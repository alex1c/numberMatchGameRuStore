/**
 * Classic «Добавить числа» / append-remaining-numbers operation.
 *
 * Snapshot active values in row-major order, leave existing cells untouched,
 * and append new cells with fresh identities at the end of the linear board.
 */

import { getActiveValues, makeCellId } from './board'
import type { BoardState, Cell } from './types'

/**
 * Append a copy of remaining active values to the end of the board.
 * - Removed cells are not copied
 * - Existing cell identities and positions are unchanged
 * - New cells receive unique IDs from `nextCellSeq`
 * - Empty active set is a no-op (same state reference)
 */
export function appendRemainingNumbers(state: BoardState): BoardState {
	const activeValues = getActiveValues(state)
	if (activeValues.length === 0) {
		return state
	}

	let seq = state.nextCellSeq
	const appended: Cell[] = activeValues.map((value) => {
		const cell: Cell = {
			id: makeCellId(seq),
			value,
			removed: false,
		}
		seq += 1
		return cell
	})

	return {
		width: state.width,
		nextCellSeq: seq,
		cells: [...state.cells, ...appended],
	}
}
