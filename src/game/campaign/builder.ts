/**
 * Campaign catalog builder — Node tooling (not imported by RN runtime).
 *
 * Algorithm:
 * for level 1..1000:
 *   profile = profileForLevel(level)  (first 10 forced EASY)
 *   try seeds = baseSeed + level * prime + attempt via generatePuzzle
 *   reject cutoff / unsolvable / invalid / duplicates
 *   store compact metrics; optionally tag learningRole for levels 1–10
 */

import {
	areValuesMatchable,
	getAvailableMoves,
	getConnectionKinds,
	type BoardState,
} from '../core'
import {
	GENERATION_VERSION,
	generatePuzzle,
	type AcceptedPuzzle,
	type CampaignDensity,
	type DifficultyProfile,
} from '../generator'
import { computeCampaignSignature } from './signature'
import { densityForLevel, profileForLevel } from './rhythm'
import type { CampaignEntry, CampaignLearningRole } from './types'
import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from './version'

/** Stable base for campaign seed derivation — do not change without CAMPAIGN_VERSION bump. */
export const CAMPAIGN_BUILD_BASE_SEED = 2_026_0329

/** Large prime spacing so level streams do not collide casually. */
export const CAMPAIGN_LEVEL_SEED_PRIME = 1_000_003

export const CAMPAIGN_BUILD_MAX_SEED_ATTEMPTS = 64
export const CAMPAIGN_BUILD_MAX_CANDIDATE_ATTEMPTS = 80

/**
 * Preferred teaching tags for levels 1–10 (PHASE 5 §§363–371).
 * Index = level - 1. Undefined = no hard tag (still EASY / low append).
 */
export const EARLY_LEARNING_GOALS: readonly (
	| CampaignLearningRole
	| undefined
)[] = [
	'equal', // L1 — obvious equal pair
	'sum10', // L2 — reinforce a+b=10
	undefined, // L3 — opening that unlocks another pair (soft)
	undefined, // L4 — gentle EASY
	'vertical', // L5 — obvious vertical
	'diagonal-only', // L6 — readable diagonal-only
	'linear-only', // L7 — row-boundary / linear-only
	undefined, // L8 — small sequence, still EASY
	'append', // L9 — clear no-move → Add
	undefined, // L10 — mixed checkpoint
] as const

export interface BuildCampaignOptions {
	readonly levelCount?: number
	readonly baseSeed?: number
	readonly maxSeedAttempts?: number
	readonly maxCandidateAttempts?: number
	readonly onProgress?: (info: {
		readonly level: number
		readonly total: number
		readonly profile: DifficultyProfile
		readonly seed: number
		readonly fingerprint: string
	}) => void
}

export interface BuildCampaignResult {
	readonly ok: boolean
	readonly entries: readonly CampaignEntry[]
	readonly signature: string
	readonly campaignVersion: typeof CAMPAIGN_VERSION
	readonly generationVersion: typeof GENERATION_VERSION
	readonly elapsedMs: number
	readonly errors: readonly string[]
}

/**
 * Classify opening / path features into a learning role tag.
 * Returns undefined when no clear single teaching signal dominates.
 */
export function detectLearningRole(
	puzzle: AcceptedPuzzle,
): CampaignLearningRole | undefined {
	const tags = collectLearningTags(puzzle)
	if (tags.has('append')) return 'append'
	if (tags.has('diagonal-only')) return 'diagonal-only'
	if (tags.has('linear-only')) return 'linear-only'
	if (tags.has('vertical')) return 'vertical'
	if (tags.has('equal')) return 'equal'
	if (tags.has('sum10')) return 'sum10'
	return undefined
}

/** True when the puzzle exhibits the requested teaching tag. */
export function puzzleHasLearningRole(
	puzzle: AcceptedPuzzle,
	role: CampaignLearningRole,
): boolean {
	return collectLearningTags(puzzle).has(role)
}

function collectLearningTags(
	puzzle: AcceptedPuzzle,
): Set<CampaignLearningRole> {
	const board = puzzle.board
	const path = puzzle.path
	const tags = collectOpeningTags(board)

	// Append teaching goal: board must be stuck on open, then Add unlocks play.
	const openingStuck = getAvailableMoves(board).length === 0
	if (
		puzzle.metrics.appendActionCount > 0 &&
		openingStuck &&
		(path.length === 0 || path[0]!.type === 'append')
	) {
		tags.add('append')
	}
	return tags
}

function collectOpeningTags(board: BoardState): Set<CampaignLearningRole> {
	const tags = new Set<CampaignLearningRole>()
	const moves = getAvailableMoves(board)
	for (const move of moves) {
		const cellA = board.cells[move.aIndex]
		const cellB = board.cells[move.bIndex]
		if (!cellA || !cellB) continue
		if (!areValuesMatchable(cellA.value, cellB.value)) continue

		if (cellA.value === cellB.value) {
			tags.add('equal')
		}
		if (cellA.value + cellB.value === 10) {
			tags.add('sum10')
		}

		const kinds = getConnectionKinds(board, move.aIndex, move.bIndex)
		if (kinds.includes('vertical')) {
			tags.add('vertical')
		}
		if (kinds.length === 1 && kinds[0] === 'diagonal') {
			tags.add('diagonal-only')
		}
		if (kinds.length === 1 && kinds[0] === 'linear') {
			tags.add('linear-only')
		}
	}
	return tags
}

function seedForAttempt(
	baseSeed: number,
	level: number,
	attempt: number,
): number {
	return (baseSeed + level * CAMPAIGN_LEVEL_SEED_PRIME + attempt) >>> 0
}

function toEntry(
	level: number,
	puzzle: AcceptedPuzzle,
	density: CampaignDensity,
	learningRole?: CampaignLearningRole,
): CampaignEntry {
	const entry: CampaignEntry = {
		level,
		seed: puzzle.identity.seed,
		profile: puzzle.identity.profile,
		density,
		fingerprint: puzzle.identity.fingerprint,
		difficultyScore: puzzle.metrics.difficultyScore,
		solutionDepth: puzzle.metrics.solutionActionCount,
		appendCount: puzzle.metrics.appendActionCount,
		maxRows: puzzle.metrics.maxRowsDuringSolution,
	}
	if (learningRole) {
		return { ...entry, learningRole }
	}
	return entry
}

/**
 * Build the full ordered campaign catalog.
 * Deterministic for identical options + generator version.
 */
export function buildCampaignCatalog(
	options: BuildCampaignOptions = {},
): BuildCampaignResult {
	const started = Date.now()
	const levelCount = options.levelCount ?? CAMPAIGN_LEVEL_COUNT
	const baseSeed = options.baseSeed ?? CAMPAIGN_BUILD_BASE_SEED
	const maxSeedAttempts =
		options.maxSeedAttempts ?? CAMPAIGN_BUILD_MAX_SEED_ATTEMPTS
	const maxCandidateAttempts =
		options.maxCandidateAttempts ?? CAMPAIGN_BUILD_MAX_CANDIDATE_ATTEMPTS

	const knownFingerprints = new Set<string>()
	const knownCanonicals = new Set<string>()
	const entries: CampaignEntry[] = []
	const errors: string[] = []
	const claimedLearning = new Set<CampaignLearningRole>()

	for (let level = 1; level <= levelCount; level += 1) {
		// Prefer EASY for the first 10 regardless of the long-form rhythm.
		const profile: DifficultyProfile =
			level <= 10 ? 'EASY' : profileForLevel(level)
		const density = densityForLevel(level)
		const preferredRole =
			level <= 10 ? EARLY_LEARNING_GOALS[level - 1] : undefined
		// Keep Add burden low before L9; L9 prefers Add when readable.
		const preferNoAppend = level >= 1 && level <= 8
		const preferAppend = level === 9
		// Extra seed budget while hunting early teaching goals.
		const levelSeedAttempts =
			level <= 10 ? Math.max(maxSeedAttempts, 160) : maxSeedAttempts

		let accepted: AcceptedPuzzle | null = null
		let acceptedRole: CampaignLearningRole | undefined
		let fallback: AcceptedPuzzle | null = null
		let fallbackRole: CampaignLearningRole | undefined
		let scoredFallback: {
			puzzle: AcceptedPuzzle
			role?: CampaignLearningRole
			score: number
		} | null = null

		for (let attempt = 0; attempt < levelSeedAttempts; attempt += 1) {
			const seed = seedForAttempt(baseSeed, level, attempt)
			const result = generatePuzzle({
				seed,
				profile,
				generationVersion: GENERATION_VERSION,
				density,
				maxCandidateAttempts,
				knownFingerprints,
				knownCanonicals,
				deadEndAnalysis: false,
			})

			if (result.status !== 'accepted') {
				continue
			}

			const puzzle = result.puzzle
			const appends = puzzle.metrics.appendActionCount
			const role = level <= 10 ? detectLearningRole(puzzle) : undefined
			const matchesPreferred =
				preferredRole !== undefined &&
				puzzleHasLearningRole(puzzle, preferredRole)

			if (!fallback) {
				fallback = puzzle
				fallbackRole = role
			}

			// Soft score for early-level append policy + teaching fit.
			let score = 0
			if (preferNoAppend && appends === 0) score += 40
			if (preferNoAppend && appends > 0) score -= 20 * appends
			if (preferAppend && appends >= 1) score += 50
			if (preferAppend && appends === 0) score -= 30
			if (matchesPreferred) score += 100
			if (role && !claimedLearning.has(role)) score += 10
			// Prefer approachable early boards (more forced, fewer appends).
			if (level <= 20 && puzzle.metrics.forcedRatio >= 0.15) score += 8
			if (level <= 20 && puzzle.metrics.initialLegalMoves >= 8) score += 5
			if (level <= 10 && appends === 0) score += 5

			if (!scoredFallback || score > scoredFallback.score) {
				scoredFallback = { puzzle, role, score }
			}

			// Hard accept when preferred teaching tag + append policy both fit.
			const appendOk =
				(!preferNoAppend || appends === 0) &&
				(!preferAppend || appends >= 1)
			if (matchesPreferred && preferredRole && appendOk) {
				accepted = puzzle
				acceptedRole = preferredRole
				break
			}

			// No preferred tag: accept when append policy satisfied.
			if (!preferredRole && appendOk) {
				accepted = puzzle
				acceptedRole = role
				break
			}
		}

		const best = accepted
			? { puzzle: accepted, role: acceptedRole }
			: scoredFallback
				? { puzzle: scoredFallback.puzzle, role: scoredFallback.role }
				: fallback
					? { puzzle: fallback, role: fallbackRole }
					: null
		if (!best) {
			errors.push(
				`level ${level} (${profile}, ${density} rows): no accepted puzzle`,
			)
			break
		}

		knownFingerprints.add(best.puzzle.identity.fingerprint)
		knownCanonicals.add(best.puzzle.identity.canonical)

		const learningRole =
			level <= 10
				? preferredRole && puzzleHasLearningRole(best.puzzle, preferredRole)
					? preferredRole
					: best.role
				: undefined
		if (learningRole) {
			claimedLearning.add(learningRole)
		}

		const entry = toEntry(level, best.puzzle, density, learningRole)
		entries.push(entry)
		options.onProgress?.({
			level,
			total: levelCount,
			profile: entry.profile,
			seed: entry.seed,
			fingerprint: entry.fingerprint,
		})
	}

	const signature = computeCampaignSignature(entries)
	return {
		ok: errors.length === 0 && entries.length === levelCount,
		entries,
		signature,
		campaignVersion: CAMPAIGN_VERSION,
		generationVersion: GENERATION_VERSION,
		elapsedMs: Date.now() - started,
		errors,
	}
}

/** Render catalog.generated.ts source text. */
export function formatCatalogSource(
	entries: readonly CampaignEntry[],
	signature: string,
): string {
	const lines: string[] = [
		'/**',
		' * AUTO-GENERATED — do not edit by hand.',
		' * Rebuild with: npm run campaign:build',
		' */',
		'',
		"import type { CampaignEntry } from './types'",
		'',
		`export const CAMPAIGN_CATALOG_SIGNATURE = '${signature}' as const`,
		'',
		'export const CAMPAIGN_CATALOG: readonly CampaignEntry[] = [',
	]

	for (const entry of entries) {
		const learning =
			entry.learningRole !== undefined
				? `, learningRole: '${entry.learningRole}'`
				: ''
		lines.push(
			`\t{ level: ${entry.level}, seed: ${entry.seed}, profile: '${entry.profile}', density: ${entry.density}, fingerprint: '${entry.fingerprint}', difficultyScore: ${entry.difficultyScore}, solutionDepth: ${entry.solutionDepth}, appendCount: ${entry.appendCount}, maxRows: ${entry.maxRows}${learning} },`,
		)
	}

	lines.push(']', '')
	return lines.join('\n')
}
