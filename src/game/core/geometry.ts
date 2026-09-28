/**
 * Classic Number Match connection geometry.
 *
 * Supported directions (endpoints must be distinct board indices):
 * - Horizontal: same row; cells strictly between on that row are removed
 * - Vertical: same column; cells strictly between are removed
 * - Diagonal: equal |Δrow| and |Δcol|; cells strictly between on that diagonal are removed
 * - Linear / row-boundary: all cells strictly between the two indices in
 *   row-major order are removed (covers end-of-row → start-of-next-row)
 *
 * Explicitly NOT supported:
 * - Same-row torus wrap (last column ↔ first column of the same row)
 * - Knight moves, L-paths, multi-turn paths
 * - Paths through active (non-removed) cells
 */

import { indexToCoordinate, isValidIndex } from './coordinates'
import type { BoardState, ConnectionKind } from './types'

/** True when every cell with index in (lo, hi) exclusive is removed. */
function allRemovedBetween(
	state: BoardState,
	loExclusive: number,
	hiExclusive: number,
): boolean {
	for (let i = loExclusive + 1; i < hiExclusive; i += 1) {
		const cell = state.cells[i]
		if (!cell || !cell.removed) {
			return false
		}
	}
	return true
}

/**
 * Horizontal clear path on one row.
 * Adjacent cells (no cells between) are allowed.
 */
export function isHorizontalClear(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): boolean {
	if (!isValidIndex(state, aIndex) || !isValidIndex(state, bIndex)) {
		return false
	}
	if (aIndex === bIndex) {
		return false
	}
	const a = indexToCoordinate(aIndex, state.width)
	const b = indexToCoordinate(bIndex, state.width)
	if (a.row !== b.row) {
		return false
	}
	const lo = Math.min(aIndex, bIndex)
	const hi = Math.max(aIndex, bIndex)
	return allRemovedBetween(state, lo, hi)
}

/**
 * Vertical clear path on one column.
 */
export function isVerticalClear(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): boolean {
	if (!isValidIndex(state, aIndex) || !isValidIndex(state, bIndex)) {
		return false
	}
	if (aIndex === bIndex) {
		return false
	}
	const a = indexToCoordinate(aIndex, state.width)
	const b = indexToCoordinate(bIndex, state.width)
	if (a.col !== b.col || a.row === b.row) {
		return false
	}
	const rowStep = a.row < b.row ? 1 : -1
	for (let row = a.row + rowStep; row !== b.row; row += rowStep) {
		const index = row * state.width + a.col
		const cell = state.cells[index]
		if (!cell || !cell.removed) {
			return false
		}
	}
	return true
}

/**
 * Straight diagonal: |Δrow| === |Δcol| and ≥ 1.
 * Intermediate cells on that diagonal must be removed.
 */
export function isDiagonalClear(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): boolean {
	if (!isValidIndex(state, aIndex) || !isValidIndex(state, bIndex)) {
		return false
	}
	if (aIndex === bIndex) {
		return false
	}
	const a = indexToCoordinate(aIndex, state.width)
	const b = indexToCoordinate(bIndex, state.width)
	const dRow = b.row - a.row
	const dCol = b.col - a.col
	const absRow = Math.abs(dRow)
	const absCol = Math.abs(dCol)
	if (absRow === 0 || absRow !== absCol) {
		return false
	}
	const rowStep = dRow > 0 ? 1 : -1
	const colStep = dCol > 0 ? 1 : -1
	for (let step = 1; step < absRow; step += 1) {
		const row = a.row + rowStep * step
		const col = a.col + colStep * step
		const index = row * state.width + col
		const cell = state.cells[index]
		if (!cell || !cell.removed) {
			return false
		}
	}
	return true
}

/**
 * Linear / row-boundary path in row-major reading order.
 *
 * Two distinct indices are connectable when every cell strictly between them
 * in linear order is removed. This covers:
 * - same-row spans (also covered by horizontal)
 * - end of row N → start of row N+1 (classic Number Match continuation)
 * - multi-row linear spans when the entire middle is empty
 *
 * This is NOT same-row torus wrap: cells on one row never connect by wrapping
 * left↔right; they only connect through the forward row-major sequence.
 */
export function isLinearClear(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): boolean {
	if (!isValidIndex(state, aIndex) || !isValidIndex(state, bIndex)) {
		return false
	}
	if (aIndex === bIndex) {
		return false
	}
	const lo = Math.min(aIndex, bIndex)
	const hi = Math.max(aIndex, bIndex)
	return allRemovedBetween(state, lo, hi)
}

/**
 * Positions are connectable when at least one classic clear path exists.
 * Endpoint activity / value compatibility are checked by `canMatch`.
 */
export function arePositionsConnectable(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): boolean {
	return (
		isHorizontalClear(state, aIndex, bIndex) ||
		isVerticalClear(state, aIndex, bIndex) ||
		isDiagonalClear(state, aIndex, bIndex) ||
		isLinearClear(state, aIndex, bIndex)
	)
}

/**
 * Return which connection kinds apply (for debugging / tests).
 * Empty array means not connectable.
 */
export function getConnectionKinds(
	state: BoardState,
	aIndex: number,
	bIndex: number,
): readonly ConnectionKind[] {
	const kinds: ConnectionKind[] = []
	if (isHorizontalClear(state, aIndex, bIndex)) {
		kinds.push('horizontal')
	}
	if (isVerticalClear(state, aIndex, bIndex)) {
		kinds.push('vertical')
	}
	if (isDiagonalClear(state, aIndex, bIndex)) {
		kinds.push('diagonal')
	}
	if (isLinearClear(state, aIndex, bIndex)) {
		kinds.push('linear')
	}
	return kinds
}
