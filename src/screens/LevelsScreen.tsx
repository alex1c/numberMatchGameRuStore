/**
 * Campaign levels grid — 1000 levels, responsive columns from width/dp.
 */

import { useCallback, useMemo, useRef } from 'react'
import {
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
	type FlatList as FlatListType,
	type ListRenderItemInfo,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppState } from '../app'
import { CAMPAIGN_LEVEL_COUNT } from '../game/campaign'
import { useGameSession } from '../game/session/GameSessionContext'
import { strings } from '../i18n/strings.ru'
import { BANNER_SLOT_HEIGHT, spacing, typography, useTheme } from '../theme'

const CELL_MIN_DP = 56
const LEVELS: readonly number[] = Array.from(
	{ length: CAMPAIGN_LEVEL_COUNT },
	(_, i) => i + 1,
)

type LevelVisualState =
	| 'completed'
	| 'unlocked'
	| 'locked'
	| 'active'
	| 'replay_active'

interface LevelsScreenProps {
	readonly onHome: () => void
	readonly onOpenGame: () => void
}

export function LevelsScreen({ onHome, onOpenGame }: LevelsScreenProps) {
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const {
		highestCompletedLevel,
		activeSession,
		startCampaignLevel,
		sessionSource,
	} = useAppState()
	const { isDirty, startSession, clearSession } = useGameSession()
	const startingRef = useRef(false)
	const listRef = useRef<FlatListType<number>>(null)

	const numColumns = useMemo(
		() => Math.max(4, Math.floor(width / CELL_MIN_DP)),
		[width],
	)

	const cellSize = useMemo(() => {
		const gap = spacing.xs
		const horizontalPad = spacing.md * 2
		const usable = width - horizontalPad - gap * (numColumns - 1)
		return Math.floor(usable / numColumns)
	}, [numColumns, width])

	const initialIndex = useMemo(() => {
		if (activeSession?.status === 'in_progress') {
			return Math.max(0, activeSession.level - 1)
		}
		return Math.max(0, highestCompletedLevel)
	}, [activeSession, highestCompletedLevel])

	const resolveState = useCallback(
		(level: number): LevelVisualState => {
			if (
				activeSession &&
				activeSession.level === level &&
				activeSession.status === 'in_progress'
			) {
				return activeSession.purpose === 'replay' ? 'replay_active' : 'active'
			}
			if (level <= highestCompletedLevel) {
				return 'completed'
			}
			if (level === highestCompletedLevel + 1) {
				return 'unlocked'
			}
			return 'locked'
		},
		[activeSession, highestCompletedLevel],
	)

	const a11yFor = useCallback(
		(level: number, state: LevelVisualState): string => {
			switch (state) {
				case 'locked':
					return strings.levelA11yLocked(level)
				case 'completed':
					return strings.levelA11yCompleted(level)
				case 'unlocked':
					return strings.levelA11yUnlocked(level)
				case 'active':
					return strings.levelA11yActive(level)
				case 'replay_active':
					return strings.levelA11yReplay(level)
				default: {
					const _exhaustive: never = state
					return _exhaustive
				}
			}
		},
		[],
	)

	const launchLevel = useCallback(
		async (level: number, purpose: 'progression' | 'replay') => {
			if (startingRef.current) {
				return
			}
			startingRef.current = true
			try {
				const result = await startCampaignLevel(level, purpose)
				if (!result.ok || !result.identity || !result.board) {
					Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
					return
				}
				startSession(result.identity, result.board, {
					undoAfterCompletion: false,
				})
				onOpenGame()
			} finally {
				startingRef.current = false
			}
		},
		[onOpenGame, startCampaignLevel, startSession],
	)

	const confirmAndLaunch = useCallback(
		(level: number, purpose: 'progression' | 'replay') => {
			const dirtyCampaign =
				sessionSource === 'campaign' &&
				isDirty &&
				activeSession?.status === 'in_progress'

			const run = () => {
				void launchLevel(level, purpose)
			}

			if (dirtyCampaign) {
				Alert.alert(strings.replaceConfirmTitle, strings.replaceConfirmBody, [
					{ text: strings.cancel, style: 'cancel' },
					{
						text: strings.replaceConfirmOk,
						style: 'destructive',
						onPress: () => {
							clearSession()
							run()
						},
					},
				])
				return
			}
			run()
		},
		[
			activeSession?.status,
			clearSession,
			isDirty,
			launchLevel,
			sessionSource,
		],
	)

	const onPressLevel = useCallback(
		(level: number) => {
			const state = resolveState(level)
			if (state === 'locked') {
				return
			}
			if (state === 'completed' || state === 'replay_active') {
				confirmAndLaunch(level, 'replay')
				return
			}
			// unlocked or active progression
			confirmAndLaunch(level, 'progression')
		},
		[confirmAndLaunch, resolveState],
	)

	const renderItem = useCallback(
		({ item: level }: ListRenderItemInfo<number>) => {
			const state = resolveState(level)
			const locked = state === 'locked'
			const bg =
				state === 'completed'
					? theme.colors.accent
					: state === 'active' || state === 'replay_active'
						? theme.colors.controlPrimary
						: state === 'unlocked'
							? theme.colors.surface
							: theme.colors.controlDisabled
			const fg =
				state === 'completed' ||
				state === 'active' ||
				state === 'replay_active'
					? theme.colors.controlPrimaryText
					: locked
						? theme.colors.controlDisabledText
						: theme.colors.text

			return (
				<Pressable
					onPress={() => onPressLevel(level)}
					disabled={locked}
					accessibilityRole="button"
					accessibilityState={{ disabled: locked }}
					accessibilityLabel={a11yFor(level, state)}
					style={[
						styles.cell,
						{
							width: cellSize,
							height: cellSize,
							backgroundColor: bg,
							borderColor: theme.colors.border,
						},
					]}
					testID={`level-cell-${level}`}
				>
					<Text style={[styles.cellText, { color: fg }]}>{level}</Text>
					{state === 'active' || state === 'replay_active' ? (
						<View
							style={[
								styles.marker,
								{ backgroundColor: theme.colors.controlPrimaryText },
							]}
						/>
					) : null}
				</Pressable>
			)
		},
		[a11yFor, cellSize, onPressLevel, resolveState, theme],
	)

	const bottomPad = insets.bottom + BANNER_SLOT_HEIGHT + spacing.lg

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID="levels-screen"
		>
			<View style={styles.header}>
				<Pressable
					onPress={onHome}
					accessibilityRole="button"
					accessibilityLabel={strings.back}
					testID="levels-back"
					style={styles.backBtn}
				>
					<Text style={{ color: theme.colors.accent, fontSize: 22 }}>←</Text>
				</Pressable>
				<Text
					style={[styles.title, { color: theme.colors.text }]}
					accessibilityRole="header"
				>
					{strings.levelsTitle}
				</Text>
				<View style={styles.backBtn} />
			</View>
			<Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
				{strings.progressCleared(highestCompletedLevel, CAMPAIGN_LEVEL_COUNT)}
			</Text>
			<FlatList
				data={LEVELS}
				key={numColumns}
				numColumns={numColumns}
				keyExtractor={(item) => String(item)}
				renderItem={renderItem}
				initialScrollIndex={Math.min(initialIndex, CAMPAIGN_LEVEL_COUNT - 1)}
				getItemLayout={(_, index) => {
					const row = Math.floor(index / numColumns)
					const length = cellSize + spacing.xs
					return { length, offset: length * row, index }
				}}
				onScrollToIndexFailed={(info) => {
					// Android may fail first paint — retry after layout.
					setTimeout(() => {
						listRef.current?.scrollToIndex({
							index: info.index,
							animated: false,
						})
					}, 100)
				}}
				contentContainerStyle={{
					paddingHorizontal: spacing.md,
					paddingBottom: bottomPad,
					gap: spacing.xs,
				}}
				columnWrapperStyle={{ gap: spacing.xs }}
				windowSize={11}
				testID="levels-list"
				ref={listRef}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
	},
	backBtn: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		...typography.subtitle,
		fontWeight: '700',
		flex: 1,
		textAlign: 'center',
	},
	subtitle: {
		...typography.caption,
		textAlign: 'center',
		marginBottom: spacing.sm,
	},
	cell: {
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cellText: {
		fontWeight: '700',
		fontSize: 14,
	},
	marker: {
		position: 'absolute',
		bottom: 6,
		width: 6,
		height: 6,
		borderRadius: 3,
	},
})
