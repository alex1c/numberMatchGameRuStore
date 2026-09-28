/**
 * Provisional algorithmic difficulty profiles — single source of truth.
 * These are NOT final human difficulty labels.
 *
 * Calibration evidence (generationVersion=1, difficultyProfileVersion=1):
 * Broad sample after opening-pair placement showed score formula naturally
 * clusters roughly by board size / path complexity. Thresholds below were set
 * from those observed clusters (not arbitrary 0–10 ladders).
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
	readonly minCells: number
	readonly maxCells: number
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
	},
}

/**
 * Deterministic provisional score from raw metrics.
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

export function metricsMatchProfile(
	metrics: DifficultyMetrics,
	profile: DifficultyProfile,
): { readonly ok: true } | { readonly ok: false; readonly detail: string } {
	const r = PROFILE_RANGES[profile]
	if (metrics.difficultyScore < r.minScore || metrics.difficultyScore > r.maxScore) {
		return {
			ok: false,
			detail: `score ${metrics.difficultyScore} outside ${r.minScore}-${r.maxScore}`,
		}
	}
	if (metrics.initialCells < r.minCells || metrics.initialCells > r.maxCells) {
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
