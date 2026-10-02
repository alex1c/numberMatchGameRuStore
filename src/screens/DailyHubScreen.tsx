/**
 * Daily puzzle hub — streak, today status, recent history, start / continue.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAppState } from '../app'
import { HubScreenShell } from '../components/HubScreenShell'
import { StarsRow } from '../components/game/StarsRow'
import {
	formatLocalDateRu,
	listRecentLocalDateKeys,
	localDateKey,
} from '../daily'
import { useGameSession } from '../game/session/GameSessionContext'
import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

interface DailyHubScreenProps {
	readonly onBack: () => void
	readonly onOpenGame: () => void
}

export function DailyHubScreen({ onBack, onOpenGame }: DailyHubScreenProps) {
	const theme = useTheme()
	const {
		daily,
		getDailySummary,
		discardStaleDailyIfDateChanged,
		startDailyPuzzle,
		buildRestoredDailySession,
		markDailySession,
		sessionSource,
	} = useAppState()
	const { startSession, restoreSession, isDirty } = useGameSession()
	const [busy, setBusy] = useState(false)
	// Re-evaluate local calendar date on foreground — never freeze mount-only todayKey.
	const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()))

	const refreshLocalDate = useCallback(() => {
		const next = localDateKey(new Date())
		setTodayKey((prev) => (prev === next ? prev : next))
		void discardStaleDailyIfDateChanged(next)
	}, [discardStaleDailyIfDateChanged])

	useEffect(() => {
		// Mount: discard stale Daily without cascading setState when already today.
		void discardStaleDailyIfDateChanged(localDateKey(new Date()))
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				refreshLocalDate()
			}
		})
		return () => {
			sub.remove()
		}
	}, [discardStaleDailyIfDateChanged, refreshLocalDate])

	const summary = getDailySummary(todayKey)

	const recentKeys = useMemo(
		() => listRecentLocalDateKeys(todayKey, 7),
		[todayKey],
	)

	const primaryAction = useMemo(() => {
		if (summary.hasActiveSession) {
			return {
				label: strings.dailyContinue,
				kind: 'continue' as const,
			}
		}
		if (summary.completedToday) {
			return {
				label: strings.dailyReplay,
				kind: 'replay' as const,
			}
		}
		return {
			label: strings.dailyPlay,
			kind: 'play' as const,
		}
	}, [summary.completedToday, summary.hasActiveSession])

	const launch = useCallback(async () => {
		if (busy) {
			return
		}
		setBusy(true)
		try {
			if (primaryAction.kind === 'continue') {
				// Re-evaluate calendar date before restoring yesterday's board.
				const nowKey = localDateKey(new Date())
				if (nowKey !== todayKey) {
					setTodayKey(nowKey)
				}
				await discardStaleDailyIfDateChanged(nowKey)
				const restored = buildRestoredDailySession()
				if (!restored) {
					// Stale unfinished Daily discarded — hub will show Play for today.
					return
				}
				markDailySession()
				restoreSession(restored)
				onOpenGame()
				return
			}

			if (
				isDirty &&
				sessionSource === 'campaign'
			) {
				Alert.alert(strings.replaceConfirmTitle, strings.replaceConfirmBody, [
					{ text: strings.cancel, style: 'cancel' },
					{
						text: strings.replaceConfirmOk,
						style: 'destructive',
						onPress: () => {
							void (async () => {
								const result = await startDailyPuzzle()
								if (!result.ok || !result.identity || !result.board) {
									Alert.alert(
										strings.errorTitle,
										result.reason ?? strings.errorGeneric,
									)
									return
								}
								startSession(result.identity, result.board, {
									undoAfterCompletion: false,
								})
								onOpenGame()
							})()
						},
					},
				])
				return
			}

			const result = await startDailyPuzzle()
			if (!result.ok || !result.identity || !result.board) {
				Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
				return
			}
			startSession(result.identity, result.board, {
				undoAfterCompletion: false,
			})
			onOpenGame()
		} finally {
			setBusy(false)
		}
	}, [
		buildRestoredDailySession,
		busy,
		discardStaleDailyIfDateChanged,
		isDirty,
		markDailySession,
		onOpenGame,
		primaryAction.kind,
		restoreSession,
		sessionSource,
		startDailyPuzzle,
		startSession,
		todayKey,
	])

	return (
		<HubScreenShell
			title={strings.dailyHubTitle}
			onBack={onBack}
			testID="screen-daily"
		>
			<Text style={[styles.date, { color: theme.colors.text }]}>
				{strings.dailyToday(formatLocalDateRu(todayKey))}
			</Text>
			<Text style={[styles.body, { color: theme.colors.textMuted }]}>
				{summary.completedToday
					? strings.dailyStatusCompleted
					: summary.hasActiveSession
						? strings.dailyStatusInProgress
						: strings.dailyStatusOpen}
			</Text>
			<View style={styles.streakRow}>
				<Text style={[styles.streak, { color: theme.colors.text }]}>
					{strings.dailyStreakActive(summary.activeStreak)}
				</Text>
				<Text style={{ color: theme.colors.textMuted }}>
					{strings.dailyStreakBest(summary.bestStreak)}
				</Text>
			</View>

			<Pressable
				onPress={() => void launch()}
				disabled={busy}
				style={[
					styles.primary,
					{ backgroundColor: theme.colors.controlPrimary },
				]}
				testID="daily-primary-cta"
				accessibilityRole="button"
				accessibilityLabel={primaryAction.label}
			>
				<Text
					style={[
						styles.primaryText,
						{ color: theme.colors.controlPrimaryText },
					]}
				>
					{primaryAction.label}
				</Text>
			</Pressable>

			<Text style={[styles.section, { color: theme.colors.text }]}>
				{strings.dailyRecentTitle}
			</Text>
			<View style={styles.historyStrip}>
				{recentKeys.map((key) => {
					const entry = daily.history.find((row) => row.dateKey === key)
					const done = entry?.completed === true
					return (
						<View
							key={key}
							style={[
								styles.historyCell,
								{
									borderColor: theme.colors.border,
									backgroundColor: theme.colors.surface,
								},
							]}
							testID={`daily-history-${key}`}
						>
							<Text
								style={{
									color: theme.colors.textMuted,
									fontSize: 10,
								}}
							>
								{key.slice(8)}
							</Text>
							{done && entry ? (
								<StarsRow stars={entry.bestStars} size="sm" />
							) : (
								<Text style={{ color: theme.colors.textMuted }}>—</Text>
							)}
						</View>
					)
				})}
			</View>
		</HubScreenShell>
	)
}

const styles = StyleSheet.create({
	date: {
		...typography.title,
		fontSize: 22,
		textAlign: 'center',
	},
	body: {
		...typography.body,
		textAlign: 'center',
	},
	streakRow: {
		alignItems: 'center',
		gap: spacing.xs,
	},
	streak: {
		...typography.subtitle,
		fontWeight: '700',
	},
	primary: {
		minHeight: 52,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	primaryText: {
		fontWeight: '700',
		fontSize: 16,
	},
	section: {
		...typography.caption,
		fontWeight: '700',
		marginTop: spacing.md,
	},
	historyStrip: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		justifyContent: 'center',
	},
	historyCell: {
		width: 44,
		alignItems: 'center',
		paddingVertical: spacing.xs,
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 2,
	},
})
