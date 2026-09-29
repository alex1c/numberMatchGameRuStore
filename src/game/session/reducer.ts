/**
 * Pure GameSession reducer — testable without React Native.
 *
 * Selection UX: invalid second tap → second cell becomes new selection.
 * History: pushed only for successful match / append.
 * Core decides match legality; reducer never invents geometry.
 */

import {
	appendRemainingNumbers,
	canMatch,
	cloneBoard,
	hasAvailableMoves,
	isBoardCleared,
	removePair,
	type BoardState,
} from '../core'
import {
	HISTORY_BOUND,
	type GameSessionAction,
	type GameSessionState,
	type SessionPuzzleIdentity,
	type SessionCounters,
} from './types'

const EMPTY_COUNTERS: SessionCounters = {
	matchesRemoved: 0,
	appendActions: 0,
	undoActions: 0,
}

function pushHistory(
	history: readonly BoardState[],
	board: BoardState,
): BoardState[] {
	const next = [...history, cloneBoard(board)]
	if (next.length > HISTORY_BOUND) {
		return next.slice(next.length - HISTORY_BOUND)
	}
	return next
}

export function createGameSession(
	identity: SessionPuzzleIdentity,
	initialBoard: BoardState,
): GameSessionState {
	const board = cloneBoard(initialBoard)
	return {
		identity,
		initialBoard: cloneBoard(initialBoard),
		board,
		selectedIndex: null,
		invalidIndices: [],
		hintIndices: [],
		history: [],
		counters: EMPTY_COUNTERS,
		completed: isBoardCleared(board),
		hasAvailableMoves: hasAvailableMoves(board),
		interactionLocked: false,
		statusMessage: null,
		hintBusy: false,
	}
}

/**
 * Restore a full gameplay session from persistence (board + history + counters).
 * Used on cold start when an in-progress / completed campaign session exists.
 */
export function hydrateGameSession(input: {
	readonly identity: SessionPuzzleIdentity
	readonly board: BoardState
	readonly initialBoard: BoardState
	readonly history?: readonly BoardState[]
	readonly counters?: SessionCounters
	readonly completed?: boolean
}): GameSessionState {
	const board = cloneBoard(input.board)
	const completed = input.completed ?? isBoardCleared(board)
	return {
		identity: input.identity,
		initialBoard: cloneBoard(input.initialBoard),
		board,
		selectedIndex: null,
		invalidIndices: [],
		hintIndices: [],
		history: (input.history ?? []).map(cloneBoard),
		counters: input.counters ?? EMPTY_COUNTERS,
		completed,
		hasAvailableMoves: hasAvailableMoves(board),
		interactionLocked: false,
		statusMessage: completed ? 'cleared' : null,
		hintBusy: false,
	}
}

export function reduceGameSession(
	state: GameSessionState,
	action: GameSessionAction,
): GameSessionState {
	switch (action.type) {
		case 'SET_LOCK':
			return { ...state, interactionLocked: action.locked }

		case 'CLEAR_FEEDBACK':
			return {
				...state,
				invalidIndices: [],
				statusMessage: state.completed ? state.statusMessage : null,
			}

		case 'CLEAR_HINT':
			return { ...state, hintIndices: [], hintBusy: false }

		case 'SET_HINT_BUSY':
			return { ...state, hintBusy: action.busy }

		case 'APPLY_HINT': {
			if (action.kind === 'match' && action.indices) {
				return {
					...state,
					hintBusy: false,
					hintIndices: action.indices,
					statusMessage: action.message,
					selectedIndex: null,
				}
			}
			return {
				...state,
				hintBusy: false,
				hintIndices: [],
				statusMessage: action.message,
			}
		}

		case 'SELECT_CELL': {
			if (state.interactionLocked || state.completed) {
				return state
			}
			const cell = state.board.cells[action.index]
			if (!cell || cell.removed) {
				return state
			}

			// Deselect same cell.
			if (state.selectedIndex === action.index) {
				return {
					...state,
					selectedIndex: null,
					invalidIndices: [],
					hintIndices: [],
					statusMessage: null,
				}
			}

			// First selection.
			if (state.selectedIndex === null) {
				return {
					...state,
					selectedIndex: action.index,
					invalidIndices: [],
					hintIndices: [],
					statusMessage: null,
				}
			}

			const first = state.selectedIndex
			const second = action.index

			if (!canMatch(state.board, first, second)) {
				// Invalid: board unchanged; second cell becomes new selection.
				return {
					...state,
					selectedIndex: second,
					invalidIndices: [first, second],
					hintIndices: [],
					statusMessage: null,
				}
			}

			const removed = removePair(state.board, first, second)
			if (!removed.ok) {
				return {
					...state,
					selectedIndex: second,
					invalidIndices: [first, second],
				}
			}

			const nextBoard = removed.state
			const completed = isBoardCleared(nextBoard)
			return {
				...state,
				board: nextBoard,
				selectedIndex: null,
				invalidIndices: [],
				hintIndices: [],
				history: pushHistory(state.history, state.board),
				counters: {
					...state.counters,
					matchesRemoved: state.counters.matchesRemoved + 1,
				},
				completed,
				hasAvailableMoves: hasAvailableMoves(nextBoard),
				statusMessage: completed ? 'cleared' : null,
			}
		}

		case 'APPEND': {
			if (state.interactionLocked || state.completed) {
				return state
			}
			if (state.hasAvailableMoves) {
				return state
			}
			const nextBoard = appendRemainingNumbers(state.board)
			if (nextBoard === state.board) {
				return state
			}
			return {
				...state,
				board: nextBoard,
				selectedIndex: null,
				invalidIndices: [],
				hintIndices: [],
				history: pushHistory(state.history, state.board),
				counters: {
					...state.counters,
					appendActions: state.counters.appendActions + 1,
				},
				completed: false,
				hasAvailableMoves: hasAvailableMoves(nextBoard),
				statusMessage: null,
			}
		}

		case 'UNDO': {
			if (state.history.length === 0) {
				return state
			}
			const previous = state.history[state.history.length - 1]!
			const history = state.history.slice(0, -1)
			const board = cloneBoard(previous)
			return {
				...state,
				board,
				selectedIndex: null,
				invalidIndices: [],
				hintIndices: [],
				history,
				counters: {
					...state.counters,
					undoActions: state.counters.undoActions + 1,
				},
				completed: isBoardCleared(board),
				hasAvailableMoves: hasAvailableMoves(board),
				statusMessage: null,
				hintBusy: false,
			}
		}

		case 'RESTART': {
			const board = cloneBoard(state.initialBoard)
			return {
				...state,
				board,
				selectedIndex: null,
				invalidIndices: [],
				hintIndices: [],
				history: [],
				counters: EMPTY_COUNTERS,
				completed: isBoardCleared(board),
				hasAvailableMoves: hasAvailableMoves(board),
				statusMessage: null,
				hintBusy: false,
				interactionLocked: false,
			}
		}

		default: {
			const _exhaustive: never = action
			return _exhaustive
		}
	}
}
