/**
 * Persistence schema types — versioned root blob under a stable storage key.
 *
 * schemaVersion 3 = Campaign v2 fields + daily + statistics + achievements notify + settings.
 * schemaVersion 2 = migration input only (Campaign v2 + mastery stars).
 * Storage key stays `numbermatch.persist.v1` (schema lives inside the blob).
 */

import type { BoardState, CellValue } from '../game/core'
import type { CampaignDensity, DifficultyProfile } from '../game/generator'
import type { StarCount } from '../game/stars'
import type { PersistedDailyState } from '../daily/types'

/** Stable AsyncStorage key — schema evolves inside the blob, not the key. */
export const STORAGE_KEY = 'numbermatch.persist.v1' as const

/** Soft undo / history bound mirrored from gameplay session. */
export const PERSIST_HISTORY_BOUND = 64 as const

/** Current on-disk schema. */
export const PERSIST_SCHEMA_VERSION = 3 as const

export type ThemePreference = 'system' | 'light' | 'dark'

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

/** Lifetime gameplay counters (all modes). */
export interface PersistedStatistics {
	readonly pairsRemoved: number
	readonly appendActions: number
	readonly hintsDelivered: number
	readonly undoActions: number
}

export interface PersistedSettings {
	readonly themePreference: ThemePreference
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
	/** Mastery/star attempt flags — cold restore must preserve. */
	readonly usedHint: boolean
	readonly usedUndo: boolean
	/**
	 * Monetization free-help entitlement for this attempt.
	 * Independent of usedHint/usedUndo (stars). Schema v2 extended in place:
	 * missing fields default from usedHint/usedUndo for pre-split saves.
	 */
	readonly freeHintConsumed: boolean
	readonly freeUndoConsumed: boolean
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
 * Schema v2 root (Campaign v2 + stars) — migration input only.
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

/**
 * Current on-disk root document (schema v3).
 */
export interface PersistedRootV3 {
	readonly schemaVersion: 3
	readonly campaignVersion: 2
	readonly revision: number
	readonly trainingCompleted: boolean
	readonly highestCompletedLevel: number
	readonly bestStars: readonly StarCount[]
	readonly activeSession: PersistedActiveSession | null
	readonly daily: PersistedDailyState
	readonly statistics: PersistedStatistics
	/** Achievement ids whose unlock toast was already shown. */
	readonly achievementNotifiedIds: readonly string[]
	readonly settings: PersistedSettings
}

export type PersistedRoot = PersistedRootV3

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
