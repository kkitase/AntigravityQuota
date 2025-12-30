/**
 * Status Bar UI Manager
 */

import * as vscode from 'vscode';
import {quota_snapshot, model_quota_info} from '../utils/types';
import {localization} from '../utils/localization';

/** Mapping of model labels to short abbreviations for status bar display */
const MODEL_ABBREVIATIONS: Record<string, string> = {
	'Gemini 3 Pro (High)': 'Gemini 3 Pro (H)',
	'Gemini 3 Pro (Low)': 'Gemini 3 Pro (L)',
	'Gemini 3 Flash': 'Gemini 3 Flash',
	'Claude Sonnet 4.5': 'Claude S4.5',
	'Claude Sonnet 4.5 (Thinking)': 'Claude S4.5T',
	'Claude Opus 4.5 (Thinking)': 'Claude O4.5T',
	'GPT-OSS 120B (Medium)': 'GPT-OSS (M)',
};

/** Get short abbreviation for a model label */
function get_abbreviation(label: string): string {
	if (MODEL_ABBREVIATIONS[label]) {
		return MODEL_ABBREVIATIONS[label];
	}
	// Fallback: generate abbreviation from first letters of words + numbers
	return label
		.split(/[\s\-_()]+/)
		.filter(Boolean)
		.map(word => {
			// If word contains numbers, keep them
			const match = word.match(/^([A-Za-z]?)(.*)$/);
			if (match) {
				return match[1].toUpperCase() + (word.match(/\d+/) || [''])[0];
			}
			return word[0]?.toUpperCase() || '';
		})
		.join('')
		.slice(0, 5);
}

export class StatusBarManager {
	private item: vscode.StatusBarItem;
	private last_snapshot: quota_snapshot | undefined;

	constructor() {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.item.command = 'agq.show_menu';
		this.item.text = '$(rocket) AGQ';
		this.item.show();
	}

	show_loading() {
		this.item.text = '$(sync~spin) AGQ';
		this.item.show();
	}

	show_error(msg: string) {
		this.item.text = '$(error) AGQ';
		this.item.tooltip = msg;
		this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		this.item.show();
	}

	update(snapshot: quota_snapshot, show_credits: boolean) {
		this.last_snapshot = snapshot;

		const pinned = this.get_pinned_models();
		const parts: string[] = [];

		// Filter models to only show pinned ones
		const pinned_models = snapshot.models.filter(m => pinned.includes(m.model_id));

		if (pinned_models.length === 0 && !show_credits) {
			// Show default text if nothing is pinned
			this.item.text = '$(rocket) AGQ';
		} else {
			for (const m of pinned_models) {
				const pct = m.remaining_percentage !== undefined ? `${m.remaining_percentage.toFixed(0)}%` : 'N/A';
				const status_icon = m.is_exhausted ? '$(error)' : m.remaining_percentage !== undefined && m.remaining_percentage < 20 ? '$(warning)' : '$(check)';
				const abbrev = get_abbreviation(m.label);
				parts.push(`${status_icon} ${abbrev}: ${pct}`);
			}

			this.item.text = parts.length > 0 ? parts.join('  ') : '$(rocket) AGQ';
		}

		// Build detailed tooltip
		this.item.tooltip = this.build_tooltip(snapshot);
		this.item.backgroundColor = undefined;
		this.item.show();
	}

	show_menu() {
		const pick = vscode.window.createQuickPick();
		
		// タイトルは常にAntigravity Quotaに設定
		pick.title = 'Antigravity Quota';
		
		pick.placeholder = localization.t('menu_placeholder');
		pick.matchOnDescription = false;
		pick.matchOnDetail = false;
		pick.canSelectMany = false;

		pick.items = this.build_menu_items();

		// Track the currently active (hovered/highlighted) item
		let currentActiveItem: vscode.QuickPickItem | undefined;

		// Capture the active item immediately when it changes (on hover/keyboard)
		pick.onDidChangeActive(items => {
			currentActiveItem = items[0];
		});

		// Action the tracked item when user accepts (click/Enter)
		pick.onDidAccept(async () => {
			if (currentActiveItem) {
				const item = currentActiveItem as any;
				if (item.action === 'refresh') {
					vscode.commands.executeCommand('agq.refresh');
					pick.hide();
				} else if (item.action === 'settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', '@ext:henrikdev.ag-quota');
					pick.hide();
				} else if (item.model_id) {
					await this.toggle_pinned_model(item.model_id);
					// Refresh the menu items to reflect the change
					pick.items = this.build_menu_items();
					// Update status bar immediately if we have a snapshot
					if (this.last_snapshot) {
						const config = vscode.workspace.getConfiguration('agq');
						this.update(this.last_snapshot, !!config.get('showPromptCredits'));
					}
				}
			}
		});

		pick.onDidHide(() => {
			pick.dispose();
		});

		pick.show();
	}

	private get_pinned_models(): string[] {
		const config = vscode.workspace.getConfiguration('agq');
		return config.get<string[]>('pinnedModels') || [];
	}

	private async toggle_pinned_model(model_id: string): Promise<void> {
		const config = vscode.workspace.getConfiguration('agq');
		const pinned = [...(config.get<string[]>('pinnedModels') || [])];

		const index = pinned.indexOf(model_id);
		if (index >= 0) {
			pinned.splice(index, 1);
		} else {
			pinned.push(model_id);
		}

		await config.update('pinnedModels', pinned, vscode.ConfigurationTarget.Global);
	}

	private build_menu_items(): vscode.QuickPickItem[] {
		const items: vscode.QuickPickItem[] = [];
		const snapshot = this.last_snapshot;
		const pinned = this.get_pinned_models();

		// Actions
		const refreshItem: vscode.QuickPickItem & {action?: string} = {
			label: localization.t('menu_refresh'),
		};
		refreshItem.action = 'refresh';
		items.push(refreshItem);

		const settingsItem: vscode.QuickPickItem & {action?: string} = {
			label: localization.t('menu_open_settings'),
		};
		settingsItem.action = 'settings';
		items.push(settingsItem);

		items.push({
			label: '',
			kind: vscode.QuickPickItemKind.Separator
		});

		// モデル選択の説明を追加
		items.push({
			label: localization.t('menu_instruction'),
			description: '',
			kind: vscode.QuickPickItemKind.Separator
		});

		// 区切り線を追加
		items.push({
			label: '─'.repeat(50),
			kind: vscode.QuickPickItemKind.Separator
		});

		items.push({label: localization.t('menu_model_quotas'), kind: vscode.QuickPickItemKind.Separator});

	if (snapshot && snapshot.models.length > 0) {
		// モデルの順序定義
		const model_order = [
			'Gemini 3 Pro (High)',
			'Gemini 3 Pro (Low)',
			'Gemini 3 Flash',
			'Claude Sonnet 4.5',
			'Claude Sonnet 4.5 (Thinking)',
			'Claude Opus 4.5 (Thinking)',
			'GPT-OSS 120B (Medium)'
		];
		
		// マップを作成
		const model_map = new Map<string, typeof snapshot.models[0]>();
		for (const m of snapshot.models) {
			model_map.set(m.label, m);
		}
		
		// 指定順序で追加
		for (const label of model_order) {
			const m = model_map.get(label);
			if (m) {
				const pct = m.remaining_percentage ?? 0;
				const bar = this.draw_progress_bar(pct);
				const is_pinned = pinned.includes(m.model_id);

				// Use checkmark to show if model is selected for status bar
				const selection_icon = is_pinned ? '$(check)' : '$(circle-outline)';
				// Show quota status separately
				const status_icon = m.is_exhausted ? '$(error)' : pct < 20 ? '$(warning)' : '';

				const item: vscode.QuickPickItem & {model_id?: string} = {
					label: `${selection_icon} ${status_icon ? status_icon + ' ' : ''}${m.label}`,
					description: `${bar} ${pct.toFixed(1)}%`,
					detail: `    ${localization.t('resets_in')}: ${m.time_until_reset_formatted}`,
				};

				// Attach model_id for click handling
				(item as any).model_id = m.model_id;
				items.push(item);
			}
		}
		
		// 順序に含まれていないモデルも追加
		for (const m of snapshot.models) {
			if (!model_order.includes(m.label)) {
				const pct = m.remaining_percentage ?? 0;
				const bar = this.draw_progress_bar(pct);
				const is_pinned = pinned.includes(m.model_id);

				const selection_icon = is_pinned ? '$(check)' : '$(circle-outline)';
				const status_icon = m.is_exhausted ? '$(error)' : pct < 20 ? '$(warning)' : '';

				const item: vscode.QuickPickItem & {model_id?: string} = {
					label: `${selection_icon} ${status_icon ? status_icon + ' ' : ''}${m.label}`,
					description: `${bar} ${pct.toFixed(1)}%`,
					detail: `    ${localization.t('resets_in')}: ${m.time_until_reset_formatted}`,
				};

				(item as any).model_id = m.model_id;
				items.push(item);
			}
		}
	} else {
			items.push({
				label: `$(info) ${localization.t('menu_no_model_data')}`,
				description: localization.t('menu_waiting_quota'),
			});
		}

		// Commented out until used (if ever)
		/*if (snapshot?.prompt_credits) {
			const pc = snapshot.prompt_credits;
			const bar = this.draw_progress_bar(pc.remaining_percentage);

			items.push({label: '', kind: vscode.QuickPickItemKind.Separator});
			items.push({label: 'Prompt Credits (Not activly used)', kind: vscode.QuickPickItemKind.Separator});
			items.push({
				label: `$(credit-card) ${pc.available.toLocaleString()} / ${pc.monthly.toLocaleString()}`,
				description: `${bar} ${pc.remaining_percentage.toFixed(1)}%`,
			});
		}*/

		return items;
	}

	private draw_progress_bar(percentage: number): string {
		const total = 10;
		const filled = Math.round((percentage / 100) * total);
		const empty = total - filled;
		return '▓'.repeat(filled) + '░'.repeat(empty);
	}

	private build_tooltip(snapshot: quota_snapshot): string {
		const lines: string[] = [];
		
		// ユーザー名
		if (snapshot.user_name) {
			lines.push(snapshot.user_name);
		}
		
		// Email
		if (snapshot.email) {
			lines.push(snapshot.email);
		}
		
		// プラン名
		if (snapshot.plan_name) {
			lines.push(`${localization.t('plan')}: ${snapshot.plan_name}`);
		}
		
		// 最終更新時刻
		const update_time = snapshot.timestamp.toLocaleString(localization.get_language() === 'ja' ? 'ja-JP' : 'en-US');
		lines.push(`${localization.t('last_updated')}: ${update_time}`);
		
		// 区切り線を追加
		if (lines.length > 0) {
			lines.push('─'.repeat(30));
		}
		
		// モデルの順序定義
		const model_order = [
			'Gemini 3 Pro (High)',
			'Gemini 3 Pro (Low)',
			'Gemini 3 Flash',
			'Claude Sonnet 4.5',
			'Claude Sonnet 4.5 (Thinking)',
			'Claude Opus 4.5 (Thinking)',
			'GPT-OSS 120B (Medium)'
		];
		
		// 全モデルのクォータ情報を指定順序で表示
		if (snapshot.models.length > 0) {
			// マップを作成
			const model_map = new Map<string, typeof snapshot.models[0]>();
			for (const m of snapshot.models) {
				model_map.set(m.label, m);
			}
			
			// 指定順序で追加
			for (const label of model_order) {
				const m = model_map.get(label);
				if (m) {
					const pct = m.remaining_percentage !== undefined ? `${m.remaining_percentage.toFixed(0)}%` : 'N/A';
					lines.push(`${m.label}: ${pct} -- ⏳ ${m.time_until_reset_formatted}`);
				}
			}
			
			// 順序に含まれていないモデルも追加
			for (const m of snapshot.models) {
				if (!model_order.includes(m.label)) {
					const pct = m.remaining_percentage !== undefined ? `${m.remaining_percentage.toFixed(0)}%` : 'N/A';
					lines.push(`${m.label}: ${pct} -- ⏳ ${m.time_until_reset_formatted}`);
				}
			}
		}
		lines.push(localization.t('click_to_configure'));
		
		return lines.join('\n');
	}

	dispose() {
		this.item.dispose();
	}
}
