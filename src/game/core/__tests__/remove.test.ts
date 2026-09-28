/**
 * removePair and post-removal path opening tests.
 */

import {
	boardFromFixture,
	canMatch,
	countActiveCells,
	getCell,
	removePair,
} from '../index'

describe('removePair', () => {
	it('removes a valid pair and keeps in-row empty slots (no full-row collapse)', () => {
		const board = boardFromFixture('1 3 7 4 6', 5)
		const result = removePair(board, 1, 2) // 3+7
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(countActiveCells(result.state)).toBe(3)
		expect(result.state.cells.map((c) => (c.removed ? '.' : String(c.value))).join('')).toBe('1..46')
		expect(getCell(result.state, 1)?.removed).toBe(true)
		expect(getCell(result.state, 1)?.value).toBe(3)
	})

	it('does not mutate on invalid pair', () => {
		const board = boardFromFixture('1 2 3', 3)
		const before = board.cells.map((c) => ({ ...c }))
		const result = removePair(board, 0, 1)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.reason).toBe('incompatible_values')
		expect(result.state).toBe(board)
		expect(board.cells).toEqual(before)
	})

	it('rejects removed cells, same cell, and out-of-range', () => {
		const board = boardFromFixture('1 . 9', 3)
		expect(removePair(board, 0, 1).ok).toBe(false)
		expect(removePair(board, 0, 0).ok).toBe(false)
		expect(removePair(board, 0, 99).ok).toBe(false)
	})

	it('cannot reuse a removed cell after a successful match', () => {
		const board = boardFromFixture('5 5 5', 3)
		const first = removePair(board, 0, 1)
		expect(first.ok).toBe(true)
		if (!first.ok) return
		expect(removePair(first.state, 0, 2).ok).toBe(false)
		expect(canMatch(first.state, 1, 2)).toBe(false)
	})

	it('opens a new path after the first removal', () => {
		// 1 and 9 share a column; 8 blocks the vertical path until removed with 2.
		const vertical = boardFromFixture(`
			1 2
			8 3
			9 4
		`, 2)
		expect(canMatch(vertical, 0, 4)).toBe(false)
		const cleared = removePair(vertical, 1, 2) // 2+8
		expect(cleared.ok).toBe(true)
		if (!cleared.ok) return
		expect(canMatch(cleared.state, 0, 4)).toBe(true)
		const second = removePair(cleared.state, 0, 4)
		expect(second.ok).toBe(true)
	})
})
