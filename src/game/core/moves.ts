/**
 * Remove a legal pair and enumerate available moves.
 * Mutability policy: pure immutable transitions (state → new state).
 */

import { cloneBoard } from './board'
import { canMatch, explainMatch } from './match'
import type { BoardState, Move, RemovePairResult } from './types'

/**
 * Remove a valid matching pair.
 * On success both cells become `removed` without compacting geometry.
 * On failure the original state is returned unchanged (same reference).
 */
export function removePair(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): RemovePairResult {
	const check = explainMatch(state, aIndex, bIndex)
	if (!check.ok) {
		return { ok: false, reason: check.reason, state }
	}

	const next = cloneBoard(state)
	const cellA = next.cells[aIndex]
	const cellB = next.cells[bIndex]
	if (!cellA || !cellB) {
		return { ok: false, reason: 'out_of_range', state }
	}

	const cells = next.cells.slice()
	cells[aIndex] = { ...cellA, removed: true }
	cells[bIndex] = { ...cellB, removed: true }

	return {
		ok: true,
		state: {
			width: next.width,
			nextCellSeq: next.nextCellSeq,
			cells,
		},
	}
}

/**
 * Enumerate every legal move on the board.
 * - Only active cells
 * - No duplicate reversed pairs
 * - Deterministic ascending (aIndex, bIndex) order with aIndex < bIndex
 */
export function getAvailableMoves(state: BoardState): readonly Move[] {
	const active: number[] = []
	for (let i = 0; i < state.cells.length; i += 1) {
		if (!state.cells[i]!.removed) {
			active.push(i)
		}
	}

	const moves: Move[] = []
	for (let i = 0; i < active.length; i += 1) {
		for (let j = i + 1; j < active.length; j += 1) {
			const aIndex = active[i]!
			const bIndex = active[j]!
			if (canMatch(state, aIndex, bIndex)) {
				moves.push({ aIndex, bIndex })
			}
		}
	}
	return moves
}

/** True when at least one legal match exists. Not equivalent to game-over. */
export function hasAvailableMoves(state: BoardState): boolean {
	const active: number[] = []
	for (let i = 0; i < state.cells.length; i += 1) {
		if (!state.cells[i]!.removed) {
			active.push(i)
		}
	}
	for (let i = 0; i < active.length; i += 1) {
		for (let j = i + 1; j < active.length; j += 1) {
			if (canMatch(state, active[i]!, active[j]!)) {
				return true
			}
		}
	}
	return false
}
