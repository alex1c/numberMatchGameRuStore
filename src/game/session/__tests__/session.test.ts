/**
 * Game session reducer tests — UI/session logic without RN rendering.
 */

import {
	boardFromFixture,
	cloneBoard,
	toCanonicalBoard,
} from '../../core'
import {
	buildCompletionBoard,
	buildInvalidSelectionBoard,
	buildPartialRowBoard,
	createGameSession,
	loadPlaytestFixture,
	reduceGameSession,
	HISTORY_BOUND,
	type SessionPuzzleIdentity,
} from '../index'

function identity(
	overrides: Partial<SessionPuzzleIdentity> = {},
): SessionPuzzleIdentity {
	return {
		generationVersion: 1,
		difficultyProfileVersion: 1,
		seed: 1,
		profile: 'CUSTOM',
		fingerprint: 'f-test',
		label: 'test',
		...overrides,
	}
}

describe('game session reducer', () => {
	it('selects first cell and deselects same cell', () => {
		const board = boardFromFixture('1 2 9')
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		expect(state.selectedIndex).toBe(0)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		expect(state.selectedIndex).toBeNull()
	})

	it('invalid second tap does not remove; second becomes selection', () => {
		const board = buildInvalidSelectionBoard()
		const initialCanonical = toCanonicalBoard(board)
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		expect(toCanonicalBoard(state.board)).toBe(initialCanonical)
		expect(state.selectedIndex).toBe(1)
		expect(state.invalidIndices).toEqual([0, 1])
		expect(state.history).toHaveLength(0)
		expect(state.counters.matchesRemoved).toBe(0)
	})

	it('valid second tap removes pair and completes 1 9', () => {
		const board = buildCompletionBoard()
		let state = createGameSession(identity(), board)
		const frozenInitial = cloneBoard(state.initialBoard)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		expect(state.completed).toBe(true)
		expect(state.board.cells.every((c) => c.removed)).toBe(true)
		expect(state.counters.matchesRemoved).toBe(1)
		expect(toCanonicalBoard(state.initialBoard)).toBe(
			toCanonicalBoard(frozenInitial),
		)
	})

	it('ignores removed cell taps', () => {
		const board = boardFromFixture('1 9 2 8')
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		expect(state.board.cells[0]?.removed).toBe(true)
		const before = state.counters.matchesRemoved
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		expect(state.selectedIndex).toBeNull()
		expect(state.counters.matchesRemoved).toBe(before)
		expect(state.history).toHaveLength(1)
	})

	it('append enabled only when stuck; undo restores exact board', () => {
		// Two equal numbers separated by active blocker — no clear path; then append.
		const board = boardFromFixture('1 3 1')
		let state = createGameSession(identity(), board)
		expect(state.hasAvailableMoves).toBe(false)
		const before = cloneBoard(state.board)
		const beforeSeq = state.board.nextCellSeq
		state = reduceGameSession(state, { type: 'APPEND' })
		expect(state.board.cells.length).toBeGreaterThan(before.cells.length)
		expect(state.counters.appendActions).toBe(1)
		expect(state.board.nextCellSeq).toBeGreaterThan(beforeSeq)
		state = reduceGameSession(state, { type: 'UNDO' })
		expect(toCanonicalBoard(state.board)).toBe(toCanonicalBoard(before))
		expect(state.board.nextCellSeq).toBe(beforeSeq)
		expect(state.board.cells.map((c) => c.id)).toEqual(
			before.cells.map((c) => c.id),
		)
		expect(state.selectedIndex).toBeNull()
		expect(state.counters.undoActions).toBe(1)
	})

	it('append disabled when legal moves exist', () => {
		const board = boardFromFixture('1 9')
		let state = createGameSession(identity(), board)
		expect(state.hasAvailableMoves).toBe(true)
		const before = toCanonicalBoard(state.board)
		state = reduceGameSession(state, { type: 'APPEND' })
		expect(toCanonicalBoard(state.board)).toBe(before)
		expect(state.counters.appendActions).toBe(0)
	})

	it('undo after match restores board; rematch works', () => {
		const board = boardFromFixture('1 9 2 8')
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		expect(state.board.cells[0]?.removed).toBe(true)
		state = reduceGameSession(state, { type: 'UNDO' })
		expect(state.board.cells[0]?.removed).toBe(false)
		expect(state.board.cells[1]?.removed).toBe(false)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		expect(state.board.cells[0]?.removed).toBe(true)
	})

	it('restart restores identity and initial board', () => {
		const board = boardFromFixture('1 9 5 5')
		let state = createGameSession(
			identity({ fingerprint: 'fp-restart', seed: 42, label: 'R' }),
			board,
		)
		const fp = state.identity.fingerprint
		const initialCanon = toCanonicalBoard(state.initialBoard)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		state = reduceGameSession(state, { type: 'RESTART' })
		expect(state.identity.fingerprint).toBe(fp)
		expect(toCanonicalBoard(state.board)).toBe(initialCanon)
		expect(state.history).toHaveLength(0)
		expect(state.selectedIndex).toBeNull()
		expect(state.counters.matchesRemoved).toBe(0)
		expect(state.completed).toBe(false)
	})

	it('completion + undo clears completion', () => {
		const board = buildCompletionBoard()
		let state = createGameSession(identity(), board)
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		expect(state.completed).toBe(true)
		state = reduceGameSession(state, { type: 'UNDO' })
		expect(state.completed).toBe(false)
		expect(state.board.cells.some((c) => !c.removed)).toBe(true)
	})

	it('cleared board session starts completed; append no-op', () => {
		const board = boardFromFixture('. .')
		let state = createGameSession(identity(), board)
		expect(state.completed).toBe(true)
		state = reduceGameSession(state, { type: 'APPEND' })
		expect(state.counters.appendActions).toBe(0)
	})

	it('partial row fixture preserves width and length', () => {
		const board = buildPartialRowBoard()
		expect(board.width).toBe(7)
		expect(board.cells.length).toBe(17)
		const state = createGameSession(identity({ label: 'partial' }), board)
		expect(state.board.cells.length).toBe(17)
	})

	it('history bound does not grow unbounded', () => {
		const board = boardFromFixture('1 3 1')
		let state = createGameSession(identity(), board)
		for (let i = 0; i < HISTORY_BOUND + 10; i += 1) {
			if (!state.hasAvailableMoves) {
				state = reduceGameSession(state, { type: 'APPEND' })
			} else {
				break
			}
		}
		expect(state.history.length).toBeLessThanOrEqual(HISTORY_BOUND)
	})
})

describe('loadPlaytestFixture', () => {
	it('loads EASY typical generated puzzle', () => {
		const loaded = loadPlaytestFixture({
			id: 'easy-typical',
			label: 'EASY',
			note: 'test',
			kind: 'generated',
			profile: 'EASY',
			seed: 10000,
		})
		expect(loaded.ok).toBe(true)
		if (loaded.ok) {
			expect(loaded.identity.profile).toBe('EASY')
			expect(loaded.identity.seed).toBe(10000)
			expect(loaded.identity.generationVersion).toBe(1)
			expect(loaded.board.cells.length).toBeGreaterThan(0)
		}
	}, 30_000)

	it('loads hand completion board', () => {
		const loaded = loadPlaytestFixture({
			id: 'completion-tiny',
			label: 'completion',
			note: 'hand',
			kind: 'hand',
			profile: 'CUSTOM',
			seed: 0,
			buildBoard: buildCompletionBoard,
		})
		expect(loaded.ok).toBe(true)
		if (loaded.ok) {
			expect(loaded.board.cells).toHaveLength(2)
		}
	})
})
