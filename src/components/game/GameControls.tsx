/**
 * Fixed bottom gameplay controls — outside board ScrollView.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { strings } from '../../i18n/strings.ru'
import { spacing, typography, useTheme } from '../../theme'

interface GameControlsProps {
	readonly canUndo: boolean
	readonly canAppend: boolean
	readonly appendPrimary: boolean
	readonly canHint: boolean
	readonly hintBusy: boolean
	readonly onUndo: () => void
	readonly onAppend: () => void
	readonly onHint: () => void
}

export function GameControls({
	canUndo,
	canAppend,
	appendPrimary,
	canHint,
	hintBusy,
	onUndo,
	onAppend,
	onHint,
}: GameControlsProps) {
	return (
		<View style={styles.row} testID="game-controls">
			<ControlButton
				label={strings.undo}
				a11y={strings.undo}
				disabled={!canUndo}
				onPress={onUndo}
				testID="btn-undo"
			/>
			<ControlButton
				label={strings.addNumbers}
				a11y={strings.addNumbersA11y}
				disabled={!canAppend}
				primary={appendPrimary && canAppend}
				onPress={onAppend}
				testID="btn-append"
			/>
			<ControlButton
				label={hintBusy ? strings.hintBusy : strings.hint}
				a11y={strings.hint}
				disabled={!canHint || hintBusy}
				onPress={onHint}
				testID="btn-hint"
			/>
		</View>
	)
}

interface ControlButtonProps {
	readonly label: string
	readonly a11y: string
	readonly disabled: boolean
	readonly primary?: boolean
	readonly onPress: () => void
	readonly testID: string
}

function ControlButton({
	label,
	a11y,
	disabled,
	primary = false,
	onPress,
	testID,
}: ControlButtonProps) {
	const theme = useTheme()
	const backgroundColor = disabled
		? theme.colors.controlDisabled
		: primary
			? theme.colors.controlPrimary
			: theme.colors.controlSecondary
	const color = disabled
		? theme.colors.controlDisabledText
		: primary
			? theme.colors.controlPrimaryText
			: theme.colors.text

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={a11y}
			accessibilityState={{ disabled }}
			style={[
				styles.button,
				{
					backgroundColor,
					borderColor: theme.colors.border,
					opacity: disabled ? 0.85 : 1,
				},
			]}
			testID={testID}
		>
			<Text
				style={[styles.label, { color }]}
				numberOfLines={1}
				allowFontScaling
				maxFontSizeMultiplier={1.3}
			>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
		paddingBottom: spacing.sm,
	},
	button: {
		flex: 1,
		minHeight: 48,
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
	},
	label: {
		...typography.body,
		fontWeight: '600',
	},
})
