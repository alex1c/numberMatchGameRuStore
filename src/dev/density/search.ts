/**
 * Density fixture search — Node tooling / Jest helpers.
 * Bounded deterministic search; never runs on app startup.
 */

import {
	getAvailableMoves,
	validateBoard,
	type BoardState,
} from '../../game/core'
import {
	GENERATION_SOLVER_CONFIG,
	analyzeDifficulty,
	puzzleFingerprint,
} from '../../game/generator'
import { replaySolution, solveBoard } from '../../game/solver'
import { createDensityCandidateBoard } from './experimentalCandidate'
import type { DensityFixtureId, DensityFixtureMeta } from './types'

export interface DensitySearchTarget {
	readonly id: DensityFixtureId
	readonly label: string
	readonly width: number
	readonly targetRows: number
	readonly initialCells: number
	readonly note: string
	readonly baseSeed: number
	readonly maxAttempts?: number
}

export interface DensitySearchAcceptRanges {
	readonly minOpeningMoves: number
	readonly maxOpeningMoves: number
	readonly minDepth: number
	readonly maxDepth: number
	readonly maxAppends: number
	readonly maxScore: number
	readonly minScore: number
}

/** Easy-ish calibration bands — density experiment, not production profiles. */
export const DENSITY_EASYISH_RANGES: DensitySearchAcceptRanges = {
	minOpeningMoves: 3,
	maxOpeningMoves: 18,
	minDepth: 8,
	maxDepth: 36,
	maxAppends: 1,
	minScore: 30,
	maxScore: 160,
}

export interface DensitySearchHit {
	readonly meta: DensityFixtureMeta
	readonly board: BoardState
	readonly attempts: number
}

function evaluateBoard(
	board: BoardState,
	id: DensityFixtureId,
	label: string,
	seed: number,
	targetRows: number,
	note: string,
	kind: DensityFixtureMeta['kind'],
): DensityFixtureMeta | null {
	const validation = validateBoard(board)
	if (!validation.ok) {
		return null
	}
	const opening = getAvailableMoves(board).length
	if (opening < 1) {
		return null
	}
	const solved = solveBoard(board, GENERATION_SOLVER_CONFIG)
	if (solved.status !== 'solved') {
		return null
	}
	const replay = replaySolution(board, solved.path)
	if (!replay.ok) {
		return null
	}
	const metrics = analyzeDifficulty(
		board,
		solved.path,
		solved.stats,
		GENERATION_SOLVER_CONFIG,
		{ deadEndAnalysis: false },
	)
	const { fingerprint } = puzzleFingerprint(board)
	return {
		id,
		label,
		width: board.width,
		targetRows,
		initialCells: board.cells.length,
		seed,
		kind,
		fingerprint,
		solutionDepth: metrics.solutionActionCount,
		initialLegalMoves: metrics.initialLegalMoves,
		choiceStates: metrics.choiceStates,
		forcedRatio: metrics.forcedRatio,
		appendCount: metrics.appendActionCount,
		maxRowsDuringSolution: metrics.maxRowsDuringSolution,
		difficultyScore: metrics.difficultyScore,
		note,
	}
}

function accepts(
	meta: DensityFixtureMeta,
	ranges: DensitySearchAcceptRanges,
): boolean {
	if (meta.initialLegalMoves < ranges.minOpeningMoves) return false
	if (meta.initialLegalMoves > ranges.maxOpeningMoves) return false
	if (meta.solutionDepth < ranges.minDepth) return false
	if (meta.solutionDepth > ranges.maxDepth) return false
	if (meta.appendCount > ranges.maxAppends) return false
	if (meta.difficultyScore < ranges.minScore) return false
	if (meta.difficultyScore > ranges.maxScore) return false
	return true
}

/**
 * Search for one experimental-shape fixture within attempt budget.
 */
export function searchDensityFixture(
	target: DensitySearchTarget,
	ranges: DensitySearchAcceptRanges = DENSITY_EASYISH_RANGES,
): DensitySearchHit | null {
	const maxAttempts = target.maxAttempts ?? 120
	let bestFallback: DensitySearchHit | null = null

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const seed = (target.baseSeed + attempt * 0x9e3779b9) >>> 0
		const board = createDensityCandidateBoard(
			{ width: target.width, initialCells: target.initialCells },
			seed,
			{ equalBias: 0.55, openingPairs: 4 },
		)
		if (board.cells.length !== target.initialCells) {
			continue
		}
		const meta = evaluateBoard(
			board,
			target.id,
			target.label,
			seed,
			target.targetRows,
			target.note,
			'experimental-shape',
		)
		if (!meta) {
			continue
		}
		const hit: DensitySearchHit = { meta, board, attempts: attempt + 1 }
		if (accepts(meta, ranges)) {
			return hit
		}
		// Keep closest easy-ish fallback (prefer more openings, fewer appends).
		if (
			!bestFallback ||
			meta.appendCount < bestFallback.meta.appendCount ||
			(meta.appendCount === bestFallback.meta.appendCount &&
				meta.initialLegalMoves > bestFallback.meta.initialLegalMoves)
		) {
			bestFallback = hit
		}
	}
	return bestFallback
}

export const DENSITY_SEARCH_TARGETS: readonly DensitySearchTarget[] = [
	{
		id: 'density-7x5',
		label: '7 × 5 — 35 чисел',
		width: 7,
		targetRows: 5,
		initialCells: 34, // even for pairing; ~35 target
		note: 'experimental 7×5 dense EASY-ish',
		baseSeed: 7_005_001,
	},
	{
		id: 'density-7x6',
		label: '7 × 6 — 42 числа',
		width: 7,
		targetRows: 6,
		initialCells: 42,
		note: 'experimental 7×6 dense EASY-ish',
		baseSeed: 7_006_001,
	},
	{
		id: 'density-8x5',
		label: '8 × 5 — 40 чисел',
		width: 8,
		targetRows: 5,
		initialCells: 40,
		note: 'experimental 8×5 dense EASY-ish',
		baseSeed: 8_005_001,
	},
	{
		id: 'density-8x6',
		label: '8 × 6 — 48 чисел',
		width: 8,
		targetRows: 6,
		initialCells: 48,
		note: 'experimental 8×6 dense EASY-ish',
		baseSeed: 8_006_001,
	},
	{
		id: 'density-9x4',
		label: '9 × 4 — 36 чисел',
		width: 9,
		targetRows: 4,
		initialCells: 36,
		note: 'experimental 9×4 wide short',
		baseSeed: 9_004_001,
	},
	{
		id: 'density-9x5',
		label: '9 × 5 — 45 чисел',
		width: 9,
		targetRows: 5,
		initialCells: 44, // even; ~45
		note: 'experimental 9×5 dense',
		baseSeed: 9_005_001,
	},
]
