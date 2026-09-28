/**
 * Move enumeration tests.
 */

import {
	boardFromFixture,
	canMatch,
	getAvailableMoves,
	hasAvailableMoves,
	removePair,
} from '../index'

describe('getAvailableMoves', () => {
	it('returns zero moves on a blocked board', () => {
		const board = boardFromFixture('1 2 3', 3)
		expect(getAvailableMoves(board)).toEqual([])
		expect(hasAvailableMoves(board)).toBe(false)
	})

	it('returns exactly one move', () => {
		const board = boardFromFixture('1 9 2', 3)
		const moves = getAvailableMoves(board)
		expect(moves).toEqual([{ aIndex: 0, bIndex: 1 }])
	})

	it('returns multiple moves without reversed duplicates', () => {
		// Adjacent 5s match; 0↔2 is blocked by the middle active 5.
		const board = boardFromFixture('5 5 5', 3)
		const moves = getAvailableMoves(board)
		expect(moves).toEqual([
			{ aIndex: 0, bIndex: 1 },
			{ aIndex: 1, bIndex: 2 },
		])
		const keys = new Set(moves.map((m) => `${m.aIndex}:${m.bIndex}`))
		expect(keys.size).toBe(moves.length)
		for (const move of moves) {
			expect(move.aIndex).toBeLessThan(move.bIndex)
			expect(canMatch(board, move.aIndex, move.bIndex)).toBe(true)
		}

		// With middle removed, 0↔2 becomes a third legal move.
		const open = boardFromFixture('5 . 5', 3)
		expect(getAvailableMoves(open)).toEqual([{ aIndex: 0, bIndex: 2 }])
	})

	it('orders moves deterministically', () => {
		const board = boardFromFixture(`
			1 1
			9 9
		`, 2)
		const a = getAvailableMoves(board)
		const b = getAvailableMoves(board)
		expect(a).toEqual(b)
		for (let i = 1; i < a.length; i += 1) {
			const prev = a[i - 1]!
			const curr = a[i]!
			expect(
				prev.aIndex < curr.aIndex ||
					(prev.aIndex === curr.aIndex && prev.bIndex <= curr.bIndex),
			).toBe(true)
		}
	})

	it('exposes a newly opened move after removal', () => {
		const board = boardFromFixture('1 2 8 9', 4)
		expect(getAvailableMoves(board).some((m) => m.aIndex === 0 && m.bIndex === 3)).toBe(false)
		const after = removePair(board, 1, 2) // 2+8
		expect(after.ok).toBe(true)
		if (!after.ok) return
		expect(getAvailableMoves(after.state)).toContainEqual({ aIndex: 0, bIndex: 3 })
	})
})
