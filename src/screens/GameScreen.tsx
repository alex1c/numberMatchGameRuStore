/**
 * Production-quality playable Game screen (PHASE 4).
 * Layout: SAFE TOP → HEADER → META → BOARD (flex/scroll) → STATUS → CONTROLS → SAFE BOTTOM
 * Default: no Game banner. DEV may toggle reserve slot for measurement.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Alert,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { BannerSlot } from '../components/BannerSlot'
import { CompletionOverlay } from '../components/game/CompletionOverlay'
import { GameControls } from '../components/game/GameControls'
import { GameHeader } from '../components/game/GameHeader'
import { NumberBoard } from '../components/game/NumberBoard'
import { strings } from '../i18n/strings.ru'
import { useGameSession } from '../game/session/GameSessionContext'
import { BANNER_SLOT_HEIGHT, spacing, typography, useTheme } from '../theme'

interface GameScreenProps {
	readonly onHome: () => void
	readonly onTraining: () => void
}

/**
 * DEV-only geometry experiment. Production always false — no empty 50px hole.
 */
const DEV_GAME_BANNER_EXPERIMENT =
	typeof __DEV__ !== 'undefined' && __DEV__
		? false
		: false

export function GameScreen({ onHome, onTraining }: GameScreenProps) {
	const theme = useTheme()
	const { session, dispatch, requestHint, isDirty } = useGameSession()
	const [dismissedCompletionKey, setDismissedCompletionKey] = useState<
		string | null
	>(null)
	const [scrollToEndToken, setScrollToEndToken] = useState(0)
	const [showBannerSlot, setShowBannerSlot] = useState(DEV_GAME_BANNER_EXPERIMENT)
	const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (feedbackTimer.current) {
				clearTimeout(feedbackTimer.current)
			}
			if (hintTimer.current) {
				clearTimeout(hintTimer.current)
			}
		}
	}, [])

	// Clear brief invalid tint.
	useEffect(() => {
		if (!session || session.invalidIndices.length === 0) {
			return
		}
		if (feedbackTimer.current) {
			clearTimeout(feedbackTimer.current)
		}
		feedbackTimer.current = setTimeout(() => {
			dispatch({ type: 'CLEAR_FEEDBACK' })
		}, 220)
	}, [session?.invalidIndices, dispatch, session])

	// Clear hint highlight after a short reveal.
	useEffect(() => {
		if (!session || session.hintIndices.length === 0) {
			return
		}
		if (hintTimer.current) {
			clearTimeout(hintTimer.current)
		}
		hintTimer.current = setTimeout(() => {
			dispatch({ type: 'CLEAR_HINT' })
		}, 1600)
	}, [session?.hintIndices, dispatch, session])

	const confirmRestart = useCallback(() => {
		if (!session) {
			return
		}
		if (!isDirty && session.history.length === 0) {
			dispatch({ type: 'RESTART' })
			return
		}
		Alert.alert(strings.restartConfirmTitle, strings.restartConfirmBody, [
			{ text: strings.cancel, style: 'cancel' },
			{
				text: strings.restartConfirmOk,
				style: 'destructive',
				onPress: () => dispatch({ type: 'RESTART' }),
			},
		])
	}, [dispatch, isDirty, session])

	const handleAppend = useCallback(() => {
		dispatch({ type: 'APPEND' })
		setScrollToEndToken((n) => n + 1)
	}, [dispatch])

	const handleCellPress = useCallback(
		(index: number) => {
			dispatch({ type: 'SELECT_CELL', index })
		},
		[dispatch],
	)

	if (!session) {
		return (
			<View
				style={[styles.root, { backgroundColor: theme.colors.background }]}
				testID="game-empty"
			>
				<Text style={{ color: theme.colors.textMuted }}>
					Нет активной сессии
				</Text>
				<Pressable onPress={onHome} accessibilityRole="button">
					<Text style={{ color: theme.colors.accent }}>{strings.home}</Text>
				</Pressable>
			</View>
		)
	}

	const statusText = resolveStatus(session)
	const appendEnabled =
		!session.completed &&
		!session.hasAvailableMoves &&
		session.board.cells.some((c) => !c.removed)
	const completionKey = session.completed
		? `${session.identity.fingerprint}:${session.counters.matchesRemoved}:${session.counters.undoActions}`
		: null
	const showCompletion =
		completionKey !== null && completionKey !== dismissedCompletionKey

	const shortFp =
		session.identity.fingerprint.length > 10
			? session.identity.fingerprint.slice(0, 10)
			: session.identity.fingerprint

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID="game-screen"
		>
			<GameHeader
				title={strings.appName}
				subtitle={`${session.identity.label} · ${shortFp}`}
				onBack={onHome}
				onRestart={confirmRestart}
				onRules={onTraining}
				onHome={onHome}
			/>

			<View style={styles.meta}>
				<Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
					{session.identity.profile} · seed {session.identity.seed}
					{__DEV__
						? ` · ${session.counters.matchesRemoved}п/${session.counters.appendActions}+`
						: ''}
				</Text>
			</View>

			<NumberBoard
				board={session.board}
				selectedIndex={session.selectedIndex}
				invalidIndices={session.invalidIndices}
				hintIndices={session.hintIndices}
				onCellPress={handleCellPress}
				interactionLocked={session.interactionLocked || session.hintBusy}
				scrollToEndToken={scrollToEndToken}
			/>

			<Text
				style={[styles.status, { color: theme.colors.textMuted }]}
				testID="game-status"
			>
				{statusText}
			</Text>

			{!session.completed ? (
				<GameControls
					canUndo={session.history.length > 0}
					canAppend={appendEnabled}
					appendPrimary={appendEnabled}
					canHint={!session.hintBusy}
					hintBusy={session.hintBusy}
					onUndo={() => dispatch({ type: 'UNDO' })}
					onAppend={handleAppend}
					onHint={requestHint}
				/>
			) : null}

			{__DEV__ ? (
				<Pressable
					onPress={() => setShowBannerSlot((v) => !v)}
					style={styles.devToggle}
					testID="dev-banner-toggle"
				>
					<Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
						DEV BannerSlot {showBannerSlot ? 'ON' : 'OFF'} ({BANNER_SLOT_HEIGHT}
						px)
					</Text>
				</Pressable>
			) : null}

			{showBannerSlot ? <BannerSlot visible /> : null}

			<CompletionOverlay
				visible={showCompletion}
				profileLabel={String(session.identity.label)}
				counters={session.counters}
				canUndo={session.history.length > 0}
				onUndo={() => {
					dispatch({ type: 'UNDO' })
				}}
				onRestart={confirmRestart}
				onHome={onHome}
				onClose={() => {
					if (completionKey) {
						setDismissedCompletionKey(completionKey)
					}
				}}
			/>
		</View>
	)
}

function resolveStatus(
	session: NonNullable<ReturnType<typeof useGameSession>['session']>,
): string {
	if (session.statusMessage === 'cleared' || session.completed) {
		return strings.statusCleared
	}
	if (session.statusMessage === strings.hintAppend) {
		return strings.hintAppend
	}
	if (session.statusMessage === strings.hintUnavailable) {
		return strings.hintUnavailable
	}
	if (session.statusMessage === strings.hintReady) {
		return strings.hintReady
	}
	if (
		!session.hasAvailableMoves &&
		!session.completed &&
		session.board.cells.some((c) => !c.removed)
	) {
		return strings.statusStuck
	}
	if (session.selectedIndex !== null) {
		return strings.statusSelectSecond
	}
	return strings.statusSelect
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	meta: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	metaText: {
		...typography.caption,
		textAlign: 'center',
	},
	status: {
		...typography.caption,
		textAlign: 'center',
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		minHeight: 22,
	},
	devToggle: {
		alignItems: 'center',
		paddingBottom: 2,
	},
})
