/**
 * Single source of truth for index ↔ row/column conversion.
 * All geometry helpers must use these functions — do not re-derive formulas.
 */

import type { BoardState, Coordinate } from './types'

/** Convert a linear row-major index into a coordinate. */
export function indexToCoordinate(
	index: number,
	width: number,
): Coordinate {
	if (!Number.isInteger(index) || !Number.isInteger(width) || width <= 0) {
		return { row: -1, col: -1 }
	}
	if (index < 0) {
		return { row: -1, col: -1 }
	}
	return {
		row: Math.floor(index / width),
		col: index % width,
	}
}

/**
 * Convert a coordinate into a linear row-major index.
 * Returns -1 for out-of-range inputs (never silently wraps).
 */
export function coordinateToIndex(
	row: number,
	col: number,
	width: number,
): number {
	if (
		!Number.isInteger(row) ||
		!Number.isInteger(col) ||
		!Number.isInteger(width) ||
		width <= 0 ||
		row < 0 ||
		col < 0 ||
		col >= width
	) {
		return -1
	}
	return row * width + col
}

/** True when index is a valid cell position on this board. */
export function isValidIndex(state: BoardState, index: number): boolean {
	return (
		Number.isInteger(index) &&
		index >= 0 &&
		index < state.cells.length
	)
}

/**
 * True when the coordinate maps to an existing cell on this board.
 * Partial final rows are allowed: index must exist in `cells`.
 */
export function isValidCoordinate(
	state: BoardState,
	row: number,
	col: number,
): boolean {
	const index = coordinateToIndex(row, col, state.width)
	return index >= 0 && index < state.cells.length
}
