/**
 * Achievement progress + unlock evaluation from persisted root (schema v3).
 */

import { totalStars } from '../game/stars'
import type { PersistedRootV3 } from '../storage'
import {
	ACHIEVEMENT_DEFINITIONS,
	type AchievementDefinition,
} from './definitions'

export interface AchievementMetrics {
	readonly highestCompletedLevel: number
	readonly totalStars: number
	readonly perfectThreeStarLevels: number
	readonly pairsRemoved: number
	readonly dailyCompletedCount: number
	readonly bestDailyStreak: number
}

/** Derive numeric progress inputs from persisted root. */
export function computeAchievementMetrics(
	root: PersistedRootV3,
): AchievementMetrics {
	const cleared = Math.max(0, root.highestCompletedLevel)
	const perfectThreeStarLevels = root.bestStars
		.slice(0, cleared)
		.filter((stars) => stars === 3).length
	const dailyCompletedCount = root.daily.history.filter(
		(entry) => entry.completed,
	).length

	return {
		highestCompletedLevel: cleared,
		totalStars: totalStars(root.bestStars),
		perfectThreeStarLevels,
		pairsRemoved: root.statistics.pairsRemoved,
		dailyCompletedCount,
		bestDailyStreak: root.daily.bestStreak,
	}
}

function metricValue(
	metrics: AchievementMetrics,
	def: AchievementDefinition,
): number {
	switch (def.category) {
		case 'campaign':
			return metrics.highestCompletedLevel
		case 'stars':
			return metrics.totalStars
		case 'mastery':
			return metrics.perfectThreeStarLevels
		case 'pairs':
			return metrics.pairsRemoved
		case 'daily':
			if (def.id === 'daily_first') {
				return metrics.dailyCompletedCount
			}
			return metrics.bestDailyStreak
		default: {
			const _exhaustive: never = def.category
			return _exhaustive
		}
	}
}

export function isAchievementUnlocked(
	root: PersistedRootV3,
	def: AchievementDefinition,
): boolean {
	const metrics = computeAchievementMetrics(root)
	return metricValue(metrics, def) >= def.threshold
}

export function achievementProgress(
	root: PersistedRootV3,
	def: AchievementDefinition,
): { readonly current: number; readonly target: number } {
	const metrics = computeAchievementMetrics(root)
	const current = Math.min(metricValue(metrics, def), def.threshold)
	return { current, target: def.threshold }
}

/** All achievement ids whose thresholds are currently satisfied. */
export function listUnlockedAchievementIds(root: PersistedRootV3): string[] {
	return ACHIEVEMENT_DEFINITIONS.filter((def) =>
		isAchievementUnlocked(root, def),
	).map((def) => def.id)
}
