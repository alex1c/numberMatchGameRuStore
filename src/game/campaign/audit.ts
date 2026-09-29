/**
 * Campaign catalog audit — reconstruct + solvability proof for every entry.
 */

import {
	GENERATION_VERSION,
	generatePuzzle,
	puzzleFingerprint,
	reconstructGeneratedPuzzle,
} from '../generator'
import { replaySolution, solveBoard } from '../solver'
import { GENERATION_SOLVER_CONFIG } from '../generator/profiles'
import { getCampaignCatalog, getCampaignCatalogSignature } from './catalog'
import { computeCampaignSignature } from './signature'
import { countProfilesInCampaign, maxExpertStreak, profileForLevel } from './rhythm'
import type { CampaignEntry } from './types'
import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from './version'

export interface CampaignAuditOptions {
	readonly entries?: readonly CampaignEntry[]
	/** When true, also re-run generatePuzzle for stronger proof (slower). */
	readonly fullGenerateProof?: boolean
	readonly onProgress?: (info: {
		readonly level: number
		readonly total: number
	}) => void
}

export interface CampaignAuditReport {
	readonly ok: boolean
	readonly checked: number
	readonly failures: readonly string[]
	readonly signature: string
	readonly signatureConstant: string
	readonly signatureMatchesConstant: boolean
	readonly signatureRerunEqual: boolean
	readonly profileCounts: Readonly<Record<string, number>>
	readonly rhythmMaxExpertStreak: number
	readonly longestHardExpertStreak: number
	readonly longestExpertStreak: number
	readonly highestScoreLevel: number
	readonly highestScore: number
	readonly level1000: CampaignEntry | null
	readonly elapsedMs: number
	readonly ranges: readonly {
		readonly label: string
		readonly from: number
		readonly to: number
		readonly easy: number
		readonly medium: number
		readonly hard: number
		readonly expert: number
		readonly medianScore: number
		readonly p95Score: number
		readonly maxHardExpertStreak: number
	}[]
}

function countRange(
	entries: readonly CampaignEntry[],
	from: number,
	to: number,
): { easy: number; medium: number; hard: number; expert: number } {
	const counts = { easy: 0, medium: 0, hard: 0, expert: 0 }
	for (const entry of entries) {
		if (entry.level < from || entry.level > to) continue
		if (entry.profile === 'EASY') counts.easy += 1
		else if (entry.profile === 'MEDIUM') counts.medium += 1
		else if (entry.profile === 'HARD') counts.hard += 1
		else counts.expert += 1
	}
	return counts
}

/**
 * Prove every catalog entry reconstructs and is solvable with replay.
 * Zero-tolerance: any failure flips ok=false.
 */
export function auditCampaignCatalog(
	options: CampaignAuditOptions = {},
): CampaignAuditReport {
	const started = Date.now()
	const entries = options.entries ?? getCampaignCatalog()
	const failures: string[] = []
	const knownFingerprints = new Set<string>()
	const knownCanonicals = new Set<string>()

	if (entries.length !== CAMPAIGN_LEVEL_COUNT) {
		failures.push(
			`length ${entries.length} !== CAMPAIGN_LEVEL_COUNT ${CAMPAIGN_LEVEL_COUNT}`,
		)
	}

	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i]!
		options.onProgress?.({ level: entry.level, total: entries.length })

		if (entry.level !== i + 1) {
			failures.push(`level order broken at index ${i}: level=${entry.level}`)
			continue
		}

		// Levels 11+ should follow the published rhythm (1–10 forced EASY).
		if (entry.level > 10) {
			const expected = profileForLevel(entry.level)
			if (entry.profile !== expected) {
				failures.push(
					`level ${entry.level}: profile ${entry.profile} !== rhythm ${expected}`,
				)
			}
		} else if (entry.profile !== 'EASY') {
			failures.push(`level ${entry.level}: expected EASY for early stretch`)
		}

		const reconstructed = reconstructGeneratedPuzzle({
			generationVersion: GENERATION_VERSION,
			seed: entry.seed,
			profile: entry.profile,
			expectedFingerprint: entry.fingerprint,
		})
		if (reconstructed.status !== 'ok') {
			failures.push(
				`level ${entry.level}: reconstruct failed (${reconstructed.status}: ${
					'reason' in reconstructed ? reconstructed.reason : '?'
				})`,
			)
			continue
		}
		if (reconstructed.fingerprint !== entry.fingerprint) {
			failures.push(`level ${entry.level}: fingerprint mismatch after reconstruct`)
			continue
		}

		if (knownFingerprints.has(entry.fingerprint)) {
			failures.push(`level ${entry.level}: duplicate fingerprint ${entry.fingerprint}`)
		}
		if (knownCanonicals.has(reconstructed.canonical)) {
			failures.push(`level ${entry.level}: duplicate canonical`)
		}
		knownFingerprints.add(entry.fingerprint)
		knownCanonicals.add(reconstructed.canonical)

		if (options.fullGenerateProof) {
			const generated = generatePuzzle({
				seed: entry.seed,
				profile: entry.profile,
				knownFingerprints: new Set(),
				knownCanonicals: new Set(),
				deadEndAnalysis: false,
			})
			if (generated.status !== 'accepted') {
				failures.push(
					`level ${entry.level}: generatePuzzle proof status=${generated.status}`,
				)
				continue
			}
			if (generated.puzzle.identity.fingerprint !== entry.fingerprint) {
				failures.push(
					`level ${entry.level}: generatePuzzle fingerprint mismatch`,
				)
				continue
			}
			const replay = replaySolution(
				generated.puzzle.board,
				generated.puzzle.path,
			)
			if (!replay.ok) {
				failures.push(`level ${entry.level}: generate replay failed`)
			}
		} else {
			// Reconstruct + solve + replay proof (default, no second generate).
			const solved = solveBoard(reconstructed.board, GENERATION_SOLVER_CONFIG)
			if (solved.status !== 'solved') {
				failures.push(
					`level ${entry.level}: solve status=${solved.status}`,
				)
				continue
			}
			const replay = replaySolution(reconstructed.board, solved.path)
			if (!replay.ok) {
				failures.push(
					`level ${entry.level}: replay failed (${replay.reason})`,
				)
				continue
			}
			// Confirm fingerprint still matches the cleared board's start identity.
			const fp = puzzleFingerprint(reconstructed.board)
			if (fp.fingerprint !== entry.fingerprint) {
				failures.push(`level ${entry.level}: post-solve fingerprint drift`)
			}
		}
	}

	const signature = computeCampaignSignature(entries)
	const signatureRerun = computeCampaignSignature(entries)
	const signatureConstant = getCampaignCatalogSignature()

	const rangeDefs = [
		{ label: '1-20', from: 1, to: 20 },
		{ label: '21-100', from: 21, to: 100 },
		{ label: '101-250', from: 101, to: 250 },
		{ label: '251-500', from: 251, to: 500 },
		{ label: '501-750', from: 501, to: 750 },
		{ label: '751-1000', from: 751, to: 1000 },
	] as const

	const ranges = rangeDefs.map((r) => ({
		...r,
		...countRange(entries, r.from, r.to),
		...scoreStats(entries, r.from, r.to),
		maxHardExpertStreak: maxHardExpertStreakInRange(entries, r.from, r.to),
	}))

	let longestHardExpert = 0
	let longestExpert = 0
	let runHE = 0
	let runX = 0
	let highestScoreLevel = 1
	let highestScore = -1
	for (const entry of entries) {
		if (entry.profile === 'HARD' || entry.profile === 'EXPERT') {
			runHE += 1
			if (runHE > longestHardExpert) longestHardExpert = runHE
		} else {
			runHE = 0
		}
		if (entry.profile === 'EXPERT') {
			runX += 1
			if (runX > longestExpert) longestExpert = runX
		} else {
			runX = 0
		}
		if (entry.difficultyScore > highestScore) {
			highestScore = entry.difficultyScore
			highestScoreLevel = entry.level
		}
	}

	const level1000 = entries[999] ?? null

	return {
		ok: failures.length === 0,
		checked: entries.length,
		failures,
		signature,
		signatureConstant,
		signatureMatchesConstant: signature === signatureConstant,
		signatureRerunEqual: signature === signatureRerun,
		profileCounts: countProfilesInCampaign(),
		rhythmMaxExpertStreak: maxExpertStreak(),
		longestHardExpertStreak: longestHardExpert,
		longestExpertStreak: longestExpert,
		highestScoreLevel,
		highestScore,
		level1000,
		elapsedMs: Date.now() - started,
		ranges,
	}
}

function scoreStats(
	entries: readonly CampaignEntry[],
	from: number,
	to: number,
): { medianScore: number; p95Score: number } {
	const scores = entries
		.filter((e) => e.level >= from && e.level <= to)
		.map((e) => e.difficultyScore)
		.sort((a, b) => a - b)
	if (scores.length === 0) {
		return { medianScore: 0, p95Score: 0 }
	}
	const mid = Math.floor(scores.length / 2)
	const medianScore =
		scores.length % 2 === 0
			? (scores[mid - 1]! + scores[mid]!) / 2
			: scores[mid]!
	const p95Index = Math.min(
		scores.length - 1,
		Math.floor(scores.length * 0.95),
	)
	return { medianScore, p95Score: scores[p95Index]! }
}

function maxHardExpertStreakInRange(
	entries: readonly CampaignEntry[],
	from: number,
	to: number,
): number {
	let best = 0
	let run = 0
	for (const entry of entries) {
		if (entry.level < from || entry.level > to) continue
		if (entry.profile === 'HARD' || entry.profile === 'EXPERT') {
			run += 1
			if (run > best) best = run
		} else {
			run = 0
		}
	}
	return best
}

export function formatAuditReport(report: CampaignAuditReport): string {
	const lines: string[] = []
	lines.push('=== Campaign audit ===')
	lines.push(
		`ok=${report.ok} checked=${report.checked} elapsedMs=${report.elapsedMs}`,
	)
	lines.push(
		`campaignVersion=${CAMPAIGN_VERSION} generationVersion=${GENERATION_VERSION}`,
	)
	lines.push(
		`signature=${report.signature} constantMatch=${report.signatureMatchesConstant} rerunEqual=${report.signatureRerunEqual}`,
	)
	lines.push(
		`rhythmMaxExpertStreak=${report.rhythmMaxExpertStreak} longestH+E=${report.longestHardExpertStreak} longestX=${report.longestExpertStreak}`,
	)
	lines.push(
		`highestScore level=${report.highestScoreLevel} score=${report.highestScore}`,
	)
	if (report.level1000) {
		const L = report.level1000
		lines.push(
			`level1000 profile=${L.profile} score=${L.difficultyScore} depth=${L.solutionDepth} appends=${L.appendCount} maxRows=${L.maxRows}`,
		)
	}
	lines.push(
		`rhythmCounts=${JSON.stringify(report.profileCounts)}`,
	)
	lines.push(
		'Range\tLevels\tEASY\tMEDIUM\tHARD\tEXPERT\tMedian\tP95\tMaxH/E',
	)
	for (const r of report.ranges) {
		const levels = r.to - r.from + 1
		lines.push(
			`${r.label}\t${levels}\t${r.easy}\t${r.medium}\t${r.hard}\t${r.expert}\t${r.medianScore.toFixed(1)}\t${r.p95Score.toFixed(1)}\t${r.maxHardExpertStreak}`,
		)
	}
	if (report.failures.length > 0) {
		lines.push('--- failures ---')
		for (const f of report.failures.slice(0, 50)) {
			lines.push(f)
		}
		if (report.failures.length > 50) {
			lines.push(`... and ${report.failures.length - 50} more`)
		}
	}
	return lines.join('\n')
}
