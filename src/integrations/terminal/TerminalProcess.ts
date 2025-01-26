import { EventEmitter } from "events"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"

// Feature flags for command chaining functionality
const FEATURE_FLAGS = {
	// Main feature toggle
	ENABLE_SHELL_SPECIFIC_CHAINING: true,

	// Enhanced shell detection using VSCode terminal info
	USE_ENHANCED_SHELL_DETECTION: true,

	// Debug logging options
	DEBUG: {
		COMMAND_FORMATTING: true, // Basic command formatting logs
		SHELL_DETECTION: true, // Shell detection process logs
		PATTERN_MATCHING: true, // Regex pattern matching details
		GROUP_LOGS: true, // Use console.group for structured logs
	},
}

/**
 * Events emitted by the TerminalProcess
 */
export interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

// how long to wait after a process outputs anything before we consider it "cool" again
const PROCESS_HOT_TIMEOUT_NORMAL = 2_000
const PROCESS_HOT_TIMEOUT_COMPILING = 15_000

export class TerminalProcess extends EventEmitter<TerminalProcessEvents> {
	waitForShellIntegration: boolean = true
	private isListening: boolean = true
	private buffer: string = ""
	private fullOutput: string = ""
	private lastRetrievedIndex: number = 0
	isHot: boolean = false
	private hotTimer: NodeJS.Timeout | null = null

	// constructor() {
	// 	super()

	private getShellType(terminal: vscode.Terminal): "powershell" | "cmd" | "unix" {
		if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
			console.group("[Shell Detection]")
			console.log("Starting shell detection...")
			console.log("Terminal name:", terminal.name)
			console.log("Process ID:", terminal.processId)

			// Log all relevant environment variables
			console.group("Environment Variables")
			console.log("COMSPEC:", process.env.COMSPEC)
			console.log("PSModulePath:", process.env.PSModulePath)
			console.log("SHELL:", process.env.SHELL)
			console.log("TERM_PROGRAM:", process.env.TERM_PROGRAM)
			console.log("PROCESSOR_ARCHITECTURE:", process.env.PROCESSOR_ARCHITECTURE)
			console.groupEnd()
		}

		// On Windows, check environment variables first
		if (process.platform === "win32") {
			const shellPath = process.env.COMSPEC || "cmd.exe"
			const psModulePath = process.env.PSModulePath

			if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
				console.group("Windows Shell Detection")
				console.log("Shell path:", shellPath)
				console.log("PowerShell module path:", psModulePath)
				console.log(
					"Is PowerShell path check:",
					shellPath.toLowerCase().includes("powershell") || shellPath.toLowerCase().includes("pwsh"),
				)
				console.log("Is CMD path check:", shellPath.toLowerCase().includes("cmd.exe"))
				console.groupEnd()
			}

			// Check for PowerShell first - either through PSModulePath or executable name
			if (psModulePath || shellPath.toLowerCase().includes("powershell") || shellPath.toLowerCase().includes("pwsh")) {
				if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
					console.log("[Shell Detection] Detected PowerShell", {
						via: psModulePath ? "PSModulePath" : "shell path",
						path: psModulePath || shellPath,
					})
				}
				return "powershell"
			} else if (shellPath.toLowerCase().includes("cmd.exe")) {
				if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
					console.log("[Shell Detection] Detected CMD via shell path")
				}
				return "cmd"
			}
		}

		// Then try terminal name if enhanced detection is enabled
		if (FEATURE_FLAGS.USE_ENHANCED_SHELL_DETECTION) {
			const terminalName = terminal.name?.toLowerCase() || ""
			if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
				console.group("Terminal Name Detection")
				console.log("Terminal name:", terminalName)
			}

			if (process.platform === "win32") {
				// Windows-specific terminal name checks
				if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
					console.log("PowerShell check:", terminalName.includes("powershell") || terminalName.includes("pwsh"))
					console.log("CMD check:", terminalName.includes("cmd") || terminalName.includes("command"))
				}

				if (terminalName.includes("powershell") || terminalName.includes("pwsh")) {
					if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
						console.log("[Shell Detection] Detected PowerShell from terminal name")
					}
					return "powershell"
				}
				if (terminalName.includes("cmd") || terminalName.includes("command")) {
					if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
						console.log("[Shell Detection] Detected CMD from terminal name")
					}
					return "cmd"
				}
			} else {
				// Unix-specific terminal name checks
				if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
					console.log(
						"Unix shell check:",
						terminalName.includes("bash") || terminalName.includes("zsh") || terminalName.includes("sh"),
					)
				}

				if (terminalName.includes("bash") || terminalName.includes("zsh") || terminalName.includes("sh")) {
					if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
						console.log("[Shell Detection] Detected Unix shell from terminal name")
					}
					return "unix"
				}
			}

			if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
				console.groupEnd()
			}
		}

		// Fall back to Unix shell for non-Windows or if no Windows shell detected
		const unixShellPath = process.env.SHELL || "/bin/bash"
		if (FEATURE_FLAGS.DEBUG.SHELL_DETECTION) {
			console.log("[Shell Detection] Fallback shell path:", unixShellPath)
			console.groupEnd() // End the main Shell Detection group
		}

		return "unix"
	}

	/**
	 * Escapes a command string to handle spaces and special characters.
	 * If the command is already quoted, it is left unchanged.
	 * If it contains spaces or special characters, it is wrapped in quotes with proper escaping.
	 */
	private escapeCommand(cmd: string): string {
		// If the command is already quoted, leave it alone
		if (cmd.startsWith('"') && cmd.endsWith('"')) {
			return cmd
		}

		// If command contains spaces or special chars, wrap in quotes
		if (/[\s&;|<>(){}[\]`$!#%^*]/.test(cmd)) {
			// Escape any existing double quotes
			cmd = cmd.replace(/"/g, '`"')
			return `"${cmd}"`
		}

		return cmd
	}

	/**
	 * Splits a command string into an array of individual commands,
	 * properly handling quoted strings and escaped characters.
	 */
	private splitCommands(command: string): string[] {
		const commands: string[] = []
		let current = ""
		let inQuotes = false
		let escaped = false

		for (let i = 0; i < command.length; i++) {
			const char = command[i]

			if (escaped) {
				current += char
				escaped = false
				continue
			}

			if (char === "\\") {
				escaped = true
				current += char
				continue
			}

			if (char === '"') {
				inQuotes = !inQuotes
				current += char
				continue
			}

			// Check for && only when not in quotes
			if (!inQuotes && char === "&" && command[i + 1] === "&") {
				if (current.trim()) {
					commands.push(current.trim())
				}
				current = ""
				i++ // Skip next &
				continue
			}

			current += char
		}

		if (current.trim()) {
			commands.push(current.trim())
		}

		return commands
	}

	/**
	 * Transforms a command based on the shell type using proper command splitting and escaping.
	 * Handles command chaining operators:
	 * - PowerShell: Converts && to conditional execution using $?
	 * - CMD: Converts ; to &&
	 * - Unix: No transformation (supports both operators)
	 */
	private transformCommand(command: string, shellType: "powershell" | "cmd" | "unix"): string {
		if (FEATURE_FLAGS.DEBUG.PATTERN_MATCHING) {
			console.log("[Pattern Matching] Starting command transformation for shell:", shellType)
		}

		let transformedCommand = command
		switch (shellType) {
			case "powershell":
				// Split commands properly respecting quotes
				const commands = this.splitCommands(command)

				// Transform and escape each command
				transformedCommand = commands
					.map((cmd, i) => {
						const escapedCmd = this.escapeCommand(cmd)
						return i === 0 ? escapedCmd : `if ($?) { ${escapedCmd} }`
					})
					.join("; ")
				break
			case "cmd":
				// Split by ;, join with &&
				transformedCommand = command.split(/\s*;\s*/).join(" && ")
				break
			case "unix":
				// No transformation needed for unix shells
				if (FEATURE_FLAGS.DEBUG.PATTERN_MATCHING) {
					console.log("[Pattern Matching] No transformation needed for unix shell")
				}
				break
		}

		if (FEATURE_FLAGS.DEBUG.PATTERN_MATCHING && transformedCommand !== command) {
			console.log("[Pattern Matching] Command transformed:", {
				original: command,
				transformed: transformedCommand,
				shellType,
			})
		}

		return transformedCommand
	}

	/**
	 * Formats a command for the specific shell, handling command chaining operators
	 */
	private formatCommandForShell(command: string, terminal: vscode.Terminal): string {
		if (!FEATURE_FLAGS.ENABLE_SHELL_SPECIFIC_CHAINING) {
			if (FEATURE_FLAGS.DEBUG.COMMAND_FORMATTING) {
				console.log("[Command Formatting] Disabled, using original command:", command)
			}
			return command
		}

		const shellType = this.getShellType(terminal)
		const formattedCommand = this.transformCommand(command, shellType)

		if (FEATURE_FLAGS.DEBUG.COMMAND_FORMATTING) {
			if (FEATURE_FLAGS.DEBUG.GROUP_LOGS) {
				console.group("Command Transformation")
				console.log("Shell:", shellType)
				console.log("Original:", command)
				console.log("Formatted:", formattedCommand)
				console.log(
					"Operators changed:",
					formattedCommand === command ? "none" : formattedCommand.includes(";") ? "&& � ;" : "; � &&",
				)
				console.groupEnd()
			} else {
				console.log("[Command Formatting]", {
					shell: shellType,
					original: command,
					formatted: formattedCommand,
					changed: formattedCommand !== command,
				})
			}
		}

		return formattedCommand
	}

	async run(terminal: vscode.Terminal, command: string) {
		if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
			const formattedCommand = this.formatCommandForShell(command, terminal)
			const execution = terminal.shellIntegration.executeCommand(formattedCommand)
			const stream = execution.read()
			// todo: need to handle errors
			let isFirstChunk = true
			let didOutputNonCommand = false
			let didEmitEmptyLine = false
			for await (let data of stream) {
				// 1. Process chunk and remove artifacts
				if (isFirstChunk) {
					/*
					The first chunk we get from this stream needs to be processed to be more human readable, ie remove vscode's custom escape sequences and identifiers, removing duplicate first char bug, etc.
					*/

					// bug where sometimes the command output makes its way into vscode shell integration metadata
					/*
					]633 is a custom sequence number used by VSCode shell integration:
					- OSC 633 ; A ST - Mark prompt start
					- OSC 633 ; B ST - Mark prompt end
					- OSC 633 ; C ST - Mark pre-execution (start of command output)
					- OSC 633 ; D [; <exitcode>] ST - Mark execution finished with optional exit code
					- OSC 633 ; E ; <commandline> [; <nonce>] ST - Explicitly set command line with optional nonce
					*/
					// if you print this data you might see something like "eecho hello worldo hello world;5ba85d14-e92a-40c4-b2fd-71525581eeb0]633;C" but this is actually just a bunch of escape sequences, ignore up to the first ;C
					/* ddateb15026-6a64-40db-b21f-2a621a9830f0]633;CTue Sep 17 06:37:04 EDT 2024 % ]633;D;0]633;P;Cwd=/Users/saoud/Repositories/test */
					// Gets output between ]633;C (command start) and ]633;D (command end)
					const outputBetweenSequences = this.removeLastLineArtifacts(
						data.match(/\]633;C([\s\S]*?)\]633;D/)?.[1] || "",
					).trim()

					// Once we've retrieved any potential output between sequences, we can remove everything up to end of the last sequence
					// https://code.visualstudio.com/docs/terminal/shell-integration#_vs-code-custom-sequences-osc-633-st
					const vscodeSequenceRegex = /\x1b\]633;.[^\x07]*\x07/g
					const lastMatch = [...data.matchAll(vscodeSequenceRegex)].pop()
					if (lastMatch && lastMatch.index !== undefined) {
						data = data.slice(lastMatch.index + lastMatch[0].length)
					}
					// Place output back after removing vscode sequences
					if (outputBetweenSequences) {
						data = outputBetweenSequences + "\n" + data
					}
					// remove ansi
					data = stripAnsi(data)
					// Split data by newlines
					let lines = data ? data.split("\n") : []
					// Remove non-human readable characters from the first line
					if (lines.length > 0) {
						lines[0] = lines[0].replace(/[^\x20-\x7E]/g, "")
					}
					// Check if first two characters are the same, if so remove the first character
					if (lines.length > 0 && lines[0].length >= 2 && lines[0][0] === lines[0][1]) {
						lines[0] = lines[0].slice(1)
					}
					// Remove everything up to the first alphanumeric character for first two lines
					if (lines.length > 0) {
						lines[0] = lines[0].replace(/^[^a-zA-Z0-9]*/, "")
					}
					if (lines.length > 1) {
						lines[1] = lines[1].replace(/^[^a-zA-Z0-9]*/, "")
					}
					// Join lines back
					data = lines.join("\n")
					isFirstChunk = false
				} else {
					data = stripAnsi(data)
				}

				// first few chunks could be the command being echoed back, so we must ignore
				// note this means that 'echo' commands wont work
				if (!didOutputNonCommand) {
					const lines = data.split("\n")
					for (let i = 0; i < lines.length; i++) {
						if (command.includes(lines[i].trim())) {
							lines.splice(i, 1)
							i-- // Adjust index after removal
						} else {
							didOutputNonCommand = true
							break
						}
					}
					data = lines.join("\n")
				}

				// FIXME: right now it seems that data chunks returned to us from the shell integration stream contains random commas, which from what I can tell is not the expected behavior. There has to be a better solution here than just removing all commas.
				data = data.replace(/,/g, "")

				// 2. Set isHot depending on the command
				// Set to hot to stall API requests until terminal is cool again
				this.isHot = true
				if (this.hotTimer) {
					clearTimeout(this.hotTimer)
				}
				// these markers indicate the command is some kind of local dev server recompiling the app, which we want to wait for output of before sending request to cline
				const compilingMarkers = ["compiling", "building", "bundling", "transpiling", "generating", "starting"]
				const markerNullifiers = [
					"compiled",
					"success",
					"finish",
					"complete",
					"succeed",
					"done",
					"end",
					"stop",
					"exit",
					"terminate",
					"error",
					"fail",
				]
				const isCompiling =
					compilingMarkers.some((marker) => data.toLowerCase().includes(marker.toLowerCase())) &&
					!markerNullifiers.some((nullifier) => data.toLowerCase().includes(nullifier.toLowerCase()))
				this.hotTimer = setTimeout(
					() => {
						this.isHot = false
					},
					isCompiling ? PROCESS_HOT_TIMEOUT_COMPILING : PROCESS_HOT_TIMEOUT_NORMAL,
				)

				// For non-immediately returning commands we want to show loading spinner right away but this wouldnt happen until it emits a line break, so as soon as we get any output we emit "" to let webview know to show spinner
				if (!didEmitEmptyLine && !this.fullOutput && data) {
					this.emit("line", "") // empty line to indicate start of command output stream
					didEmitEmptyLine = true
				}

				this.fullOutput += data
				if (this.isListening) {
					this.emitIfEol(data)
					this.lastRetrievedIndex = this.fullOutput.length - this.buffer.length
				}
			}

			this.emitRemainingBufferIfListening()

			// for now we don't want this delaying requests since we don't send diagnostics automatically anymore (previous: "even though the command is finished, we still want to consider it 'hot' in case so that api request stalls to let diagnostics catch up")
			if (this.hotTimer) {
				clearTimeout(this.hotTimer)
			}
			this.isHot = false

			this.emit("completed")
			this.emit("continue")
		} else {
			const formattedCommand = this.formatCommandForShell(command, terminal)
			terminal.sendText(formattedCommand, true)
			// For terminals without shell integration, we can't know when the command completes
			// So we'll just emit the continue event after a delay
			this.emit("completed")
			this.emit("continue")
			this.emit("no_shell_integration")
			// setTimeout(() => {
			// 	console.log(`Emitting continue after delay for terminal`)
			// 	// can't emit completed since we don't if the command actually completed, it could still be running server
			// }, 500) // Adjust this delay as needed
		}
	}

	// Inspired by https://github.com/sindresorhus/execa/blob/main/lib/transform/split.js
	private emitIfEol(chunk: string) {
		this.buffer += chunk
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			let line = this.buffer.slice(0, lineEndIndex).trimEnd() // removes trailing \r
			// Remove \r if present (for Windows-style line endings)
			// if (line.endsWith("\r")) {
			// 	line = line.slice(0, -1)
			// }
			this.emit("line", line)
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}
	}

	private emitRemainingBufferIfListening() {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.removeLastLineArtifacts(this.buffer)
			if (remainingBuffer) {
				this.emit("line", remainingBuffer)
			}
			this.buffer = ""
			this.lastRetrievedIndex = this.fullOutput.length
		}
	}

	continue() {
		this.emitRemainingBufferIfListening()
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	getUnretrievedOutput(): string {
		const unretrieved = this.fullOutput.slice(this.lastRetrievedIndex)
		this.lastRetrievedIndex = this.fullOutput.length
		return this.removeLastLineArtifacts(unretrieved)
	}

	// some processing to remove artifacts like '%' at the end of the buffer (it seems that since vsode uses % at the beginning of newlines in terminal, it makes its way into the stream)
	// This modification will remove '%', '$', '#', or '>' followed by optional whitespace
	removeLastLineArtifacts(output: string) {
		const lines = output.trimEnd().split("\n")
		if (lines.length > 0) {
			const lastLine = lines[lines.length - 1]
			// Remove prompt characters and trailing whitespace from the last line
			lines[lines.length - 1] = lastLine.replace(/[%$#>]\s*$/, "")
		}
		return lines.join("\n").trimEnd()
	}
}

export type TerminalProcessResultPromise = TerminalProcess & Promise<void>

// Similar to execa's ResultPromise, this lets us create a mixin of both a TerminalProcess and a Promise: https://github.com/sindresorhus/execa/blob/main/lib/methods/promise.js
export function mergePromise(process: TerminalProcess, promise: Promise<void>): TerminalProcessResultPromise {
	const nativePromisePrototype = (async () => {})().constructor.prototype
	const descriptors = ["then", "catch", "finally"].map(
		(property) => [property, Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)] as const,
	)
	for (const [property, descriptor] of descriptors) {
		if (descriptor) {
			const value = descriptor.value.bind(promise)
			Reflect.defineProperty(process, property, { ...descriptor, value })
		}
	}
	return process as TerminalProcessResultPromise
}
