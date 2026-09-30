/**
 * Organic campaign difficulty + density rhythm — not a rigid E/M/H/X loop.
 *
 * Design goals:
 * - Early levels stay mostly EASY (readable openings)
 * - Difficulty rises in waves with recovery (easier) levels
 * - Later campaign favors HARD / EXPERT more often
 * - No long EXPERT streaks (max 2 consecutive)
 * - Density (rows at width 8) progresses separately from difficulty
 */

import type { CampaignDensity, DifficultyProfile } from '../generator'
import { CAMPAIGN_LEVEL_COUNT } from './version'

/**
 * Campaign v2 density rhythm (rows at fixed width 8).
 * Target bands from product brief — deterministic, not a blind quota.
 */
export function densityForLevel(level: number): CampaignDensity {
	if (!Number.isInteger(level) || level < 1 || level > CAMPAIGN_LEVEL_COUNT) {
		throw new Error(`densityForLevel: level out of range: ${level}`)
	}

	// 1–100: primarily 8×7; small amount of 8×8 later in the band.
	if (level <= 100) {
		if (level >= 85 && level % 5 === 0) return 8
		return 7
	}

	// 101–300: mix 8×7 / 8×8.
	if (level <= 300) {
		const phase = level % 5
		if (phase === 0 || phase === 1) return 7
		return 8
	}

	// 301–550: primarily 8×8, with some 8×9.
	if (level <= 550) {
		if (level % 7 === 0) return 9
		return 8
	}

	// 551–800: mix 8×8 / 8×9.
	if (level <= 800) {
		return level % 2 === 0 ? 8 : 9
	}

	// 801–950: primarily 8×9, occasional 8×10.
	if (level <= 950) {
		if (level % 11 === 0) return 10
		return 9
	}

	// 951–1000: mix 8×9 / 8×10.
	return level % 2 === 0 ? 10 : 9
}

/** Count densities across the full campaign (diagnostics / audit tables). */
export function countDensitiesInCampaign(): Record<CampaignDensity, number> {
	const counts: Record<CampaignDensity, number> = {
		7: 0,
		8: 0,
		9: 0,
		10: 0,
	}
	for (let level = 1; level <= CAMPAIGN_LEVEL_COUNT; level += 1) {
		counts[densityForLevel(level)] += 1
	}
	return counts
}

/**
 * Map a 1-based campaign level onto a difficulty profile.
 * Pure and deterministic — used by both builder and tests.
 */
export function profileForLevel(level: number): DifficultyProfile {
	if (!Number.isInteger(level) || level < 1 || level > CAMPAIGN_LEVEL_COUNT) {
		throw new Error(`profileForLevel: level out of range: ${level}`)
	}

	// Opening stretch: teach mechanics on EASY boards.
	if (level <= 12) {
		return 'EASY'
	}

	// Soft introduction of MEDIUM with periodic EASY recovery.
	if (level <= 40) {
		if (level % 7 === 0) return 'EASY'
		if (level % 5 === 0) return 'MEDIUM'
		return level <= 24 ? 'EASY' : 'MEDIUM'
	}

	// Mid campaign: MEDIUM dominant, HARD appears, EASY recovery beats.
	if (level <= 120) {
		const phase = level % 11
		if (phase === 0) return 'EASY'
		if (phase === 1 || phase === 2) return 'MEDIUM'
		if (phase === 3) return 'HARD'
		if (phase === 4 || phase === 5) return 'MEDIUM'
		if (phase === 6) return 'EASY'
		if (phase === 7) return 'HARD'
		if (phase === 8 || phase === 9) return 'MEDIUM'
		return 'MEDIUM'
	}

	// Upper-mid: HARD grows; EXPERT introduced sparsely; recovery preserved.
	if (level <= 400) {
		const phase = level % 13
		if (phase === 0) return 'EASY'
		if (phase === 1 || phase === 2) return 'MEDIUM'
		if (phase === 3 || phase === 4) return 'HARD'
		if (phase === 5) return 'MEDIUM'
		if (phase === 6) return 'HARD'
		if (phase === 7) return 'EXPERT'
		if (phase === 8) return 'MEDIUM'
		if (phase === 9 || phase === 10) return 'HARD'
		if (phase === 11) return 'EASY'
		return 'MEDIUM'
	}

	// Late campaign: HARD / EXPERT common, but cap EXPERT streaks and keep recovery.
	const phase = level % 17
	let profile: DifficultyProfile
	if (phase === 0) {
		profile = 'MEDIUM'
	} else if (phase === 1 || phase === 2) {
		profile = 'HARD'
	} else if (phase === 3) {
		profile = 'EXPERT'
	} else if (phase === 4) {
		profile = 'HARD'
	} else if (phase === 5) {
		profile = 'MEDIUM'
	} else if (phase === 6 || phase === 7) {
		profile = 'HARD'
	} else if (phase === 8) {
		profile = 'EXPERT'
	} else if (phase === 9) {
		profile = 'EASY'
	} else if (phase === 10 || phase === 11) {
		profile = 'HARD'
	} else if (phase === 12) {
		profile = 'EXPERT'
	} else if (phase === 13) {
		profile = 'MEDIUM'
	} else if (phase === 14 || phase === 15) {
		profile = 'HARD'
	} else {
		profile = 'MEDIUM'
	}

	// Soft guard: never allow 3+ EXPERT in a row by demoting the third.
	if (profile === 'EXPERT' && level >= 3) {
		const prev1 = profileForLevelUnsafe(level - 1)
		const prev2 = profileForLevelUnsafe(level - 2)
		if (prev1 === 'EXPERT' && prev2 === 'EXPERT') {
			return 'HARD'
		}
	}

	return profile
}

/**
 * Internal lookup that avoids re-entering the EXPERT-streak guard recursion
 * for already-resolved earlier levels in the late band. Uses the same wave
 * formulas without the streak demotion (streak is applied only at the tip).
 */
function profileForLevelUnsafe(level: number): DifficultyProfile {
	if (level <= 12) return 'EASY'
	if (level <= 40) {
		if (level % 7 === 0) return 'EASY'
		if (level % 5 === 0) return 'MEDIUM'
		return level <= 24 ? 'EASY' : 'MEDIUM'
	}
	if (level <= 120) {
		const phase = level % 11
		if (phase === 0) return 'EASY'
		if (phase === 3 || phase === 7) return 'HARD'
		if (phase === 6) return 'EASY'
		return 'MEDIUM'
	}
	if (level <= 400) {
		const phase = level % 13
		if (phase === 0 || phase === 11) return 'EASY'
		if (phase === 7) return 'EXPERT'
		if (phase === 3 || phase === 4 || phase === 6 || phase === 9 || phase === 10) {
			return 'HARD'
		}
		return 'MEDIUM'
	}
	const phase = level % 17
	if (phase === 0 || phase === 13 || phase === 16) return 'MEDIUM'
	if (phase === 5) return 'MEDIUM'
	if (phase === 9) return 'EASY'
	if (phase === 3 || phase === 8 || phase === 12) return 'EXPERT'
	return 'HARD'
}

/** Count profiles across the full campaign (diagnostics / audit tables). */
export function countProfilesInCampaign(): Record<DifficultyProfile, number> {
	const counts: Record<DifficultyProfile, number> = {
		EASY: 0,
		MEDIUM: 0,
		HARD: 0,
		EXPERT: 0,
	}
	for (let level = 1; level <= CAMPAIGN_LEVEL_COUNT; level += 1) {
		counts[profileForLevel(level)] += 1
	}
	return counts
}

/** Longest consecutive EXPERT run in the rhythm (must stay small). */
export function maxExpertStreak(): number {
	let best = 0
	let run = 0
	for (let level = 1; level <= CAMPAIGN_LEVEL_COUNT; level += 1) {
		if (profileForLevel(level) === 'EXPERT') {
			run += 1
			if (run > best) best = run
		} else {
			run = 0
		}
	}
	return best
}
