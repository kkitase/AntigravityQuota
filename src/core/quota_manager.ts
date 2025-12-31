/**
 * Quota Manager Service
 */

import * as https from 'https';
import {quota_snapshot, model_quota_info, prompt_credits_info, server_user_status_response} from '../utils/types';
import {localization} from '../utils/localization';

export class QuotaManager {
	private port: number = 0;
	private csrf_token: string = '';

	private update_callback?: (snapshot: quota_snapshot) => void;
	private error_callback?: (error: Error) => void;
	private reconnect_callback?: () => void;
	private polling_timer?: NodeJS.Timeout;

	// 連続エラーカウンター（再接続トリガー用）
	private consecutive_error_count: number = 0;
	private static readonly MAX_CONSECUTIVE_ERRORS = 3;
	private static readonly MAX_REQUEST_RETRIES = 2;

	constructor() {}

	init(port: number, csrf_token: string) {
		this.port = port;
		this.csrf_token = csrf_token;
		// 接続成功時にエラーカウンターをリセット
		this.consecutive_error_count = 0;
	}

	private request<T>(path: string, body: object): Promise<T> {
		return new Promise((resolve, reject) => {
			const data = JSON.stringify(body);
			const options: https.RequestOptions = {
				hostname: '127.0.0.1',
				port: this.port,
				path,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(data),
					'Connect-Protocol-Version': '1',
					'X-Codeium-Csrf-Token': this.csrf_token,
				},
				rejectUnauthorized: false,
				timeout: 5000,
			};

			const req = https.request(options, res => {
				let body = '';
				res.on('data', chunk => (body += chunk));
				res.on('end', () => {
					try {
						resolve(JSON.parse(body) as T);
					} catch {
						reject(new Error(localization.t('json_parse_failed')));
					}
				});
			});

			req.on('error', reject);
			req.on('timeout', () => {
				req.destroy();
				reject(new Error(localization.t('request_timeout')));
			});

			req.write(data);
			req.end();
		});
	}

	on_update(callback: (snapshot: quota_snapshot) => void) {
		this.update_callback = callback;
	}

	on_error(callback: (error: Error) => void) {
		this.error_callback = callback;
	}

	/** 再接続が必要になった場合に呼ばれるコールバックを設定 */
	on_reconnect_needed(callback: () => void) {
		this.reconnect_callback = callback;
	}

	start_polling(interval_ms: number) {
		this.stop_polling();
		this.fetch_quota();
		this.polling_timer = setInterval(() => this.fetch_quota(), interval_ms);
	}

	stop_polling() {
		if (this.polling_timer) {
			clearInterval(this.polling_timer);
			this.polling_timer = undefined;
		}
	}

	async fetch_quota() {
		let last_error: Error | null = null;

		// リトライ処理
		for (let attempt = 0; attempt < QuotaManager.MAX_REQUEST_RETRIES; attempt++) {
			try {
				const data = await this.request<server_user_status_response>('/exa.language_server_pb.LanguageServerService/GetUserStatus', {
					metadata: {
						ideName: 'antigravity',
						extensionName: 'antigravity',
						locale: localization.get_language(),
					},
				});

				const snapshot = this.parse_response(data);

				// 成功時にエラーカウンターをリセット
				this.consecutive_error_count = 0;

				if (this.update_callback) {
					this.update_callback(snapshot);
				}
				return;
			} catch (error: any) {
				last_error = error;
				console.error(localization.t('quota_fetch_error'), `Attempt ${attempt + 1}: ${error.message}`);

				// リトライ前に少し待機
				if (attempt < QuotaManager.MAX_REQUEST_RETRIES - 1) {
					await new Promise(r => setTimeout(r, 500));
				}
			}
		}

		// 全リトライ失敗
		this.consecutive_error_count++;

		if (this.error_callback && last_error) {
			this.error_callback(last_error);
		}

		// 連続エラーが閾値を超えた場合、再接続をトリガー
		if (this.consecutive_error_count >= QuotaManager.MAX_CONSECUTIVE_ERRORS) {
			console.error(`Consecutive errors reached ${this.consecutive_error_count}, triggering reconnect`);
			this.consecutive_error_count = 0; // リセットして再接続を待つ
			if (this.reconnect_callback) {
				this.reconnect_callback();
			}
		}
	}

	private parse_response(data: server_user_status_response): quota_snapshot {
		const user_status = data.userStatus;
		const plan_info = user_status.planStatus?.planInfo;
		const available_credits = user_status.planStatus?.availablePromptCredits;

		// ユーザー名、email、プラン名を取得
		const user_name = user_status.name;
		const email = user_status.email;
		const plan_name = plan_info?.planName;

		let prompt_credits: prompt_credits_info | undefined;

		if (plan_info && available_credits !== undefined) {
			const monthly = Number(plan_info.monthlyPromptCredits);
			const available = Number(available_credits);
			if (monthly > 0) {
				prompt_credits = {
					available,
					monthly,
					used_percentage: ((monthly - available) / monthly) * 100,
					remaining_percentage: (available / monthly) * 100,
				};
			}
		}

		const raw_models = user_status.cascadeModelConfigData?.clientModelConfigs || [];
		const models: model_quota_info[] = raw_models
			.filter((m: any) => m.quotaInfo)
			.map((m: any) => {
				const reset_time = new Date(m.quotaInfo.resetTime);
				const now = new Date();
				const diff = reset_time.getTime() - now.getTime();

				return {
					label: m.label,
					model_id: m.modelOrAlias?.model || 'unknown',
					remaining_fraction: m.quotaInfo.remainingFraction,
					remaining_percentage: m.quotaInfo.remainingFraction !== undefined ? m.quotaInfo.remainingFraction * 100 : undefined,
					is_exhausted: m.quotaInfo.remainingFraction === 0,
					reset_time: reset_time,
					time_until_reset: diff,
					time_until_reset_formatted: this.format_time(diff, reset_time),
				};
			});

		return {
			timestamp: new Date(),
			user_name,
			email,
			plan_name,
			prompt_credits,
			models,
		};
	}

	private format_time(ms: number, reset_time: Date): string {
		if (ms <= 0) return localization.t('ready');

		const total_mins = Math.ceil(ms / 60000);
		const hours = Math.floor(total_mins / 60);
		const mins = total_mins % 60;

		if (hours > 0) {
			return `${hours}h ${mins.toString().padStart(2, '0')}m`;
		} else {
			return `${mins}m`;
		}
	}
}
