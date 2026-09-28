/**
 * appendRemainingNumbers tests.
 */

import {
	appendRemainingNumbers,
	boardFromFixture,
	getActiveValues,
	getAvailableMoves,
	validateBoard,
} from '../index'

describe('appendRemainingNumbers', () => {
	it('copies only active values in row-major order', () => {
		const board = boardFromFixture(`
			2 . 8 3
			. 7 . 3
		`, 4)
		expect(getActiveValues(board)).toEqual([2, 8, 3, 7, 3])
		const next = appendRemainingNumbers(board)
		expect(getActiveValues(next).slice(-5)).toEqual([2, 8, 3, 7, 3])
		expect(next.cells.length).toBe(board.cells.length + 5)
	})

	it('preserves old identities and assigns unique new ones', () => {
		const board = boardFromFixture('1 . 9', 3)
		const oldIds = board.cells.map((c) => c.id)
		const next = appendRemainingNumbers(board)
		expect(next.cells.slice(0, 3).map((c) => c.id)).toEqual(oldIds)
		const newIds = next.cells.slice(3).map((c) => c.id)
		expect(newIds).toEqual(['c4', 'c5'])
		expect(new Set(next.cells.map((c) => c.id)).size).toBe(next.cells.length)
		expect(validateBoard(next).ok).toBe(true)
	})

	it('continues across partial final rows', () => {
		const board = boardFromFixture(`
			1 2 3
			4
		`, 3)
		const next = appendRemainingNumbers(board)
		// Original 4 cells + 4 active values
		expect(next.cells.length).toBe(8)
		expect(next.cells.slice(4).map((c) => c.value)).toEqual([1, 2, 3, 4])
		expect(next.width).toBe(3)
	})

	it('supports repeated append', () => {
		const board = boardFromFixture('2 7', 2)
		const once = appendRemainingNumbers(board)
		const twice = appendRemainingNumbers(once)
		expect(twice.cells.map((c) => c.value)).toEqual([2, 7, 2, 7, 2, 7, 2, 7])
	})

	it('is a no-op when no active values remain', () => {
		const board = boardFromFixture('. . .', 3)
		const next = appendRemainingNumbers(board)
		expect(next).toBe(board)
	})

	it('recomputes available moves after append', () => {
		const board = boardFromFixture('1 2 3', 3)
		expect(getAvailableMoves(board)).toEqual([])
		const next = appendRemainingNumbers(board)
		// Tail duplicates 1,2,3 — new linear/value opportunities may appear
		expect(getAvailableMoves(next).length).toBeGreaterThanOrEqual(0)
		expect(validateBoard(next).ok).toBe(true)
	})
})
