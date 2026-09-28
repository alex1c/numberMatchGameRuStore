/**
 * Number Match solver types.
 * Pure search layer — no React, ads, analytics, or UI state.
 */

import type { BoardState } from '../core'

/** Replayable action that maps 1:1 onto production core operations. */
export type SolverAction =
	| { readonly type: 'match'; readonly aIndex: number; readonly bIndex: number }
	| { readonly type: 'append' }

/**
 * When may the solver consider `appendRemainingNumbers`?
 * - when_stuck: only if the current board has zero legal matches (classic UX)
 * - anytime: append is always an option while budget remains
 */
export type AppendPolicy = 'when_stuck' | 'anytime'

export type CutoffReason = 'max_states' | 'max_depth' | 'timeout'

export interface SolverOptions {
	readonly maxStates?: number
	readonly maxDepth?: number
	readonly maxAppends?: number
	readonly appendPolicy?: AppendPolicy
	/** Optional wall-clock guard; unit tests should prefer state/depth budgets. */
	readonly timeoutMs?: number
}

export interface SolverStats {
	readonly exploredStates: number
	readonly generatedTransitions: number
	readonly cacheHits: number
	readonly maxDepthReached: number
	readonly appendActionsConsidered: number
	readonly solutionDepth: number | null
	readonly elapsedMs: number
}

export type SolveResult =
	| {
			readonly status: 'solved'
			readonly path: readonly SolverAction[]
			readonly stats: SolverStats
	  }
	| {
			readonly status: 'unsolvable'
			readonly stats: SolverStats
	  }
	| {
			readonly status: 'cutoff'
			readonly reason: CutoffReason
			readonly stats: SolverStats
	  }
	| {
			readonly status: 'invalid'
			readonly reason: string
			readonly stats: SolverStats
	  }

/** Defaults measured to be conservative on desktop fixtures (PHASE 2). */
export const DEFAULT_SOLVER_OPTIONS = {
	maxStates: 25_000,
	maxDepth: 128,
	maxAppends: 4,
	appendPolicy: 'when_stuck' as AppendPolicy,
} as const

/** Internal search node (solver-specific; not part of BoardState). */
export interface SolverSearchState {
	readonly board: BoardState
	/** How many append actions already applied on this branch. */
	readonly appendsUsed: number
}
