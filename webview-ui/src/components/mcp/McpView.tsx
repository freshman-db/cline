import { VSCodeButton, VSCodeLink, VSCodePanels, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { vscode } from "../../utils/vscode"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { McpServer } from "../../../../src/shared/mcp"
import McpToolRow from "./McpToolRow"
import McpResourceRow from "./McpResourceRow"
import { useTranslation } from "react-i18next"

type McpViewProps = {
	onDone: () => void
}

const McpView = ({ onDone }: McpViewProps) => {
	const { mcpServers: servers } = useExtensionState()
	const { t } = useTranslation()

	// const [servers, setServers] = useState<McpServer[]>([
	// 	// Add some mock servers for testing
	// 	{
	// 		name: "local-tools",
	// 		config: JSON.stringify({
	// 			mcpServers: {
	// 				"local-tools": {
	// 					command: "npx",
	// 					args: ["-y", "@modelcontextprotocol/server-tools"],
	// 				},
	// 			},
	// 		}),
	// 		status: "connected",
	// 		tools: [
	// 			{
	// 				name: "execute_command",
	// 				description: "Run a shell command on the local system",
	// 			},
	// 			{
	// 				name: "read_file",
	// 				description: "Read contents of a file from the filesystem",
	// 			},
	// 		],
	// 	},
	// 	{
	// 		name: "postgres-db",
	// 		config: JSON.stringify({
	// 			mcpServers: {
	// 				"postgres-db": {
	// 					command: "npx",
	// 					args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
	// 				},
	// 			},
	// 		}),
	// 		status: "disconnected",
	// 		error: "Failed to connect to database: Connection refused",
	// 	},
	// 	{
	// 		name: "github-tools",
	// 		config: JSON.stringify({
	// 			mcpServers: {
	// 				"github-tools": {
	// 					command: "npx",
	// 					args: ["-y", "@modelcontextprotocol/server-github"],
	// 				},
	// 			},
	// 		}),
	// 		status: "connecting",
	// 		resources: [
	// 			{
	// 				uri: "github://repo/issues",
	// 				name: "Repository Issues",
	// 			},
	// 			{
	// 				uri: "github://repo/pulls",
	// 				name: "Pull Requests",
	// 			},
	// 		],
	// 	},
	// ])

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: "flex",
				flexDirection: "column",
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "10px 17px 10px 20px",
				}}>
				<h3 style={{ color: "var(--vscode-foreground)", margin: 0 }}>{t("mcp.title")}</h3>
				<VSCodeButton onClick={onDone}>{t("mcp.done")}</VSCodeButton>
			</div>

			<div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "16px",
						marginTop: "5px",
					}}>
					{t("mcp.description")}{" "}
					<VSCodeLink href="https://github.com/modelcontextprotocol" style={{ display: "inline" }}>
						Model Context Protocol
					</VSCodeLink>{" "}
					{t("mcp.communityServers")}{" "}
					<VSCodeLink href="https://github.com/modelcontextprotocol/servers" style={{ display: "inline" }}>
						{t("mcp.communityServers")}
					</VSCodeLink>{" "}
					{t("mcp.seeDemo")}{" "}
					<VSCodeLink href="https://x.com/sdrzn/status/1867271665086074969" style={{ display: "inline" }}>
						{t("mcp.seeDemo")}
					</VSCodeLink>
				</div>

				{servers.length > 0 && (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "10px",
						}}>
						{servers.map((server) => (
							<ServerRow key={server.name} server={server} />
						))}
					</div>
				)}

				{/* Server Configuration Button */}

				<div style={{ marginTop: "10px", width: "100%" }}>
					<VSCodeButton
						appearance="secondary"
						style={{ width: "100%" }}
						onClick={() => {
							vscode.postMessage({ type: "openMcpSettings" })
						}}>
						<span className="codicon codicon-server" style={{ marginRight: "6px" }}></span>
						{t("mcp.configureServers")}
					</VSCodeButton>
				</div>

				{/* Advanced Settings Link */}
				<div style={{ textAlign: "center", marginTop: "5px" }}>
					<VSCodeLink
						onClick={() => {
							vscode.postMessage({
								type: "openExtensionSettings",
								text: "cline.mcp",
							})
						}}
						style={{ fontSize: "12px" }}>
						{t("mcp.advancedSettings")}
					</VSCodeLink>
				</div>

				{/* Bottom padding */}
				<div style={{ height: "20px" }} />
			</div>
		</div>
	)
}

// Server Row Component
const ServerRow = ({ server }: { server: McpServer }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const { t } = useTranslation()

	const getStatusColor = () => {
		switch (server.status) {
			case "connected":
				return "var(--vscode-testing-iconPassed)"
			case "connecting":
				return "var(--vscode-charts-yellow)"
			case "disconnected":
				return "var(--vscode-testing-iconFailed)"
		}
	}

	const handleRowClick = () => {
		if (!server.error) {
			setIsExpanded(!isExpanded)
		}
	}

	const handleRestart = () => {
		vscode.postMessage({
			type: "restartMcpServer",
			text: server.name,
		})
	}

	return (
		<div style={{ marginBottom: "10px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "8px",
					background: "var(--vscode-textCodeBlock-background)",
					cursor: server.error ? "default" : "pointer",
					borderRadius: isExpanded || server.error ? "4px 4px 0 0" : "4px",
					opacity: server.disabled ? 0.6 : 1,
				}}
				onClick={handleRowClick}>
				{!server.error && (
					<span className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`} style={{ marginRight: "8px" }} />
				)}
				<span style={{ flex: 1 }}>{server.name}</span>
				<div style={{ display: "flex", alignItems: "center", marginRight: "8px" }} onClick={(e) => e.stopPropagation()}>
					<div
						role="switch"
						aria-checked={!server.disabled}
						tabIndex={0}
						style={{
							width: "20px",
							height: "10px",
							backgroundColor: server.disabled
								? "var(--vscode-titleBar-inactiveForeground)"
								: "var(--vscode-testing-iconPassed)",
							borderRadius: "5px",
							position: "relative",
							cursor: "pointer",
							transition: "background-color 0.2s",
							opacity: server.disabled ? 0.5 : 0.9,
						}}
						onClick={() => {
							vscode.postMessage({
								type: "toggleMcpServer",
								serverName: server.name,
								disabled: !server.disabled,
							})
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault()
								vscode.postMessage({
									type: "toggleMcpServer",
									serverName: server.name,
									disabled: !server.disabled,
								})
							}
						}}>
						<div
							style={{
								width: "6px",
								height: "6px",
								backgroundColor: "white",
								border: "1px solid color-mix(in srgb, #666666 65%, transparent)",
								borderRadius: "50%",
								position: "absolute",
								top: "1px",
								left: server.disabled ? "2px" : "12px",
								transition: "left 0.2s",
							}}
						/>
					</div>
				</div>
				<div
					style={{
						width: "8px",
						height: "8px",
						borderRadius: "50%",
						background: getStatusColor(),
						marginLeft: "8px",
					}}
				/>
			</div>

			{server.error ? (
				<div
					style={{
						fontSize: "13px",
						background: "var(--vscode-textCodeBlock-background)",
						borderRadius: "0 0 4px 4px",
						width: "100%",
					}}>
					<div
						style={{
							color: "var(--vscode-testing-iconFailed)",
							marginBottom: "8px",
							padding: "0 10px",
							overflowWrap: "break-word",
							wordBreak: "break-word",
						}}>
						{server.error}
					</div>
					<VSCodeButton
						appearance="secondary"
						onClick={handleRestart}
						disabled={server.status === "connecting"}
						style={{
							width: "calc(100% - 20px)",
							margin: "0 10px 10px 10px",
						}}>
						{server.status === "connecting" ? "Retrying..." : "Retry Connection"}
					</VSCodeButton>
				</div>
			) : (
				isExpanded && (
					<div
						style={{
							background: "var(--vscode-textCodeBlock-background)",
							padding: "0 10px 10px 10px",
							fontSize: "13px",
							borderRadius: "0 0 4px 4px",
						}}>
						<VSCodePanels>
							<VSCodePanelTab id="tools">
								{t("mcp.tools")} ({server.tools?.length || 0})
							</VSCodePanelTab>
							<VSCodePanelTab id="resources">
								{t("mcp.resources")} (
								{[...(server.resourceTemplates || []), ...(server.resources || [])].length || 0})
							</VSCodePanelTab>

							<VSCodePanelView id="tools-view">
								{server.tools && server.tools.length > 0 ? (
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "8px",
											width: "100%",
										}}>
										{server.tools.map((tool) => (
											<McpToolRow key={tool.name} tool={tool} serverName={server.name} />
										))}
									</div>
								) : (
									<div
										style={{
											padding: "10px 0",
											color: "var(--vscode-descriptionForeground)",
										}}>
										{t("mcp.noTools")}
									</div>
								)}
							</VSCodePanelView>

							<VSCodePanelView id="resources-view">
								{(server.resources && server.resources.length > 0) ||
								(server.resourceTemplates && server.resourceTemplates.length > 0) ? (
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "8px",
											width: "100%",
										}}>
										{[...(server.resourceTemplates || []), ...(server.resources || [])].map((item) => (
											<McpResourceRow
												key={"uriTemplate" in item ? item.uriTemplate : item.uri}
												item={item}
											/>
										))}
									</div>
								) : (
									<div
										style={{
											padding: "10px 0",
											color: "var(--vscode-descriptionForeground)",
										}}>
										{t("mcp.noResources")}
									</div>
								)}
							</VSCodePanelView>
						</VSCodePanels>

						<VSCodeButton
							appearance="secondary"
							onClick={handleRestart}
							disabled={server.status === "connecting"}
							style={{
								width: "calc(100% - 14px)",
								margin: "0 7px 3px 7px",
							}}>
							{server.status === "connecting" ? t("mcp.restarting") : t("mcp.restartServer")}
						</VSCodeButton>
					</div>
				)
			)}

			{server.error && (
				<VSCodeButton
					appearance="secondary"
					onClick={handleRestart}
					disabled={server.status === "connecting"}
					style={{
						width: "calc(100% - 20px)",
						margin: "0 10px 10px 10px",
					}}>
					{server.status === "connecting" ? t("mcp.retrying") : t("mcp.retryConnection")}
				</VSCodeButton>
			)}
		</div>
	)
}

export default McpView
