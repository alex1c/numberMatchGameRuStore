/**
 * Fixed bottom gameplay controls — outside board ScrollView.
 * When stuck, Add becomes primary and briefly pulses for attention.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AccessibilityInfo,
	ActivityIndicator,
	Animated,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { strings } from '../../i18n/strings.ru'
import {
	APPEND_PULSE_REPETITIONS,
	shouldStartAppendPulse,
} from '../../game/session/hintRequest'
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
	const theme = useTheme()
	const scale = useMemo(() => new Animated.Value(1), [])
	const pulseAnim = useRef<Animated.CompositeAnimation | null>(null)
	const prevPrimary = useRef(false)
	const [reduceMotion, setReduceMotion] = useState(false)

	useEffect(() => {
		let mounted = true
		AccessibilityInfo.isReduceMotionEnabled()
			.then((enabled) => {
				if (mounted) {
					setReduceMotion(enabled)
				}
			})
			.catch(() => {
				/* ignore — treat as motion allowed */
			})
		const sub = AccessibilityInfo.addEventListener?.(
			'reduceMotionChanged',
			(enabled: boolean) => {
				setReduceMotion(enabled)
			},
		)
		return () => {
			mounted = false
			sub?.remove?.()
		}
	}, [])

	const stopPulse = () => {
		pulseAnim.current?.stop()
		pulseAnim.current = null
		scale.stopAnimation()
		scale.setValue(1)
	}

	useEffect(() => {
		const shouldPulse = shouldStartAppendPulse(
			prevPrimary.current,
			appendPrimary && canAppend,
		)
		prevPrimary.current = appendPrimary && canAppend

		if (!shouldPulse || reduceMotion) {
			if (!(appendPrimary && canAppend)) {
				stopPulse()
			}
			return
		}

		stopPulse()
		const sequence: Animated.CompositeAnimation[] = []
		for (let i = 0; i < APPEND_PULSE_REPETITIONS; i += 1) {
			sequence.push(
				Animated.sequence([
					Animated.timing(scale, {
						toValue: 1.06,
						duration: 180,
						useNativeDriver: true,
					}),
					Animated.timing(scale, {
						toValue: 1,
						duration: 180,
						useNativeDriver: true,
					}),
				]),
			)
		}
		const anim = Animated.sequence(sequence)
		pulseAnim.current = anim
		anim.start(({ finished }) => {
			if (finished) {
				pulseAnim.current = null
				scale.setValue(1)
			}
		})

		return () => {
			stopPulse()
		}
		// Only react to primary/stuck transitions — not every parent render.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
	}, [appendPrimary, canAppend, reduceMotion])

	useEffect(() => {
		return () => {
			stopPulse()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
	}, [])

	const handleAppend = () => {
		stopPulse()
		onAppend()
	}

	return (
		<View style={styles.row} testID="game-controls">
			<ControlButton
				label={strings.undo}
				a11y={strings.undo}
				disabled={!canUndo}
				onPress={onUndo}
				testID="btn-undo"
			/>
			<Animated.View
				style={[styles.appendWrap, { transform: [{ scale }] }]}
				testID="btn-append-pulse"
			>
				<ControlButton
					label={strings.addNumbers}
					a11y={strings.addNumbersA11y}
					disabled={!canAppend}
					primary={appendPrimary && canAppend}
					onPress={handleAppend}
					testID="btn-append"
				/>
			</Animated.View>
			<ControlButton
				label={hintBusy ? strings.hintBusy : strings.hint}
				a11y={strings.hint}
				disabled={!canHint}
				busy={hintBusy}
				busyColor={theme.colors.text}
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
	readonly busy?: boolean
	readonly busyColor?: string
	readonly onPress: () => void
	readonly testID: string
}

function ControlButton({
	label,
	a11y,
	disabled,
	primary = false,
	busy = false,
	busyColor,
	onPress,
	testID,
}: ControlButtonProps) {
	const theme = useTheme()
	const backgroundColor =
		disabled && !busy
			? theme.colors.controlDisabled
			: primary
				? theme.colors.controlPrimary
				: theme.colors.controlSecondary
	const color =
		disabled && !busy
			? theme.colors.controlDisabledText
			: primary
				? theme.colors.controlPrimaryText
				: theme.colors.text

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled || busy}
			accessibilityRole="button"
			accessibilityLabel={a11y}
			accessibilityState={{ disabled: disabled || busy, busy }}
			style={[
				styles.button,
				{
					backgroundColor,
					borderColor: theme.colors.border,
					opacity: disabled && !busy ? 0.85 : 1,
				},
			]}
			testID={testID}
		>
			{busy ? (
				<View style={styles.busyRow} testID="hint-busy-indicator">
					<ActivityIndicator
						size="small"
						color={busyColor ?? color}
					/>
					<Text
						style={[styles.label, { color }]}
						numberOfLines={1}
						allowFontScaling
						maxFontSizeMultiplier={1.3}
					>
						{label}
					</Text>
				</View>
			) : (
				<Text
					style={[styles.label, { color }]}
					numberOfLines={1}
					allowFontScaling
					maxFontSizeMultiplier={1.3}
				>
					{label}
				</Text>
			)}
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
	appendWrap: {
		flex: 1,
	},
	button: {
		flex: 1,
		alignSelf: 'stretch',
		minHeight: 48,
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
	},
	busyRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.xs,
	},
	label: {
		...typography.body,
		fontWeight: '600',
	},
})
