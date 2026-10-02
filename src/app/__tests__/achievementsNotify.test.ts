/**
 * Achievement notify — only ids not yet toasted.
 */

import { createDefaultRoot } from '../../storage'
import { evaluateAchievementUnlocks } from '../achievementsNotify'

describe('evaluateAchievementUnlocks', () => {
	it('returns unlocked ids missing from achievementNotifiedIds', () => {
		const root = {
			...createDefaultRoot(),
			highestCompletedLevel: 10,
			achievementNotifiedIds: ['campaign_10'],
		}
		const result = evaluateAchievementUnlocks(root)
		expect(result.newUnlockIds).not.toContain('campaign_10')
	})
})
