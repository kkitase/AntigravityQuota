export type Language = 'ja' | 'en';

export interface LocalizationResources {
	// QuotaManager
	json_parse_failed: string;
	request_timeout: string;
	quota_fetch_error: string;
	ready: string;
	minutes: string;
	hours: string;
	resets_in: string;

	// PlatformStrategies
	not_antigravity: string;
	process_empty: string;
	pid_not_found: string;
	requirement_antigravity_running: string;
	requirement_process_running: string;
	requirement_powershell_permission: string;
	requirement_wmic_permission: string;

	// UI (StatusBar)
	tooltip_details: string;
	menu_placeholder: string;
	menu_user_info: string;
	menu_model_quotas: string;
	menu_no_model_data: string;
	menu_waiting_quota: string;
	plan: string;
	last_updated: string;
	menu_instruction: string;
	click_to_configure: string;

	// Extension
	extension_activating: string;
	manual_refresh: string;
	refreshing_quota: string;
	already_active: string;
	manual_activation: string;
	reconnect_triggered: string;
	reconnecting: string;
	logs_opened: string;
	initialization_successful: string;
	process_not_found: string;
	troubleshooting_title: string;
	troubleshooting_step1: string;
	troubleshooting_step2: string;
	troubleshooting_step3: string;
	troubleshooting_step4: string;
	status_bar_process_not_found: string;
	error_dialog_process_not_found: string;
	show_logs_action: string;
}

const resources: Record<Language, LocalizationResources> = {
	ja: {
		json_parse_failed: 'レスポンスの JSON 解析に失敗しました',
		request_timeout: 'リクエストがタイムアウトしました',
		quota_fetch_error: 'クォータ取得エラー:',
		ready: '準備完了',
		minutes: '分',
		hours: '時間',
		resets_in: 'リセットまで',

		not_antigravity: 'プロセスは Antigravity ではありません',
		process_empty: 'プロセスが空です - 言語サーバーのプロセスが見つかりませんでした',
		pid_not_found: 'プロセスデータの中に PID が見つかりませんでした',
		requirement_antigravity_running: 'Antigravity が起動していること',
		requirement_process_running: 'language_server プロセスが実行されていること',
		requirement_powershell_permission: 'システムに PowerShell コマンドを実行する権限があること',
		requirement_wmic_permission: 'システムに wmic/PowerShell および netstat コマンドを実行する権限があること',

		tooltip_details: 'クリックして Antigravity Quota の詳細を表示',
		menu_placeholder: 'ステータスバーでの表示/非表示を切り替えるモデルを選択してください',
		menu_user_info: 'ユーザー情報',
		menu_model_quotas: 'モデルごとのクォータ利用状況',
		menu_no_model_data: 'モデルデータがありません',
		menu_waiting_quota: 'クォータ情報の取得を待機中...',
		plan: 'プラン',
		last_updated: '最終更新',
		menu_instruction: 'ステータスバーに表示するモデルを選択',
		click_to_configure: 'クリックしてモデル表示を設定',

		extension_activating: 'Antigravity Quota を起動中',
		manual_refresh: '手動更新が実行されました',
		refreshing_quota: 'クォータ情報を更新中...',
		already_active: 'AGQ はすでに有効です',
		manual_activation: '手動起動が実行されました',
		reconnect_triggered: '再接続がトリガーされました',
		reconnecting: 'Antigravity プロセスに再接続しています...',
		logs_opened: 'デバッグログパネルが開かれました',
		initialization_successful: '初期化に成功しました',
		process_not_found: 'Antigravity プロセスが見つかりませんでした',
		troubleshooting_title: 'トラブルシューティング:',
		troubleshooting_step1: 'Antigravity 拡張機能がインストールされ、有効になっているか確認してください',
		troubleshooting_step2: 'language_server プロセスが実行中か確認してください',
		troubleshooting_step3: 'VS Code をリロードしてみてください',
		troubleshooting_step4: '出力パネルを開き、"Antigravity Quota" を選択して詳細なログを確認してください',
		status_bar_process_not_found: 'Antigravity プロセスが見つかりません',
		error_dialog_process_not_found: 'Antigravity プロセスを見つけることができませんでした。実行されているか確認してください。',
		show_logs_action: 'ログを表示',
	},
	en: {
		json_parse_failed: 'Invalid JSON response',
		request_timeout: 'Request timeout',
		quota_fetch_error: 'Quota fetch error:',
		ready: 'Ready',
		minutes: 'm',
		hours: 'h',
		resets_in: 'Resets in',

		not_antigravity: 'Process is NOT Antigravity',
		process_empty: 'Empty process array - no language_server processes found',
		pid_not_found: 'No PID found in process data',
		requirement_antigravity_running: 'Antigravity is running',
		requirement_process_running: 'language_server process is running',
		requirement_powershell_permission: 'The system has permission to run PowerShell commands',
		requirement_wmic_permission: 'The system has permission to run wmic/PowerShell and netstat commands',

		tooltip_details: 'Click to view Antigravity Quota details',
		menu_placeholder: 'Click a model to toggle its visibility in the status bar',
		menu_user_info: 'User Information',
		menu_model_quotas: 'Model Quotas',
		menu_no_model_data: 'No model data',
		menu_waiting_quota: 'Waiting for quota info...',
		plan: 'Plan',
		last_updated: 'Last updated',
		menu_instruction: 'Select models to display in status bar',
		click_to_configure: 'Click to configure model display',

		extension_activating: 'Antigravity Quota Activating',
		manual_refresh: 'Manual refresh triggered',
		refreshing_quota: 'Refreshing Quota...',
		already_active: 'AGQ is already active',
		manual_activation: 'Manual activation triggered',
		reconnect_triggered: 'Reconnect triggered',
		reconnecting: 'Reconnecting to Antigravity process...',
		logs_opened: 'Debug log panel opened',
		initialization_successful: 'Initialization successful',
		process_not_found: 'Antigravity process not found',
		troubleshooting_title: 'Troubleshooting tips:',
		troubleshooting_step1: 'Make sure Antigravity extension is installed and enabled',
		troubleshooting_step2: 'Check if the language_server process is running',
		troubleshooting_step3: 'Try reloading VS Code',
		troubleshooting_step4: 'Open "Output" panel and select "Antigravity Quota" for detailed logs',
		status_bar_process_not_found: 'Antigravity process not found',
		error_dialog_process_not_found: 'Could not find Antigravity process. Is it running?',
		show_logs_action: 'Show Logs',
	},
};

class LocalizationService {
	private current_language: Language = 'en';

	set_language(lang: Language) {
		this.current_language = lang;
	}

	get_language(): Language {
		return this.current_language;
	}

	t(key: keyof LocalizationResources): string {
		return resources[this.current_language][key];
	}
}

export const localization = new LocalizationService();
