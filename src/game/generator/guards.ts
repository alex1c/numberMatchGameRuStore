/**
 * Human-playability and mobile growth guards.
 * Each guard is named, documented, and maps to a rejection reason.
 */

import { countActiveCells, getAvailableMoves, type BoardState } from '../core'
import { rangesForProfileVersion } from './profiles'
import type { DifficultyMetrics, RejectionReason } from './types'
import type { DifficultyProfile } from './version'

export interface GuardResult {
	readonly ok: boolean
	readonly reason?: RejectionReason
	readonly guard?: string
	readonly detail?: string
}

function digitRunsTooLong(board: BoardState, maxRun: number): boolean {
	let run = 1
	for (let i = 1; i < board.cells.length; i += 1) {
		const prev = board.cells[i - 1]!
		const cur = board.cells[i]!
		if (
			!prev.removed &&
			!cur.removed &&
			prev.value === cur.value
		) {
			run += 1
			if (run > maxRun) return true
		} else {
			run = 1
		}
	}
	return false
}

function digitFrequencySkewed(board: BoardState): boolean {
	const counts = new Array(10).fill(0) as number[]
	let active = 0
	for (const cell of board.cells) {
		if (cell.removed) continue
		const value = cell.value
		counts[value] = (counts[value] ?? 0) + 1
		active += 1
	}
	if (active === 0) return true
	for (let v = 1; v <= 9; v += 1) {
		const count = counts[v] ?? 0
		if (count / active > 0.45) return true
	}
	return false
}

/**
 * Guard: opening_quality
 * Reject EASY/MEDIUM with zero opening moves (immediate append).
 * Reject extreme opening move fan-out.
 */
export function guardOpeningQuality(
	board: BoardState,
	profile: DifficultyProfile,
	difficultyProfileVersion: number = 1,
): GuardResult {
	const ranges = rangesForProfileVersion(profile, difficultyProfileVersion)
	const moves = getAvailableMoves(board).length
	if (moves === 0 && !ranges.allowImmediateAppend) {
		return {
			ok: false,
			reason: 'opening_quality',
			guard: 'opening_requires_append',
			detail: 'zero legal moves at start',
		}
	}
	if (moves > ranges.maxInitialLegalMoves) {
		return {
			ok: false,
			reason: 'opening_quality',
			guard: 'opening_too_noisy',
			detail: `initialLegalMoves=${moves}`,
		}
	}
	// gv3 EASY expects enough openings (density-independent readability).
	if (moves < ranges.minInitialLegalMoves) {
		return {
			ok: false,
			reason: 'opening_quality',
			guard: 'opening_too_sparse',
			detail: `initialLegalMoves=${moves} < ${ranges.minInitialLegalMoves}`,
		}
	}
	return { ok: true }
}

/**
 * Guard: pathological_distribution
 * Reject boards with long identical runs or extreme digit monopoly.
 */
export function guardDistribution(board: BoardState): GuardResult {
	if (digitRunsTooLong(board, 4)) {
		return {
			ok: false,
			reason: 'pathological_distribution',
			guard: 'identical_run',
			detail: 'more than 4 identical active digits in a row',
		}
	}
	if (digitFrequencySkewed(board)) {
		return {
			ok: false,
			reason: 'pathological_distribution',
			guard: 'digit_monopoly',
			detail: 'single digit exceeds 45% of active cells',
		}
	}
	return { ok: true }
}

/**
 * Guard: trivial_for_profile
 * Non-EASY boards that are fully forced (no choice) are too trivial.
 */
export function guardTriviality(
	metrics: DifficultyMetrics,
	profile: DifficultyProfile,
	difficultyProfileVersion: number = 1,
): GuardResult {
	const ranges = rangesForProfileVersion(profile, difficultyProfileVersion)
	if (
		!ranges.allowTrivialNoChoice &&
		metrics.choiceStates === 0 &&
		metrics.solutionActionCount <= 6
	) {
		return {
			ok: false,
			reason: 'trivial_for_profile',
			guard: 'fully_forced_short',
			detail: 'no choice states on a short solution',
		}
	}
	return { ok: true }
}

/**
 * Guard: excessive_growth
 * Mobile portrait density — reject oversized representation growth.
 */
export function guardMobileGrowth(
	metrics: DifficultyMetrics,
	profile: DifficultyProfile,
	difficultyProfileVersion: number = 1,
): GuardResult {
	const ranges = rangesForProfileVersion(profile, difficultyProfileVersion)
	if (metrics.maxRowsDuringSolution > ranges.maxRowsDuringSolution) {
		return {
			ok: false,
			reason: 'excessive_growth',
			guard: 'max_rows_during_solution',
			detail: `maxRows=${metrics.maxRowsDuringSolution} > ${ranges.maxRowsDuringSolution}`,
		}
	}
	if (metrics.maxCellsDuringSolution > ranges.maxCellsDuringSolution) {
		return {
			ok: false,
			reason: 'excessive_growth',
			guard: 'max_cells_during_solution',
			detail: `maxCells=${metrics.maxCellsDuringSolution}`,
		}
	}
	return { ok: true }
}

export function runStructuralGuards(
	board: BoardState,
	profile: DifficultyProfile,
	difficultyProfileVersion: number = 1,
): GuardResult {
	if (countActiveCells(board) === 0) {
		return {
			ok: false,
			reason: 'invalid_candidate',
			guard: 'empty_board',
		}
	}
	const opening = guardOpeningQuality(board, profile, difficultyProfileVersion)
	if (!opening.ok) return opening
	const dist = guardDistribution(board)
	if (!dist.ok) return dist
	return { ok: true }
}

export function runPostSolveGuards(
	metrics: DifficultyMetrics,
	profile: DifficultyProfile,
	difficultyProfileVersion: number = 1,
): GuardResult {
	const trivial = guardTriviality(metrics, profile, difficultyProfileVersion)
	if (!trivial.ok) return trivial
	return guardMobileGrowth(metrics, profile, difficultyProfileVersion)
}
