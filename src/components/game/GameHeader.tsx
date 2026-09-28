/**
 * Game screen header: back, mode label, overflow (restart / rules / home).
 */

import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { strings } from '../../i18n/strings.ru'
import { spacing, typography, useTheme } from '../../theme'

interface GameHeaderProps {
	readonly title: string
	readonly subtitle?: string
	readonly onBack: () => void
	readonly onRestart: () => void
	readonly onRules: () => void
	readonly onHome: () => void
}

export function GameHeader({
	title,
	subtitle,
	onBack,
	onRestart,
	onRules,
	onHome,
}: GameHeaderProps) {
	const theme = useTheme()
	const [menuOpen, setMenuOpen] = useState(false)

	return (
		<View
			style={[styles.bar, { borderBottomColor: theme.colors.border }]}
			testID="game-header"
		>
			<Pressable
				onPress={onBack}
				accessibilityRole="button"
				accessibilityLabel={strings.back}
				style={styles.side}
				testID="btn-back"
			>
				<Text style={[styles.sideText, { color: theme.colors.accent }]}>←</Text>
			</Pressable>
			<View style={styles.center}>
				<Text
					style={[styles.title, { color: theme.colors.text }]}
					numberOfLines={1}
					accessibilityRole="header"
				>
					{title}
				</Text>
				{subtitle ? (
					<Text
						style={[styles.subtitle, { color: theme.colors.textMuted }]}
						numberOfLines={1}
					>
						{subtitle}
					</Text>
				) : null}
			</View>
			<Pressable
				onPress={() => setMenuOpen(true)}
				accessibilityRole="button"
				accessibilityLabel="Меню"
				style={styles.side}
				testID="btn-overflow"
			>
				<Text style={[styles.sideText, { color: theme.colors.text }]}>⋮</Text>
			</Pressable>

			<Modal
				visible={menuOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setMenuOpen(false)}
			>
				<Pressable
					style={[styles.menuBackdrop, { backgroundColor: theme.colors.overlay }]}
					onPress={() => setMenuOpen(false)}
				>
					<View
						style={[styles.menu, { backgroundColor: theme.colors.surface }]}
					>
						<MenuItem
							label={strings.restart}
							onPress={() => {
								setMenuOpen(false)
								onRestart()
							}}
							testID="menu-restart"
						/>
						<MenuItem
							label={strings.rules}
							onPress={() => {
								setMenuOpen(false)
								onRules()
							}}
							testID="menu-rules"
						/>
						<MenuItem
							label={strings.home}
							onPress={() => {
								setMenuOpen(false)
								onHome()
							}}
							testID="menu-home"
						/>
					</View>
				</Pressable>
			</Modal>
		</View>
	)
}

function MenuItem({
	label,
	onPress,
	testID,
}: {
	readonly label: string
	readonly onPress: () => void
	readonly testID: string
}) {
	const theme = useTheme()
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={styles.menuItem}
			testID={testID}
		>
			<Text style={{ color: theme.colors.text, ...typography.body }}>{label}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	bar: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
		minHeight: 52,
	},
	side: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sideText: {
		fontSize: 22,
		fontWeight: '600',
	},
	center: {
		flex: 1,
		alignItems: 'center',
		paddingHorizontal: spacing.xs,
	},
	title: {
		...typography.subtitle,
		fontWeight: '700',
	},
	subtitle: {
		...typography.caption,
		marginTop: 2,
	},
	menuBackdrop: {
		flex: 1,
		justifyContent: 'flex-start',
		alignItems: 'flex-end',
		paddingTop: 56,
		paddingRight: spacing.md,
	},
	menu: {
		minWidth: 200,
		borderRadius: 12,
		paddingVertical: spacing.xs,
		elevation: 4,
	},
	menuItem: {
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.md,
	},
})
