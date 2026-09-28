/**
 * Generator public types.
 */

import type { BoardState, CellValue } from '../core'
import type { SolverAction, SolverStats } from '../solver'
import type { DifficultyProfile } from './version'

export type {
	DifficultyProfile,
}

export type RejectionReason =
	| 'invalid_candidate'
	| 'solver_unsolvable'
	| 'solver_cutoff'
	| 'solver_invalid'
	| 'replay_failed'
	| 'duplicate'
	| 'profile_mismatch'
	| 'opening_quality'
	| 'excessive_growth'
	| 'pathological_distribution'
	| 'trivial_for_profile'
	| 'attempt_budget_exhausted'
	| 'invalid_config'

export interface GeneratorSolverConfig {
	readonly appendPolicy: 'when_stuck' | 'anytime'
	readonly maxAppends: number
	readonly maxStates: number
	readonly maxDepth: number
}

/** Size hint for candidate construction — not difficulty labels. */
export type BoardSizePreset = 'compact' | 'normal' | 'dense'

export interface CandidateShape {
	readonly width: number
	readonly initialCells: number
}

/**
 * Dead-end / alternative analysis is experimental and budgeted separately.
 * Unknown/cutoff alternatives are never counted as dead.
 */
export interface DeadEndMetrics {
	readonly alternativesChecked: number
	readonly alternativesSolvable: number
	readonly alternativesDead: number
	readonly alternativesCutoff: number
	readonly alternativesUnknown: number
	/** Null when no alternatives were checked. */
	readonly deadEndRatio: number | null
	readonly analysisCutoff: boolean
}

export interface DifficultyMetrics {
	readonly initialCells: number
	readonly initialLegalMoves: number
	readonly solutionActionCount: number
	readonly matchActionCount: number
	readonly appendActionCount: number
	readonly exploredStates: number
	readonly generatedTransitions: number
	readonly cacheHits: number
	readonly maxSearchDepth: number
	readonly averageBranching: number
	readonly peakBranching: number
	readonly forcedStates: number
	readonly choiceStates: number
	readonly maxChoicesAlongPath: number
	readonly averageChoices: number
	readonly forcedRatio: number
	readonly hasHorizontal: boolean
	readonly hasVertical: boolean
	readonly hasDiagonal: boolean
	readonly hasLinear: boolean
	readonly diagonalOnlyMoves: number
	readonly linearOnlyMoves: number
	readonly equalMatches: number
	readonly sum10Matches: number
	readonly fiveFiveMatches: number
	readonly appendRequiredStages: number
	readonly maxCellsDuringSolution: number
	readonly maxRowsDuringSolution: number
	readonly finalRepresentationLength: number
	readonly minActiveDuringSolution: number
	readonly peakActiveDuringSolution: number
	readonly removedRatioAtPeak: number
	readonly difficultyScore: number
	readonly deadEnd: DeadEndMetrics
	/** Informational only — never used for classification identity. */
	readonly solverElapsedMs: number
}

export interface PuzzleIdentity {
	readonly generationVersion: number
	readonly difficultyProfileVersion: number
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly fingerprint: string
	readonly canonical: string
}

export interface AcceptedPuzzle {
	readonly identity: PuzzleIdentity
	readonly board: BoardState
	readonly values: readonly CellValue[]
	readonly width: number
	readonly path: readonly SolverAction[]
	readonly metrics: DifficultyMetrics
	readonly solverStats: SolverStats
}

export type GeneratePuzzleResult =
	| {
			readonly status: 'accepted'
			readonly puzzle: AcceptedPuzzle
			readonly attempts: number
			readonly rejectionCounts: Readonly<Record<string, number>>
	  }
	| {
			readonly status: 'exhausted'
			readonly reason: RejectionReason
			readonly attempts: number
			readonly rejectionCounts: Readonly<Record<string, number>>
			readonly requestedSeed: number
			readonly profile: DifficultyProfile
			readonly lastSolverStatus?: string
	  }
	| {
			readonly status: 'invalid_config'
			readonly reason: string
	  }

export interface GeneratePuzzleOptions {
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly maxCandidateAttempts?: number
	readonly knownFingerprints?: ReadonlySet<string>
	readonly knownCanonicals?: ReadonlySet<string>
	readonly solver?: Partial<GeneratorSolverConfig>
	readonly deadEndAnalysis?: boolean
}

export { GENERATION_VERSION, DIFFICULTY_PROFILE_VERSION } from './version'
