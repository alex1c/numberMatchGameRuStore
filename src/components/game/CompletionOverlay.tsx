/**
 * Simple completion overlay — no campaign rewards.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { strings } from '../../i18n/strings.ru'
import type { SessionCounters } from '../../game/session'
import { spacing, typography, useTheme } from '../../theme'

interface CompletionOverlayProps {
	readonly visible: boolean
	readonly profileLabel: string
	readonly counters: SessionCounters
	readonly canUndo: boolean
	readonly onUndo: () => void
	readonly onRestart: () => void
	readonly onHome: () => void
	readonly onClose: () => void
}

export function CompletionOverlay({
	visible,
	profileLabel,
	counters,
	canUndo,
	onUndo,
	onRestart,
	onHome,
	onClose,
}: CompletionOverlayProps) {
	const theme = useTheme()

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
						{strings.completedTitle}
					</Text>
					<Text style={[styles.body, { color: theme.colors.textMuted }]}>
						{strings.completedBody}
					</Text>
					<Text style={[styles.meta, { color: theme.colors.textMuted }]}>
						{profileLabel} · {strings.matches} {counters.matchesRemoved} ·{' '}
						{strings.appends} {counters.appendActions}
					</Text>
					<View style={styles.actions}>
						{canUndo ? (
							<Action
								label={strings.undo}
								onPress={onUndo}
								testID="completion-undo"
							/>
						) : null}
						<Action
							label={strings.restart}
							onPress={onRestart}
							primary
							testID="completion-restart"
						/>
						<Action
							label={strings.home}
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
	testID,
}: {
	readonly label: string
	readonly onPress: () => void
	readonly primary?: boolean
	readonly testID: string
}) {
	const theme = useTheme()
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={[
				styles.action,
				{
					backgroundColor: primary
						? theme.colors.controlPrimary
						: theme.colors.controlSecondary,
					borderColor: theme.colors.border,
				},
			]}
			testID={testID}
		>
			<Text
				style={{
					color: primary
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
