/**
 * Analytics event builder — no native SDK calls.
 */

import { buildAnalyticsEvent } from '../events'

describe('buildAnalyticsEvent', () => {
	it('keeps allowed params and strips unknown / high-cardinality junk', () => {
		const event = buildAnalyticsEvent('level_completed', {
			level: 3,
			difficulty: 'EASY',
			initialRows: 7,
			starsEarnedThisAttempt: 2,
			bestStars: 3,
			usedHint: true,
			usedUndo: false,
			appendCount: 1,
			campaignVersion: 2,
			generationVersion: 3,
			fingerprint: 'should-drop',
			board: { cells: [] },
		})
		expect(event.name).toBe('level_completed')
		expect(event.parameters.level).toBe(3)
		expect(event.parameters.usedHint).toBe(true)
		expect(event.parameters.campaignVersion).toBe(2)
		expect(event.parameters).not.toHaveProperty('fingerprint')
		expect(event.parameters).not.toHaveProperty('board')
	})

	it('supports hint funnel fields', () => {
		const event = buildAnalyticsEvent('hint_used', {
			level: 1,
			source: 'free',
			result: 'match',
		})
		expect(event.parameters).toEqual({
			level: 1,
			source: 'free',
			result: 'match',
		})
	})

	it('supports ad rewarded purpose', () => {
		const event = buildAnalyticsEvent('ad_rewarded_requested', {
			reward: 'hint',
			level: 4,
		})
		expect(event.parameters.reward).toBe('hint')
	})
})
