/**
 * Helpers that map campaign catalog entries ↔ gameplay session identity.
 */

import {
	CAMPAIGN_LEVEL_COUNT,
	resolveCampaignLevel,
} from '../game/campaign'
import {
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
} from '../game/generator'
import {
	hydrateGameSession,
	type GameSessionState,
	type SessionPuzzleIdentity,
} from '../game/session'
import {
	sessionBoards,
	type PersistedActiveSession,
	type PersistedSessionPurpose,
} from '../storage'

export type CampaignStartResult =
	| {
			readonly ok: true
			readonly level: number
			readonly purpose: PersistedSessionPurpose
			readonly identity: SessionPuzzleIdentity
			readonly board: GameSessionState['board']
			readonly entry: {
				readonly seed: number
				readonly profile: PersistedActiveSession['profile']
				readonly fingerprint: string
				readonly density: PersistedActiveSession['density']
			}
	  }
	| { readonly ok: false; readonly reason: string }

/** Build SessionPuzzleIdentity for a campaign level. */
export function campaignIdentity(
	level: number,
	entry: {
		readonly seed: number
		readonly profile: PersistedActiveSession['profile']
		readonly fingerprint: string
	},
): SessionPuzzleIdentity {
	return {
		generationVersion: GENERATION_VERSION,
		difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION,
		seed: entry.seed,
		profile: entry.profile,
		fingerprint: entry.fingerprint,
		label: `level-${level}`,
	}
}

/** Resolve catalog level into a fresh playable board + identity. */
export function prepareCampaignLevel(
	level: number,
	purpose: PersistedSessionPurpose,
): CampaignStartResult {
	if (!Number.isInteger(level) || level < 1 || level > CAMPAIGN_LEVEL_COUNT) {
		return { ok: false, reason: `invalid_level_${level}` }
	}
	const resolved = resolveCampaignLevel(level)
	if (resolved.status !== 'ok') {
		return { ok: false, reason: resolved.reason }
	}
	return {
		ok: true,
		level,
		purpose,
		identity: campaignIdentity(level, resolved.entry),
		board: resolved.board,
		entry: {
			seed: resolved.entry.seed,
			profile: resolved.entry.profile,
			fingerprint: resolved.fingerprint,
			density: resolved.entry.density,
		},
	}
}

/**
 * Rebuild a GameSessionState from a persisted active session.
 * Prefer stored initialBoard; otherwise regenerate from catalog.
 */
export function gameSessionFromPersisted(
	session: PersistedActiveSession,
): GameSessionState | null {
	const boards = sessionBoards(session)
	let initialBoard = boards.initialBoard
	if (!initialBoard) {
		const resolved = resolveCampaignLevel(session.level)
		if (resolved.status !== 'ok') {
			return null
		}
		initialBoard = resolved.board
	}
	return hydrateGameSession({
		identity: campaignIdentity(session.level, session),
		board: boards.board,
		initialBoard,
		history: boards.history,
		counters: session.counters,
		completed: session.status === 'completed',
		usedHint: session.usedHint,
		usedUndo: session.usedUndo,
	})
}

/** Next frontier level after highestCompleted (capped at 1000). */
export function frontierLevel(highestCompletedLevel: number): number {
	if (highestCompletedLevel >= CAMPAIGN_LEVEL_COUNT) {
		return CAMPAIGN_LEVEL_COUNT
	}
	return highestCompletedLevel + 1
}

/** True when level is unlocked for play / replay. */
export function isLevelUnlocked(
	level: number,
	highestCompletedLevel: number,
): boolean {
	if (level < 1 || level > CAMPAIGN_LEVEL_COUNT) {
		return false
	}
	return level <= highestCompletedLevel + 1
}
