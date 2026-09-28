/**
 * PHASE 2 solver fixture matrix S1–S10 + replay validation.
 */

import {
	appendRemainingNumbers,
	boardFromFixture,
	canMatch,
	getAvailableMoves,
	getConnectionKinds,
	isBoardCleared,
	isLinearClear,
} from '../../core'
import { replaySolution, solveBoard } from '../index'
import {
	fixtureS1,
	fixtureS2,
	fixtureS3,
	fixtureS4,
	fixtureS5,
	fixtureS6,
	fixtureS7,
	fixtureS8,
	fixtureS9,
	fixtureS10,
} from './fixtures'

function expectSolvedReplay(
	board: ReturnType<typeof fixtureS1>['board'],
	options?: Parameters<typeof solveBoard>[1],
) {
	const snapshot = {
		width: board.width,
		nextCellSeq: board.nextCellSeq,
		cells: board.cells.map((c) => ({ ...c })),
	}
	const result = solveBoard(board, options)
	expect(result.status).toBe('solved')
	if (result.status !== 'solved') return result
	const replay = replaySolution(board, result.path)
	expect(replay.ok).toBe(true)
	if (replay.ok) {
		expect(isBoardCleared(replay.state)).toBe(true)
	}
	// Initial board must remain untouched.
	expect(board.width).toBe(snapshot.width)
	expect(board.nextCellSeq).toBe(snapshot.nextCellSeq)
	expect(board.cells).toEqual(snapshot.cells)
	return result
}

describe('solver fixtures S1–S10', () => {
	it('S1 already cleared → solved empty path', () => {
		const { board } = fixtureS1()
		const result = expectSolvedReplay(board)
		if (result.status === 'solved') {
			expect(result.path).toEqual([])
			expect(result.stats.solutionDepth).toBe(0)
		}
	})

	it('S2 one move 1+9 → solved', () => {
		const { board } = fixtureS2()
		const result = expectSolvedReplay(board)
		if (result.status === 'solved') {
			expect(result.path).toEqual([
				{ type: 'match', aIndex: 0, bIndex: 1 },
			])
		}
	})

	it('S3 identical pair → solved', () => {
		const { board } = fixtureS3()
		expectSolvedReplay(board)
	})

	it('S4 blocker opens after prior match (≥2 removals)', () => {
		const { board } = fixtureS4()
		expect(canMatch(board, 0, 4)).toBe(false)
		const result = expectSolvedReplay(board)
		if (result.status === 'solved') {
			expect(result.path.length).toBeGreaterThanOrEqual(2)
			expect(result.path.every((a) => a.type === 'match')).toBe(true)
		}
	})

	it('S5 row-boundary / multi-row linear required', () => {
		const { board } = fixtureS5()
		// End of row 0 (8) → start of row 1 (2)
		expect(isLinearClear(board, 2, 3)).toBe(true)
		expect(getConnectionKinds(board, 2, 3)).toEqual(['linear'])
		expect(canMatch(board, 2, 3)).toBe(true)
		const result = expectSolvedReplay(board)
		if (result.status === 'solved') {
			expect(
				result.path.some(
					(a) =>
						a.type === 'match' &&
						a.aIndex === 2 &&
						a.bIndex === 3,
				),
			).toBe(true)
		}
	})

	it('S5b multi-row linear span with empty middle rows', () => {
		// Width 4: 6 at (0,3) ↔ 4 at (2,0). Not H/V/Diag; only row-major linear.
		const board = boardFromFixture(`
			1 2 3 6
			. . . .
			4
		`, 4)
		expect(isLinearClear(board, 3, 8)).toBe(true)
		expect(getConnectionKinds(board, 3, 8)).toEqual(['linear'])
		expect(canMatch(board, 3, 8)).toBe(true)
		expect(getAvailableMoves(board)).toEqual([{ aIndex: 3, bIndex: 8 }])
		const result = expectSolvedReplay(board, { maxAppends: 2 })
		expect(result.status).toBe('solved')
		if (result.status === 'solved') {
			expect(result.path[0]).toEqual({
				type: 'match',
				aIndex: 3,
				bIndex: 8,
			})
		}
	})

	it('S6 diagonal required', () => {
		const { board } = fixtureS6()
		expect(getConnectionKinds(board, 0, 3)).toContain('diagonal')
		expectSolvedReplay(board)
	})

	it('S7 append required → solved with append then matches', () => {
		const { board, options } = fixtureS7()
		expect(getAvailableMoves(board)).toEqual([])
		const result = expectSolvedReplay(board, options)
		if (result.status === 'solved') {
			expect(result.path[0]).toEqual({ type: 'append' })
			expect(result.path.length).toBeGreaterThan(1)
		}
	})

	it('S8 tiny maxStates → cutoff (never unsolvable)', () => {
		const { board, options } = fixtureS8()
		const result = solveBoard(board, options)
		expect(result.status).toBe('cutoff')
		if (result.status === 'cutoff') {
			expect(result.reason).toBe('max_states')
		}
	})

	it('S9 invalid board → invalid', () => {
		const { board } = fixtureS9()
		const result = solveBoard(board)
		expect(result.status).toBe('invalid')
	})

	it('S10 maxAppends=0 exhausts → unsolvable (proven)', () => {
		const { board, options } = fixtureS10()
		expect(getAvailableMoves(board)).toEqual([])
		const result = solveBoard(board, options)
		expect(result.status).toBe('unsolvable')
		// Same board with append budget becomes solvable (contrast).
		const withAppend = solveBoard(board, { maxAppends: 1 })
		expect(withAppend.status).toBe('solved')
	})
})

describe('solver replay uses production core', () => {
	it('rejects illegal injected match actions', () => {
		const board = boardFromFixture('1 2 3', 3)
		const replay = replaySolution(board, [
			{ type: 'match', aIndex: 0, bIndex: 1 },
		])
		expect(replay.ok).toBe(false)
		if (!replay.ok) {
			expect(replay.reason).toBe('illegal_match')
		}
	})

	it('append in replay matches production appendRemainingNumbers', () => {
		const board = boardFromFixture('1 2 3', 3)
		const expected = appendRemainingNumbers(board)
		const replay = replaySolution(board, [{ type: 'append' }])
		expect(replay.ok).toBe(false) // not cleared after append alone
		expect(replay.state.cells.map((c) => c.value)).toEqual(
			expected.cells.map((c) => c.value),
		)
	})
})
