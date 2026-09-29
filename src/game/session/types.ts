/**
 * Pure gameplay session types — UI interaction with one puzzle.
 * Board mathematics stay in core; search in solver; creation in generator.
 */

import type { BoardState } from '../core'
import type { DifficultyProfile } from '../generator'

/**
 * Stable playtest puzzle identity for session / UI.
 * Distinct from generator PuzzleIdentity (which also carries canonical).
 */
export interface SessionPuzzleIdentity {
	readonly generationVersion: number
	readonly difficultyProfileVersion: number
	readonly seed: number
	readonly profile: DifficultyProfile | 'CUSTOM'
	readonly fingerprint: string
	readonly label: string
}

export interface SessionCounters {
	readonly matchesRemoved: number
	readonly appendActions: number
	readonly undoActions: number
}

export interface GameSessionState {
	readonly identity: SessionPuzzleIdentity
	/** Immutable original puzzle — never mutated by play. */
	readonly initialBoard: BoardState
	readonly board: BoardState
	/** Selected cell linear index, or null. */
	readonly selectedIndex: number | null
	/** Indices briefly marked invalid (UI feedback only). */
	readonly invalidIndices: readonly number[]
	/** Indices briefly marked as hint targets. */
	readonly hintIndices: readonly number[]
	readonly history: readonly BoardState[]
	readonly counters: SessionCounters
	readonly completed: boolean
	readonly hasAvailableMoves: boolean
	readonly interactionLocked: boolean
	readonly statusMessage: string | null
	readonly hintBusy: boolean
	/**
	 * Campaign policy (§241): when false, UI must hide Undo after completion.
	 * DEV fixtures omit this (Undo remains available via overlay).
	 */
	readonly undoAfterCompletion?: boolean
}

export type GameSessionAction =
	| { readonly type: 'SELECT_CELL'; readonly index: number }
	| { readonly type: 'CLEAR_FEEDBACK' }
	| { readonly type: 'APPEND' }
	| { readonly type: 'UNDO' }
	| { readonly type: 'RESTART' }
	| { readonly type: 'SET_HINT_BUSY'; readonly busy: boolean }
	| {
			readonly type: 'APPLY_HINT'
			readonly kind: 'match' | 'append' | 'unavailable'
			readonly indices?: readonly number[]
			readonly message: string
	  }
	| { readonly type: 'CLEAR_HINT' }
	| { readonly type: 'SET_LOCK'; readonly locked: boolean }

/** Soft history bound for playtest (puzzles are small). */
export const HISTORY_BOUND = 64
