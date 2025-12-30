/**
 * Config Manager Service
 */

import * as vscode from 'vscode';
import {config_options} from '../utils/types';
import {localization} from '../utils/localization';

export class ConfigManager {
	private readonly config_key = 'agq';

	/**
	 * Get full config
	 */
	get_config(): config_options {
		const config = vscode.workspace.getConfiguration(this.config_key);
		let lang = config.get<'ja' | 'en' | 'auto'>('language', 'auto');
		
		if (lang === 'auto') {
			lang = vscode.env.language.startsWith('ja') ? 'ja' : 'en';
		}
		
		// Apply language to localization service (types will be ja | en here)
		localization.set_language(lang as 'ja' | 'en');

		return {
			enabled: config.get<boolean>('enabled', true),
			polling_interval: Math.max(30, config.get<number>('pollingInterval', 120)) * 1000,
			show_prompt_credits: config.get<boolean>('showPromptCredits', false),
			language: lang,
		};
	}

	/**
	 * Listen to config changes
	 */
	on_config_change(callback: (config: config_options) => void): vscode.Disposable {
		return vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(this.config_key)) {
				const new_config = this.get_config();
				callback(new_config);
			}
		});
	}
}
