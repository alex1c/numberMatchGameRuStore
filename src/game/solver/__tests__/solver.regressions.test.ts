/**
 * Determinism, cache/append-budget, ID-irrelevance, and policy regressions.
 */

import {
	boardFromFixture,
	cloneBoard,
	createBoard,
	type BoardState,
	type CellValue,
} from '../../core'
import {
	firstSolutionMove,
	solveBoard,
	solverCacheKey,
	type SolverAction,
} from '../index'

function withDifferentIds(board: BoardState, seqOffset: number): BoardState {
	return {
		width: board.width,
		nextCellSeq: board.nextCellSeq + seqOffset + board.cells.length,
		cells: board.cells.map((cell, index) => ({
			...cell,
			id: `alt${seqOffset}_${index}`,
		})),
	}
}

describe('solver determinism', () => {
	it('same board/options ⇒ same status, path, and explored state count', () => {
		const board = boardFromFixture(`
			1 2
			8 7
			9 3
		`, 2)
		const options = { maxAppends: 2, maxStates: 5_000 }
		const a = solveBoard(board, options)
		const b = solveBoard(board, options)
		expect(a.status).toBe(b.status)
		expect(a.status).toBe('solved')
		if (a.status === 'solved' && b.status === 'solved') {
			expect(a.path).toEqual(b.path)
			expect(a.stats.exploredStates).toBe(b.stats.exploredStates)
			expect(a.stats.generatedTransitions).toBe(b.stats.generatedTransitions)
		}
	})

	it('cell IDs / nextCellSeq do not change mathematical solve outcome', () => {
		const base = boardFromFixture('1 9 2 8', 4)
		const alt = withDifferentIds(base, 100)
		expect(solverCacheKey(base, 2)).toBe(solverCacheKey(alt, 2))
		const a = solveBoard(base, { maxAppends: 1 })
		const b = solveBoard(alt, { maxAppends: 1 })
		expect(a.status).toBe(b.status)
		if (a.status === 'solved' && b.status === 'solved') {
			expect(a.path).toEqual(b.path)
		}
	})
})

describe('append-budget cache key', () => {
	it('same geometry with different remaining appends is not conflated', () => {
		const board = boardFromFixture('1 2 3', 3)
		const key0 = solverCacheKey(board, 0)
		const key1 = solverCacheKey(board, 1)
		expect(key0).not.toBe(key1)

		const noAppend = solveBoard(board, { maxAppends: 0 })
		const withAppend = solveBoard(board, { maxAppends: 1 })
		expect(noAppend.status).toBe('unsolvable')
		expect(withAppend.status).toBe('solved')
	})

	it('failure memo does not leak across different append allowances in one search', () => {
		// anytime policy can visit richer trees; ensure append-required board still solves.
		const board = boardFromFixture('1 2 3', 3)
		const result = solveBoard(board, {
			maxAppends: 2,
			appendPolicy: 'anytime',
			maxStates: 10_000,
		})
		expect(result.status).toBe('solved')
	})
})

describe('append policy', () => {
	it('when_stuck does not append while matches exist', () => {
		const board = boardFromFixture('5 5 1 2', 4)
		const result = solveBoard(board, {
			maxAppends: 2,
			appendPolicy: 'when_stuck',
		})
		expect(result.status).toBe('solved')
		if (result.status === 'solved') {
			// First action must be a match while pairs exist.
			expect(result.path[0]?.type).toBe('match')
		}
	})

	it('anytime may still solve the same board', () => {
		const board = boardFromFixture('5 5', 2)
		const result = solveBoard(board, {
			maxAppends: 1,
			appendPolicy: 'anytime',
		})
		expect(result.status).toBe('solved')
	})
})

describe('immutability and helpers', () => {
	it('does not mutate the initial board object graph', () => {
		const board = createBoard([1, 9, 2, 8] as CellValue[], 4)
		const before = cloneBoard(board)
		solveBoard(board, { maxAppends: 1 })
		expect(board).toEqual(before)
	})

	it('firstSolutionMove returns the first path action', () => {
		const board = boardFromFixture('1 9', 2)
		const move = firstSolutionMove(board)
		expect(move).toEqual({ type: 'match', aIndex: 0, bIndex: 1 })
	})

	it('max_depth cutoff is not reported as unsolvable', () => {
		const board = boardFromFixture('1 2 3', 3)
		const result = solveBoard(board, {
			maxAppends: 2,
			maxDepth: 0,
			maxStates: 10_000,
		})
		// depth 0 means any child exceeds maxDepth
		expect(result.status).toBe('cutoff')
		if (result.status === 'cutoff') {
			expect(result.reason).toBe('max_depth')
		}
	})
})

describe('path typing', () => {
	it('solved paths only contain match/append actions', () => {
		const board = boardFromFixture('1 2 3', 3)
		const result = solveBoard(board, { maxAppends: 1 })
		expect(result.status).toBe('solved')
		if (result.status !== 'solved') return
		for (const action of result.path) {
			const typed: SolverAction = action
			expect(typed.type === 'match' || typed.type === 'append').toBe(true)
		}
	})
})
