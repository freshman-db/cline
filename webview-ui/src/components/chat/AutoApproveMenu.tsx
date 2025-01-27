import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useState } from "react"
import styled from "styled-components"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { AutoApprovalSettings } from "../../../../src/shared/AutoApprovalSettings"
import { vscode } from "../../utils/vscode"
import { getAsVar, VSC_FOREGROUND, VSC_TITLEBAR_INACTIVE_FOREGROUND, VSC_DESCRIPTION_FOREGROUND } from "../../utils/vscStyles"

interface AutoApproveMenuProps {
	style?: React.CSSProperties
}

const ACTION_METADATA: {
	id: keyof AutoApprovalSettings["actions"]
	label: string
	shortName: string
	description: string
}[] = [
	{
		id: "readFiles",
		label: "Read files and directories",
		shortName: "Read",
		description: "Allows access to read any file on your computer.",
	},
	{
		id: "editFiles",
		label: "Edit files",
		shortName: "Edit",
		description: "Allows modification of any files on your computer.",
	},
	{
		id: "executeCommands",
		label: "Execute safe commands",
		shortName: "Commands",
		description:
			"Allows execution of safe terminal commands. If the model determines a command is potentially destructive, it will still require approval.",
	},
	{
		id: "useBrowser",
		label: "Use the browser",
		shortName: "Browser",
		description: "Allows ability to launch and interact with any website in a headless browser.",
	},
	{
		id: "useMcp",
		label: "Use MCP servers",
		shortName: "MCP",
		description: "Allows use of configured MCP servers which may modify filesystem or interact with APIs.",
	},
]

const AutoApproveMenu = ({ style }: AutoApproveMenuProps) => {
	const { t } = useTranslation()
	const { autoApprovalSettings } = useExtensionState()
	const [isExpanded, setIsExpanded] = useState(false)
	const [isHoveringCollapsibleSection, setIsHoveringCollapsibleSection] = useState(false)

	const getTranslatedActionMetadata = () =>
		ACTION_METADATA.map((action) => ({
			...action,
			label: t(`autoApprove.actions.${action.id}.label`),
			shortName: t(`autoApprove.actions.${action.id}.shortName`),
			description: t(`autoApprove.actions.${action.id}.description`),
		}))

	const enabledActions = getTranslatedActionMetadata().filter((action) => autoApprovalSettings.actions[action.id])
	const enabledActionsList = enabledActions.map((action) => action.shortName).join(", ")
	const hasEnabledActions = enabledActions.length > 0

	const updateEnabled = useCallback(
		(enabled: boolean) => {
			vscode.postMessage({
				type: "autoApprovalSettings",
				autoApprovalSettings: {
					...autoApprovalSettings,
					enabled,
				},
			})
		},
		[autoApprovalSettings],
	)

	const updateAction = useCallback(
		(actionId: keyof AutoApprovalSettings["actions"], value: boolean) => {
			// Calculate what the new actions state will be
			const newActions = {
				...autoApprovalSettings.actions,
				[actionId]: value,
			}

			// Check if this will result in any enabled actions
			const willHaveEnabledActions = Object.values(newActions).some(Boolean)

			vscode.postMessage({
				type: "autoApprovalSettings",
				autoApprovalSettings: {
					...autoApprovalSettings,
					actions: newActions,
					// If no actions will be enabled, ensure the main toggle is off
					enabled: willHaveEnabledActions ? autoApprovalSettings.enabled : false,
				},
			})
		},
		[autoApprovalSettings],
	)

	const updateMaxRequests = useCallback(
		(maxRequests: number) => {
			vscode.postMessage({
				type: "autoApprovalSettings",
				autoApprovalSettings: {
					...autoApprovalSettings,
					maxRequests,
				},
			})
		},
		[autoApprovalSettings],
	)

	const updateNotifications = useCallback(
		(enableNotifications: boolean) => {
			vscode.postMessage({
				type: "autoApprovalSettings",
				autoApprovalSettings: {
					...autoApprovalSettings,
					enableNotifications,
				},
			})
		},
		[autoApprovalSettings],
	)

	return (
		<div
			style={{
				padding: "0 15px",
				userSelect: "none",
				borderTop: isExpanded
					? `0.5px solid color-mix(in srgb, ${getAsVar(VSC_TITLEBAR_INACTIVE_FOREGROUND)} 20%, transparent)`
					: "none",
				overflowY: "auto",
				...style,
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: isExpanded ? "8px 0" : "8px 0 0 0",
					cursor: !hasEnabledActions ? "pointer" : "default",
				}}
				onMouseEnter={() => {
					if (!hasEnabledActions) {
						setIsHoveringCollapsibleSection(true)
					}
				}}
				onMouseLeave={() => {
					if (!hasEnabledActions) {
						setIsHoveringCollapsibleSection(false)
					}
				}}
				onClick={() => {
					if (!hasEnabledActions) {
						setIsExpanded((prev) => !prev)
					}
				}}>
				<VSCodeCheckbox
					style={{
						pointerEvents: hasEnabledActions ? "auto" : "none",
					}}
					checked={hasEnabledActions && autoApprovalSettings.enabled}
					disabled={!hasEnabledActions}
					onClick={(e) => {
						if (!hasEnabledActions) return
						e.stopPropagation()
						updateEnabled(!autoApprovalSettings.enabled)
					}}
				/>
				<CollapsibleSection
					isHovered={isHoveringCollapsibleSection}
					style={{ cursor: "pointer" }}
					onClick={() => {
						if (hasEnabledActions) {
							setIsExpanded((prev) => !prev)
						}
					}}>
					<span
						style={{
							color: getAsVar(VSC_FOREGROUND),
							whiteSpace: "nowrap",
						}}>
						{t("autoApprove.title")}
					</span>
					<span
						style={{
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}>
						{enabledActions.length === 0 ? t("autoApprove.none") : enabledActionsList}
					</span>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
						style={{
							flexShrink: 0,
							marginLeft: isExpanded ? "2px" : "-2px",
						}}
					/>
				</CollapsibleSection>
			</div>
			{isExpanded && (
				<div style={{ padding: "0" }}>
					<div
						style={{
							marginBottom: "10px",
							color: getAsVar(VSC_DESCRIPTION_FOREGROUND),
							fontSize: "12px",
						}}>
						{t("autoApprove.description")}
					</div>
					{getTranslatedActionMetadata().map((action) => (
						<div key={action.id} style={{ margin: "6px 0" }}>
							<VSCodeCheckbox
								checked={autoApprovalSettings.actions[action.id]}
								onChange={(e) => {
									const checked = (e.target as HTMLInputElement).checked
									updateAction(action.id, checked)
								}}>
								{action.label}
							</VSCodeCheckbox>
							<div
								style={{
									marginLeft: "28px",
									color: getAsVar(VSC_DESCRIPTION_FOREGROUND),
									fontSize: "12px",
								}}>
								{action.description}
							</div>
						</div>
					))}
					<div
						style={{
							height: "0.5px",
							background: getAsVar(VSC_TITLEBAR_INACTIVE_FOREGROUND),
							margin: "15px 0",
							opacity: 0.2,
						}}
					/>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							marginTop: "10px",
							marginBottom: "8px",
							color: getAsVar(VSC_FOREGROUND),
						}}>
						<span style={{ flexShrink: 1, minWidth: 0 }}>{t("autoApprove.maxRequests")}</span>
						<VSCodeTextField
							value={autoApprovalSettings.maxRequests.toString()}
							onInput={(e) => {
								const input = e.target as HTMLInputElement
								input.value = input.value.replace(/[^0-9]/g, "")
								const value = parseInt(input.value)
								if (!isNaN(value) && value > 0) {
									updateMaxRequests(value)
								}
							}}
							onKeyDown={(e) => {
								if (!/^\d$/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(e.key)) {
									e.preventDefault()
								}
							}}
							style={{ flex: 1 }}
						/>
					</div>
					<div
						style={{
							color: getAsVar(VSC_DESCRIPTION_FOREGROUND),
							fontSize: "12px",
							marginBottom: "10px",
						}}>
						{t("autoApprove.maxRequestsDescription")}
					</div>
					<div style={{ margin: "6px 0" }}>
						<VSCodeCheckbox
							checked={autoApprovalSettings.enableNotifications}
							onChange={(e) => {
								const checked = (e.target as HTMLInputElement).checked
								updateNotifications(checked)
							}}>
							{t("autoApprove.enableNotifications")}
						</VSCodeCheckbox>
						<div
							style={{
								marginLeft: "28px",
								color: getAsVar(VSC_DESCRIPTION_FOREGROUND),
								fontSize: "12px",
							}}>
							{t("autoApprove.notificationsDescription")}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

const CollapsibleSection = styled.div<{ isHovered?: boolean }>`
	display: flex;
	align-items: center;
	gap: 4px;
	color: ${(props) => (props.isHovered ? getAsVar(VSC_FOREGROUND) : getAsVar(VSC_DESCRIPTION_FOREGROUND))};
	flex: 1;
	min-width: 0;

	&:hover {
		color: ${getAsVar(VSC_FOREGROUND)};
	}
`

export default AutoApproveMenu
