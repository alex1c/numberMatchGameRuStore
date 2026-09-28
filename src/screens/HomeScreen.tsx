/**
 * Temporary playtest Home — launch representative puzzles / Continue session.
 * Not final product Home. DEV fixtures gated by __DEV__.
 */

import { useCallback, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
} from 'react-native'

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
	const { hasSession, isDirty, startSession, session } = useGameSession()
	const [busyId, setBusyId] = useState<string | null>(null)

	const launchFixture = useCallback(
		(fixture: PlaytestFixture) => {
			const run = () => {
				setBusyId(fixture.id)
				try {
					const loaded = loadPlaytestFixture(fixture)
					if (!loaded.ok) {
						Alert.alert('Ошибка', loaded.error)
						return
					}
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
		[isDirty, onNavigate, startSession],
	)

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
				{strings.sessionInMemory}
			</Text>

			{hasSession && session ? (
				<Pressable
					onPress={() => onNavigate('game')}
					style={[
						styles.primary,
						{ backgroundColor: theme.colors.controlPrimary },
					]}
					accessibilityRole="button"
					accessibilityLabel={strings.continue}
					testID="btn-continue"
				>
					<Text
						style={[
							styles.primaryText,
							{ color: theme.colors.controlPrimaryText },
						]}
					>
						{strings.continue}
						{session.identity.label
							? ` · ${session.identity.label}`
							: ''}
					</Text>
				</Pressable>
			) : null}

			<Text style={[styles.section, { color: theme.colors.text }]}>
				Playtest
			</Text>
			{PLAYTEST_PROFILE_FIXTURES.map((fixture) => (
				<FixtureButton
					key={fixture.id}
					fixture={fixture}
					busy={busyId === fixture.id}
					onPress={() => launchFixture(fixture)}
				/>
			))}

			{__DEV__ ? (
				<>
					<Text style={[styles.section, { color: theme.colors.accent }]}>
						{strings.devFixtures}
					</Text>
					{DEV_EXTENDED_FIXTURES.map((fixture) => (
						<FixtureButton
							key={fixture.id}
							fixture={fixture}
							busy={busyId === fixture.id}
							onPress={() => launchFixture(fixture)}
							dev
						/>
					))}
				</>
			) : null}

			<Text style={[styles.section, { color: theme.colors.textMuted }]}>
				Другое
			</Text>
			<Pressable
				onPress={() => onNavigate('training')}
				style={[styles.link, { borderColor: theme.colors.border }]}
				testID="nav-training"
			>
				<Text style={{ color: theme.colors.text }}>{strings.rules}</Text>
				<Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
					{strings.trainingNote}
				</Text>
			</Pressable>
			{(
				[
					['levels', 'Levels'],
					['daily', 'Daily'],
					['statistics', 'Statistics'],
					['achievements', 'Achievements'],
					['settings', 'Settings'],
					['about', 'About'],
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
		</ScrollView>
	)
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
				{dev
					? `${fixture.note} · seed ${fixture.seed}`
					: fixture.note}
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
})
