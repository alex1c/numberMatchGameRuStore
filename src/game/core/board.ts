/**
 * Board creation, inspection, validation, cloning, and clear detection.
 * Transitions are pure: operations return new state objects.
 */

import { isValidIndex } from './coordinates'
import { isCellValue } from './values'
import type {
	BoardState,
	BoardValidationResult,
	Cell,
	CellId,
	CellValue,
} from './types'

/** Create a stable cell id from a monotonic sequence number. */
export function makeCellId(seq: number): CellId {
	return `c${seq}`
}

/**
 * Create a board from a flat list of values in row-major order.
 * `width` must be a positive integer; values must be in 1..9.
 */
export function createBoard(
	values: readonly CellValue[],
	width: number,
): BoardState {
	if (!Number.isInteger(width) || width <= 0) {
		throw new Error(`createBoard: width must be a positive integer, got ${width}`)
	}
	for (let i = 0; i < values.length; i += 1) {
		const value = values[i]
		if (value === undefined || !isCellValue(value)) {
			throw new Error(`createBoard: invalid value at index ${i}: ${String(value)}`)
		}
	}
	const cells: Cell[] = values.map((value, index) => ({
		id: makeCellId(index + 1),
		value,
		removed: false,
	}))
	return {
		width,
		cells,
		nextCellSeq: values.length + 1,
	}
}

/**
 * Validate structural invariants of a board.
 * Used at persistence / programmer boundaries — not for normal invalid moves.
 */
export function validateBoard(state: BoardState): BoardValidationResult {
	if (!Number.isInteger(state.width) || state.width <= 0) {
		return { ok: false, reason: 'width must be a positive integer' }
	}
	if (!Array.isArray(state.cells)) {
		return { ok: false, reason: 'cells must be an array' }
	}
	if (!Number.isInteger(state.nextCellSeq) || state.nextCellSeq < 1) {
		return { ok: false, reason: 'nextCellSeq must be a positive integer' }
	}
	const seenIds = new Set<string>()
	for (let i = 0; i < state.cells.length; i += 1) {
		const cell = state.cells[i]
		if (!cell) {
			return { ok: false, reason: `missing cell at index ${i}` }
		}
		if (!isCellValue(cell.value)) {
			return { ok: false, reason: `invalid value at index ${i}` }
		}
		if (typeof cell.id !== 'string' || cell.id.length === 0) {
			return { ok: false, reason: `invalid id at index ${i}` }
		}
		if (seenIds.has(cell.id)) {
			return { ok: false, reason: `duplicate id ${cell.id}` }
		}
		seenIds.add(cell.id)
		if (typeof cell.removed !== 'boolean') {
			return { ok: false, reason: `invalid removed flag at index ${i}` }
		}
	}
	return { ok: true }
}

/** Read a cell by linear index, or null when out of range. */
export function getCell(state: BoardState, index: number): Cell | null {
	if (!isValidIndex(state, index)) {
		return null
	}
	return state.cells[index] ?? null
}

/** Count currently active (non-removed) numbers. */
export function countActiveCells(state: BoardState): number {
	let count = 0
	for (const cell of state.cells) {
		if (!cell.removed) {
			count += 1
		}
	}
	return count
}

/**
 * Board is cleared when no active numbers remain.
 * Removed cells may still occupy the representation; height does not matter.
 */
export function isBoardCleared(state: BoardState): boolean {
	return countActiveCells(state) === 0
}

/** Shallow-immutable clone suitable for branching (solver / undo later). */
export function cloneBoard(state: BoardState): BoardState {
	return {
		width: state.width,
		nextCellSeq: state.nextCellSeq,
		cells: state.cells.map((cell) => ({ ...cell })),
	}
}

/**
 * Active values in current row-major order (removed cells skipped).
 * Used by append and tests — not a geometry representation.
 */
export function getActiveValues(state: BoardState): readonly CellValue[] {
	const values: CellValue[] = []
	for (const cell of state.cells) {
		if (!cell.removed) {
			values.push(cell.value)
		}
	}
	return values
}

/**
 * Active cell indices in row-major order.
 */
export function getActiveIndices(state: BoardState): readonly number[] {
	const indices: number[] = []
	for (let i = 0; i < state.cells.length; i += 1) {
		if (!state.cells[i]!.removed) {
			indices.push(i)
		}
	}
	return indices
}
