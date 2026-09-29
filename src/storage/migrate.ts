/**
 * Schema detection and migration to the current PersistedRootV1.
 */

import { createDefaultRoot } from './defaults'
import { parsePersistedRootJson, validatePersistedRoot } from './validate'
import type { PersistedRootV1 } from './types'

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
 * Migrate unknown stored JSON into PersistedRootV1.
 * Unknown future schema versions fall back to safe defaults (DEV log).
 */
export function migrateToCurrent(rawText: string | null): PersistedRootV1 {
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

	if (schemaVersion === 1) {
		const validated = validatePersistedRoot(record)
		if (validated.ok) {
			return validated.value
		}
		devLog('schema v1 failed validation — using defaults', validated.reason)
		return createDefaultRoot()
	}

	if (typeof schemaVersion === 'number' && schemaVersion > 1) {
		devLog(
			`unknown future schemaVersion ${schemaVersion} — using safe defaults`,
		)
		return createDefaultRoot()
	}

	// Legacy / missing version — attempt soft read of known fields, else defaults.
	devLog(`unrecognized schemaVersion ${String(schemaVersion)} — using defaults`)
	return createDefaultRoot()
}

/** Convenience when the caller already has a validated parse path. */
export function migrateParsedOrDefault(rawText: string | null): PersistedRootV1 {
	if (rawText === null) {
		return createDefaultRoot()
	}
	const parsed = parsePersistedRootJson(rawText)
	if (parsed.ok) {
		return parsed.value
	}
	return migrateToCurrent(rawText)
}
