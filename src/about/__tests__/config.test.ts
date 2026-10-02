/**
 * About config — canonical ForestMusic URLs present.
 */

import {
	ABOUT_APP_NAME,
	ABOUT_DEVELOPER,
	ABOUT_OTHER_APPS_URL,
	ABOUT_PRIVACY_URL,
	ABOUT_SUPPORT_EMAIL,
	ABOUT_WEBSITE_URL,
	APP_DISPLAY_NAME_SHORT,
	APP_VERSION,
} from '../config'

describe('about config', () => {
	it('exposes required display metadata', () => {
		expect(APP_DISPLAY_NAME_SHORT).toBe('Пары чисел')
		expect(ABOUT_APP_NAME).toContain('Number Match')
		expect(ABOUT_DEVELOPER).toBe('ForestMusic')
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
		expect(ABOUT_SUPPORT_EMAIL).toBe('rustore-alex1c@yandex.ru')
	})

	it('includes canonical https links', () => {
		expect(ABOUT_WEBSITE_URL).toMatch(/^https:\/\//)
		expect(ABOUT_OTHER_APPS_URL).toMatch(/^https:\/\/www\.rustore\.ru\//)
		expect(ABOUT_PRIVACY_URL).toMatch(/^https:\/\/alex1c\.github\.io\//)
	})
})
