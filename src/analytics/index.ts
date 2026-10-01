/**
 * AppMetrica analytics facade — initialize once; never block gameplay.
 * Screens should call trackEvent / helpers, not AppMetrica directly.
 */

import AppMetrica from '@appmetrica/react-native-analytics'

import {
	buildAnalyticsEvent,
	type AnalyticsEventName,
} from './events'

/** Production AppMetrica API key (masked in reports). */
const APPMETRICA_API_KEY = '88c82868-6155-463a-81ce-5980ebce883a'

let initialized = false

/** Activates AppMetrica once per JS runtime. Safe to call repeatedly. */
export function initializeAnalytics(): void {
	if (initialized) {
		return
	}
	initialized = true

	try {
		AppMetrica.activate({
			apiKey: APPMETRICA_API_KEY,
			appOpenTrackingEnabled: false,
			advIdentifiersTracking: false,
			logs: typeof __DEV__ !== 'undefined' && __DEV__,
		})
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			console.log(
				'[NumberMatch][analytics] AppMetrica activate ok (key …883a)',
			)
		}
	} catch (error) {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			console.warn('[NumberMatch][analytics] activate failed', error)
		}
	}
}

export function trackEvent(
	name: AnalyticsEventName,
	parameters: Record<string, unknown> = {},
): void {
	try {
		const event = buildAnalyticsEvent(name, parameters)
		AppMetrica.reportEvent(event.name, event.parameters)
	} catch {
		// Native analytics optional at runtime / in Jest without native binary.
	}
}

export { buildAnalyticsEvent, ANALYTICS_EVENT_NAMES } from './events'
export type {
	AnalyticsEvent,
	AnalyticsEventName,
	AnalyticsParameter,
} from './events'
