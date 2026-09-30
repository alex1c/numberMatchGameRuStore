/**
 * Reconstruct a previously generated puzzle from seed + profile + fingerprint.
 *
 * Replays the same candidate stream as generatePuzzle, but NEVER calls the
 * solver. Catalog / persistence restore must stay cheap and deterministic.
 */

import { cloneBoard, type BoardState } from '../core'
import {
	createCandidateBoard,
	createCandidateBoardGv3,
} from './candidate'
import { isCampaignDensity, type CampaignDensity } from './density'
import { puzzleFingerprint } from './fingerprint'
import type { DifficultyProfile } from './version'
import {
	GENERATION_VERSION,
	GENERATION_VERSION_V2,
	deriveStreamSeed,
	isDifficultyProfile,
	isSupportedGenerationVersion,
} from './version'

export interface ReconstructGeneratedPuzzleOptions {
	readonly generationVersion: number
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly expectedFingerprint: string
	readonly maxAttempts?: number
	/** Required when generationVersion >= 3. */
	readonly density?: CampaignDensity
}

export type ReconstructGeneratedPuzzleResult =
	| {
			readonly status: 'ok'
			readonly board: BoardState
			readonly attempts: number
			readonly fingerprint: string
			readonly canonical: string
	  }
	| {
			readonly status: 'not_found'
			readonly reason: string
			readonly attempts: number
	  }
	| {
			readonly status: 'invalid_config'
			readonly reason: string
	  }

/**
 * Walk candidate attempts until the fingerprint matches, then return a clone.
 * Fail closed when the expected board is not in the attempt budget.
 *
 * Supports generationVersion 2 (gv2 shape) and 3 (gv3 density).
 */
export function reconstructGeneratedPuzzle(
	options: ReconstructGeneratedPuzzleOptions,
): ReconstructGeneratedPuzzleResult {
	if (!Number.isFinite(options.seed)) {
		return { status: 'invalid_config', reason: 'seed must be finite' }
	}
	if (!isDifficultyProfile(options.profile)) {
		return {
			status: 'invalid_config',
			reason: `unsupported profile: ${String(options.profile)}`,
		}
	}
	if (
		typeof options.expectedFingerprint !== 'string' ||
		options.expectedFingerprint.length === 0
	) {
		return {
			status: 'invalid_config',
			reason: 'expectedFingerprint must be a non-empty string',
		}
	}
	if (!isSupportedGenerationVersion(options.generationVersion)) {
		return {
			status: 'invalid_config',
			reason:
				`unsupported generationVersion ${options.generationVersion}; ` +
				`expected ${GENERATION_VERSION_V2} or ${GENERATION_VERSION}`,
		}
	}
	if (options.generationVersion >= 3) {
		if (options.density === undefined) {
			return {
				status: 'invalid_config',
				reason: 'density is required for generationVersion 3',
			}
		}
		if (!isCampaignDensity(options.density)) {
			return {
				status: 'invalid_config',
				reason: `unsupported density: ${String(options.density)}`,
			}
		}
	}
	if (
		options.maxAttempts !== undefined &&
		(!Number.isInteger(options.maxAttempts) || options.maxAttempts <= 0)
	) {
		return {
			status: 'invalid_config',
			reason: 'maxAttempts must be a positive integer',
		}
	}

	const maxAttempts = options.maxAttempts ?? 80
	const density =
		options.generationVersion >= 3 ? options.density : undefined
	const stream = deriveStreamSeed(
		options.generationVersion,
		options.profile,
		options.seed,
		density,
	)

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const attemptSeed = (stream + attempt * 0x9e3779b9) >>> 0
		const { board } =
			options.generationVersion >= 3 && density !== undefined
				? createCandidateBoardGv3({
						profile: options.profile,
						density,
						attemptSeed,
					})
				: createCandidateBoard(options.profile, attemptSeed)
		const { fingerprint, canonical } = puzzleFingerprint(
			board,
			options.generationVersion,
		)
		if (fingerprint === options.expectedFingerprint) {
			return {
				status: 'ok',
				board: cloneBoard(board),
				attempts: attempt + 1,
				fingerprint,
				canonical,
			}
		}
	}

	return {
		status: 'not_found',
		reason: 'fingerprint_not_in_attempt_budget',
		attempts: maxAttempts,
	}
}
