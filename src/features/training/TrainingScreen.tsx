/**
 * Interactive Training screen — real boards, required taps, no ads.
 * On final required action → persist trainingCompleted before CTA.
 * First-launch CTA → Level 1 (replace). Replay Finish → Home only.
 */

import { useCallback, useMemo, useState } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { NumberBoard } from '../../components/game/NumberBoard'
import {
	appendRemainingNumbers,
	canMatch,
	hasAvailableMoves,
	removePair,
	type BoardState,
} from '../../game/core'
import { useAppState } from '../../app'
import { strings } from '../../i18n/strings.ru'
import { spacing, typography, useTheme } from '../../theme'
import {
	TRAINING_STEPS,
	isRequiredPair,
	type TrainingStepDef,
} from './steps'

interface TrainingScreenProps {
	readonly onHome: () => void
	/** First-launch / no progress: start Level 1 via replace. */
	readonly onStartCampaign: () => void
	/** True when opened as replay from Home (Finish → Home only). */
	readonly isReplay?: boolean
}

export function TrainingScreen({
	onHome,
	onStartCampaign,
	isReplay = false,
}: TrainingScreenProps) {
	const theme = useTheme()
	const { completeTraining, highestCompletedLevel, trainingCompleted } =
		useAppState()

	// Capture first-launch intent before completeTraining flips trainingCompleted.
	const [openedBeforeComplete] = useState(() => !trainingCompleted)
	const [stepIndex, setStepIndex] = useState(0)
	const [board, setBoard] = useState<BoardState>(() =>
		TRAINING_STEPS[0]!.buildBoard(),
	)
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
	const [invalidIndices, setInvalidIndices] = useState<readonly number[]>([])
	const [feedback, setFeedback] = useState<string | null>(null)
	const [finished, setFinished] = useState(false)
	const [persisting, setPersisting] = useState(false)

	const step: TrainingStepDef = TRAINING_STEPS[stepIndex]!
	const isLast = stepIndex >= TRAINING_STEPS.length - 1

	const appendEnabled = useMemo(() => {
		if (step.required.type !== 'append') {
			return false
		}
		return (
			!hasAvailableMoves(board) &&
			board.cells.some((c) => !c.removed)
		)
	}, [board, step.required.type])

	const advanceAfterSuccess = useCallback(async () => {
		if (isLast) {
			setPersisting(true)
			try {
				// Persist trainingCompleted immediately before CTA (§ training).
				await completeTraining()
			} finally {
				setPersisting(false)
			}
			setFinished(true)
			return
		}
		const nextIndex = stepIndex + 1
		setStepIndex(nextIndex)
		setBoard(TRAINING_STEPS[nextIndex]!.buildBoard())
		setSelectedIndex(null)
		setInvalidIndices([])
		setFeedback(null)
	}, [completeTraining, isLast, stepIndex])

	const handleCellPress = useCallback(
		(index: number) => {
			if (finished || persisting) {
				return
			}
			if (step.required.type === 'append') {
				setFeedback(strings.trainingNeedAppend)
				return
			}
			const cell = board.cells[index]
			if (!cell || cell.removed) {
				return
			}

			if (selectedIndex === index) {
				setSelectedIndex(null)
				setInvalidIndices([])
				setFeedback(null)
				return
			}

			if (selectedIndex === null) {
				setSelectedIndex(index)
				setInvalidIndices([])
				setFeedback(null)
				return
			}

			const first = selectedIndex
			const second = index

			if (!canMatch(board, first, second)) {
				// Wrong tap: safe — gentle feedback, second becomes selection.
				setSelectedIndex(second)
				setInvalidIndices([first, second])
				setFeedback(strings.trainingWrongTap)
				return
			}

			if (!isRequiredPair(step.required, first, second)) {
				setSelectedIndex(second)
				setInvalidIndices([first, second])
				setFeedback(strings.trainingWrongPair)
				return
			}

			const removed = removePair(board, first, second)
			if (!removed.ok) {
				setSelectedIndex(second)
				setInvalidIndices([first, second])
				setFeedback(strings.trainingWrongTap)
				return
			}

			setBoard(removed.state)
			setSelectedIndex(null)
			setInvalidIndices([])
			setFeedback(strings.trainingStepDone)
			void advanceAfterSuccess()
		},
		[advanceAfterSuccess, board, finished, persisting, selectedIndex, step.required],
	)

	const handleAppend = useCallback(() => {
		if (finished || persisting || step.required.type !== 'append') {
			return
		}
		if (!appendEnabled) {
			setFeedback(strings.trainingNeedAppend)
			return
		}
		const next = appendRemainingNumbers(board)
		setBoard(next)
		setSelectedIndex(null)
		setInvalidIndices([])
		setFeedback(strings.trainingStepDone)
		void advanceAfterSuccess()
	}, [
		advanceAfterSuccess,
		appendEnabled,
		board,
		finished,
		persisting,
		step.required.type,
	])

	const handleFinishCta = useCallback(() => {
		// First-launch Finish → Level 1 when frontier is still 0.
		// Replay Finish → Home only (do not restart Level 1 if campaign progressed).
		const shouldStartLevel1 =
			openedBeforeComplete &&
			!isReplay &&
			highestCompletedLevel === 0
		if (shouldStartLevel1) {
			onStartCampaign()
			return
		}
		onHome()
	}, [
		highestCompletedLevel,
		isReplay,
		onHome,
		onStartCampaign,
		openedBeforeComplete,
	])

	if (finished) {
		return (
			<View
				style={[styles.root, { backgroundColor: theme.colors.background }]}
				testID="training-done"
			>
				<Text
					style={[styles.title, { color: theme.colors.text }]}
					accessibilityRole="header"
				>
					{strings.trainingDoneTitle}
				</Text>
				<Text style={[styles.body, { color: theme.colors.textMuted }]}>
					{strings.trainingDoneBody}
				</Text>
				<Pressable
					onPress={handleFinishCta}
					style={[
						styles.primary,
						{ backgroundColor: theme.colors.controlPrimary },
					]}
					accessibilityRole="button"
					accessibilityLabel={
						openedBeforeComplete &&
						!isReplay &&
						highestCompletedLevel === 0
							? strings.trainingStartGame
							: strings.home
					}
					testID="training-cta"
				>
					<Text
						style={[
							styles.primaryText,
							{ color: theme.colors.controlPrimaryText },
						]}
					>
						{openedBeforeComplete &&
						!isReplay &&
						highestCompletedLevel === 0
							? strings.trainingStartGame
							: strings.home}
					</Text>
				</Pressable>
			</View>
		)
	}

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID="training-screen"
		>
			<View style={styles.topBar}>
				<Pressable
					onPress={onHome}
					accessibilityRole="button"
					accessibilityLabel={strings.back}
					testID="training-back"
					style={styles.backBtn}
				>
					<Text style={{ color: theme.colors.accent, fontSize: 22 }}>←</Text>
				</Pressable>
				<Text
					style={[styles.progress, { color: theme.colors.textMuted }]}
					accessibilityLabel={strings.trainingProgress(
						stepIndex + 1,
						TRAINING_STEPS.length,
					)}
				>
					{strings.trainingProgress(stepIndex + 1, TRAINING_STEPS.length)}
				</Text>
				<View style={styles.backBtn} />
			</View>

			<Text
				style={[styles.title, { color: theme.colors.text }]}
				accessibilityRole="header"
			>
				{step.title}
			</Text>
			<Text
				style={[styles.body, { color: theme.colors.textMuted }]}
				accessibilityLiveRegion="polite"
			>
				{step.instruction}
			</Text>

			<NumberBoard
				board={board}
				selectedIndex={selectedIndex}
				invalidIndices={invalidIndices}
				hintIndices={[]}
				onCellPress={handleCellPress}
				interactionLocked={persisting}
			/>

			{step.required.type === 'append' ? (
				<Pressable
					onPress={handleAppend}
					disabled={!appendEnabled || persisting}
					style={[
						styles.primary,
						{
							backgroundColor: appendEnabled
								? theme.colors.controlPrimary
								: theme.colors.controlDisabled,
						},
					]}
					accessibilityRole="button"
					accessibilityLabel={strings.addNumbersA11y}
					accessibilityState={{ disabled: !appendEnabled }}
					testID="training-append"
				>
					<Text
						style={[
							styles.primaryText,
							{
								color: appendEnabled
									? theme.colors.controlPrimaryText
									: theme.colors.controlDisabledText,
							},
						]}
					>
						{strings.addNumbers}
					</Text>
				</Pressable>
			) : null}

			<Text
				style={[styles.feedback, { color: theme.colors.textMuted }]}
				testID="training-feedback"
				accessibilityLiveRegion="polite"
			>
				{feedback ?? ' '}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
		gap: spacing.sm,
	},
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	backBtn: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	progress: {
		...typography.caption,
		fontWeight: '600',
	},
	title: {
		...typography.subtitle,
		fontWeight: '700',
		textAlign: 'center',
	},
	body: {
		...typography.body,
		textAlign: 'center',
		paddingHorizontal: spacing.sm,
	},
	primary: {
		minHeight: 48,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		marginHorizontal: spacing.md,
	},
	primaryText: {
		fontWeight: '700',
		fontSize: 16,
	},
	feedback: {
		...typography.caption,
		textAlign: 'center',
		minHeight: 20,
	},
})
