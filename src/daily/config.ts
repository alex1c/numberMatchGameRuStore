/**
 * Daily puzzle schedule — profile, density, and deterministic seeds per local date.
 */

import {
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
	normalizeSeed,
	type CampaignDensity,
	type DifficultyProfile,
} from '../game/generator'
import { dateFromLocalDateKey, type LocalDateKey } from './date'

/** Bump when daily spec / rhythm rules change (invalidates old daily saves). */
export const DAILY_VERSION = 1 as const

export { GENERATION_VERSION, DIFFICULTY_PROFILE_VERSION }

export interface DailySpec {
	readonly profile: DifficultyProfile
	readonly density: CampaignDensity
	readonly seed: number
}

/** Per-attempt candidate budget inside generatePuzzle for one seed offset. */
export const DAILY_MAX_CANDIDATE_ATTEMPTS = 100 as const

/** Extra deterministic seed offsets (seed + attempt) when the base seed exhausts. */
export const DAILY_MAX_SEED_OFFSET_ATTEMPTS = 32 as const

/**
 * Weekly rhythm indexed by local weekday (Date#getDay: 0 = Sunday … 6 = Saturday).
 *
 * Design goals:
 * - Mostly MEDIUM / HARD with densities 7–9 (Mon–Fri core).
 * - One EASY day (Sunday) at density 7 for a lighter finish to the week.
 * - One EXPERT day (Saturday) at density 10 for a weekend spike.
 *
 * | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
 * | EASY 7 | MED 8 | HARD 8 | HARD 9 | MED 7 | HARD 9 | EXP 10 |
 */
const WEEKDAY_RHYTHM: readonly {
	readonly profile: DifficultyProfile
	readonly density: CampaignDensity
}[] = [
	{ profile: 'EASY', density: 7 },
	{ profile: 'MEDIUM', density: 8 },
	{ profile: 'HARD', density: 8 },
	{ profile: 'HARD', density: 9 },
	{ profile: 'MEDIUM', density: 7 },
	{ profile: 'HARD', density: 9 },
	{ profile: 'EXPERT', density: 10 },
] as const

/** FNV-1a 32-bit hash — stable across Node / Jest / RN. */
function hashStringToUint32(text: string): number {
	let h = 2_166_136_261 >>> 0
	for (let i = 0; i < text.length; i += 1) {
		h ^= text.charCodeAt(i)
		h = Math.imul(h, 16_777_619) >>> 0
	}
	return h >>> 0
}

/**
 * Deterministic uint32 seed for a calendar day.
 * Derived from `numbermatch-daily-v${DAILY_VERSION}-${dateKey}` — no Math.random.
 */
export function createDailySeedNumber(dateKey: LocalDateKey): number {
	const slug = `numbermatch-daily-v${DAILY_VERSION}-${dateKey}`
	return normalizeSeed(hashStringToUint32(slug))
}

/** Resolve profile, density, and base seed for a local date key. */
export function getDailySpec(dateKey: LocalDateKey): DailySpec {
	const weekday = dateFromLocalDateKey(dateKey).getDay()
	const slot = WEEKDAY_RHYTHM[weekday] ?? WEEKDAY_RHYTHM[1]!
	return {
		profile: slot.profile,
		density: slot.density,
		seed: createDailySeedNumber(dateKey),
	}
}
