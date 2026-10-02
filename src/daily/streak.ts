/**
 * Daily completion history, streak counters, and history pruning.
 */

import {
	daysBetweenLocalDates,
	previousLocalDateKey,
	type LocalDateKey,
} from './date'
import {
	DAILY_HISTORY_BOUND,
	type DailyHistoryEntry,
	type PersistedDailyState,
} from './types'
import type { StarCount } from '../game/stars'

function findHistoryEntry(
	history: readonly DailyHistoryEntry[],
	dateKey: LocalDateKey,
): DailyHistoryEntry | undefined {
	return history.find((entry) => entry.dateKey === dateKey)
}

function mergeHistoryEntry(
	history: readonly DailyHistoryEntry[],
	entry: DailyHistoryEntry,
): DailyHistoryEntry[] {
	const without = history.filter((row) => row.dateKey !== entry.dateKey)
	return [...without, entry].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

/**
 * Idempotent daily completion for streak math.
 * Re-completing the same date does not extend the streak; bestStars may increase.
 */
export function recordDailyCompletion(
	state: PersistedDailyState,
	dateKey: LocalDateKey,
	bestStars: StarCount = 3,
): PersistedDailyState {
	const existing = findHistoryEntry(state.history, dateKey)
	if (existing?.completed) {
		const mergedStars = Math.max(existing.bestStars, bestStars) as StarCount
		const history =
			mergedStars === existing.bestStars
				? state.history
				: mergeHistoryEntry(state.history, {
						...existing,
						bestStars: mergedStars,
					})
		return {
			...state,
			history,
			activeDaily:
				state.activeDaily?.dateKey === dateKey ? null : state.activeDaily,
		}
	}

	const entry: DailyHistoryEntry = {
		dateKey,
		bestStars,
		completed: true,
	}
	const history = mergeHistoryEntry(state.history, entry)

	let currentStreak = 1
	if (state.lastCompletedDateKey) {
		const gap = daysBetweenLocalDates(state.lastCompletedDateKey, dateKey)
		if (gap === 1) {
			currentStreak = state.currentStreak + 1
		} else if (gap === 0) {
			currentStreak = Math.max(1, state.currentStreak)
		} else {
			currentStreak = 1
		}
	}

	const bestStreak = Math.max(state.bestStreak, currentStreak)

	return {
		...state,
		history: pruneDailyHistory(history, dateKey, DAILY_HISTORY_BOUND),
		currentStreak,
		bestStreak,
		lastCompletedDateKey: dateKey,
		activeDaily:
			state.activeDaily?.dateKey === dateKey ? null : state.activeDaily,
	}
}

/**
 * Streak shown on hub relative to `todayKey`.
 * Last completion today or yesterday keeps currentStreak alive.
 */
export function getActiveCurrentStreak(
	state: PersistedDailyState,
	todayKey: LocalDateKey,
): number {
	if (!state.lastCompletedDateKey || state.currentStreak <= 0) return 0
	const gap = daysBetweenLocalDates(state.lastCompletedDateKey, todayKey)
	if (gap === 0 || gap === 1) return state.currentStreak
	return 0
}

export function isDailyCompletedOn(
	state: PersistedDailyState,
	dateKey: LocalDateKey,
): boolean {
	const entry = findHistoryEntry(state.history, dateKey)
	return entry?.completed === true
}

/** Recompute longest consecutive completion run (migration sanity). */
export function computeBestStreakFromKeys(keys: LocalDateKey[]): number {
	if (keys.length === 0) return 0
	const sorted = [...new Set(keys)].sort()
	let best = 1
	let run = 1
	for (let i = 1; i < sorted.length; i += 1) {
		const prev = sorted[i - 1]!
		const cur = sorted[i]!
		if (daysBetweenLocalDates(prev, cur) === 1) {
			run += 1
			best = Math.max(best, run)
		} else {
			run = 1
		}
	}
	return best
}

/**
 * Drop entries older than `retainDays` before `todayKey`, keeping at least
 * the streak chain ending at last completion when possible.
 */
export function pruneDailyHistory(
	history: readonly DailyHistoryEntry[],
	todayKey: LocalDateKey,
	retainDays: number = DAILY_HISTORY_BOUND,
): DailyHistoryEntry[] {
	let cutoff = todayKey
	for (let i = 0; i < retainDays; i += 1) {
		cutoff = previousLocalDateKey(cutoff)
	}
	const sorted = [...history].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
	const recent = sorted.filter((entry) => entry.dateKey >= cutoff)
	return recent.length > 0 ? recent : sorted.slice(-retainDays)
}
