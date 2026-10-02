/**
 * Achievement threshold evaluation from persisted root.
 */

import { recordDailyCompletion } from '../../daily/streak'
import { createDefaultRoot } from '../../storage'
import { ACHIEVEMENT_DEFINITIONS } from '../definitions'
import { isAchievementUnlocked, listUnlockedAchievementIds } from '../evaluate'

function def(id: string) {
	const found = ACHIEVEMENT_DEFINITIONS.find((row) => row.id === id)
	if (!found) {
		throw new Error(`missing def ${id}`)
	}
	return found
}

describe('achievement evaluate thresholds', () => {
	it('unlocks campaign_10 when frontier reaches 10', () => {
		const root = {
			...createDefaultRoot(),
			highestCompletedLevel: 10,
		}
		expect(isAchievementUnlocked(root, def('campaign_10'))).toBe(true)
		expect(isAchievementUnlocked(root, def('campaign_50'))).toBe(false)
	})

	it('unlocks stars_100 when total stars reach threshold', () => {
		const stars = [...createDefaultRoot().bestStars]
		for (let i = 0; i < 34; i += 1) {
			stars[i] = 3
		}
		const root = {
			...createDefaultRoot(),
			highestCompletedLevel: 34,
			bestStars: stars,
		}
		expect(
			listUnlockedAchievementIds(root).some((id) => id === 'stars_100'),
		).toBe(true)
	})

	it('counts 3-star levels for clean_10', () => {
		const stars = [...createDefaultRoot().bestStars]
		for (let i = 0; i < 10; i += 1) {
			stars[i] = 3
		}
		const root = {
			...createDefaultRoot(),
			highestCompletedLevel: 10,
			bestStars: stars,
		}
		expect(isAchievementUnlocked(root, def('clean_10'))).toBe(true)
	})

	it('unlocks pairs_500 from statistics.pairsRemoved', () => {
		const root = {
			...createDefaultRoot(),
			statistics: {
				...createDefaultRoot().statistics,
				pairsRemoved: 500,
			},
		}
		expect(isAchievementUnlocked(root, def('pairs_500'))).toBe(true)
	})

	it('unlocks daily streak achievements from bestStreak', () => {
		let daily = createDefaultRoot().daily
		daily = recordDailyCompletion(daily, '2026-01-01', 3)
		daily = recordDailyCompletion(daily, '2026-01-02', 3)
		daily = recordDailyCompletion(daily, '2026-01-03', 3)
		const root = {
			...createDefaultRoot(),
			daily,
		}
		expect(isAchievementUnlocked(root, def('daily_streak_3'))).toBe(true)
		expect(isAchievementUnlocked(root, def('daily_first'))).toBe(true)
	})
})
