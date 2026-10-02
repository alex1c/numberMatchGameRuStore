/**
 * About screen constants — ForestMusic canonical URLs (RuStore / GitHub Pages).
 */

import appJson from '../../app.json'

export const APP_DISPLAY_NAME_SHORT = 'Пары чисел' as const

export const ABOUT_APP_NAME = 'Пары чисел — Number Match' as const

export const ABOUT_DEVELOPER = 'ForestMusic' as const

export const ABOUT_WEBSITE_URL = 'https://forest-music.ru' as const

export const ABOUT_OTHER_APPS_URL =
	'https://www.rustore.ru/catalog/developer/pw0k858f' as const

/**
 * Canonical privacy policy URL (GitHub Pages pattern like sibling ForestMusic apps).
 * Page may 404 until published — keep URL stable for store listings.
 */
export const ABOUT_PRIVACY_URL =
	'https://alex1c.github.io/numberMatchGameRuStore/' as const

/**
 * Verified ForestMusic RuStore support contact (same mailbox as sibling apps).
 */
export const ABOUT_SUPPORT_EMAIL = 'rustore-alex1c@yandex.ru' as const

export const ABOUT_SUPPORT_MAILTO = `mailto:${ABOUT_SUPPORT_EMAIL}` as const

/**
 * Version for About UI — same source as expo `version` (app.json / EAS build).
 * At runtime, `expo-constants` expoConfig.version would match when the native shell is present.
 */
export const APP_VERSION: string = appJson.expo.version ?? '1.0.0'
