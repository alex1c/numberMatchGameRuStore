/**
 * Hint request helpers + append-pulse transition rules.
 */

import { boardFromFixture, createBoard, type CellValue } from '../../core'
import {
	APPEND_PULSE_REPETITIONS,
	createGameSession,
	hintOutcomeFromSolveResult,
	immediateHintIfStuck,
	reduceGameSession,
	scheduleAfterPaint,
	shouldStartAppendPulse,
} from '../index'
import type { SessionPuzzleIdentity } from '../types'

function identity(
	overrides: Partial<SessionPuzzleIdentity> = {},
): SessionPuzzleIdentity {
	return {
		generationVersion: 3,
		difficultyProfileVersion: 2,
		seed: 1,
		profile: 'EASY',
		fingerprint: 'f-test',
		label: 'test',
		...overrides,
	}
}

describe('immediateHintIfStuck', () => {
	it('returns append guidance without needing solver when stuck', () => {
		// Board with no legal matches (1 alone at end of row geometry).
		const board = boardFromFixture('1 2 3')
		// Force all pairs impossible by using values that cannot match under width 3
		// when only one active cell remains.
		const single = createBoard([1] as CellValue[], 3)
		const outcome = immediateHintIfStuck(single, false)
		expect(outcome).not.toBeNull()
		expect(outcome?.kind).toBe('append')
		expect(outcome?.skippedSolver).toBe(true)
		expect(outcome?.delivered).toBe(true)
		void board
	})

	it('returns null when legal moves exist', () => {
		const board = boardFromFixture('1 9')
		expect(immediateHintIfStuck(board, false)).toBeNull()
	})
})

describe('hintOutcomeFromSolveResult', () => {
	const emptyStats = {
		exploredStates: 1,
		generatedTransitions: 0,
		cacheHits: 0,
		maxDepthReached: 1,
		appendActionsConsidered: 0,
		solutionDepth: 1 as number | null,
		elapsedMs: 1,
	}

	it('maps match path to delivered match hint', () => {
		const outcome = hintOutcomeFromSolveResult({
			status: 'solved',
			path: [{ type: 'match', aIndex: 0, bIndex: 1 }],
			stats: emptyStats,
		})
		expect(outcome.kind).toBe('match')
		expect(outcome.delivered).toBe(true)
		expect(outcome.indices).toEqual([0, 1])
	})

	it('maps cutoff to unavailable (not delivered)', () => {
		const outcome = hintOutcomeFromSolveResult({
			status: 'cutoff',
			reason: 'max_states',
			stats: { ...emptyStats, solutionDepth: null, exploredStates: 100 },
		})
		expect(outcome.kind).toBe('unavailable')
		expect(outcome.delivered).toBe(false)
	})
})

describe('APPLY_HINT star semantics', () => {
	it('sets usedHint only for delivered match/append', () => {
		const board = boardFromFixture('1 9 2 8')
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'unavailable',
			message: 'x',
		})
		expect(state.usedHint).toBe(false)
		expect(state.hintBusy).toBe(false)

		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'match',
			indices: [0, 1],
			message: 'ok',
		})
		expect(state.usedHint).toBe(true)
	})

	it('SET_HINT_BUSY alone does not set usedHint', () => {
		const board = boardFromFixture('1 9')
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, { type: 'SET_HINT_BUSY', busy: true })
		expect(state.hintBusy).toBe(true)
		expect(state.usedHint).toBe(false)
	})
})

describe('append pulse transition', () => {
	it('starts only on false→true transition', () => {
		expect(shouldStartAppendPulse(false, true)).toBe(true)
		expect(shouldStartAppendPulse(true, true)).toBe(false)
		expect(shouldStartAppendPulse(false, false)).toBe(false)
		expect(shouldStartAppendPulse(true, false)).toBe(false)
	})

	it('uses a finite repetition count', () => {
		expect(APPEND_PULSE_REPETITIONS).toBe(3)
	})
})

describe('scheduleAfterPaint', () => {
	it('invokes callback after paint yield', async () => {
		jest.useFakeTimers()
		const spy = jest.fn()
		scheduleAfterPaint(spy)
		expect(spy).not.toHaveBeenCalled()
		jest.runAllTimers()
		expect(spy).toHaveBeenCalledTimes(1)
		jest.useRealTimers()
	})

	it('cancel prevents callback', () => {
		jest.useFakeTimers()
		const spy = jest.fn()
		const handle = scheduleAfterPaint(spy)
		handle.cancel()
		jest.runAllTimers()
		expect(spy).not.toHaveBeenCalled()
		jest.useRealTimers()
	})
})
