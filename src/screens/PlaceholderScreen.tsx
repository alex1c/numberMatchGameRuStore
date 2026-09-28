/**
 * Minimal placeholder for planned routes.
 * Not production UI — only verifies navigation foundation.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { spacing, typography, useTheme } from '../theme'
import type { AppRouteName } from '../navigation'

interface PlaceholderScreenProps {
	readonly routeName: AppRouteName
	readonly title: string
	readonly note?: string
	readonly onClose: () => void
}

export function PlaceholderScreen({
	routeName,
	title,
	note,
	onClose,
}: PlaceholderScreenProps) {
	const theme = useTheme()

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID={`screen-${routeName}`}
		>
			<Text
				style={[styles.title, { color: theme.colors.text }]}
				accessibilityRole="header"
			>
				{title}
			</Text>
			{note ? (
				<Text style={[styles.note, { color: theme.colors.textMuted }]}>
					{note}
				</Text>
			) : null}
			<Pressable
				onPress={onClose}
				style={[styles.button, { borderColor: theme.colors.border }]}
				testID={`close-${routeName}`}
			>
				<Text style={{ color: theme.colors.accent }}>Back</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		gap: spacing.md,
	},
	title: {
		...typography.title,
		textAlign: 'center',
	},
	note: {
		...typography.body,
		textAlign: 'center',
	},
	button: {
		marginTop: spacing.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 8,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.lg,
	},
})
