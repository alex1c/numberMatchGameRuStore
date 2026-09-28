/**
 * Invariant / property-style regression tests (no extra property-testing library).
 */

import {
	appendRemainingNumbers,
	areValuesMatchable,
	boardFromFixture,
	canMatch,
	countActiveCells,
	createBoard,
	getActiveValues,
	getAvailableMoves,
	isBoardCleared,
	removePair,
	toCanonicalBoard,
	validateBoard,
} from '../index'
import type { CellValue } from '../index'

function randomBoard(width: number, count: number, seed: number) {
	let s = seed
	const next = () => {
		s = (s * 1664525 + 1013904223) >>> 0
		return s
	}
	const values: CellValue[] = []
	for (let i = 0; i < count; i += 1) {
		values.push(((next() % 9) + 1) as CellValue)
	}
	return createBoard(values, width)
}

describe('invariants', () => {
	it('removing a valid pair reduces active count by exactly 2', () => {
		const board = boardFromFixture('1 . 9 4 6', 5)
		const before = countActiveCells(board)
		const result = removePair(board, 0, 2)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(countActiveCells(result.state)).toBe(before - 2)
	})

	it('invalid moves leave the board reference unchanged', () => {
		const board = createBoard([1, 2, 3, 4], 4)
		const result = removePair(board, 0, 1)
		expect(result.ok).toBe(false)
		expect(result.state).toBe(board)
	})

	it('every enumerated move passes canMatch', () => {
		const boards = [
			boardFromFixture('5 5 5 5', 4),
			boardFromFixture(`
				1 2 3
				7 8 9
			`, 3),
			randomBoard(5, 20, 42),
			randomBoard(9, 36, 99),
		]
		for (const board of boards) {
			for (const move of getAvailableMoves(board)) {
				expect(canMatch(board, move.aIndex, move.bIndex)).toBe(true)
				expect(canMatch(board, move.bIndex, move.aIndex)).toBe(true)
			}
		}
	})

	it('append only adds previously active values and keeps old ids', () => {
		const board = boardFromFixture(`
			2 . 8
			3 . 7
		`, 3)
		const active = getActiveValues(board)
		const oldIds = board.cells.map((c) => c.id)
		const next = appendRemainingNumbers(board)
		expect(next.cells.slice(0, board.cells.length).map((c) => c.id)).toEqual(oldIds)
		expect(next.cells.slice(board.cells.length).map((c) => c.value)).toEqual(active)
		expect(new Set(next.cells.map((c) => c.id)).size).toBe(next.cells.length)
	})

	it('cleared boards have zero legal moves', () => {
		const board = boardFromFixture('. .', 2)
		expect(isBoardCleared(board)).toBe(true)
		expect(getAvailableMoves(board)).toEqual([])
	})

	it('reversing endpoints never changes legality', () => {
		const board = boardFromFixture(`
			1 . 9
			2 8 3
		`, 3)
		for (let a = 0; a < board.cells.length; a += 1) {
			for (let b = 0; b < board.cells.length; b += 1) {
				expect(canMatch(board, a, b)).toBe(canMatch(board, b, a))
			}
		}
	})

	it('canonical form is stable for identical geometry', () => {
		const a = boardFromFixture('1 . 9', 3)
		const b = boardFromFixture('1 . 9', 3)
		expect(toCanonicalBoard(a)).toBe(toCanonicalBoard(b))
		expect(validateBoard(a).ok).toBe(true)
	})

	it('areValuesMatchable agrees with equal-or-sum-10 definition', () => {
		for (let a = 1; a <= 9; a += 1) {
			for (let b = 1; b <= 9; b += 1) {
				expect(areValuesMatchable(a, b)).toBe(a === b || a + b === 10)
			}
		}
	})
})
