/**
 * Fresh persistence defaults (schema v2 / Campaign v2).
 */

import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from '../game/campaign'
import { createEmptyStarBoard } from '../game/stars'
import { PERSIST_SCHEMA_VERSION } from './types'
import type { PersistedRootV2 } from './types'

/** Create a brand-new root document (revision starts at 0). */
export function createDefaultRoot(): PersistedRootV2 {
	return {
		schemaVersion: PERSIST_SCHEMA_VERSION,
		campaignVersion: CAMPAIGN_VERSION,
		revision: 0,
		trainingCompleted: false,
		highestCompletedLevel: 0,
		bestStars: createEmptyStarBoard(CAMPAIGN_LEVEL_COUNT),
		activeSession: null,
	}
}
