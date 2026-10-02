/**
 * Daily domain unit tests — dates, generation determinism, streak rules.
 */

import {
	createDailyPuzzle,
	createDailySeedNumber,
	daysBetweenLocalDates,
	getActiveCurrentStreak,
	getDailySpec,
	isDailyCompletedOn,
	localDateKey,
	nextLocalDateKey,
	previousLocalDateKey,
	recordDailyCompletion,
	createEmptyDailyState,
	isValidLocalDateKey,
} from '../index'

describe('local date helpers', () => {
	it('round-trips localDateKey and validators', () => {
		const key = localDateKey(new Date(2026, 2, 15, 8, 30, 0))
		expect(key).toBe('2026-03-15')
		expect(isValidLocalDateKey(key)).toBe(true)
		expect(isValidLocalDateKey('2026-02-30')).toBe(false)
	})

	it('steps previous/next by calendar day', () => {
		expect(previousLocalDateKey('2026-03-01')).toBe('2026-02-28')
		expect(nextLocalDateKey('2026-02-28')).toBe('2026-03-01')
		expect(daysBetweenLocalDates('2026-03-01', '2026-03-03')).toBe(2)
	})
})

describe('daily seeds and specs', () => {
	it('maps the same date to the same seed and spec', () => {
		const key = '2026-06-10'
		expect(createDailySeedNumber(key)).toBe(createDailySeedNumber(key))
		expect(getDailySpec(key)).toEqual(getDailySpec(key))
	})

	it('maps different dates to different seeds', () => {
		const a = createDailySeedNumber('2026-06-10')
		const b = createDailySeedNumber('2026-06-11')
		expect(a).not.toBe(b)
	})
})

describe('createDailyPuzzle determinism', () => {
	it('returns the same fingerprint and seed for one date', () => {
		const key = '2026-04-20'
		const first = createDailyPuzzle(key)
		const second = createDailyPuzzle(key)
		expect(first.ok).toBe(true)
		expect(second.ok).toBe(true)
		if (!first.ok || !second.ok) return
		expect(first.seed).toBe(second.seed)
		expect(first.fingerprint).toBe(second.fingerprint)
	})
})

describe('daily streak', () => {
	const d1 = '2026-05-01'
	const d2 = '2026-05-02'
	const d4 = '2026-05-04'

	it('extends streak on consecutive days', () => {
		let state = createEmptyDailyState()
		state = recordDailyCompletion(state, d1, 3)
		state = recordDailyCompletion(state, d2, 2)
		expect(state.currentStreak).toBe(2)
		expect(state.bestStreak).toBe(2)
		expect(isDailyCompletedOn(state, d1)).toBe(true)
	})

	it('resets streak after a missed day', () => {
		let state = recordDailyCompletion(createEmptyDailyState(), d1, 3)
		state = recordDailyCompletion(state, d4, 3)
		expect(state.currentStreak).toBe(1)
	})

	it('does not change streak on same-day replay but can raise stars', () => {
		let state = recordDailyCompletion(createEmptyDailyState(), d1, 1)
		const streakBefore = state.currentStreak
		state = recordDailyCompletion(state, d1, 3)
		expect(state.currentStreak).toBe(streakBefore)
		expect(
			state.history.find((row) => row.dateKey === d1)?.bestStars,
		).toBe(3)
	})

	it('expires active streak when last completion is too old', () => {
		let state = recordDailyCompletion(createEmptyDailyState(), d1, 3)
		expect(getActiveCurrentStreak(state, d2)).toBe(1)
		expect(getActiveCurrentStreak(state, '2026-05-03')).toBe(0)
	})
})
