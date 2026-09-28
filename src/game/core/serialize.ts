/**
 * Canonical / hashable board representation for future solver layers.
 * UI-free and deterministic — safe to compare across branches.
 */

import type { BoardState } from './types'

/**
 * Compact canonical string: `w{width}|` then each cell as digit or `.` for removed.
 * Example: `w4|2.837.3`
 */
export function toCanonicalBoard(state: BoardState): string {
	let body = ''
	for (const cell of state.cells) {
		body += cell.removed ? '.' : String(cell.value)
	}
	return `w${state.width}|${body}`
}

/**
 * JSON-friendly snapshot for future persistence boundaries.
 * Does not perform I/O — callers own storage.
 */
export function toSerializableBoard(state: BoardState): {
	width: number
	nextCellSeq: number
	cells: readonly {
		id: string
		value: number
		removed: boolean
	}[]
} {
	return {
		width: state.width,
		nextCellSeq: state.nextCellSeq,
		cells: state.cells.map((cell) => ({
			id: cell.id,
			value: cell.value,
			removed: cell.removed,
		})),
	}
}
