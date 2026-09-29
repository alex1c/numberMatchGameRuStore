/**
 * Reconstruct a previously generated puzzle from seed + profile + fingerprint.
 *
 * Replays the same candidate stream as generatePuzzle, but NEVER calls the
 * solver. Catalog / persistence restore must stay cheap and deterministic.
 */

import { cloneBoard, type BoardState } from '../core'
import { createCandidateBoard } from './candidate'
import { puzzleFingerprint } from './fingerprint'
import type { DifficultyProfile } from './version'
import {
	GENERATION_VERSION,
	deriveStreamSeed,
	isDifficultyProfile,
} from './version'

export interface ReconstructGeneratedPuzzleOptions {
	readonly generationVersion: number
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly expectedFingerprint: string
	readonly maxAttempts?: number
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
	if (options.generationVersion !== GENERATION_VERSION) {
		return {
			status: 'invalid_config',
			reason:
				`unsupported generationVersion ${options.generationVersion}; ` +
				`expected ${GENERATION_VERSION}`,
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
	const stream = deriveStreamSeed(
		options.generationVersion,
		options.profile,
		options.seed,
	)

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const attemptSeed = (stream + attempt * 0x9e3779b9) >>> 0
		const { board } = createCandidateBoard(options.profile, attemptSeed)
		const { fingerprint, canonical } = puzzleFingerprint(board)
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
