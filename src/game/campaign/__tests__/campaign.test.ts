/**
 * Campaign rhythm / signature unit tests (no full catalog required).
 */

import {
	computeCampaignSignature,
	countProfilesInCampaign,
	maxExpertStreak,
	profileForLevel,
	CAMPAIGN_LEVEL_COUNT,
} from '../index'
import type { CampaignEntry } from '../types'

describe('campaign rhythm', () => {
	it('keeps early levels EASY', () => {
		for (let level = 1; level <= 12; level += 1) {
			expect(profileForLevel(level)).toBe('EASY')
		}
	})

	it('does not form long EXPERT streaks', () => {
		expect(maxExpertStreak()).toBeLessThanOrEqual(2)
	})

	it('covers all profiles across the campaign', () => {
		const counts = countProfilesInCampaign()
		expect(counts.EASY).toBeGreaterThan(0)
		expect(counts.MEDIUM).toBeGreaterThan(0)
		expect(counts.HARD).toBeGreaterThan(0)
		expect(counts.EXPERT).toBeGreaterThan(0)
		expect(
			counts.EASY + counts.MEDIUM + counts.HARD + counts.EXPERT,
		).toBe(CAMPAIGN_LEVEL_COUNT)
	})

	it('is not a rigid E/M/H/X loop', () => {
		const window = [13, 14, 15, 16, 17, 18, 19, 20].map(profileForLevel)
		const unique = new Set(window)
		// Early post-intro window should stay in the easy/medium band.
		expect(unique.has('EXPERT')).toBe(false)
	})
})

describe('campaign signature', () => {
	it('is deterministic for the same ordered entries', () => {
		const entries: CampaignEntry[] = [
			{
				level: 1,
				seed: 1,
				profile: 'EASY',
				density: 7,
				fingerprint: 'faaaaaaaa',
				difficultyScore: 10,
				solutionDepth: 4,
				appendCount: 0,
				maxRows: 3,
			},
			{
				level: 2,
				seed: 2,
				profile: 'EASY',
				density: 7,
				fingerprint: 'fbbbbbbbb',
				difficultyScore: 12,
				solutionDepth: 5,
				appendCount: 0,
				maxRows: 3,
			},
		]
		const a = computeCampaignSignature(entries)
		const b = computeCampaignSignature(entries)
		expect(a).toBe(b)
		expect(a.startsWith('cs')).toBe(true)
	})
})
