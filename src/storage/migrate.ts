/**
 * Schema detection and migration to PersistedRootV2.
 *
 * Pre-release policy:
 * - schema 1 / Campaign v1 → keep trainingCompleted; RESET campaign
 *   progress, active session, and stars (do not continue v1 boards as v2).
 * - corrupt / unknown → safe defaults.
 */

import { CAMPAIGN_VERSION } from '../game/campaign'
import { createEmptyStarBoard } from '../game/stars'
import { createDefaultRoot } from './defaults'
import { starBoardFromRawOrRepair } from './starsPersist'
import { parsePersistedRootJson, validatePersistedRoot } from './validate'
import { PERSIST_SCHEMA_VERSION } from './types'
import type { PersistedRootV2 } from './types'

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

/**
 * Migrate unknown stored JSON into PersistedRootV2.
 */
export function migrateToCurrent(rawText: string | null): PersistedRootV2 {
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

	// schema v2 — validate; repair stars / drop bad session via validate.
	if (schemaVersion === PERSIST_SCHEMA_VERSION) {
		const validated = validatePersistedRoot(record)
		if (validated.ok) {
			// Campaign version mismatch (e.g. future bump): reset campaign only.
			if (validated.value.campaignVersion !== CAMPAIGN_VERSION) {
				devLog(
					`campaignVersion ${validated.value.campaignVersion} → ${CAMPAIGN_VERSION}; resetting campaign progress`,
				)
				return {
					...createDefaultRoot(),
					trainingCompleted: validated.value.trainingCompleted,
					revision: validated.value.revision,
				}
			}
			return validated.value
		}
		devLog('schema v2 failed validation — using defaults', validated.reason)
		return createDefaultRoot()
	}

	// schema v1 (Campaign v1) — preserve training; reset campaign + stars.
	if (schemaVersion === 1) {
		devLog(
			'schema v1 → v2: preserving trainingCompleted; resetting Campaign progress/session/stars',
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
export function migrateParsedOrDefault(rawText: string | null): PersistedRootV2 {
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
