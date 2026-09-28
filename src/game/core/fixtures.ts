/**
 * Readable test fixtures for Number Match boards.
 * Production code must not depend on this module.
 *
 * Format example (width inferred from first non-empty line length unless given):
 *   1 . . 9
 *   2 8 4 6
 *
 * Tokens:
 * - digit 1..9 — active cell
 * - `.` or `_` — removed / empty geometric cell
 */

import { makeCellId } from './board'
import { isCellValue } from './values'
import type { BoardState, Cell, CellValue } from './types'

export type FixtureToken = CellValue | '.'

/**
 * Parse a multi-line board diagram into a BoardState.
 * Rows may be shorter only on the final row (partial last row).
 */
export function boardFromFixture(
	diagram: string,
	width?: number,
): BoardState {
	const lines = diagram
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

	if (lines.length === 0) {
		throw new Error('boardFromFixture: empty diagram')
	}

	const tokenRows: FixtureToken[][] = lines.map((line, rowIndex) => {
		const parts = line.split(/\s+/).filter((part) => part.length > 0)
		return parts.map((part, colIndex) => {
			if (part === '.' || part === '_') {
				return '.'
			}
			const numeric = Number(part)
			if (!isCellValue(numeric)) {
				throw new Error(
					`boardFromFixture: invalid token "${part}" at row ${rowIndex} col ${colIndex}`,
				)
			}
			return numeric
		})
	})

	const inferredWidth = width ?? tokenRows[0]!.length
	if (!Number.isInteger(inferredWidth) || inferredWidth <= 0) {
		throw new Error('boardFromFixture: invalid width')
	}

	for (let r = 0; r < tokenRows.length; r += 1) {
		const row = tokenRows[r]!
		const isLast = r === tokenRows.length - 1
		if (isLast) {
			if (row.length > inferredWidth) {
				throw new Error(
					`boardFromFixture: last row longer than width ${inferredWidth}`,
				)
			}
		} else if (row.length !== inferredWidth) {
			throw new Error(
				`boardFromFixture: row ${r} length ${row.length} !== width ${inferredWidth}`,
			)
		}
	}

	const cells: Cell[] = []
	let seq = 1
	for (const row of tokenRows) {
		for (const token of row) {
			if (token === '.') {
				// Removed placeholder keeps geometry; value 1 is inert debug filler.
				cells.push({
					id: makeCellId(seq),
					value: 1,
					removed: true,
				})
			} else {
				cells.push({
					id: makeCellId(seq),
					value: token,
					removed: false,
				})
			}
			seq += 1
		}
	}

	return {
		width: inferredWidth,
		cells,
		nextCellSeq: seq,
	}
}

/** Render a board as a fixture-like string for assertion messages. */
export function boardToFixture(state: BoardState): string {
	const lines: string[] = []
	for (let i = 0; i < state.cells.length; i += state.width) {
		const slice = state.cells.slice(i, i + state.width)
		lines.push(
			slice
				.map((cell) => (cell.removed ? '.' : String(cell.value)))
				.join(' '),
		)
	}
	return lines.join('\n')
}
