/**
 * Deterministic Number Match solver (PHASE 2).
 *
 * Algorithm: bounded depth-first search with failure transposition cache.
 * Transitions use production core only (`getAvailableMoves`, `removePair`,
 * `appendRemainingNumbers`, `isBoardCleared`).
 *
 * Cutoff vs unsolvable:
 * - `cutoff` — a safety budget fired (states / depth / timeout)
 * - `unsolvable` — every reachable branch under the finite model failed
 *   without any cutoff
 *
 * Append policy (configurable):
 * - `when_stuck` (default): append only when there are zero legal matches
 * - `anytime`: append may be tried in addition to matches (still budgeted)
 *
 * Search is iterative (explicit stack) to avoid unbounded native recursion.
 */

import {
	appendRemainingNumbers,
	getAvailableMoves,
	isBoardCleared,
	removePair,
	validateBoard,
	type BoardState,
} from '../core'
import { solverCacheKey } from './cacheKey'
import {
	DEFAULT_SOLVER_OPTIONS,
	type AppendPolicy,
	type CutoffReason,
	type SolveResult,
	type SolverAction,
	type SolverOptions,
	type SolverStats,
} from './types'

interface ResolvedOptions {
	readonly maxStates: number
	readonly maxDepth: number
	readonly maxAppends: number
	readonly appendPolicy: AppendPolicy
	readonly timeoutMs: number | null
}

interface Frame {
	readonly board: BoardState
	readonly appendsUsed: number
	readonly depth: number
	readonly path: readonly SolverAction[]
	readonly transitions: readonly Transition[]
	nextIndex: number
	/** True when a child was skipped or incompletely explored due to a budget. */
	incomplete: boolean
}

interface Transition {
	readonly action: SolverAction
	readonly board: BoardState
	readonly appendsUsed: number
}

function resolveOptions(options: SolverOptions | undefined): ResolvedOptions {
	return {
		maxStates: options?.maxStates ?? DEFAULT_SOLVER_OPTIONS.maxStates,
		maxDepth: options?.maxDepth ?? DEFAULT_SOLVER_OPTIONS.maxDepth,
		maxAppends: options?.maxAppends ?? DEFAULT_SOLVER_OPTIONS.maxAppends,
		appendPolicy: options?.appendPolicy ?? DEFAULT_SOLVER_OPTIONS.appendPolicy,
		timeoutMs:
			options?.timeoutMs !== undefined && options.timeoutMs > 0
				? options.timeoutMs
				: null,
	}
}

function emptyStats(elapsedMs: number): SolverStats {
	return {
		exploredStates: 0,
		generatedTransitions: 0,
		cacheHits: 0,
		maxDepthReached: 0,
		appendActionsConsidered: 0,
		solutionDepth: null,
		elapsedMs,
	}
}

/**
 * Build deterministic outgoing transitions for a search node.
 * Match order follows `getAvailableMoves()`; append is appended last when allowed.
 */
export function listTransitions(
	board: BoardState,
	appendsUsed: number,
	maxAppends: number,
	appendPolicy: AppendPolicy,
): {
	readonly transitions: readonly Transition[]
	readonly appendConsidered: boolean
} {
	const moves = getAvailableMoves(board)
	const transitions: Transition[] = []

	for (const move of moves) {
		const removed = removePair(board, move.aIndex, move.bIndex)
		if (!removed.ok) {
			continue
		}
		transitions.push({
			action: {
				type: 'match',
				aIndex: move.aIndex,
				bIndex: move.bIndex,
			},
			board: removed.state,
			appendsUsed,
		})
	}

	let appendConsidered = false
	const canAppend = appendsUsed < maxAppends
	const stuck = moves.length === 0
	const allowAppend =
		canAppend &&
		(appendPolicy === 'anytime' || (appendPolicy === 'when_stuck' && stuck))

	if (allowAppend) {
		appendConsidered = true
		const next = appendRemainingNumbers(board)
		// No-op append (no active cells) cannot progress a non-cleared board.
		if (next !== board) {
			transitions.push({
				action: { type: 'append' },
				board: next,
				appendsUsed: appendsUsed + 1,
			})
		}
	}

	return { transitions, appendConsidered }
}

/**
 * Solve a board under bounded deterministic search.
 * Each call uses fresh caches — no global mutable solver state.
 */
export function solveBoard(
	initial: BoardState,
	options?: SolverOptions,
): SolveResult {
	const started = Date.now()
	const opts = resolveOptions(options)
	const validation = validateBoard(initial)
	if (!validation.ok) {
		return {
			status: 'invalid',
			reason: validation.reason,
			stats: emptyStats(Date.now() - started),
		}
	}

	let exploredStates = 0
	let generatedTransitions = 0
	let cacheHits = 0
	let maxDepthReached = 0
	let appendActionsConsidered = 0
	let cutoffReason: CutoffReason | null = null

	// States proven to have no solution under the remaining-append budget.
	const failed = new Set<string>()

	if (isBoardCleared(initial)) {
		return {
			status: 'solved',
			path: [],
			stats: {
				exploredStates: 1,
				generatedTransitions: 0,
				cacheHits: 0,
				maxDepthReached: 0,
				appendActionsConsidered: 0,
				solutionDepth: 0,
				elapsedMs: Date.now() - started,
			},
		}
	}

	const rootTransitions = listTransitions(
		initial,
		0,
		opts.maxAppends,
		opts.appendPolicy,
	)
	generatedTransitions += rootTransitions.transitions.length
	if (rootTransitions.appendConsidered) {
		appendActionsConsidered += 1
	}

	const stack: Frame[] = [
		{
			board: initial,
			appendsUsed: 0,
			depth: 0,
			path: [],
			transitions: rootTransitions.transitions,
			nextIndex: 0,
			incomplete: false,
		},
	]

	// Path-local keys prevent re-expanding the same node within one branch.
	const pathKeys = new Set<string>([
		solverCacheKey(initial, opts.maxAppends),
	])

	while (stack.length > 0) {
		if (opts.timeoutMs !== null && Date.now() - started >= opts.timeoutMs) {
			cutoffReason = 'timeout'
			break
		}

		const frame = stack[stack.length - 1]!

		if (frame.nextIndex === 0) {
			exploredStates += 1
			if (frame.depth > maxDepthReached) {
				maxDepthReached = frame.depth
			}
			if (exploredStates > opts.maxStates) {
				cutoffReason = 'max_states'
				break
			}
		}

		if (frame.nextIndex >= frame.transitions.length) {
			const key = solverCacheKey(
				frame.board,
				opts.maxAppends - frame.appendsUsed,
			)
			// Only memoize failure when every transition was fully explored.
			if (!frame.incomplete) {
				failed.add(key)
			} else if (stack.length >= 2) {
				stack[stack.length - 2]!.incomplete = true
			}
			pathKeys.delete(key)
			stack.pop()
			continue
		}

		const transition = frame.transitions[frame.nextIndex]!
		frame.nextIndex += 1

		const nextDepth = frame.depth + 1
		if (nextDepth > opts.maxDepth) {
			cutoffReason = 'max_depth'
			frame.incomplete = true
			continue
		}

		const nextPath = [...frame.path, transition.action]
		const appendsRemaining = opts.maxAppends - transition.appendsUsed
		const childKey = solverCacheKey(transition.board, appendsRemaining)

		if (isBoardCleared(transition.board)) {
			return {
				status: 'solved',
				path: nextPath,
				stats: {
					exploredStates,
					generatedTransitions,
					cacheHits,
					maxDepthReached: Math.max(maxDepthReached, nextDepth),
					appendActionsConsidered,
					solutionDepth: nextPath.length,
					elapsedMs: Date.now() - started,
				},
			}
		}

		if (failed.has(childKey)) {
			cacheHits += 1
			continue
		}
		if (pathKeys.has(childKey)) {
			cacheHits += 1
			continue
		}

		const childListed = listTransitions(
			transition.board,
			transition.appendsUsed,
			opts.maxAppends,
			opts.appendPolicy,
		)
		generatedTransitions += childListed.transitions.length
		if (childListed.appendConsidered) {
			appendActionsConsidered += 1
		}

		if (childListed.transitions.length === 0) {
			// Dead end under the finite model (no matches, append unavailable/no-op).
			failed.add(childKey)
			continue
		}

		pathKeys.add(childKey)
		stack.push({
			board: transition.board,
			appendsUsed: transition.appendsUsed,
			depth: nextDepth,
			path: nextPath,
			transitions: childListed.transitions,
			nextIndex: 0,
			incomplete: false,
		})
	}

	const elapsedMs = Date.now() - started
	const stats: SolverStats = {
		exploredStates,
		generatedTransitions,
		cacheHits,
		maxDepthReached,
		appendActionsConsidered,
		solutionDepth: null,
		elapsedMs,
	}

	if (cutoffReason !== null) {
		return { status: 'cutoff', reason: cutoffReason, stats }
	}

	return { status: 'unsolvable', stats }
}

/**
 * First action of a solved path, if any. Pure helper for future hint layers.
 */
export function firstSolutionMove(
	initial: BoardState,
	options?: SolverOptions,
): SolverAction | null {
	const result = solveBoard(initial, options)
	if (result.status !== 'solved' || result.path.length === 0) {
		return null
	}
	return result.path[0] ?? null
}
