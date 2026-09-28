/**
 * Minimal Home shell — Phase 0 foundation check.
 * Product UI arrives in later phases.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { APP_IDENTITY } from '../services/identity'
import { spacing, typography, useTheme } from '../theme'
import type { AppRouteName } from '../navigation'

interface HomeScreenProps {
	readonly onNavigate: (route: AppRouteName) => void
}

const PLANNED_LINKS: readonly { route: AppRouteName; label: string }[] = [
	{ route: 'game', label: 'Game' },
	{ route: 'levels', label: 'Levels' },
	{ route: 'daily', label: 'Daily' },
	{ route: 'statistics', label: 'Statistics' },
	{ route: 'achievements', label: 'Achievements' },
	{ route: 'settings', label: 'Settings' },
	{ route: 'training', label: 'Training' },
	{ route: 'about', label: 'About' },
]

export function HomeScreen({ onNavigate }: HomeScreenProps) {
	const theme = useTheme()

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID="home-screen"
		>
			<Text
				style={[styles.title, { color: theme.colors.text }]}
				accessibilityRole="header"
			>
				{APP_IDENTITY.displayName}
			</Text>
			<Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
				ForestMusic · Phase 0 + Phase 1
			</Text>
			<Text
				style={[styles.badge, { color: theme.colors.accent }]}
				testID="boot-ok"
			>
				BOOT_OK
			</Text>
			<View style={styles.links}>
				{PLANNED_LINKS.map((item) => (
					<Pressable
						key={item.route}
						onPress={() => onNavigate(item.route)}
						style={[styles.link, { borderColor: theme.colors.border }]}
						testID={`nav-${item.route}`}
					>
						<Text style={{ color: theme.colors.text }}>{item.label}</Text>
					</Pressable>
				))}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		gap: spacing.sm,
	},
	title: {
		...typography.title,
		textAlign: 'center',
	},
	subtitle: {
		...typography.subtitle,
	},
	badge: {
		...typography.badge,
		marginTop: spacing.sm,
	},
	links: {
		marginTop: spacing.lg,
		width: '100%',
		maxWidth: 360,
		gap: spacing.sm,
	},
	link: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 8,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		alignItems: 'center',
	},
})
