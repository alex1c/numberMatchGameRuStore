/**
 * Persistence boundary — interface only for Phase 0/1.
 * Full game save/restore arrives in a later phase.
 *
 * Puzzle identity must NOT be built from mutable fields like updatedAt,
 * autosave counters, move counts, or board hashes that change every move.
 * Future identity shape (conceptually): mode + level/seed/date + generationVersion.
 */

import type { BoardState } from '../game/core'

/** Versioned envelope for a future saved session blob. */
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

/** Storage key namespace — concrete AsyncStorage wiring is deferred. */
export const STORAGE_KEYS = {
	activeSession: 'numbermatch.activeSession.v1',
	settings: 'numbermatch.settings.v1',
} as const
