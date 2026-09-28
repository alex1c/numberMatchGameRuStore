/**
 * Empty-row collapse after successful removals (generationVersion 2).
 */

import {
	appendRemainingNumbers,
	boardFromFixture,
	canMatch,
	collapseEmptyRows,
	countActiveCells,
	getAvailableMoves,
	hasAvailableMoves,
	removePair,
} from '../index'

describe('collapseEmptyRows', () => {
	it('drops a fully removed complete middle row', () => {
		const board = boardFromFixture(`
			1 . 3
			. . .
			2 8 4
		`, 3)
		const collapsed = collapseEmptyRows(board)
		expect(collapsed.cells).toHaveLength(6)
		expect(collapsed.cells.map((c) => (c.removed ? '.' : c.value))).toEqual([
			1, '.', 3, 2, 8, 4,
		])
		// IDs of survivors preserved
		expect(collapsed.cells[0]?.id).toBe(board.cells[0]?.id)
		expect(collapsed.cells[3]?.id).toBe(board.cells[6]?.id)
	})

	it('returns same reference when nothing to collapse', () => {
		const board = boardFromFixture('1 . 9', 3)
		expect(collapseEmptyRows(board)).toBe(board)
	})

	it('trims a fully removed trailing partial row', () => {
		const board = boardFromFixture(`
			1 2 3
			. .
		`, 3)
		const collapsed = collapseEmptyRows(board)
		expect(collapsed.cells).toHaveLength(3)
		expect(collapsed.cells.every((c) => !c.removed)).toBe(true)
	})

	it('does not treat missing partial-row columns as cells', () => {
		const board = boardFromFixture(`
			1 2 3 4 5 6 7
			8 9 1
		`, 7)
		expect(collapseEmptyRows(board)).toBe(board)
		expect(board.cells).toHaveLength(10)
	})
})

describe('removePair + collapse', () => {
	it('collapses a row cleared by the match', () => {
		const board = boardFromFixture(`
			1 9
			2 8
		`, 2)
		const result = removePair(board, 0, 1)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.state.cells).toHaveLength(2)
		expect(result.state.cells.map((c) => c.value)).toEqual([2, 8])
		expect(result.state.cells.every((c) => !c.removed)).toBe(true)
	})

	it('keeps in-row removed slots when the row still has actives', () => {
		const board = boardFromFixture('1 3 7 4 6', 5)
		const result = removePair(board, 1, 2)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.state.cells).toHaveLength(5)
		expect(result.state.cells.map((c) => (c.removed ? '.' : String(c.value))).join('')).toBe(
			'1..46',
		)
	})

	it('preserves IDs across collapse and supports append', () => {
		const board = boardFromFixture(`
			5 5
			1 9
			2 3
		`, 2)
		const id19a = board.cells[2]!.id
		const id19b = board.cells[3]!.id
		const result = removePair(board, 2, 3) // clear middle row 1 9
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.state.cells).toHaveLength(4)
		expect(result.state.cells.map((c) => c.id)).not.toContain(id19a)
		expect(result.state.cells.map((c) => c.id)).not.toContain(id19b)
		const beforeAppend = result.state.cells.map((c) => c.id)
		const appended = appendRemainingNumbers(result.state)
		expect(appended.cells.slice(0, 4).map((c) => c.id)).toEqual(beforeAppend)
	})

	it('physical-gap class: same values, wrong geometry, no moves', () => {
		const board = boardFromFixture(`
			2 6 . . .
			. . . 2 6
		`, 5)
		expect(canMatch(board, 0, 8)).toBe(false)
		expect(canMatch(board, 1, 9)).toBe(false)
		expect(hasAvailableMoves(board)).toBe(false)
		expect(getAvailableMoves(board)).toEqual([])
		expect(countActiveCells(board)).toBe(4)
		// Empty complete rows absent — compact two-row gap fixture
		expect(board.cells).toHaveLength(10)
	})
})
