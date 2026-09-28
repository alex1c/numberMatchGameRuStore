/**
 * Normalize board geometry after removals.
 *
 * Fully empty *complete* rows (width cells, all removed) are dropped.
 * A trailing partial row is trimmed only when every existing cell is removed.
 * Surviving cells keep stable IDs; linear indices/coordinates may change.
 */

import type { BoardState, Cell } from './types'

/**
 * Drop empty complete rows (and a fully-removed trailing partial row).
 * Returns the same reference when nothing changes.
 */
export function collapseEmptyRows(state: BoardState): BoardState {
	const { width, cells, nextCellSeq } = state
	if (width <= 0 || cells.length === 0) {
		return state
	}

	const nextCells: Cell[] = []
	let index = 0
	while (index < cells.length) {
		const remaining = cells.length - index
		const rowLen = Math.min(width, remaining)
		const row = cells.slice(index, index + rowLen)
		const allRemoved = row.every((cell) => cell.removed)
		const isCompleteRow = rowLen === width
		const isTrailingPartial = rowLen < width && index + rowLen === cells.length

		if (allRemoved && (isCompleteRow || isTrailingPartial)) {
			index += rowLen
			continue
		}

		for (const cell of row) {
			nextCells.push(cell)
		}
		index += rowLen
	}

	if (nextCells.length === cells.length) {
		return state
	}

	return {
		width,
		nextCellSeq,
		cells: nextCells,
	}
}
