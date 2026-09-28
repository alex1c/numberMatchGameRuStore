/**
 * Difficulty metrics from a representative solver path (PHASE 2 path).
 * Analysis is read-only w.r.t. the caller's initial board reference.
 */

import {
	appendRemainingNumbers,
	cloneBoard,
	countActiveCells,
	getAvailableMoves,
	getCell,
	getConnectionKinds,
	isBoardCleared,
	removePair,
	type BoardState,
} from '../core'
import {
	solveBoard,
	type SolverAction,
	type SolverOptions,
	type SolverStats,
} from '../solver'
import { computeDifficultyScore } from './profiles'
import type { DeadEndMetrics, DifficultyMetrics, GeneratorSolverConfig } from './types'

function rowCount(board: BoardState): number {
	if (board.cells.length === 0) return 0
	return Math.ceil(board.cells.length / board.width)
}

function legalMatchCount(board: BoardState): number {
	return getAvailableMoves(board).length
}

function analyzeDeadEnds(
	initial: BoardState,
	path: readonly SolverAction[],
	solverConfig: GeneratorSolverConfig,
	options?: {
		readonly maxChoiceStates?: number
		readonly maxAlternativesPerState?: number
		readonly altMaxStates?: number
	},
): DeadEndMetrics {
	const maxChoiceStates = options?.maxChoiceStates ?? 4
	const maxAlt = options?.maxAlternativesPerState ?? 3
	const altMaxStates = options?.altMaxStates ?? 2_000

	let state = cloneBoard(initial)
	let appendsUsed = 0
	let choiceSeen = 0
	let alternativesChecked = 0
	let alternativesSolvable = 0
	let alternativesDead = 0
	let alternativesCutoff = 0
	let alternativesUnknown = 0
	let analysisCutoff = false

	const baseSolver: SolverOptions = {
		appendPolicy: solverConfig.appendPolicy,
		maxAppends: solverConfig.maxAppends,
		maxStates: solverConfig.maxStates,
		maxDepth: solverConfig.maxDepth,
	}

	for (const action of path) {
		const moves = getAvailableMoves(state)
		const canAppend =
			appendsUsed < solverConfig.maxAppends &&
			(solverConfig.appendPolicy === 'anytime' || moves.length === 0)
		const isChoice =
			moves.length > 1 ||
			(moves.length === 1 && canAppend && solverConfig.appendPolicy === 'anytime')

		if (isChoice && choiceSeen < maxChoiceStates && action.type === 'match') {
			choiceSeen += 1
			const chosenKey = `${action.aIndex}:${action.bIndex}`
			let checkedHere = 0
			for (const move of moves) {
				const key = `${move.aIndex}:${move.bIndex}`
				if (key === chosenKey) continue
				if (checkedHere >= maxAlt) break
				checkedHere += 1
				alternativesChecked += 1
				const removed = removePair(state, move.aIndex, move.bIndex)
				if (!removed.ok) {
					alternativesUnknown += 1
					continue
				}
				const remainingAppends = solverConfig.maxAppends - appendsUsed
				const alt = solveBoard(removed.state, {
					...baseSolver,
					maxAppends: remainingAppends,
					maxStates: altMaxStates,
					maxDepth: Math.min(64, solverConfig.maxDepth),
				})
				if (alt.status === 'solved') {
					alternativesSolvable += 1
				} else if (alt.status === 'unsolvable') {
					alternativesDead += 1
				} else if (alt.status === 'cutoff') {
					alternativesCutoff += 1
					analysisCutoff = true
				} else {
					alternativesUnknown += 1
				}
			}
		}

		if (action.type === 'match') {
			const removed = removePair(state, action.aIndex, action.bIndex)
			if (!removed.ok) break
			state = removed.state
		} else {
			state = appendRemainingNumbers(state)
			appendsUsed += 1
		}
	}

	const known = alternativesSolvable + alternativesDead
	const deadEndRatio =
		known === 0 ? null : alternativesDead / known

	return {
		alternativesChecked,
		alternativesSolvable,
		alternativesDead,
		alternativesCutoff,
		alternativesUnknown,
		deadEndRatio,
		analysisCutoff,
	}
}

/**
 * Build difficulty metrics by replaying the representative solution.
 * Does not mutate `initial`.
 */
export function analyzeDifficulty(
	initial: BoardState,
	path: readonly SolverAction[],
	solverStats: SolverStats,
	solverConfig: GeneratorSolverConfig,
	options?: { readonly deadEndAnalysis?: boolean },
): DifficultyMetrics {
	const snapshot = cloneBoard(initial)
	let state = cloneBoard(initial)
	let appendsUsed = 0

	let forcedStates = 0
	let choiceStates = 0
	let maxChoicesAlongPath = 0
	let choiceSum = 0
	let branchSum = 0
	let branchPeak = 0
	let statesAlong = 0

	let hasHorizontal = false
	let hasVertical = false
	let hasDiagonal = false
	let hasLinear = false
	let diagonalOnlyMoves = 0
	let linearOnlyMoves = 0
	let equalMatches = 0
	let sum10Matches = 0
	let fiveFiveMatches = 0
	let appendRequiredStages = 0
	let matchActionCount = 0
	let appendActionCount = 0

	let maxCells = state.cells.length
	let maxRows = rowCount(state)
	let minActive = countActiveCells(state)
	let peakActive = minActive
	let removedAtPeak = 0

	const initialLegalMoves = legalMatchCount(state)

	for (const action of path) {
		const moves = getAvailableMoves(state)
		const branch = moves.length
		statesAlong += 1
		branchSum += branch
		if (branch > branchPeak) branchPeak = branch

		const canAppend =
			appendsUsed < solverConfig.maxAppends &&
			(solverConfig.appendPolicy === 'anytime' || moves.length === 0)

		if (moves.length === 0 && canAppend && action.type === 'append') {
			forcedStates += 1
			appendRequiredStages += 1
			maxChoicesAlongPath = Math.max(maxChoicesAlongPath, 1)
			choiceSum += 1
		} else if (moves.length <= 1) {
			forcedStates += 1
			maxChoicesAlongPath = Math.max(maxChoicesAlongPath, moves.length)
			choiceSum += moves.length
		} else {
			choiceStates += 1
			maxChoicesAlongPath = Math.max(maxChoicesAlongPath, moves.length)
			choiceSum += moves.length
		}

		if (action.type === 'match') {
			matchActionCount += 1
			const cellA = getCell(state, action.aIndex)
			const cellB = getCell(state, action.bIndex)
			if (cellA && cellB) {
				if (cellA.value === cellB.value) equalMatches += 1
				if (cellA.value + cellB.value === 10) sum10Matches += 1
				if (cellA.value === 5 && cellB.value === 5) fiveFiveMatches += 1
			}
			const kinds = getConnectionKinds(state, action.aIndex, action.bIndex)
			if (kinds.includes('horizontal')) hasHorizontal = true
			if (kinds.includes('vertical')) hasVertical = true
			if (kinds.includes('diagonal')) hasDiagonal = true
			if (kinds.includes('linear')) hasLinear = true
			if (kinds.length === 1 && kinds[0] === 'diagonal') {
				diagonalOnlyMoves += 1
			}
			if (kinds.length === 1 && kinds[0] === 'linear') {
				linearOnlyMoves += 1
			}
			const removed = removePair(state, action.aIndex, action.bIndex)
			if (!removed.ok) {
				throw new Error('analyzeDifficulty: illegal match on representative path')
			}
			state = removed.state
		} else {
			appendActionCount += 1
			state = appendRemainingNumbers(state)
			appendsUsed += 1
		}

		maxCells = Math.max(maxCells, state.cells.length)
		maxRows = Math.max(maxRows, rowCount(state))
		const active = countActiveCells(state)
		minActive = Math.min(minActive, active)
		if (active >= peakActive) {
			peakActive = active
			removedAtPeak =
				state.cells.length === 0
					? 0
					: (state.cells.length - active) / state.cells.length
		}
	}

	if (!isBoardCleared(state)) {
		throw new Error('analyzeDifficulty: path did not clear board')
	}

	// Confirm caller board unchanged.
	void snapshot

	const deadEnd =
		options?.deadEndAnalysis === false
			? {
					alternativesChecked: 0,
					alternativesSolvable: 0,
					alternativesDead: 0,
					alternativesCutoff: 0,
					alternativesUnknown: 0,
					deadEndRatio: null,
					analysisCutoff: false,
				}
			: analyzeDeadEnds(initial, path, solverConfig)

	const forcedRatio =
		statesAlong === 0 ? 1 : forcedStates / statesAlong
	const averageChoices = statesAlong === 0 ? 0 : choiceSum / statesAlong
	const averageBranching = statesAlong === 0 ? 0 : branchSum / statesAlong

	const partial = {
		initialCells: countActiveCells(initial),
		solutionActionCount: path.length,
		choiceStates,
		peakBranching: branchPeak,
		appendActionCount,
		diagonalOnlyMoves,
		linearOnlyMoves,
		forcedRatio,
		deadEndRatio: deadEnd.deadEndRatio,
	}

	return {
		initialCells: partial.initialCells,
		initialLegalMoves,
		solutionActionCount: path.length,
		matchActionCount,
		appendActionCount,
		exploredStates: solverStats.exploredStates,
		generatedTransitions: solverStats.generatedTransitions,
		cacheHits: solverStats.cacheHits,
		maxSearchDepth: solverStats.maxDepthReached,
		averageBranching,
		peakBranching: branchPeak,
		forcedStates,
		choiceStates,
		maxChoicesAlongPath,
		averageChoices,
		forcedRatio,
		hasHorizontal,
		hasVertical,
		hasDiagonal,
		hasLinear,
		diagonalOnlyMoves,
		linearOnlyMoves,
		equalMatches,
		sum10Matches,
		fiveFiveMatches,
		appendRequiredStages,
		maxCellsDuringSolution: maxCells,
		maxRowsDuringSolution: maxRows,
		finalRepresentationLength: state.cells.length,
		minActiveDuringSolution: minActive,
		peakActiveDuringSolution: peakActive,
		removedRatioAtPeak: removedAtPeak,
		difficultyScore: computeDifficultyScore(partial),
		deadEnd,
		solverElapsedMs: solverStats.elapsedMs,
	}
}
