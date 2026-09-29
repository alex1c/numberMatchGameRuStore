/**
 * Production Home — campaign CTA, levels, training replay.
 * DEV fixtures stay below the fold and never persist campaign activeSession.
 */

import { useCallback, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import {
	formatDevDiagnostics,
	frontierLevel,
	useAppState,
} from '../app'
import { CAMPAIGN_LEVEL_COUNT } from '../game/campaign'
import {
	DEV_EXTENDED_FIXTURES,
	PLAYTEST_PROFILE_FIXTURES,
	loadPlaytestFixture,
	type PlaytestFixture,
} from '../game/session'
import { useGameSession } from '../game/session/GameSessionContext'
import { strings } from '../i18n/strings.ru'
import { APP_IDENTITY } from '../services/identity'
import { spacing, typography, useTheme } from '../theme'
import type { AppRouteName } from '../navigation'

interface HomeScreenProps {
	readonly onNavigate: (route: AppRouteName) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
	const theme = useTheme()
	const {
		highestCompletedLevel,
		activeSession,
		sessionSource,
		startCampaignLevel,
		resetProgress,
		markDevFixtureSession,
		clearActiveSession,
		root,
	} = useAppState()
	const { hasSession, isDirty, startSession, clearSession, session } =
		useGameSession()
	const [busyId, setBusyId] = useState<string | null>(null)
	const [starting, setStarting] = useState(false)

	const frontier = frontierLevel(highestCompletedLevel)
	const campaignDone = highestCompletedLevel >= CAMPAIGN_LEVEL_COUNT

	const primaryCta = resolvePrimaryCta({
		activeSession,
		highestCompletedLevel,
		campaignDone,
		frontier,
	})

	const confirmIfDirty = useCallback(
		(run: () => void) => {
			const dirtyCampaign =
				sessionSource === 'campaign' &&
				isDirty &&
				activeSession?.status === 'in_progress'
			if (dirtyCampaign) {
				Alert.alert(strings.replaceConfirmTitle, strings.replaceConfirmBody, [
					{ text: strings.cancel, style: 'cancel' },
					{
						text: strings.replaceConfirmOk,
						style: 'destructive',
						onPress: run,
					},
				])
				return
			}
			run()
		},
		[activeSession?.status, isDirty, sessionSource],
	)

	const launchCampaign = useCallback(
		async (level: number, purpose: 'progression' | 'replay') => {
			if (starting) {
				return
			}
			setStarting(true)
			try {
				const result = await startCampaignLevel(level, purpose)
				if (!result.ok || !result.identity || !result.board) {
					Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
					return
				}
				startSession(result.identity, result.board, {
					undoAfterCompletion: false,
				})
				onNavigate('game')
			} finally {
				setStarting(false)
			}
		},
		[onNavigate, startCampaignLevel, startSession, starting],
	)

	const handlePrimary = () => {
		if (primaryCta.kind === 'continue') {
			onNavigate('game')
			return
		}
		if (primaryCta.kind === 'levels') {
			onNavigate('levels')
			return
		}
		confirmIfDirty(() => {
			void launchCampaign(primaryCta.level, primaryCta.purpose)
		})
	}

	const launchFixture = useCallback(
		(fixture: PlaytestFixture) => {
			const run = () => {
				setBusyId(fixture.id)
				try {
					const loaded = loadPlaytestFixture(fixture)
					if (!loaded.ok) {
						Alert.alert(strings.errorTitle, loaded.error)
						return
					}
					// DEV fixtures are NON-persistent — do not write campaign activeSession.
					markDevFixtureSession()
					startSession(loaded.identity, loaded.board)
					onNavigate('game')
				} finally {
					setBusyId(null)
				}
			}

			if (isDirty) {
				Alert.alert(strings.replaceConfirmTitle, strings.replaceConfirmBody, [
					{ text: strings.cancel, style: 'cancel' },
					{
						text: strings.replaceConfirmOk,
						style: 'destructive',
						onPress: run,
					},
				])
				return
			}
			run()
		},
		[isDirty, markDevFixtureSession, onNavigate, startSession],
	)

	const handleDevReset = useCallback(() => {
		Alert.alert(strings.devResetProgress, strings.replaceConfirmBody, [
			{ text: strings.cancel, style: 'cancel' },
			{
				text: strings.devResetProgress,
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await resetProgress()
						clearSession()
						await clearActiveSession()
					})()
				},
			},
		])
	}, [clearActiveSession, clearSession, resetProgress])

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.colors.background }}
			contentContainerStyle={styles.root}
			testID="home-screen"
		>
			<Text
				style={[styles.title, { color: theme.colors.text }]}
				accessibilityRole="header"
			>
				{APP_IDENTITY.displayName}
			</Text>
			<Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
				{strings.homeSubtitle}
			</Text>
			<Text style={[styles.note, { color: theme.colors.textMuted }]}>
				{campaignDone
					? strings.campaignComplete
					: strings.progressCleared(
							highestCompletedLevel,
							CAMPAIGN_LEVEL_COUNT,
						)}
			</Text>
			{!campaignDone ? (
				<Text style={[styles.note, { color: theme.colors.textMuted }]}>
					{strings.progressLevel(frontier, CAMPAIGN_LEVEL_COUNT)}
				</Text>
			) : null}

			<Pressable
				onPress={handlePrimary}
				disabled={starting}
				style={[
					styles.primary,
					{ backgroundColor: theme.colors.controlPrimary },
				]}
				accessibilityRole="button"
				accessibilityLabel={primaryCta.label}
				testID="btn-primary-cta"
			>
				<Text
					style={[
						styles.primaryText,
						{ color: theme.colors.controlPrimaryText },
					]}
				>
					{primaryCta.label}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => onNavigate('levels')}
				style={[styles.link, { borderColor: theme.colors.border }]}
				testID="nav-levels"
				accessibilityRole="button"
				accessibilityLabel={strings.levels}
			>
				<Text style={{ color: theme.colors.text, fontWeight: '600' }}>
					{strings.levels}
				</Text>
			</Pressable>

			<Pressable
				onPress={() => onNavigate('training')}
				style={[styles.link, { borderColor: theme.colors.border }]}
				testID="nav-training"
				accessibilityRole="button"
				accessibilityLabel={strings.training}
			>
				<Text style={{ color: theme.colors.text, fontWeight: '600' }}>
					{strings.training}
				</Text>
				<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
					{strings.trainingNote}
				</Text>
			</Pressable>

			{(
				[
					['daily', 'Ежедневная'],
					['statistics', 'Статистика'],
					['achievements', 'Достижения'],
					['settings', 'Настройки'],
					['about', 'О приложении'],
				] as const
			).map(([route, label]) => (
				<Pressable
					key={route}
					onPress={() => onNavigate(route)}
					style={[styles.link, { borderColor: theme.colors.border }]}
					testID={`nav-${route}`}
				>
					<Text style={{ color: theme.colors.textMuted }}>{label}</Text>
				</Pressable>
			))}

			{typeof __DEV__ !== 'undefined' && __DEV__ ? (
				<View style={styles.devBlock} testID="dev-section">
					<Text style={[styles.section, { color: theme.colors.accent }]}>
						{strings.devSection}
					</Text>
					<Text style={[styles.note, { color: theme.colors.textMuted }]}>
						{formatDevDiagnostics(root)}
					</Text>
					<Pressable
						onPress={() => onNavigate('densityLab')}
						style={[
							styles.primary,
							{ backgroundColor: theme.colors.controlSecondary },
						]}
						accessibilityRole="button"
						accessibilityLabel={strings.densityLabEntry}
						testID="dev-density-lab"
					>
						<Text
							style={[styles.primaryText, { color: theme.colors.text }]}
						>
							{strings.densityLabEntry}
						</Text>
					</Pressable>
					{hasSession && session && sessionSource === 'dev_fixture' ? (
						<Pressable
							onPress={() => onNavigate('game')}
							style={[styles.link, { borderColor: theme.colors.border }]}
						>
							<Text style={{ color: theme.colors.text }}>
								{strings.continue} · {session.identity.label}
							</Text>
						</Pressable>
					) : null}
					{PLAYTEST_PROFILE_FIXTURES.map((fixture) => (
						<FixtureButton
							key={fixture.id}
							fixture={fixture}
							busy={busyId === fixture.id}
							onPress={() => launchFixture(fixture)}
						/>
					))}
					{DEV_EXTENDED_FIXTURES.map((fixture) => (
						<FixtureButton
							key={fixture.id}
							fixture={fixture}
							busy={busyId === fixture.id}
							onPress={() => launchFixture(fixture)}
							dev
						/>
					))}
					<Pressable
						onPress={handleDevReset}
						style={[styles.link, { borderColor: theme.colors.danger }]}
						testID="dev-reset-progress"
					>
						<Text style={{ color: theme.colors.danger }}>
							{strings.devResetProgress}
						</Text>
					</Pressable>
				</View>
			) : null}
		</ScrollView>
	)
}

function resolvePrimaryCta(input: {
	readonly activeSession: ReturnType<typeof useAppState>['activeSession']
	readonly highestCompletedLevel: number
	readonly campaignDone: boolean
	readonly frontier: number
}): {
	readonly kind: 'continue' | 'start' | 'next' | 'levels'
	readonly label: string
	readonly level: number
	readonly purpose: 'progression' | 'replay'
} {
	const { activeSession, highestCompletedLevel, campaignDone, frontier } = input

	if (activeSession?.status === 'in_progress') {
		return {
			kind: 'continue',
			label: strings.continueLevel(activeSession.level),
			level: activeSession.level,
			purpose: activeSession.purpose,
		}
	}

	if (
		activeSession?.status === 'completed' &&
		activeSession.purpose === 'progression' &&
		!campaignDone
	) {
		const next = Math.min(
			CAMPAIGN_LEVEL_COUNT,
			Math.max(activeSession.level + 1, frontier),
		)
		return {
			kind: 'next',
			label: strings.nextLevelCta(next),
			level: next,
			purpose: 'progression',
		}
	}

	if (campaignDone) {
		return {
			kind: 'levels',
			label: strings.levels,
			level: CAMPAIGN_LEVEL_COUNT,
			purpose: 'replay',
		}
	}

	return {
		kind: 'start',
		label:
			highestCompletedLevel === 0
				? strings.play
				: strings.startLevel(frontier),
		level: frontier,
		purpose: 'progression',
	}
}

function FixtureButton({
	fixture,
	busy,
	onPress,
	dev = false,
}: {
	readonly fixture: PlaytestFixture
	readonly busy: boolean
	readonly onPress: () => void
	readonly dev?: boolean
}) {
	const theme = useTheme()
	return (
		<Pressable
			onPress={onPress}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={fixture.label}
			style={[
				styles.link,
				{
					borderColor: theme.colors.border,
					backgroundColor: theme.colors.surface,
				},
			]}
			testID={`fixture-${fixture.id}`}
		>
			<Text style={{ color: theme.colors.text, fontWeight: '600' }}>
				{fixture.label}
				{busy ? '…' : ''}
			</Text>
			<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
				{dev ? `${fixture.note} · seed ${fixture.seed}` : fixture.note}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	root: {
		alignItems: 'stretch',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.lg,
		gap: spacing.sm,
		paddingBottom: spacing.xl,
	},
	title: {
		...typography.title,
		textAlign: 'center',
	},
	subtitle: {
		...typography.subtitle,
		textAlign: 'center',
	},
	note: {
		...typography.caption,
		textAlign: 'center',
		marginBottom: spacing.sm,
	},
	section: {
		...typography.caption,
		fontWeight: '700',
		marginTop: spacing.md,
		letterSpacing: 0.5,
	},
	primary: {
		minHeight: 52,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.md,
	},
	primaryText: {
		fontWeight: '700',
		fontSize: 16,
	},
	link: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		gap: 2,
	},
	devBlock: {
		marginTop: spacing.lg,
		gap: spacing.sm,
	},
})
