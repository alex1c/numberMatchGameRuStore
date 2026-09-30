/**
 * Provisional algorithmic difficulty profiles — single source of truth.
 * These are NOT final human difficulty labels.
 *
 * Calibration:
 * - difficultyProfileVersion=1 / generationVersion=2: sparse boards, cell-count gates
 * - difficultyProfileVersion=2 / generationVersion=3: density-independent ranges
 */

import type { DifficultyMetrics, GeneratorSolverConfig } from './types'
import type { DifficultyProfile } from './version'

export const GENERATION_SOLVER_CONFIG: GeneratorSolverConfig = {
	appendPolicy: 'when_stuck',
	maxAppends: 3,
	maxStates: 25_000,
	maxDepth: 128,
}

export interface ProfileRanges {
	readonly profile: DifficultyProfile
	readonly minScore: number
	readonly maxScore: number
	/** Null = do not gate on cell count (gv3 density-independent). */
	readonly minCells: number | null
	readonly maxCells: number | null
	readonly minSolutionDepth: number
	readonly maxSolutionDepth: number
	readonly minChoiceStates: number
	readonly maxChoiceStates: number
	readonly maxAppendsInSolution: number
	readonly minInitialLegalMoves: number
	readonly maxInitialLegalMoves: number
	readonly maxRowsDuringSolution: number
	readonly requireChoice?: boolean
	readonly allowImmediateAppend: boolean
	readonly allowTrivialNoChoice: boolean
	/** Soft upper bound for representation growth (post-solve guard). */
	readonly maxCellsDuringSolution: number
}

/**
 * Human-readable provisional intent (algorithmic, pre-playtest).
 *
 * EASY — compact board, readable openings, short path, low ambiguity.
 * MEDIUM — larger board, more choice states, occasional append.
 * HARD — denser / longer representative solutions, more branching.
 * EXPERT — largest boards and richest choice structure; still mobile-readable.
 */
export const PROFILE_RANGES: Record<DifficultyProfile, ProfileRanges> = {
	EASY: {
		profile: 'EASY',
		minScore: 0,
		maxScore: 85,
		minCells: 12,
		maxCells: 16,
		minSolutionDepth: 4,
		maxSolutionDepth: 18,
		minChoiceStates: 0,
		maxChoiceStates: 12,
		maxAppendsInSolution: 1,
		minInitialLegalMoves: 1,
		maxInitialLegalMoves: 14,
		maxRowsDuringSolution: 12,
		allowImmediateAppend: false,
		allowTrivialNoChoice: true,
		maxCellsDuringSolution: 96,
	},
	MEDIUM: {
		profile: 'MEDIUM',
		minScore: 50,
		maxScore: 140,
		minCells: 18,
		maxCells: 24,
		minSolutionDepth: 6,
		maxSolutionDepth: 30,
		minChoiceStates: 1,
		maxChoiceStates: 22,
		maxAppendsInSolution: 3,
		minInitialLegalMoves: 1,
		maxInitialLegalMoves: 28,
		maxRowsDuringSolution: 16,
		requireChoice: true,
		allowImmediateAppend: false,
		allowTrivialNoChoice: false,
		maxCellsDuringSolution: 96,
	},
	HARD: {
		profile: 'HARD',
		minScore: 85,
		maxScore: 190,
		minCells: 24,
		maxCells: 32,
		minSolutionDepth: 10,
		maxSolutionDepth: 50,
		minChoiceStates: 3,
		maxChoiceStates: 32,
		maxAppendsInSolution: 3,
		minInitialLegalMoves: 0,
		maxInitialLegalMoves: 32,
		maxRowsDuringSolution: 20,
		requireChoice: true,
		allowImmediateAppend: true,
		allowTrivialNoChoice: false,
		maxCellsDuringSolution: 96,
	},
	EXPERT: {
		profile: 'EXPERT',
		minScore: 110,
		maxScore: 260,
		minCells: 30,
		maxCells: 40,
		minSolutionDepth: 14,
		maxSolutionDepth: 80,
		minChoiceStates: 5,
		maxChoiceStates: 45,
		maxAppendsInSolution: 3,
		minInitialLegalMoves: 0,
		maxInitialLegalMoves: 36,
		maxRowsDuringSolution: 24,
		requireChoice: true,
		allowImmediateAppend: true,
		allowTrivialNoChoice: false,
		maxCellsDuringSolution: 96,
	},
}

/**
 * gv3 profile ranges — gate on score / depth / choices / appends / openings,
 * NOT on initial cell count (density is an independent axis).
 *
 * Dense 8×7..8×10 boards naturally produce deep solutions and many openings,
 * so bands are wide and overlapping. Campaign rhythm + candidate biases still
 * label intent; absolute score alone does not sharply separate profiles.
 * See docs/GENERATOR_V3.md.
 */
export const PROFILE_RANGES_GV3: Record<DifficultyProfile, ProfileRanges> = {
	EASY: {
		profile: 'EASY',
		minScore: 0,
		maxScore: 420,
		minCells: null,
		maxCells: null,
		minSolutionDepth: 20,
		maxSolutionDepth: 70,
		minChoiceStates: 0,
		maxChoiceStates: 60,
		maxAppendsInSolution: 2,
		minInitialLegalMoves: 4,
		maxInitialLegalMoves: 96,
		maxRowsDuringSolution: 16,
		allowImmediateAppend: false,
		allowTrivialNoChoice: true,
		maxCellsDuringSolution: 160,
	},
	MEDIUM: {
		profile: 'MEDIUM',
		minScore: 120,
		maxScore: 460,
		minCells: null,
		maxCells: null,
		minSolutionDepth: 24,
		maxSolutionDepth: 75,
		minChoiceStates: 8,
		maxChoiceStates: 70,
		maxAppendsInSolution: 3,
		minInitialLegalMoves: 1,
		maxInitialLegalMoves: 96,
		maxRowsDuringSolution: 18,
		requireChoice: true,
		allowImmediateAppend: false,
		allowTrivialNoChoice: false,
		maxCellsDuringSolution: 168,
	},
	HARD: {
		profile: 'HARD',
		minScore: 160,
		maxScore: 500,
		minCells: null,
		maxCells: null,
		minSolutionDepth: 28,
		maxSolutionDepth: 80,
		minChoiceStates: 16,
		maxChoiceStates: 80,
		maxAppendsInSolution: 3,
		minInitialLegalMoves: 0,
		maxInitialLegalMoves: 96,
		maxRowsDuringSolution: 20,
		requireChoice: true,
		allowImmediateAppend: true,
		allowTrivialNoChoice: false,
		maxCellsDuringSolution: 176,
	},
	EXPERT: {
		profile: 'EXPERT',
		minScore: 200,
		maxScore: 560,
		minCells: null,
		maxCells: null,
		minSolutionDepth: 30,
		maxSolutionDepth: 90,
		minChoiceStates: 20,
		maxChoiceStates: 90,
		maxAppendsInSolution: 3,
		minInitialLegalMoves: 0,
		maxInitialLegalMoves: 96,
		maxRowsDuringSolution: 24,
		requireChoice: true,
		allowImmediateAppend: true,
		allowTrivialNoChoice: false,
		maxCellsDuringSolution: 176,
	},
}

/**
 * Alias kept for docs / audits that refer to PROFILE_RANGES_V2 naming.
 * Same object as PROFILE_RANGES_GV3.
 */
export const PROFILE_RANGES_V2 = PROFILE_RANGES_GV3

/**
 * gv2 score — includes initialCells (sparse boards, cell-count correlated).
 *
 * score =
 *   initialCells * 0.7
 * + solutionActionCount * 1.5
 * + choiceStates * 2.4
 * + peakBranching * 1.2
 * + appendActionCount * 7
 * + diagonalOnlyMoves * 3
 * + linearOnlyMoves * 3.5
 * + (deadEndRatio ?? 0) * 18
 * - forcedRatio * 6
 */
export function computeDifficultyScore(m: {
	readonly initialCells: number
	readonly solutionActionCount: number
	readonly choiceStates: number
	readonly peakBranching: number
	readonly appendActionCount: number
	readonly diagonalOnlyMoves: number
	readonly linearOnlyMoves: number
	readonly forcedRatio: number
	readonly deadEndRatio: number | null
}): number {
	const dead = m.deadEndRatio ?? 0
	const raw =
		m.initialCells * 0.7 +
		m.solutionActionCount * 1.5 +
		m.choiceStates * 2.4 +
		m.peakBranching * 1.2 +
		m.appendActionCount * 7 +
		m.diagonalOnlyMoves * 3 +
		m.linearOnlyMoves * 3.5 +
		dead * 18 -
		m.forcedRatio * 6
	return Math.round(raw * 100) / 100
}

/**
 * gv3 density-independent score — drops initialCells so 8×7..8×10
 * can share the same profile bands.
 *
 * Weights emphasize branching / appends / forced play over raw depth,
 * because dense boards are deep by construction.
 */
export function computeDifficultyScoreV2(m: {
	readonly initialCells: number
	readonly solutionActionCount: number
	readonly choiceStates: number
	readonly peakBranching: number
	readonly appendActionCount: number
	readonly diagonalOnlyMoves: number
	readonly linearOnlyMoves: number
	readonly forcedRatio: number
	readonly deadEndRatio: number | null
}): number {
	const dead = m.deadEndRatio ?? 0
	const raw =
		m.solutionActionCount * 0.7 +
		m.choiceStates * 3.0 +
		m.peakBranching * 1.8 +
		m.appendActionCount * 12 +
		m.diagonalOnlyMoves * 2.5 +
		m.linearOnlyMoves * 3 +
		dead * 18 -
		m.forcedRatio * 40
	return Math.round(raw * 100) / 100
}

/** Pick profile ranges for a difficultyProfileVersion. */
export function rangesForProfileVersion(
	profile: DifficultyProfile,
	difficultyProfileVersion: number,
): ProfileRanges {
	if (difficultyProfileVersion >= 2) {
		return PROFILE_RANGES_GV3[profile]
	}
	return PROFILE_RANGES[profile]
}

export function metricsMatchProfile(
	metrics: DifficultyMetrics,
	profile: DifficultyProfile,
	difficultyProfileVersion: number = 1,
): { readonly ok: true } | { readonly ok: false; readonly detail: string } {
	const r = rangesForProfileVersion(profile, difficultyProfileVersion)
	if (metrics.difficultyScore < r.minScore || metrics.difficultyScore > r.maxScore) {
		return {
			ok: false,
			detail: `score ${metrics.difficultyScore} outside ${r.minScore}-${r.maxScore}`,
		}
	}
	if (
		r.minCells !== null &&
		r.maxCells !== null &&
		(metrics.initialCells < r.minCells || metrics.initialCells > r.maxCells)
	) {
		return {
			ok: false,
			detail: `cells ${metrics.initialCells} outside ${r.minCells}-${r.maxCells}`,
		}
	}
	if (
		metrics.solutionActionCount < r.minSolutionDepth ||
		metrics.solutionActionCount > r.maxSolutionDepth
	) {
		return {
			ok: false,
			detail: `depth ${metrics.solutionActionCount} outside ${r.minSolutionDepth}-${r.maxSolutionDepth}`,
		}
	}
	if (
		metrics.choiceStates < r.minChoiceStates ||
		metrics.choiceStates > r.maxChoiceStates
	) {
		return {
			ok: false,
			detail: `choiceStates ${metrics.choiceStates} outside ${r.minChoiceStates}-${r.maxChoiceStates}`,
		}
	}
	if (metrics.appendActionCount > r.maxAppendsInSolution) {
		return {
			ok: false,
			detail: `appends ${metrics.appendActionCount} > ${r.maxAppendsInSolution}`,
		}
	}
	if (
		metrics.initialLegalMoves < r.minInitialLegalMoves ||
		metrics.initialLegalMoves > r.maxInitialLegalMoves
	) {
		return {
			ok: false,
			detail: `initialMoves ${metrics.initialLegalMoves} outside range`,
		}
	}
	if (metrics.maxRowsDuringSolution > r.maxRowsDuringSolution) {
		return {
			ok: false,
			detail: `maxRows ${metrics.maxRowsDuringSolution} > ${r.maxRowsDuringSolution}`,
		}
	}
	if (r.requireChoice && metrics.choiceStates < 1) {
		return { ok: false, detail: 'profile requires choice states' }
	}
	return { ok: true }
}
