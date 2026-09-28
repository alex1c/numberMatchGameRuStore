/**
 * Cleared-board detection and robustness edge cases.
 */

import {
	boardFromFixture,
	canMatch,
	createBoard,
	getAvailableMoves,
	isBoardCleared,
	removePair,
	validateBoard,
} from '../index'

describe('isBoardCleared', () => {
	it('is false for initial non-empty boards', () => {
		const board = createBoard([1, 2, 3], 3)
		expect(isBoardCleared(board)).toBe(false)
	})

	it('is false when only partially removed', () => {
		const board = boardFromFixture('1 . 9', 3)
		expect(isBoardCleared(board)).toBe(false)
	})

	it('is true when every cell is removed', () => {
		const board = boardFromFixture('. . .', 3)
		expect(isBoardCleared(board)).toBe(true)
		expect(getAvailableMoves(board)).toEqual([])
	})
})

describe('robustness', () => {
	it('rejects invalid indices and same-cell matches', () => {
		const board = createBoard([1, 9], 2)
		expect(canMatch(board, -1, 0)).toBe(false)
		expect(canMatch(board, 0, 0)).toBe(false)
		expect(canMatch(board, 0, 5)).toBe(false)
	})

	it('validateBoard catches duplicate ids', () => {
		const board = createBoard([1, 2], 2)
		const broken = {
			...board,
			cells: [
				{ ...board.cells[0]!, id: 'dup' },
				{ ...board.cells[1]!, id: 'dup' },
			],
		}
		expect(validateBoard(broken).ok).toBe(false)
	})

	it('removePair does not alias prior snapshots', () => {
		const board = createBoard([5, 5], 2)
		const snapshot = board.cells.map((c) => ({ ...c }))
		const result = removePair(board, 0, 1)
		expect(result.ok).toBe(true)
		expect(board.cells).toEqual(snapshot)
		expect(result.ok && result.state.cells[0]?.removed).toBe(true)
	})
})
