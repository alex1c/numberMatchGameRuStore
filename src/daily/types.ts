/**
 * Daily persistence shapes (UI / storage layer consumes these later).
 */

import type { CampaignDensity, DifficultyProfile } from '../game/generator'
import type { StarCount } from '../game/stars'
import type {
	PersistedBoardV1,
	PersistedCountersV1,
} from '../storage/types'
import type { LocalDateKey } from './date'
import { DAILY_VERSION } from './config'

/** Soft cap on stored completion rows (~13 months of daily play). */
export const DAILY_HISTORY_BOUND = 400 as const

/** Compact per-day result — stars + completion flag only. */
export interface DailyHistoryEntry {
	readonly dateKey: LocalDateKey
	readonly bestStars: StarCount
	readonly completed: boolean
}

/**
 * In-progress daily session for the current local calendar day only.
 * Mirrors campaign help / board fields without campaign level metadata.
 */
export interface PersistedDailyActiveSession {
	readonly mode: 'daily'
	readonly dateKey: LocalDateKey
	readonly generationVersion: number
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly fingerprint: string
	readonly density: CampaignDensity
	readonly board: PersistedBoardV1
	readonly initialBoard?: PersistedBoardV1
	readonly history: readonly PersistedBoardV1[]
	readonly counters: PersistedCountersV1
	readonly nextCellSeq: number
	readonly usedHint: boolean
	readonly usedUndo: boolean
	readonly freeHintConsumed: boolean
	readonly freeUndoConsumed: boolean
}

export interface PersistedDailyState {
	readonly dailyVersion: typeof DAILY_VERSION
	readonly history: readonly DailyHistoryEntry[]
	readonly currentStreak: number
	readonly bestStreak: number
	readonly lastCompletedDateKey: LocalDateKey | null
	/** Unfinished board for today — discard when dateKey ≠ today. */
	readonly activeDaily: PersistedDailyActiveSession | null
}

export function createEmptyDailyState(): PersistedDailyState {
	return {
		dailyVersion: DAILY_VERSION,
		history: [],
		currentStreak: 0,
		bestStreak: 0,
		lastCompletedDateKey: null,
		activeDaily: null,
	}
}
