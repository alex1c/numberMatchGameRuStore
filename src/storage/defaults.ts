/**
 * Fresh persistence defaults (schema v3 / Campaign v2 + daily shell).
 */

import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from '../game/campaign'
import { createEmptyStarBoard } from '../game/stars'
import { createEmptyDailyState } from '../daily/types'
import { PERSIST_SCHEMA_VERSION } from './types'
import type {
	PersistedRootV3,
	PersistedSettings,
	PersistedStatistics,
} from './types'

/** Zeroed lifetime statistics. */
export function createDefaultStatistics(): PersistedStatistics {
	return {
		pairsRemoved: 0,
		appendActions: 0,
		hintsDelivered: 0,
		undoActions: 0,
	}
}

/** Default user settings. */
export function createDefaultSettings(): PersistedSettings {
	return {
		themePreference: 'system',
	}
}

/** Create a brand-new root document (revision starts at 0). */
export function createDefaultRoot(): PersistedRootV3 {
	return {
		schemaVersion: PERSIST_SCHEMA_VERSION,
		campaignVersion: CAMPAIGN_VERSION,
		revision: 0,
		trainingCompleted: false,
		highestCompletedLevel: 0,
		bestStars: createEmptyStarBoard(CAMPAIGN_LEVEL_COUNT),
		activeSession: null,
		daily: createEmptyDailyState(),
		statistics: createDefaultStatistics(),
		achievementNotifiedIds: [],
		settings: createDefaultSettings(),
	}
}
