/**
 * Solver-verified daily puzzle generation for one local date key.
 */

import type { BoardState } from '../game/core'
import {
	GENERATION_VERSION,
	generatePuzzle,
	type CampaignDensity,
	type DifficultyProfile,
} from '../game/generator'
import {
	DAILY_MAX_CANDIDATE_ATTEMPTS,
	DAILY_MAX_SEED_OFFSET_ATTEMPTS,
	DAILY_VERSION,
	getDailySpec,
} from './config'
import type { LocalDateKey } from './date'

export interface DailyPuzzleSuccess {
	readonly ok: true
	readonly dateKey: LocalDateKey
	readonly dailyVersion: typeof DAILY_VERSION
	readonly profile: DifficultyProfile
	readonly density: CampaignDensity
	/** Winning seed (base seed + attemptOffset). */
	readonly seed: number
	readonly attemptOffset: number
	readonly board: BoardState
	readonly fingerprint: string
	readonly canonical: string
	readonly generationVersion: number
	readonly difficultyProfileVersion: number
	readonly maxRowsDuringSolution: number
}

export interface DailyPuzzleFailure {
	readonly ok: false
	readonly dateKey: LocalDateKey
	readonly dailyVersion: typeof DAILY_VERSION
	readonly profile: DifficultyProfile
	readonly density: CampaignDensity
	readonly baseSeed: number
	readonly reason: 'generation_exhausted'
	readonly lastStatus: string
}

export type DailyGenerationResult = DailyPuzzleSuccess | DailyPuzzleFailure

/**
 * Build today's daily puzzle — only returns boards accepted by generatePuzzle
 * (solver-proven). On failure, walks deterministic seed offsets seed+attempt.
 */
export function createDailyPuzzle(dateKey: LocalDateKey): DailyGenerationResult {
	const spec = getDailySpec(dateKey)
	let lastStatus = 'none'

	for (let attempt = 0; attempt < DAILY_MAX_SEED_OFFSET_ATTEMPTS; attempt += 1) {
		const seed = (spec.seed + attempt) >>> 0
		const result = generatePuzzle({
			seed,
			profile: spec.profile,
			density: spec.density,
			generationVersion: GENERATION_VERSION,
			maxCandidateAttempts: DAILY_MAX_CANDIDATE_ATTEMPTS,
			deadEndAnalysis: false,
		})

		if (result.status === 'accepted') {
			const { identity, board, metrics } = result.puzzle
			return {
				ok: true,
				dateKey,
				dailyVersion: DAILY_VERSION,
				profile: spec.profile,
				density: spec.density,
				seed,
				attemptOffset: attempt,
				board,
				fingerprint: identity.fingerprint,
				canonical: identity.canonical,
				generationVersion: identity.generationVersion,
				difficultyProfileVersion: identity.difficultyProfileVersion,
				maxRowsDuringSolution: metrics.maxRowsDuringSolution,
			}
		}

		lastStatus =
			result.status === 'invalid_config'
				? result.reason
				: `${result.status}:${result.reason}`
	}

	return {
		ok: false,
		dateKey,
		dailyVersion: DAILY_VERSION,
		profile: spec.profile,
		density: spec.density,
		baseSeed: spec.seed,
		reason: 'generation_exhausted',
		lastStatus,
	}
}
