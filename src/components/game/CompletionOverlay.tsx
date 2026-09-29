/**
 * Completion overlay — campaign Next / Replay / Home; DEV may keep Undo.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { strings } from '../../i18n/strings.ru'
import type { SessionCounters } from '../../game/session'
import { spacing, typography, useTheme } from '../../theme'

export type CompletionMode = 'campaign_progression' | 'campaign_replay' | 'dev'

interface CompletionOverlayProps {
	readonly visible: boolean
	readonly title: string
	readonly body?: string
	readonly counters: SessionCounters
	readonly mode: CompletionMode
	/** Campaign progression: show Next when there is a next level. */
	readonly showNext?: boolean
	readonly nextLabel?: string
	readonly nextBusy?: boolean
	readonly onNext?: () => void
	readonly onReplay?: () => void
	readonly onHome: () => void
	/** Override Home button label (e.g. Density Lab back). */
	readonly homeLabel?: string
	readonly onClose: () => void
	/** DEV / non-campaign only — hidden after campaign completion (§241). */
	readonly canUndo?: boolean
	readonly onUndo?: () => void
	readonly showRestart?: boolean
	readonly onRestart?: () => void
}

export function CompletionOverlay({
	visible,
	title,
	body,
	counters,
	mode,
	showNext = false,
	nextLabel,
	nextBusy = false,
	onNext,
	onReplay,
	onHome,
	homeLabel,
	onClose,
	canUndo = false,
	onUndo,
	showRestart = false,
	onRestart,
}: CompletionOverlayProps) {
	const theme = useTheme()
	const isCampaign = mode === 'campaign_progression' || mode === 'campaign_replay'

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View
				style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
				testID="completion-overlay"
			>
				<View
					style={[styles.card, { backgroundColor: theme.colors.surface }]}
				>
					<Text style={[styles.title, { color: theme.colors.text }]}>
						{title}
					</Text>
					{body ? (
						<Text style={[styles.body, { color: theme.colors.textMuted }]}>
							{body}
						</Text>
					) : null}
					<Text style={[styles.meta, { color: theme.colors.textMuted }]}>
						{strings.completionStats(
							counters.matchesRemoved,
							counters.appendActions,
						)}
					</Text>
					<View style={styles.actions}>
						{showNext && onNext ? (
							<Action
								label={nextLabel ?? strings.nextLevel}
								onPress={onNext}
								primary
								disabled={nextBusy}
								testID="completion-next"
							/>
						) : null}
						{onReplay ? (
							<Action
								label={strings.repeatLevel}
								onPress={onReplay}
								primary={!showNext}
								testID="completion-replay"
							/>
						) : null}
						{!isCampaign && canUndo && onUndo ? (
							<Action
								label={strings.undo}
								onPress={onUndo}
								testID="completion-undo"
							/>
						) : null}
						{!isCampaign && showRestart && onRestart ? (
							<Action
								label={strings.restart}
								onPress={onRestart}
								primary={!canUndo}
								testID="completion-restart"
							/>
						) : null}
						<Action
							label={homeLabel ?? strings.home}
							onPress={onHome}
							testID="completion-home"
						/>
					</View>
				</View>
			</View>
		</Modal>
	)
}

function Action({
	label,
	onPress,
	primary = false,
	disabled = false,
	testID,
}: {
	readonly label: string
	readonly onPress: () => void
	readonly primary?: boolean
	readonly disabled?: boolean
	readonly testID: string
}) {
	const theme = useTheme()
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			style={[
				styles.action,
				{
					backgroundColor: disabled
						? theme.colors.controlDisabled
						: primary
							? theme.colors.controlPrimary
							: theme.colors.controlSecondary,
					borderColor: theme.colors.border,
					opacity: disabled ? 0.7 : 1,
				},
			]}
			testID={testID}
		>
			<Text
				style={{
					color: disabled
						? theme.colors.controlDisabledText
						: primary
							? theme.colors.controlPrimaryText
							: theme.colors.text,
					fontWeight: '600',
				}}
			>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
	},
	card: {
		width: '100%',
		maxWidth: 360,
		borderRadius: 16,
		padding: spacing.lg,
		gap: spacing.sm,
	},
	title: {
		...typography.title,
		fontSize: 24,
		textAlign: 'center',
	},
	body: {
		...typography.body,
		textAlign: 'center',
	},
	meta: {
		...typography.caption,
		textAlign: 'center',
		marginBottom: spacing.sm,
	},
	actions: {
		gap: spacing.sm,
	},
	action: {
		minHeight: 48,
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
