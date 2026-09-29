/**
 * Training core examples — each controlled move is valid under gv2 rules.
 */

import {
	TRAINING_STEPS,
	assertTrainingAppendUnlocks,
	assertTrainingMatchValid,
} from '../index'

describe('training steps (production core)', () => {
	it('validates equal, sum10, gap, vertical match steps', () => {
		for (const id of ['equal', 'sum10', 'gap', 'vertical'] as const) {
			const step = TRAINING_STEPS.find((s) => s.id === id)
			expect(step).toBeDefined()
			const result = assertTrainingMatchValid(step!)
			expect(result.ok).toBe(true)
		}
	})

	it('diagonal-only connection kinds', () => {
		const step = TRAINING_STEPS.find((s) => s.id === 'diagonal')!
		const result = assertTrainingMatchValid(step)
		expect(result.ok).toBe(true)
		expect(result.kinds).toEqual(['diagonal'])
	})

	it('linear-only connection kinds', () => {
		const step = TRAINING_STEPS.find((s) => s.id === 'linear')!
		const result = assertTrainingMatchValid(step)
		expect(result.ok).toBe(true)
		expect(result.kinds).toEqual(['linear'])
	})

	it('append unlocks a move when stuck', () => {
		const step = TRAINING_STEPS.find((s) => s.id === 'append')!
		expect(assertTrainingAppendUnlocks(step).ok).toBe(true)
	})

	it('exposes seven interactive steps', () => {
		expect(TRAINING_STEPS).toHaveLength(7)
	})
})
