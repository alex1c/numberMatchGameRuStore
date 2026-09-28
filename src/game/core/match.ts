/**
 * Match decision helpers: values + geometry combined.
 * Invalid pairs are typed results — not exceptions.
 */

import { isValidIndex } from './coordinates'
import { arePositionsConnectable } from './geometry'
import { areValuesMatchable } from './values'
import type { BoardState, MatchCheckResult } from './types'

/**
 * Full match check: distinct in-range active cells, value-compatible,
 * and geometrically connectable under classic Number Match rules.
 */
export function explainMatch(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): MatchCheckResult {
	if (aIndex === bIndex) {
		return { ok: false, reason: 'same_cell' }
	}
	if (!isValidIndex(state, aIndex) || !isValidIndex(state, bIndex)) {
		return { ok: false, reason: 'out_of_range' }
	}
	const cellA = state.cells[aIndex]
	const cellB = state.cells[bIndex]
	if (!cellA || !cellB) {
		return { ok: false, reason: 'out_of_range' }
	}
	if (cellA.removed || cellB.removed) {
		return { ok: false, reason: 'removed' }
	}
	if (!areValuesMatchable(cellA.value, cellB.value)) {
		return { ok: false, reason: 'incompatible_values' }
	}
	if (!arePositionsConnectable(state, aIndex, bIndex)) {
		return { ok: false, reason: 'not_connectable' }
	}
	return { ok: true }
}

/** Convenience boolean wrapper around `explainMatch`. */
export function canMatch(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): boolean {
	return explainMatch(state, aIndex, bIndex).ok
}
