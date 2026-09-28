/**
 * Replay a solver path through production core APIs only.
 * No private solver shortcuts or direct cell mutation.
 */

import {
	appendRemainingNumbers,
	canMatch,
	isBoardCleared,
	removePair,
	type BoardState,
} from '../core'
import type { SolverAction } from './types'

export type ReplayFailureReason =
	| 'illegal_match'
	| 'remove_failed'
	| 'append_noop_unexpected'
	| 'not_cleared'

export type ReplayResult =
	| { readonly ok: true; readonly state: BoardState }
	| {
			readonly ok: false
			readonly reason: ReplayFailureReason
			readonly state: BoardState
			readonly step: number
	  }

/**
 * Apply each action via production core. On success the final board is cleared.
 */
export function replaySolution(
	initial: BoardState,
	path: readonly SolverAction[],
): ReplayResult {
	let state = initial
	for (let step = 0; step < path.length; step += 1) {
		const action = path[step]!
		if (action.type === 'match') {
			if (!canMatch(state, action.aIndex, action.bIndex)) {
				return { ok: false, reason: 'illegal_match', state, step }
			}
			const removed = removePair(state, action.aIndex, action.bIndex)
			if (!removed.ok) {
				return { ok: false, reason: 'remove_failed', state, step }
			}
			state = removed.state
			continue
		}

		const next = appendRemainingNumbers(state)
		// Append on a board with no active cells is a core no-op; a solution
		// path should never need that (cleared boards stop before append).
		if (next === state && !isBoardCleared(state)) {
			return { ok: false, reason: 'append_noop_unexpected', state, step }
		}
		state = next
	}

	if (!isBoardCleared(state)) {
		return { ok: false, reason: 'not_cleared', state, step: path.length }
	}
	return { ok: true, state }
}
