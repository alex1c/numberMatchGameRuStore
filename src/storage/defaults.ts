/**
 * Fresh persistence defaults.
 */

import { CAMPAIGN_VERSION } from '../game/campaign'
import type { PersistedRootV1 } from './types'

/** Create a brand-new root document (revision starts at 0). */
export function createDefaultRoot(): PersistedRootV1 {
	return {
		schemaVersion: 1,
		campaignVersion: CAMPAIGN_VERSION,
		revision: 0,
		trainingCompleted: false,
		highestCompletedLevel: 0,
		activeSession: null,
	}
}
