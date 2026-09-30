/**
 * Persistence schema types — versioned root blob under a stable storage key.
 *
 * schemaVersion 2 = Campaign v2 + mastery stars + attempt help flags.
 * Storage key stays `numbermatch.persist.v1` (schema lives inside the blob).
 */

import type { BoardState, CellValue } from '../game/core'
import type { CampaignDensity, DifficultyProfile } from '../game/generator'
import type { StarCount } from '../game/stars'

/** Stable AsyncStorage key — schema evolves inside the blob, not the key. */
export const STORAGE_KEY = 'numbermatch.persist.v1' as const

/** Soft undo / history bound mirrored from gameplay session. */
export const PERSIST_HISTORY_BOUND = 64 as const

/** Current on-disk schema. */
export const PERSIST_SCHEMA_VERSION = 2 as const

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
	/** gv3 density (rows at width 8). Required for Campaign v2 sessions. */
	readonly density: CampaignDensity
	readonly board: PersistedBoardV1
	readonly initialBoard?: PersistedBoardV1
	readonly history: readonly PersistedBoardV1[]
	readonly counters: PersistedCountersV1
	/** Echo of board.nextCellSeq for quick validation. */
	readonly nextCellSeq: number
	/** Attempt help flags — cold restore must preserve for star scoring. */
	readonly usedHint: boolean
	readonly usedUndo: boolean
}

/**
 * Historical schema v1 root (Campaign v1) — migration input only.
 * Not used at runtime after migrateToCurrent.
 */
export interface PersistedRootV1 {
	readonly schemaVersion: 1
	readonly campaignVersion: 1
	readonly revision: number
	readonly trainingCompleted: boolean
	readonly highestCompletedLevel: number
	readonly activeSession: unknown
}

/**
 * Current on-disk root document (Campaign v2 + stars).
 */
export interface PersistedRootV2 {
	readonly schemaVersion: 2
	readonly campaignVersion: 2
	readonly revision: number
	readonly trainingCompleted: boolean
	/** Frontier: 0 means nothing cleared; 1000 means campaign finished. */
	readonly highestCompletedLevel: number
	/**
	 * Best stars per level — length 1000, index 0 = Level 1, values 0..3.
	 * Invariant: levels 1..highestCompletedLevel each have ≥ 1 star.
	 */
	readonly bestStars: readonly StarCount[]
	readonly activeSession: PersistedActiveSession | null
}

export type PersistedRoot = PersistedRootV2

/** @deprecated Alias kept for gradual rename — same as PersistedRootV2. */
export type PersistedRootV1Compat = PersistedRootV2

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
