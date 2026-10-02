/**
 * Schema detection and migration to PersistedRootV3.
 *
 * Pre-release policy:
 * - schema 2 → v3: preserve ALL campaign fields; add empty daily/stats/settings.
 * - schema 1 / Campaign v1 → keep trainingCompleted; RESET campaign (v3 output).
 * - corrupt / unknown → safe defaults (v3).
 */

import { CAMPAIGN_VERSION } from '../game/campaign'
import { createEmptyDailyState } from '../daily/types'
import {
	createDefaultRoot,
	createDefaultSettings,
	createDefaultStatistics,
} from './defaults'
import { createEmptyStarBoard } from '../game/stars'
import { starBoardFromRawOrRepair } from './starsPersist'
import {
	parsePersistedRootJson,
	validatePersistedRoot,
	validatePersistedRootV2,
} from './validate'
import { PERSIST_SCHEMA_VERSION } from './types'
import type { PersistedRootV2, PersistedRootV3 } from './types'

const isDev =
	typeof __DEV__ !== 'undefined'
		? __DEV__
		: process.env.NODE_ENV !== 'production'

function devLog(message: string, detail?: unknown): void {
	if (!isDev) return
	if (detail !== undefined) {
		console.warn(`[storage.migrate] ${message}`, detail)
	} else {
		console.warn(`[storage.migrate] ${message}`)
	}
}

/** Copy campaign slice from v2 into a fresh v3 shell (daily/stats/settings defaulted). */
export function migrateRootV2ToV3(v2: PersistedRootV2): PersistedRootV3 {
	return {
		schemaVersion: PERSIST_SCHEMA_VERSION,
		campaignVersion: CAMPAIGN_VERSION,
		revision: v2.revision,
		trainingCompleted: v2.trainingCompleted,
		highestCompletedLevel: v2.highestCompletedLevel,
		bestStars: v2.bestStars,
		activeSession: v2.activeSession,
		daily: createEmptyDailyState(),
		statistics: createDefaultStatistics(),
		achievementNotifiedIds: [],
		settings: createDefaultSettings(),
	}
}

/**
 * Migrate unknown stored JSON into PersistedRootV3.
 */
export function migrateToCurrent(rawText: string | null): PersistedRootV3 {
	if (rawText === null || rawText.trim() === '') {
		return createDefaultRoot()
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(rawText) as unknown
	} catch {
		devLog('corrupt JSON — using defaults')
		return createDefaultRoot()
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		devLog('non-object root — using defaults')
		return createDefaultRoot()
	}

	const record = parsed as Record<string, unknown>
	const schemaVersion = record.schemaVersion

	// schema v3 — validate; repair stars / drop bad session via validate.
	if (schemaVersion === PERSIST_SCHEMA_VERSION) {
		const validated = validatePersistedRoot(record)
		if (validated.ok) {
			if (validated.value.campaignVersion !== CAMPAIGN_VERSION) {
				devLog(
					`campaignVersion ${validated.value.campaignVersion} → ${CAMPAIGN_VERSION}; resetting campaign progress`,
				)
				return {
					...createDefaultRoot(),
					trainingCompleted: validated.value.trainingCompleted,
					revision: validated.value.revision,
					daily: validated.value.daily,
					statistics: validated.value.statistics,
					achievementNotifiedIds: validated.value.achievementNotifiedIds,
					settings: validated.value.settings,
				}
			}
			return validated.value
		}
		devLog('schema v3 failed validation — using defaults', validated.reason)
		return createDefaultRoot()
	}

	// schema v2 → v3: preserve entire campaign document.
	if (schemaVersion === 2) {
		const validated = validatePersistedRootV2(record)
		if (validated.ok) {
			if (validated.value.campaignVersion !== CAMPAIGN_VERSION) {
				devLog(
					`v2 campaignVersion ${validated.value.campaignVersion} → ${CAMPAIGN_VERSION}; resetting campaign`,
				)
				return {
					...createDefaultRoot(),
					trainingCompleted: validated.value.trainingCompleted,
					revision: validated.value.revision,
				}
			}
			devLog('schema v2 → v3: preserving campaign; adding daily/stats/settings')
			return migrateRootV2ToV3(validated.value)
		}
		devLog('schema v2 failed validation — using defaults', validated.reason)
		return createDefaultRoot()
	}

	// schema v1 (Campaign v1) — preserve training; reset campaign + stars (v3).
	if (schemaVersion === 1) {
		devLog(
			'schema v1 → v3: preserving trainingCompleted; resetting Campaign progress/session/stars',
		)
		const trainingCompleted =
			typeof record.trainingCompleted === 'boolean'
				? record.trainingCompleted
				: false
		const revision =
			typeof record.revision === 'number' &&
			Number.isInteger(record.revision) &&
			record.revision >= 0
				? record.revision
				: 0
		return {
			...createDefaultRoot(),
			trainingCompleted,
			revision,
		}
	}

	if (typeof schemaVersion === 'number' && schemaVersion > PERSIST_SCHEMA_VERSION) {
		devLog(
			`unknown future schemaVersion ${schemaVersion} — using safe defaults`,
		)
		return createDefaultRoot()
	}

	devLog(`unrecognized schemaVersion ${String(schemaVersion)} — using defaults`)
	return createDefaultRoot()
}

/** Convenience when the caller already has a validated parse path. */
export function migrateParsedOrDefault(rawText: string | null): PersistedRootV3 {
	if (rawText === null) {
		return createDefaultRoot()
	}
	const parsed = parsePersistedRootJson(rawText)
	if (parsed.ok) {
		return parsed.value
	}
	return migrateToCurrent(rawText)
}

/** Re-export for tests that repair stars during migration checks. */
export { starBoardFromRawOrRepair, createEmptyStarBoard }
