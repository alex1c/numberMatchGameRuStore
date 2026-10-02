/**
 * Settings — theme, training replay, rules, about. No sound toggle.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppState } from '../app'
import { trackEvent } from '../analytics'
import { HubScreenShell } from '../components/HubScreenShell'
import { strings } from '../i18n/strings.ru'
import type { ThemePreference } from '../storage'
import { spacing, typography, useTheme } from '../theme'

interface SettingsScreenProps {
	readonly onBack: () => void
	readonly onTraining: () => void
	readonly onRules: () => void
	readonly onAbout: () => void
}

const THEME_OPTIONS: readonly ThemePreference[] = [
	'system',
	'light',
	'dark',
]

export function SettingsScreen({
	onBack,
	onTraining,
	onRules,
	onAbout,
}: SettingsScreenProps) {
	const theme = useTheme()
	const { themePreference, setThemePreference } = useAppState()

	const pickTheme = (preference: ThemePreference) => {
		if (preference === themePreference) {
			return
		}
		void (async () => {
			await setThemePreference(preference)
			trackEvent('theme_changed', { theme: preference })
		})()
	}

	return (
		<HubScreenShell
			title={strings.settingsTitle}
			onBack={onBack}
			testID="screen-settings"
		>
			<Text style={[styles.section, { color: theme.colors.text }]}>
				{strings.settingsThemeSection}
			</Text>
			<View style={styles.themeRow}>
				{THEME_OPTIONS.map((option) => {
					const selected = themePreference === option
					return (
						<Pressable
							key={option}
							onPress={() => pickTheme(option)}
							style={[
								styles.themeChip,
								{
									borderColor: selected
										? theme.colors.accent
										: theme.colors.border,
									backgroundColor: selected
										? theme.colors.controlSecondary
										: theme.colors.surface,
								},
							]}
							testID={`theme-${option}`}
							accessibilityRole="button"
							accessibilityState={{ selected }}
						>
							<Text style={{ color: theme.colors.text, fontWeight: '600' }}>
								{strings.themeOptionLabel(option)}
							</Text>
						</Pressable>
					)
				})}
			</View>

			<NavRow
				label={strings.training}
				note={strings.settingsTrainingNote}
				onPress={onTraining}
				testID="settings-training"
			/>
			<NavRow
				label={strings.rules}
				onPress={onRules}
				testID="settings-rules"
			/>
			<NavRow
				label={strings.aboutTitle}
				onPress={onAbout}
				testID="settings-about"
			/>
		</HubScreenShell>
	)
}

function NavRow({
	label,
	note,
	onPress,
	testID,
}: {
	readonly label: string
	readonly note?: string
	readonly onPress: () => void
	readonly testID: string
}) {
	const theme = useTheme()
	return (
		<Pressable
			onPress={onPress}
			style={[styles.navRow, { borderColor: theme.colors.border }]}
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
		>
			<Text style={{ color: theme.colors.text, fontWeight: '600' }}>
				{label}
			</Text>
			{note ? (
				<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
					{note}
				</Text>
			) : null}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	section: {
		...typography.caption,
		fontWeight: '700',
	},
	themeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	themeChip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
	},
	navRow: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		gap: 2,
	},
})
