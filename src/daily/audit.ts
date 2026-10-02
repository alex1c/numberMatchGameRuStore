/**
 * Daily calendar audit — prove generation for a consecutive date window.
 */

import type { DifficultyProfile } from '../game/generator'
import { createDailyPuzzle } from './generate'
import {
	listRecentLocalDateKeys,
	localDateKey,
	type LocalDateKey,
} from './date'

export interface DailyAuditOptions {
	readonly endDateKey?: LocalDateKey
	readonly dayCount?: number
	readonly onProgress?: (info: {
		readonly index: number
		readonly total: number
		readonly dateKey: LocalDateKey
	}) => void
}

export interface DailyAuditReport {
	readonly ok: boolean
	readonly dayCount: number
	readonly startDateKey: LocalDateKey
	readonly endDateKey: LocalDateKey
	readonly solved: number
	readonly exhausted: number
	readonly cutoff: number
	readonly invalid: number
	readonly duplicateFingerprints: number
	readonly profileCounts: Readonly<Record<DifficultyProfile, number>>
	readonly densityCounts: Readonly<Record<string, number>>
	readonly maxRowsObserved: number
	readonly determinismSamples: readonly {
		readonly dateKey: LocalDateKey
		readonly fingerprintEqual: boolean
		readonly seedEqual: boolean
	}[]
	readonly elapsedMs: number
	readonly failures: readonly string[]
}

function bucketStatus(lastStatus: string): 'cutoff' | 'invalid' | 'other' {
	if (lastStatus.includes('cutoff')) return 'cutoff'
	if (
		lastStatus.includes('invalid') ||
		lastStatus.includes('unsolvable') ||
		lastStatus.includes('replay')
	) {
		return 'invalid'
	}
	return 'other'
}

/** Audit `dayCount` consecutive local days ending at `endDateKey` (default today). */
export function auditDailyCalendar(
	options: DailyAuditOptions = {},
): DailyAuditReport {
	const started = Date.now()
	const endDateKey = options.endDateKey ?? localDateKey(new Date())
	const dayCount = options.dayCount ?? 365
	const dateKeys = listRecentLocalDateKeys(endDateKey, dayCount)
	const startDateKey = dateKeys[0] ?? endDateKey

	const failures: string[] = []
	const fingerprints = new Map<string, LocalDateKey>()
	let solved = 0
	let exhausted = 0
	let cutoff = 0
	let invalid = 0
	let duplicateFingerprints = 0
	let maxRowsObserved = 0

	const profileCounts: Record<DifficultyProfile, number> = {
		EASY: 0,
		MEDIUM: 0,
		HARD: 0,
		EXPERT: 0,
	}
	const densityCounts: Record<string, number> = {}

	for (let i = 0; i < dateKeys.length; i += 1) {
		const dateKey = dateKeys[i]!
		options.onProgress?.({ index: i + 1, total: dateKeys.length, dateKey })

		const result = createDailyPuzzle(dateKey)
		if (!result.ok) {
			exhausted += 1
			const bucket = bucketStatus(result.lastStatus)
			if (bucket === 'cutoff') cutoff += 1
			else if (bucket === 'invalid') invalid += 1
			failures.push(`${dateKey}: ${result.lastStatus}`)
			continue
		}

		solved += 1
		profileCounts[result.profile] += 1
		densityCounts[String(result.density)] =
			(densityCounts[String(result.density)] ?? 0) + 1

		maxRowsObserved = Math.max(
			maxRowsObserved,
			result.maxRowsDuringSolution,
		)

		const prev = fingerprints.get(result.fingerprint)
		if (prev !== undefined) {
			duplicateFingerprints += 1
			failures.push(
				`duplicate fingerprint ${result.fingerprint} (${prev} and ${dateKey})`,
			)
		} else {
			fingerprints.set(result.fingerprint, dateKey)
		}
	}

	const sampleIndices = [0, Math.floor(dayCount / 4), Math.floor(dayCount / 2), Math.floor((3 * dayCount) / 4), dayCount - 1]
	const determinismSamples = sampleIndices
		.filter((idx) => idx >= 0 && idx < dateKeys.length)
		.map((idx) => {
			const dateKey = dateKeys[idx]!
			const a = createDailyPuzzle(dateKey)
			const b = createDailyPuzzle(dateKey)
			if (!a.ok || !b.ok) {
				return {
					dateKey,
					fingerprintEqual: false,
					seedEqual: false,
				}
			}
			return {
				dateKey,
				fingerprintEqual: a.fingerprint === b.fingerprint,
				seedEqual: a.seed === b.seed,
			}
		})

	for (const sample of determinismSamples) {
		if (!sample.fingerprintEqual || !sample.seedEqual) {
			failures.push(`determinism failed for ${sample.dateKey}`)
		}
	}

	const ok =
		failures.length === 0 &&
		solved === dayCount &&
		determinismSamples.every((s) => s.fingerprintEqual && s.seedEqual)

	return {
		ok,
		dayCount,
		startDateKey,
		endDateKey,
		solved,
		exhausted,
		cutoff,
		invalid,
		duplicateFingerprints,
		profileCounts,
		densityCounts,
		maxRowsObserved,
		determinismSamples,
		elapsedMs: Date.now() - started,
		failures,
	}
}

export function formatDailyAuditReport(report: DailyAuditReport): string {
	const lines = [
		'Number Match daily audit',
		`window=${report.startDateKey}..${report.endDateKey} days=${report.dayCount}`,
		`solved=${report.solved} exhausted=${report.exhausted} cutoff=${report.cutoff} invalid=${report.invalid}`,
		`duplicateFingerprints=${report.duplicateFingerprints} maxRows=${report.maxRowsObserved}`,
		`profiles=${JSON.stringify(report.profileCounts)} densities=${JSON.stringify(report.densityCounts)}`,
		`determinism=${JSON.stringify(report.determinismSamples)}`,
		`elapsedMs=${report.elapsedMs} ok=${report.ok}`,
	]
	if (report.failures.length > 0) {
		lines.push(`failures (${report.failures.length}, first 10):`)
		for (const msg of report.failures.slice(0, 10)) {
			lines.push(`  - ${msg}`)
		}
	}
	return lines.join('\n')
}
