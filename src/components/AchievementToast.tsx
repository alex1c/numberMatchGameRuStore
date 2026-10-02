/**
 * Non-blocking achievement unlock toast — one id at a time, queued FIFO.
 * Visibility is driven by the parent queue head (no local sync setState).
 */

import { useEffect, useMemo, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'

import { getAchievementDefinition } from '../achievements'
import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

const TOAST_MS = 3200

interface AchievementToastProps {
	readonly queue: readonly string[]
	readonly onDismiss: (achievementId: string) => void
}

export function AchievementToast({ queue, onDismiss }: AchievementToastProps) {
	const theme = useTheme()
	const activeId = queue[0] ?? null
	const opacity = useMemo(() => new Animated.Value(0), [])
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (!activeId) {
			opacity.setValue(0)
			return
		}

		opacity.setValue(0)
		Animated.timing(opacity, {
			toValue: 1,
			duration: 180,
			useNativeDriver: true,
		}).start()

		if (timer.current) {
			clearTimeout(timer.current)
		}
		timer.current = setTimeout(() => {
			Animated.timing(opacity, {
				toValue: 0,
				duration: 160,
				useNativeDriver: true,
			}).start(({ finished }) => {
				if (finished) {
					onDismiss(activeId)
				}
			})
		}, TOAST_MS)

		return () => {
			if (timer.current) {
				clearTimeout(timer.current)
				timer.current = null
			}
		}
	}, [activeId, onDismiss, opacity])

	if (!activeId) {
		return null
	}

	const def = getAchievementDefinition(activeId)
	const title = def?.titleRu ?? activeId

	return (
		<Animated.View
			style={[
				styles.wrap,
				{
					opacity,
					backgroundColor: theme.colors.surface,
					borderColor: theme.colors.border,
				},
			]}
			pointerEvents="box-none"
			testID="achievement-toast"
		>
			<Pressable
				onPress={() => {
					if (timer.current) {
						clearTimeout(timer.current)
						timer.current = null
					}
					onDismiss(activeId)
				}}
				accessibilityRole="button"
				accessibilityLabel={strings.achievementUnlockedA11y(title)}
			>
				<Text style={[styles.kicker, { color: theme.colors.accent }]}>
					{strings.achievementUnlockedKicker}
				</Text>
				<Text style={[styles.title, { color: theme.colors.text }]}>
					{title}
				</Text>
			</Pressable>
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		top: spacing.md,
		left: spacing.md,
		right: spacing.md,
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		elevation: 4,
		shadowColor: '#000',
		shadowOpacity: 0.12,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
	},
	kicker: {
		...typography.caption,
		fontWeight: '700',
		marginBottom: 2,
	},
	title: {
		...typography.body,
		fontWeight: '600',
	},
})
