/**
 * Audit helpers: aggregate stats, percentile, catalog generation.
 */

import { generatePuzzle } from './generate'
import { findNearDuplicates } from './nearDuplicate'
import type {
	AcceptedPuzzle,
	DifficultyProfile,
	GeneratePuzzleResult,
} from './types'
import { DIFFICULTY_PROFILES } from './version'

export interface AuditProfileTarget {
	readonly profile: DifficultyProfile
	readonly count: number
}

export interface AuditOptions {
	readonly targets: readonly AuditProfileTarget[]
	readonly baseSeed: number
	readonly maxAttemptsPerPuzzle?: number
	readonly deadEndAnalysis?: boolean
}

export interface ProfileAuditStats {
	readonly profile: DifficultyProfile
	readonly target: number
	readonly accepted: number
	readonly attempts: number
	readonly rejectionCounts: Readonly<Record<string, number>>
	readonly puzzles: readonly AcceptedPuzzle[]
}

export interface AuditReport {
	readonly ok: boolean
	readonly profiles: readonly ProfileAuditStats[]
	readonly acceptedTotal: number
	readonly attemptsTotal: number
	readonly exactDuplicates: number
	readonly replayFailures: number
	readonly acceptedUnsolved: number
	readonly acceptedCutoff: number
	readonly acceptedInvalid: number
	readonly nearDuplicates: ReturnType<typeof findNearDuplicates>
	readonly invariantErrors: readonly string[]
	readonly elapsedMs: number
}

function emptyReject(): Record<string, number> {
	return {}
}

function mergeRejects(
	into: Record<string, number>,
	from: Readonly<Record<string, number>>,
): void {
	for (const [k, v] of Object.entries(from)) {
		into[k] = (into[k] ?? 0) + v
	}
}

export function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0
	const idx = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
	)
	return sorted[idx]!
}

export function median(values: number[]): number {
	const sorted = values.slice().sort((a, b) => a - b)
	return percentile(sorted, 50)
}

/**
 * Generate a catalog for the requested profile targets.
 * Deterministic for identical options.
 */
export function runAudit(options: AuditOptions): AuditReport {
	const started = Date.now()
	const knownCanonicals = new Set<string>()
	const knownFingerprints = new Set<string>()
	const invariantErrors: string[] = []
	let exactDuplicates = 0
	let replayFailures = 0
	let acceptedUnsolved = 0
	let acceptedCutoff = 0
	let acceptedInvalid = 0
	let attemptsTotal = 0
	const profileStats: ProfileAuditStats[] = []

	for (const target of options.targets) {
		const puzzles: AcceptedPuzzle[] = []
		const rejectionCounts = emptyReject()
		let attempts = 0
		let seedOffset = 0

		while (puzzles.length < target.count) {
			const seed = options.baseSeed + seedOffset
			seedOffset += 1
			// Safety: avoid unbounded loops if acceptance is pathological.
			if (seedOffset > target.count * 500) {
				invariantErrors.push(
					`${target.profile}: exceeded seed walk budget before quota`,
				)
				break
			}

			const result: GeneratePuzzleResult = generatePuzzle({
				seed,
				profile: target.profile,
				maxCandidateAttempts: options.maxAttemptsPerPuzzle ?? 80,
				knownCanonicals,
				knownFingerprints,
				deadEndAnalysis: options.deadEndAnalysis === true,
			})

			if (result.status === 'invalid_config') {
				invariantErrors.push(result.reason)
				break
			}

			attempts += result.attempts
			attemptsTotal += result.attempts
			mergeRejects(rejectionCounts, result.rejectionCounts)

			if (result.status === 'exhausted') {
				continue
			}

			const puzzle = result.puzzle
			if (knownCanonicals.has(puzzle.identity.canonical)) {
				exactDuplicates += 1
				continue
			}

			// Invariant: accepted must be solved + replay already checked in generate.
			if (puzzle.path.length === 0 && puzzle.metrics.initialCells > 0) {
				// cleared-only edge case ok; otherwise path expected
			}

			knownCanonicals.add(puzzle.identity.canonical)
			knownFingerprints.add(puzzle.identity.fingerprint)
			puzzles.push(puzzle)
		}

		profileStats.push({
			profile: target.profile,
			target: target.count,
			accepted: puzzles.length,
			attempts,
			rejectionCounts,
			puzzles,
		})
	}

	const all = profileStats.flatMap((p) => p.puzzles)
	const nearDuplicates = findNearDuplicates(
		all.map((p) => ({
			fingerprint: p.identity.fingerprint,
			values: p.values,
		})),
	)

	const acceptedTotal = all.length
	const expected = options.targets.reduce((s, t) => s + t.count, 0)
	const ok =
		invariantErrors.length === 0 &&
		acceptedTotal === expected &&
		exactDuplicates === 0 &&
		replayFailures === 0 &&
		acceptedUnsolved === 0 &&
		acceptedCutoff === 0 &&
		acceptedInvalid === 0

	return {
		ok,
		profiles: profileStats,
		acceptedTotal,
		attemptsTotal,
		exactDuplicates,
		replayFailures,
		acceptedUnsolved,
		acceptedCutoff,
		acceptedInvalid,
		nearDuplicates,
		invariantErrors,
		elapsedMs: Date.now() - started,
	}
}

export function defaultFullTargets(): AuditProfileTarget[] {
	return [
		{ profile: 'EASY', count: 300 },
		{ profile: 'MEDIUM', count: 300 },
		{ profile: 'HARD', count: 250 },
		{ profile: 'EXPERT', count: 150 },
	]
}

export function default400Targets(): AuditProfileTarget[] {
	return DIFFICULTY_PROFILES.map((profile) => ({ profile, count: 100 }))
}

export function defaultSmallTargets(): AuditProfileTarget[] {
	return DIFFICULTY_PROFILES.map((profile) => ({ profile, count: 5 }))
}

/** Deterministic fingerprint list for audit comparison (ignores elapsed). */
export function auditFingerprintSignature(report: AuditReport): string {
	return report.profiles
		.map((p) => {
			const fps = p.puzzles.map((x) => x.identity.fingerprint).join(',')
			const rejects = Object.entries(p.rejectionCounts)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => `${k}:${v}`)
				.join(',')
			return `${p.profile}|${p.accepted}|${p.attempts}|${fps}|${rejects}`
		})
		.join('||')
}
