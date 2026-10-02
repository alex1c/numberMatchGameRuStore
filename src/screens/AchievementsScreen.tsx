/**
 * Achievements catalog with progress bars and locked requirements.
 */

import { StyleSheet, Text, View } from 'react-native'

import {
	ACHIEVEMENT_DEFINITIONS,
	achievementProgress,
	isAchievementUnlocked,
} from '../achievements'
import { useAppState } from '../app'
import { HubScreenShell } from '../components/HubScreenShell'
import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

interface AchievementsScreenProps {
	readonly onBack: () => void
}

export function AchievementsScreen({ onBack }: AchievementsScreenProps) {
	const theme = useTheme()
	const { root } = useAppState()

	const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((def) =>
		isAchievementUnlocked(root, def),
	).length

	return (
		<HubScreenShell
			title={strings.achievementsTitle}
			onBack={onBack}
			testID="screen-achievements"
		>
			<Text style={[styles.summary, { color: theme.colors.textMuted }]}>
				{strings.achievementsProgress(unlockedCount, ACHIEVEMENT_DEFINITIONS.length)}
			</Text>
			{ACHIEVEMENT_DEFINITIONS.map((def) => {
				const unlocked = isAchievementUnlocked(root, def)
				const { current, target } = achievementProgress(root, def)
				const ratio = target > 0 ? current / target : 0
				return (
					<View
						key={def.id}
						style={[
							styles.card,
							{
								borderColor: theme.colors.border,
								backgroundColor: theme.colors.surface,
								opacity: unlocked ? 1 : 0.92,
							},
						]}
						testID={`achievement-${def.id}`}
					>
						<Text style={[styles.cardTitle, { color: theme.colors.text }]}>
							{unlocked ? '✓ ' : ''}
							{def.titleRu}
						</Text>
						<Text style={{ color: theme.colors.textMuted }}>
							{def.descriptionRu}
						</Text>
						{!unlocked ? (
							<Text
								style={[styles.requirement, { color: theme.colors.textMuted }]}
							>
								{strings.achievementRequirement(def.requirementRu)}
							</Text>
						) : null}
						<View
							style={[
								styles.barTrack,
								{ backgroundColor: theme.colors.controlDisabled },
							]}
						>
							<View
								style={[
									styles.barFill,
									{
										width: `${Math.round(ratio * 100)}%`,
										backgroundColor: unlocked
											? theme.colors.accent
											: theme.colors.controlPrimary,
									},
								]}
							/>
						</View>
						<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
							{strings.achievementProgressLine(current, target)}
						</Text>
					</View>
				)
			})}
		</HubScreenShell>
	)
}

const styles = StyleSheet.create({
	summary: {
		...typography.body,
		textAlign: 'center',
	},
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 12,
		padding: spacing.md,
		gap: spacing.xs,
	},
	cardTitle: {
		...typography.subtitle,
		fontWeight: '700',
	},
	requirement: {
		...typography.caption,
		fontStyle: 'italic',
	},
	barTrack: {
		height: 6,
		borderRadius: 3,
		overflow: 'hidden',
		marginTop: spacing.xs,
	},
	barFill: {
		height: '100%',
		borderRadius: 3,
	},
})
