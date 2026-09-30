/**
 * Star helper unit tests.
 */

import {
	createEmptyStarBoard,
	maxStarsPossible,
	mergeBestStars,
	normalizeStarCount,
	starsFromAttempt,
	totalStars,
	withBestStars,
} from '../stars'

describe('starsFromAttempt', () => {
	it('awards 3 for clean run', () => {
		expect(starsFromAttempt({ usedHint: false, usedUndo: false })).toBe(3)
	})

	it('awards 2 when only Hint used', () => {
		expect(starsFromAttempt({ usedHint: true, usedUndo: false })).toBe(2)
	})

	it('awards 2 when only Undo used', () => {
		expect(starsFromAttempt({ usedHint: false, usedUndo: true })).toBe(2)
	})

	it('awards 1 when both helps used', () => {
		expect(starsFromAttempt({ usedHint: true, usedUndo: true })).toBe(1)
	})
})

describe('best stars', () => {
	it('never decreases', () => {
		expect(mergeBestStars(3, 1)).toBe(3)
		expect(mergeBestStars(1, 3)).toBe(3)
	})

	it('upgrades board and total', () => {
		let board = createEmptyStarBoard(1000)
		board = withBestStars(board, 17, 1)
		expect(totalStars(board)).toBe(1)
		board = withBestStars(board, 17, 3)
		expect(board[16]).toBe(3)
		expect(totalStars(board)).toBe(3)
		board = withBestStars(board, 17, 1)
		expect(board[16]).toBe(3)
		expect(totalStars(board)).toBe(3)
	})

	it('max total is 3000', () => {
		expect(maxStarsPossible(1000)).toBe(3000)
		const board = createEmptyStarBoard(1000).map(() => 3 as const)
		expect(totalStars(board)).toBe(3000)
	})

	it('normalizes invalid values', () => {
		expect(normalizeStarCount(2)).toBe(2)
		expect(normalizeStarCount(9)).toBe(3)
		expect(normalizeStarCount(-1)).toBe(0)
		expect(normalizeStarCount('x')).toBeNull()
	})
})
