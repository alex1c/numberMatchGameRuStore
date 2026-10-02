/**
 * Lifetime statistics — campaign, gameplay, daily groups.
 */

import { useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useAppState } from '../app'
import { HubScreenShell } from '../components/HubScreenShell'
import { CAMPAIGN_LEVEL_COUNT } from '../game/campaign'
import { localDateKey } from '../daily'
import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

interface StatisticsScreenProps {
	readonly onBack: () => void
}

export function StatisticsScreen({ onBack }: StatisticsScreenProps) {
	const {
		highestCompletedLevel,
		totalStars,
		bestStars,
		statistics,
		daily,
		getDailySummary,
	} = useAppState()

	const todayKey = useMemo(() => localDateKey(new Date()), [])
	const summary = getDailySummary(todayKey)
	const dailyCompletedCount = daily.history.filter((e) => e.completed).length
	const threeStarLevels = bestStars.filter((stars) => stars === 3).length

	return (
		<HubScreenShell
			title={strings.statisticsTitle}
			onBack={onBack}
			testID="screen-statistics"
		>
			<StatGroup title={strings.statsGroupCampaign}>
				<StatRow
					label={strings.statsLevelsCleared}
					value={`${highestCompletedLevel} / ${CAMPAIGN_LEVEL_COUNT}`}
				/>
				<StatRow
					label={strings.statsStarsTotal}
					value={`${totalStars} / ${CAMPAIGN_LEVEL_COUNT * 3}`}
				/>
				<StatRow
					label={strings.statsThreeStarLevels}
					value={String(threeStarLevels)}
				/>
			</StatGroup>

			<StatGroup title={strings.statsGroupGameplay}>
				<StatRow
					label={strings.statsPairsRemoved}
					value={String(statistics.pairsRemoved)}
				/>
				<StatRow
					label={strings.statsAppendActions}
					value={String(statistics.appendActions)}
				/>
				<StatRow
					label={strings.statsHintsDelivered}
					value={String(statistics.hintsDelivered)}
				/>
				<StatRow
					label={strings.statsUndoActions}
					value={String(statistics.undoActions)}
				/>
			</StatGroup>

			<StatGroup title={strings.statsGroupDaily}>
				<StatRow
					label={strings.statsDailyCompleted}
					value={String(dailyCompletedCount)}
				/>
				<StatRow
					label={strings.dailyStreakActiveLabel}
					value={String(summary.activeStreak)}
				/>
				<StatRow
					label={strings.dailyStreakBestLabel}
					value={String(daily.bestStreak)}
				/>
			</StatGroup>
		</HubScreenShell>
	)
}

function StatGroup({
	title,
	children,
}: {
	readonly title: string
	readonly children: ReactNode
}) {
	const theme = useTheme()
	return (
		<View
			style={[
				styles.group,
				{
					borderColor: theme.colors.border,
					backgroundColor: theme.colors.surface,
				},
			]}
		>
			<Text style={[styles.groupTitle, { color: theme.colors.text }]}>
				{title}
			</Text>
			{children}
		</View>
	)
}

function StatRow({
	label,
	value,
}: {
	readonly label: string
	readonly value: string
}) {
	const theme = useTheme()
	return (
		<View style={styles.row}>
			<Text style={{ color: theme.colors.textMuted, flex: 1 }}>{label}</Text>
			<Text style={{ color: theme.colors.text, fontWeight: '600' }}>
				{value}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	group: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 12,
		padding: spacing.md,
		gap: spacing.sm,
	},
	groupTitle: {
		...typography.caption,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
})
