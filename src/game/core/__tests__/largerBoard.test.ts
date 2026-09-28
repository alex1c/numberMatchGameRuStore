/**
 * Representative larger-board smoke test for getAvailableMoves.
 * Guards against infinite loops / pathological exponential search in Phase 1.
 */

import {
	createBoard,
	getAvailableMoves,
	hasAvailableMoves,
	validateBoard,
} from '../index'
import type { CellValue } from '../index'

describe('larger board move enumeration', () => {
	it('enumerates moves on a dense 9x12-style board quickly', () => {
		const width = 9
		const values: CellValue[] = []
		for (let i = 0; i < width * 12; i += 1) {
			values.push(((i % 9) + 1) as CellValue)
		}
		const board = createBoard(values, width)
		expect(validateBoard(board).ok).toBe(true)

		const started = Date.now()
		const moves = getAvailableMoves(board)
		const elapsed = Date.now() - started

		expect(elapsed).toBeLessThan(2000)
		expect(Array.isArray(moves)).toBe(true)
		expect(hasAvailableMoves(board)).toBe(moves.length > 0)
		// Deterministic: second call matches first
		expect(getAvailableMoves(board)).toEqual(moves)
		for (const move of moves) {
			expect(move.aIndex).toBeLessThan(move.bIndex)
		}
	})

	it('works for alternate widths (4 and 7)', () => {
		for (const width of [4, 7]) {
			const values: CellValue[] = []
			for (let i = 0; i < width * 8; i += 1) {
				values.push(((i % 9) + 1) as CellValue)
			}
			const board = createBoard(values, width)
			const moves = getAvailableMoves(board)
			expect(moves.every((m) => m.aIndex < m.bIndex)).toBe(true)
		}
	})
})
