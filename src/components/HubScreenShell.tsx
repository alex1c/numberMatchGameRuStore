/**
 * Shared chrome for hub screens (back + title + scroll body).
 * BannerSlot stays in AppShell — do not duplicate ads here.
 */

import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

interface HubScreenShellProps {
	readonly title: string
	readonly onBack: () => void
	readonly children: ReactNode
	readonly testID?: string
}

export function HubScreenShell({
	title,
	onBack,
	children,
	testID,
}: HubScreenShellProps) {
	const theme = useTheme()

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID={testID}
		>
			<View style={styles.header}>
				<Pressable
					onPress={onBack}
					style={styles.back}
					accessibilityRole="button"
					accessibilityLabel={strings.back}
					testID={`${testID ?? 'hub'}-back`}
				>
					<Text style={{ color: theme.colors.accent, fontWeight: '600' }}>
						{strings.back}
					</Text>
				</Pressable>
				<Text
					style={[styles.title, { color: theme.colors.text }]}
					accessibilityRole="header"
				>
					{title}
				</Text>
				<View style={styles.back} />
			</View>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{children}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		gap: spacing.sm,
	},
	back: {
		minWidth: 72,
	},
	title: {
		...typography.title,
		flex: 1,
		textAlign: 'center',
		fontSize: 20,
	},
	content: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xl,
		gap: spacing.md,
	},
})
