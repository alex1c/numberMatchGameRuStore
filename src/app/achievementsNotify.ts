/**
 * Achievement unlock evaluation — UI toasts consume `newUnlockIds`.
 */

import { listUnlockedAchievementIds } from '../achievements/evaluate'
import type { PersistedRootV3 } from '../storage'

export interface AchievementNotifyContext {
	readonly newUnlockIds: readonly string[]
	/** Populated after daily commit — accurate streak for analytics. */
	readonly dailyStreakAfter?: number
}

/**
 * Newly unlocked achievements whose toast was not shown yet.
 * Does not mutate persistence — caller marks notified after display.
 */
export function evaluateAchievementUnlocks(
	root: PersistedRootV3,
): AchievementNotifyContext {
	const unlocked = new Set(listUnlockedAchievementIds(root))
	const notified = new Set(root.achievementNotifiedIds)
	const newUnlockIds = [...unlocked].filter((id) => !notified.has(id))
	return { newUnlockIds }
}
