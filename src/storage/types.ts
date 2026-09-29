/**
 * Persistence schema types — versioned root blob under a stable storage key.
 */

import type { BoardState, CellValue } from '../game/core'
import type { DifficultyProfile } from '../game/generator'

/** Stable AsyncStorage key — schema evolves inside the blob, not the key. */
export const STORAGE_KEY = 'numbermatch.persist.v1' as const

/** Soft undo / history bound mirrored from gameplay session. */
export const PERSIST_HISTORY_BOUND = 64 as const

export type PersistedSessionPurpose = 'progression' | 'replay'
export type PersistedSessionStatus = 'in_progress' | 'completed'

/** JSON-friendly board cell (ids preserved across restore). */
export interface PersistedCellV1 {
	readonly id: string
	readonly value: CellValue
	readonly removed: boolean
}

/** JSON-friendly board snapshot. */
export interface PersistedBoardV1 {
	readonly width: number
	readonly nextCellSeq: number
	readonly cells: readonly PersistedCellV1[]
}

export interface PersistedCountersV1 {
	readonly matchesRemoved: number
	readonly appendActions: number
	readonly undoActions: number
}

/**
 * Active campaign session snapshot.
 * initialBoard is optional — when omitted, restore regenerates from catalog.
 */
export interface PersistedActiveSession {
	readonly mode: 'campaign'
	readonly purpose: PersistedSessionPurpose
	readonly status: PersistedSessionStatus
	readonly level: number
	readonly generationVersion: number
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly fingerprint: string
	readonly board: PersistedBoardV1
	readonly initialBoard?: PersistedBoardV1
	readonly history: readonly PersistedBoardV1[]
	readonly counters: PersistedCountersV1
	/** Echo of board.nextCellSeq for quick validation. */
	readonly nextCellSeq: number
}

/** Current on-disk root document. */
export interface PersistedRootV1 {
	readonly schemaVersion: 1
	readonly campaignVersion: 1
	readonly revision: number
	readonly trainingCompleted: boolean
	/** Frontier: 0 means nothing cleared; 1000 means campaign finished. */
	readonly highestCompletedLevel: number
	readonly activeSession: PersistedActiveSession | null
}

export type PersistedRoot = PersistedRootV1

/** Low-level key/value adapter (AsyncStorage or in-memory for tests). */
export interface StorageAdapter {
	getItem(key: string): Promise<string | null>
	setItem(key: string, value: string): Promise<void>
	removeItem(key: string): Promise<void>
}

/** @deprecated Prefer STORAGE_KEY — kept for older stubs / docs. */
export const STORAGE_KEYS = {
	persist: STORAGE_KEY,
	activeSession: 'numbermatch.activeSession.v1',
	settings: 'numbermatch.settings.v1',
} as const

/** Legacy Phase 0/1 envelope — no longer the primary save shape. */
export interface PersistedGameEnvelopeV1 {
	readonly schemaVersion: 1
	readonly puzzleIdentity: string
	readonly board: BoardState
	readonly savedAt: string
}

export interface GamePersistencePort {
	loadActiveSession(): Promise<PersistedGameEnvelopeV1 | null>
	saveActiveSession(envelope: PersistedGameEnvelopeV1): Promise<void>
	clearActiveSession(): Promise<void>
}
