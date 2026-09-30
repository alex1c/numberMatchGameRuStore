/**
 * GameControls pure-facing contracts (pulse + primary Add).
 * Full Animated pulse is covered via shouldStartAppendPulse unit rules.
 */

import {
	APPEND_PULSE_REPETITIONS,
	shouldStartAppendPulse,
} from '../../../game/session/hintRequest'

describe('GameControls Add pulse contract', () => {
	it('pulses only on enter-stuck transition, finite times', () => {
		expect(shouldStartAppendPulse(false, true)).toBe(true)
		expect(shouldStartAppendPulse(true, true)).toBe(false)
		expect(APPEND_PULSE_REPETITIONS).toBeGreaterThanOrEqual(2)
		expect(APPEND_PULSE_REPETITIONS).toBeLessThanOrEqual(3)
	})
})
