/**
 * Typed AppMetrica event catalog for Number Match.
 * Keep parameter cardinality low — no boards, fingerprints, or raw SDK errors.
 */

export const ANALYTICS_EVENT_NAMES = [
	'app_started',
	'screen_view',
	'training_started',
	'training_completed',
	'level_started',
	'level_completed',
	'level_restarted',
	'numbers_added',
	'hint_used',
	'undo_used',
	'ad_banner_loaded',
	'ad_banner_failed',
	'ad_interstitial_shown',
	'ad_interstitial_failed',
	'ad_rewarded_requested',
	'ad_rewarded_completed',
	'ad_rewarded_failed',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]

const ALLOWED_PARAMETERS: Record<AnalyticsEventName, readonly string[]> = {
	app_started: [],
	screen_view: ['screen'],
	training_started: [],
	training_completed: [],
	level_started: [
		'level',
		'difficulty',
		'initialRows',
		'purpose',
		'campaignVersion',
		'generationVersion',
	],
	level_completed: [
		'level',
		'difficulty',
		'initialRows',
		'starsEarnedThisAttempt',
		'bestStars',
		'usedHint',
		'usedUndo',
		'appendCount',
		'campaignVersion',
		'generationVersion',
	],
	level_restarted: [
		'level',
		'usedHint',
		'usedUndo',
		'appendCount',
	],
	numbers_added: ['level', 'resultingRows', 'appendCount'],
	hint_used: ['level', 'source', 'result'],
	undo_used: ['level', 'source'],
	ad_banner_loaded: ['placement'],
	ad_banner_failed: ['placement', 'error_category'],
	ad_interstitial_shown: [],
	ad_interstitial_failed: ['error_category'],
	ad_rewarded_requested: ['reward', 'level'],
	ad_rewarded_completed: ['reward', 'level'],
	ad_rewarded_failed: ['reward', 'level', 'error_category'],
}

export type AnalyticsParameter = string | number | boolean

export interface AnalyticsEvent {
	readonly name: AnalyticsEventName
	readonly parameters: Record<string, AnalyticsParameter>
}

/**
 * Strip unknown keys / non-primitive values so AppMetrica stays tidy.
 */
export function buildAnalyticsEvent(
	name: AnalyticsEventName,
	parameters: Record<string, unknown> = {},
): AnalyticsEvent {
	const allowed = new Set(ALLOWED_PARAMETERS[name])
	const safeParameters: Record<string, AnalyticsParameter> = {}

	for (const [key, value] of Object.entries(parameters)) {
		if (!allowed.has(key)) {
			continue
		}
		if (
			typeof value !== 'string' &&
			typeof value !== 'number' &&
			typeof value !== 'boolean'
		) {
			continue
		}
		safeParameters[key] = value
	}

	return { name, parameters: safeParameters }
}
