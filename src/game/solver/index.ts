/**
 * Number Match solver public API (PHASE 2).
 */

export type {
	AppendPolicy,
	CutoffReason,
	SolveResult,
	SolverAction,
	SolverOptions,
	SolverSearchState,
	SolverStats,
} from './types'
export { DEFAULT_SOLVER_OPTIONS } from './types'

export { solverCacheKey } from './cacheKey'
export { replaySolution } from './replay'
export type { ReplayFailureReason, ReplayResult } from './replay'
export { firstSolutionMove, listTransitions, solveBoard } from './solve'
