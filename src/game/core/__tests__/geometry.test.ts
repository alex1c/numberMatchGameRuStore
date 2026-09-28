/**
 * Geometry tests: horizontal, vertical, diagonal, linear/row-boundary.
 */

import {
	arePositionsConnectable,
	boardFromFixture,
	canMatch,
	coordinateToIndex,
	getConnectionKinds,
	indexToCoordinate,
	isDiagonalClear,
	isHorizontalClear,
	isLinearClear,
	isVerticalClear,
} from '../index'

describe('coordinates', () => {
	it('converts index 0 and row boundaries for multiple widths', () => {
		expect(indexToCoordinate(0, 4)).toEqual({ row: 0, col: 0 })
		expect(indexToCoordinate(3, 4)).toEqual({ row: 0, col: 3 })
		expect(indexToCoordinate(4, 4)).toEqual({ row: 1, col: 0 })
		expect(coordinateToIndex(1, 0, 4)).toBe(4)
		expect(coordinateToIndex(0, 4, 4)).toBe(-1)
	})

	it('handles partial final row indices', () => {
		const board = boardFromFixture(`
			1 2 3
			4 5
		`, 3)
		expect(board.cells).toHaveLength(5)
		expect(indexToCoordinate(4, 3)).toEqual({ row: 1, col: 1 })
		expect(coordinateToIndex(1, 2, 3)).toBe(5) // would be past end
		expect(board.cells[5]).toBeUndefined()
	})
})

describe('horizontal geometry', () => {
	it('connects adjacent cells', () => {
		const board = boardFromFixture('1 1 3', 3)
		expect(isHorizontalClear(board, 0, 1)).toBe(true)
		expect(canMatch(board, 0, 1)).toBe(true)
	})

	it('allows one or many removed cells between', () => {
		const one = boardFromFixture('1 . 9', 3)
		expect(isHorizontalClear(one, 0, 2)).toBe(true)
		expect(canMatch(one, 0, 2)).toBe(true)

		const many = boardFromFixture('2 . . . 8', 5)
		expect(isHorizontalClear(many, 0, 4)).toBe(true)
		expect(canMatch(many, 0, 4)).toBe(true)
	})

	it('blocks when an active cell sits between', () => {
		const board = boardFromFixture('1 5 9', 3)
		expect(isHorizontalClear(board, 0, 2)).toBe(false)
		expect(canMatch(board, 0, 2)).toBe(false)
	})

	it('is order-independent for reverse selection', () => {
		const board = boardFromFixture('4 . 6', 3)
		expect(canMatch(board, 0, 2)).toBe(true)
		expect(canMatch(board, 2, 0)).toBe(true)
	})
})

describe('vertical geometry', () => {
	it('connects adjacent rows in one column', () => {
		const board = boardFromFixture(`
			1 2
			1 3
		`, 2)
		expect(isVerticalClear(board, 0, 2)).toBe(true)
		expect(canMatch(board, 0, 2)).toBe(true)
	})

	it('allows removed gaps and rejects blockers', () => {
		const clear = boardFromFixture(`
			3 .
			. .
			7 .
		`, 2)
		expect(isVerticalClear(clear, 0, 4)).toBe(true)
		expect(canMatch(clear, 0, 4)).toBe(true)

		const blocked = boardFromFixture(`
			3 .
			5 .
			7 .
		`, 2)
		expect(isVerticalClear(blocked, 0, 4)).toBe(false)
		expect(canMatch(blocked, 0, 4)).toBe(false)
	})
})

describe('diagonal geometry', () => {
	it('connects adjacent diagonal cells', () => {
		const board = boardFromFixture(`
			1 2
			3 1
		`, 2)
		expect(isDiagonalClear(board, 0, 3)).toBe(true)
		expect(canMatch(board, 0, 3)).toBe(true)
	})

	it('allows removed cells on a straight diagonal', () => {
		const board = boardFromFixture(`
			9 . .
			. . .
			. . 1
		`, 3)
		expect(isDiagonalClear(board, 0, 8)).toBe(true)
		expect(canMatch(board, 0, 8)).toBe(true)
	})

	it('rejects diagonal blockers and non-diagonal slopes', () => {
		const blocked = boardFromFixture(`
			9 . .
			. 5 .
			. . 1
		`, 3)
		expect(isDiagonalClear(blocked, 0, 8)).toBe(false)

		const notDiagonal = boardFromFixture(`
			1 . .
			. . .
			. 9 .
		`, 3)
		// (0,0) → (2,1): |Δrow|=2, |Δcol|=1 — not a straight diagonal
		expect(isDiagonalClear(notDiagonal, 0, 7)).toBe(false)
	})
})

describe('linear / end-of-row geometry', () => {
	it('connects last cell of row N with first cell of row N+1', () => {
		const board = boardFromFixture(`
			1 2 3
			7 5 6
		`, 3)
		// 3 at index 2 and 7 at index 3 — adjacent in row-major order
		expect(isLinearClear(board, 2, 3)).toBe(true)
		expect(canMatch(board, 2, 3)).toBe(true)
		expect(getConnectionKinds(board, 2, 3)).toContain('linear')
		expect(isHorizontalClear(board, 2, 3)).toBe(false)
		expect(isVerticalClear(board, 2, 3)).toBe(false)
	})

	it('allows removed gap across the row boundary', () => {
		const board = boardFromFixture(`
			1 2 .
			. . 8
		`, 3)
		// 2 (index 1) ↔ 8 (index 5); between indices 2,3,4 are removed; 2+8=10
		expect(isLinearClear(board, 1, 5)).toBe(true)
		expect(canMatch(board, 1, 5)).toBe(true)
	})

	it('blocks when an active cell sits across the boundary path', () => {
		const board = boardFromFixture(`
			1 2 3
			4 5 9
		`, 3)
		// 2 (1) ↔ 9 (5): between 2,3,4 = 3,4,5 all active
		expect(isLinearClear(board, 1, 5)).toBe(false)
		expect(canMatch(board, 1, 5)).toBe(false)
	})

	it('supports several removed cells and incomplete last row', () => {
		const board = boardFromFixture(`
			4 5 6
			. . .
			4
		`, 3)
		// 6 (2) ↔ 4 (6): between indices 3..5 removed; values sum to 10; last row partial
		expect(board.cells).toHaveLength(7)
		expect(isLinearClear(board, 2, 6)).toBe(true)
		expect(canMatch(board, 2, 6)).toBe(true)
	})

	it('is order-independent for reverse selection', () => {
		const board = boardFromFixture(`
			1 2 8
			2 5 6
		`, 3)
		expect(canMatch(board, 2, 3)).toBe(true)
		expect(canMatch(board, 3, 2)).toBe(true)
	})

	it('rejects same-row torus wrap that only looks adjacent visually', () => {
		// Width 4: 9 at col0 and 1 at col3 are NOT connected by wrapping the row.
		const board = boardFromFixture('9 5 5 1', 4)
		expect(isHorizontalClear(board, 0, 3)).toBe(false)
		expect(isLinearClear(board, 0, 3)).toBe(false)
		expect(arePositionsConnectable(board, 0, 3)).toBe(false)
		expect(canMatch(board, 0, 3)).toBe(false)
	})

	it('rejects visually close non-linear non-diagonal pairs', () => {
		// 1 at (0,0) and 9 at (2,1): not H/V/Diag; linear blocked by 5.
		const board = boardFromFixture(`
			1 5 .
			. . .
			. 9 .
		`, 3)
		expect(isDiagonalClear(board, 0, 7)).toBe(false)
		expect(isLinearClear(board, 0, 7)).toBe(false)
		expect(canMatch(board, 0, 7)).toBe(false)
	})
})
