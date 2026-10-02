/**
 * Screenshot QA mode must stay DEV-only.
 */

import { isScreenshotQaMode } from '../screenshotQaMode'

describe('screenshotQaMode', () => {
	const previous = process.env.EXPO_PUBLIC_SCREENSHOT_QA_MODE

	afterEach(() => {
		if (previous === undefined) {
			delete process.env.EXPO_PUBLIC_SCREENSHOT_QA_MODE
		} else {
			process.env.EXPO_PUBLIC_SCREENSHOT_QA_MODE = previous
		}
	})

	it('is inactive when the env flag is unset', () => {
		delete process.env.EXPO_PUBLIC_SCREENSHOT_QA_MODE
		// Jest runs with __DEV__ true; flag still required.
		expect(isScreenshotQaMode()).toBe(false)
	})

	it('activates only when the env flag is 1 under __DEV__', () => {
		process.env.EXPO_PUBLIC_SCREENSHOT_QA_MODE = '1'
		expect(isScreenshotQaMode()).toBe(true)
	})
})
