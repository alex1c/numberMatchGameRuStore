/**
 * DEV Density Lab — compare solver-proven boards of different widths/rows.
 * Production builds must never mount this screen (__DEV__ gate at call sites).
 */

import { useCallback, useMemo, useState } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
} from 'react-native'

import { useAppState } from '../app'
import {
	DENSITY_REFERENCE_CONTENT_WIDTH,
	DENSITY_REFERENCE_VIEWPORT_HEIGHT,
	computeViewportFill,
	getDensityFixtures,
	loadDensityFixture,
	type DensityFixtureId,
	type DensityFixtureMeta,
} from '../dev/density'
import { useGameSession } from '../game/session/GameSessionContext'
import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

interface DensityLabScreenProps {
	readonly onHome: () => void
	readonly onOpenGame: () => void
}

export function DensityLabScreen({
	onHome,
	onOpenGame,
}: DensityLabScreenProps) {
	const theme = useTheme()
	const { markDevFixtureSession, sessionSource } = useAppState()
	const { startSession, isDirty, session } = useGameSession()
	const [busyId, setBusyId] = useState<string | null>(null)

	const fixtures = useMemo(() => getDensityFixtures(), [])

	const launch = useCallback(
		(id: DensityFixtureId) => {
			const run = () => {
				setBusyId(id)
				try {
					const loaded = loadDensityFixture(id)
					if (!loaded.ok) {
						Alert.alert('Ошибка', loaded.error)
						return
					}
					// Non-persistent DEV path — Campaign Continue stays intact.
					markDevFixtureSession()
					startSession(loaded.identity, loaded.board)
					onOpenGame()
				} finally {
					setBusyId(null)
				}
			}

			const dirtyDev =
				sessionSource === 'dev_fixture' &&
				isDirty &&
				session &&
				!session.completed
			if (dirtyDev) {
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
		[
			isDirty,
			markDevFixtureSession,
			onOpenGame,
			session,
			sessionSource,
			startSession,
		],
	)

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.colors.background }}
			contentContainerStyle={styles.root}
			testID="density-lab-screen"
		>
			<Text
				style={[styles.title, { color: theme.colors.text }]}
				accessibilityRole="header"
			>
				{strings.densityLabTitle}
			</Text>
			<Text style={[styles.note, { color: theme.colors.textMuted }]}>
				{strings.densityLabNote}
			</Text>

			{fixtures.map((fixture) => (
				<FixtureCard
					key={fixture.id}
					fixture={fixture}
					busy={busyId === fixture.id}
					onPress={() => launch(fixture.id)}
				/>
			))}

			<Pressable
				onPress={onHome}
				style={[styles.link, { borderColor: theme.colors.border }]}
				accessibilityRole="button"
				accessibilityLabel={strings.home}
				testID="density-lab-home"
			>
				<Text style={{ color: theme.colors.accent }}>{strings.home}</Text>
			</Pressable>
		</ScrollView>
	)
}

function FixtureCard({
	fixture,
	busy,
	onPress,
}: {
	readonly fixture: DensityFixtureMeta
	readonly busy: boolean
	readonly onPress: () => void
}) {
	const theme = useTheme()
	const fill = computeViewportFill({
		viewportHeight: DENSITY_REFERENCE_VIEWPORT_HEIGHT,
		availableWidth: DENSITY_REFERENCE_CONTENT_WIDTH,
		boardWidth: fixture.width,
		cellCount: fixture.initialCells,
	})

	return (
		<Pressable
			onPress={onPress}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={fixture.label}
			style={[
				styles.card,
				{
					borderColor: theme.colors.border,
					backgroundColor: theme.colors.surface,
				},
			]}
			testID={`density-${fixture.id}`}
		>
			<Text style={[styles.cardTitle, { color: theme.colors.text }]}>
				{fixture.label}
				{busy ? '…' : ''}
			</Text>
			<Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
				{fixture.width}×{fixture.targetRows} · {fixture.initialCells} клеток ·
				ячейка ~{fill.cellSize}dp · fill ~{fill.viewportFillPercent}%
			</Text>
			<Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
				ходы {fixture.initialLegalMoves} · глубина {fixture.solutionDepth} ·
				добавл. {fixture.appendCount}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	root: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.lg,
		gap: spacing.sm,
		paddingBottom: spacing.xl,
	},
	title: {
		...typography.title,
		textAlign: 'center',
	},
	note: {
		...typography.caption,
		textAlign: 'center',
		marginBottom: spacing.sm,
	},
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		gap: 2,
	},
	cardTitle: {
		fontWeight: '700',
		fontSize: 16,
	},
	cardMeta: {
		fontSize: 12,
	},
	link: {
		marginTop: spacing.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		minHeight: 48,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
