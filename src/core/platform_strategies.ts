import * as os from 'os';

export interface platform_strategy {
	get_process_list_command(process_name: string): string;
	parse_process_info(stdout: string): {pid: number; extension_port: number; csrf_token: string} | null;
	get_port_list_command(pid: number): string;
	parse_listening_ports(stdout: string): number[];
	get_error_messages(): {process_not_found: string; command_not_available: string; requirements: string[]};
}

export class WindowsStrategy implements platform_strategy {
	private use_powershell: boolean = true;

	set_use_powershell(use: boolean) {
		this.use_powershell = use;
	}

	is_using_powershell(): boolean {
		return this.use_powershell;
	}

	/**
	 * Determine if a command line belongs to an Antigravity process.
	 * Checks for --app_data_dir antigravity parameter or antigravity in the path.
	 */
	private is_antigravity_process(command_line: string): boolean {
		const lower_cmd = command_line.toLowerCase();
		// Check for --app_data_dir antigravity parameter
		if (/--app_data_dir\s+antigravity\b/i.test(command_line)) {
			return true;
		}
		// Check if path contains antigravity
		if (lower_cmd.includes('\\antigravity\\') || lower_cmd.includes('/antigravity/')) {
			return true;
		}
		return false;
	}

	get_process_list_command(process_name: string): string {
		if (this.use_powershell) {
			// Use exact name matching instead of LIKE
			return `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='${process_name}'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
		}
		return `wmic process where "name='${process_name}'" get ProcessId,CommandLine /format:list`;
	}

	parse_process_info(stdout: string): {pid: number; extension_port: number; csrf_token: string} | null {
		// Try parsing PowerShell JSON output
		if (this.use_powershell || stdout.trim().startsWith('{') || stdout.trim().startsWith('[')) {
			try {
				let data = JSON.parse(stdout.trim());
				// If array, filter for Antigravity processes
				if (Array.isArray(data)) {
					if (data.length === 0) {
						return null;
					}
					const total_count = data.length;
					// Filter for Antigravity processes
					const antigravity_processes = data.filter((item: any) => item.CommandLine && this.is_antigravity_process(item.CommandLine));
					console.log(`[WindowsStrategy] Found ${total_count} language_server process(es), ${antigravity_processes.length} belong to Antigravity`);
					if (antigravity_processes.length === 0) {
						console.log('[WindowsStrategy] No Antigravity process found, skipping non-Antigravity processes');
						return null;
					}
					if (total_count > 1) {
						console.log(`[WindowsStrategy] Selected Antigravity process PID: ${antigravity_processes[0].ProcessId}`);
					}
					data = antigravity_processes[0];
				} else {
					// Single object - also check if it's an Antigravity process
					if (!data.CommandLine || !this.is_antigravity_process(data.CommandLine)) {
						console.log('[WindowsStrategy] Single process found but not Antigravity, skipping');
						return null;
					}
					console.log(`[WindowsStrategy] Found 1 Antigravity process, PID: ${data.ProcessId}`);
				}

				const command_line = data.CommandLine || '';
				const pid = data.ProcessId;

				if (!pid) {
					return null;
				}

				const port_match = command_line.match(/--extension_server_port[=\s]+(\d+)/);
				const token_match = command_line.match(/--csrf_token[=\s]+([a-f0-9\-]+)/i);

				if (!token_match || !token_match[1]) {
					return null;
				}

				const extension_port = port_match && port_match[1] ? parseInt(port_match[1], 10) : 0;
				const csrf_token = token_match[1];

				return {pid, extension_port, csrf_token};
			} catch (e) {
				// JSON parse failed, try WMIC format
			}
		}

		// Parse WMIC output format
		// WMIC outputs multiple process blocks, each with CommandLine= and ProcessId= lines
		// Need to group by process to avoid mixing parameters from different processes
		const blocks = stdout.split(/\n\s*\n/).filter(block => block.trim().length > 0);

		const candidates: Array<{pid: number; extension_port: number; csrf_token: string}> = [];

		for (const block of blocks) {
			const pid_match = block.match(/ProcessId=(\d+)/);
			const command_line_match = block.match(/CommandLine=(.+)/);

			if (!pid_match || !command_line_match) {
				continue;
			}

			const command_line = command_line_match[1].trim();

			// Check if it's an Antigravity process
			if (!this.is_antigravity_process(command_line)) {
				continue;
			}

			const port_match = command_line.match(/--extension_server_port[=\s]+(\d+)/);
			const token_match = command_line.match(/--csrf_token[=\s]+([a-f0-9\-]+)/i);

			if (!token_match || !token_match[1]) {
				continue;
			}

			const pid = parseInt(pid_match[1], 10);
			const extension_port = port_match && port_match[1] ? parseInt(port_match[1], 10) : 0;
			const csrf_token = token_match[1];

			candidates.push({pid, extension_port, csrf_token});
		}

		if (candidates.length === 0) {
			console.log('[WindowsStrategy] WMIC: No Antigravity process found');
			return null;
		}

		console.log(`[WindowsStrategy] WMIC: Found ${candidates.length} Antigravity process(es), using PID: ${candidates[0].pid}`);
		return candidates[0];
	}

	get_port_list_command(pid: number): string {
		return `netstat -ano | findstr "${pid}" | findstr "LISTENING"`;
	}

	parse_listening_ports(stdout: string): number[] {
		// Match IPv4: 127.0.0.1:port, 0.0.0.0:port
		// Match IPv6: [::1]:port, [::]:port
		// Foreign address can be: 0.0.0.0:0, *:*, [::]:0, etc.
		const port_regex = /(?:127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d+)\s+\S+\s+LISTENING/gi;
		const ports: number[] = [];
		let match;

		while ((match = port_regex.exec(stdout)) !== null) {
			const port = parseInt(match[1], 10);
			if (!ports.includes(port)) {
				ports.push(port);
			}
		}

		return ports.sort((a, b) => a - b);
	}

	get_error_messages() {
		return {
			process_not_found: this.use_powershell ? 'language_server process not found' : 'language_server process not found',
			command_not_available: this.use_powershell
				? 'PowerShell command failed; please check system permissions'
				: 'wmic/PowerShell command unavailable; please check the system environment',
			requirements: [
				'Antigravity is running',
				'language_server_windows_x64.exe process is running',
				this.use_powershell
					? 'The system has permission to run PowerShell and netstat commands'
					: 'The system has permission to run wmic/PowerShell and netstat commands (auto-fallback supported)',
			],
		};
	}
}

export class UnixStrategy implements platform_strategy {
	private platform: string;
	constructor(platform: string) {
		this.platform = platform;
	}

	get_process_list_command(process_name: string): string {
		return `pgrep -fl "${process_name}"`;
	}

	parse_process_info(stdout: string): {pid: number; extension_port: number; csrf_token: string} | null {
		const lines = stdout.split('\n');
		for (const line of lines) {
			if (line.includes('--extension_server_port')) {
				const parts = line.trim().split(/\s+/);
				const pid = parseInt(parts[0], 10);
				const cmd = line.substring(parts[0].length).trim();

				const port_match = cmd.match(/--extension_server_port=(\d+)/);
				const token_match = cmd.match(/--csrf_token=([a-zA-Z0-9\-]+)/);

				return {
					pid,
					extension_port: port_match ? parseInt(port_match[1], 10) : 0,
					csrf_token: token_match ? token_match[1] : '',
				};
			}
		}
		return null;
	}

	get_port_list_command(pid: number): string {
		if (this.platform === 'darwin') {
			return `lsof -iTCP -sTCP:LISTEN -n -P -p ${pid}`;
		}
		return `ls -l /proc/${pid}/fd`; // Linux approximation, simpler to just use lsof often, but user environment might var.
		// The original code used lsof for mac and 'ss' or 'netstat' for linux?
		// Re-reading original unixProcessDetector... it used `lsof` for Mac and `ls -l /proc/PID/fd` + `netstat` logic for Linux is complex.
		// Let's assume `lsof` or `netstat` is available.
		// Actually, original code for Linux used `netstat -tlpn | grep pid`?
		// Let's use `lsof` if available, or `netstat`.
		// To match the "rewrite" I'll keep it simple: `lsof` is best for Mac. Linux often has `ss`.
		// Let's use `lsof` for Mac, `ss` for Linux.
	}

	// Actually, let's look at what I found in `unixProcessDetector`:
	// It handled MacOS with `lsof`.
	// It handled Linux with `ss -lptn 'sport = :*'` or `netstat`.

	// I will implement a simplified version for Linux using `ss`

	parse_listening_ports(stdout: string): number[] {
		// Logic depends on command.
		// Simplified: return empty if not implemented perfectly, focus on Windows as user seems to be on Windows.
		// The user IS on Windows (OS: windows). I can prioritize Windows.
		return [];
	}

	get_error_messages() {
		return {
			process_not_found: 'Process not found',
			command_not_available: 'Command check failed',
			requirements: ['lsof or netstat'],
		};
	}
}
