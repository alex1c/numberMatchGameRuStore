/**
 * Deterministic puzzle generation pipeline.
 *
 * seed → namespaced stream → candidates → solve → replay → metrics → guards → profile
 */

import { cloneBoard, validateBoard } from '../core'
import { replaySolution, solveBoard } from '../solver'
import { createCandidateBoard } from './candidate'
import { puzzleFingerprint } from './fingerprint'
import { runPostSolveGuards, runStructuralGuards } from './guards'
import { analyzeDifficulty } from './metrics'
import {
	GENERATION_SOLVER_CONFIG,
	metricsMatchProfile,
} from './profiles'
import type {
	GeneratePuzzleOptions,
	GeneratePuzzleResult,
	GeneratorSolverConfig,
	RejectionReason,
} from './types'
import {
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
	deriveStreamSeed,
	isDifficultyProfile,
} from './version'

function bump(
	counts: Record<string, number>,
	reason: RejectionReason,
): void {
	counts[reason] = (counts[reason] ?? 0) + 1
}

function resolveSolverConfig(
	partial?: Partial<GeneratorSolverConfig>,
): GeneratorSolverConfig {
	return {
		appendPolicy: partial?.appendPolicy ?? GENERATION_SOLVER_CONFIG.appendPolicy,
		maxAppends: partial?.maxAppends ?? GENERATION_SOLVER_CONFIG.maxAppends,
		maxStates: partial?.maxStates ?? GENERATION_SOLVER_CONFIG.maxStates,
		maxDepth: partial?.maxDepth ?? GENERATION_SOLVER_CONFIG.maxDepth,
	}
}

export function validateGenerateOptions(
	options: GeneratePuzzleOptions,
): string | null {
	if (!Number.isFinite(options.seed)) {
		return 'seed must be finite'
	}
	if (!isDifficultyProfile(options.profile)) {
		return `unsupported profile: ${String(options.profile)}`
	}
	if (
		options.maxCandidateAttempts !== undefined &&
		(!Number.isInteger(options.maxCandidateAttempts) ||
			options.maxCandidateAttempts <= 0)
	) {
		return 'maxCandidateAttempts must be a positive integer'
	}
	return null
}

/**
 * Generate one accepted puzzle for a profile, or a typed failure.
 * Fully deterministic for the same options + known-duplicate sets.
 */
export function generatePuzzle(
	options: GeneratePuzzleOptions,
): GeneratePuzzleResult {
	const configError = validateGenerateOptions(options)
	if (configError) {
		return { status: 'invalid_config', reason: configError }
	}

	const maxAttempts = options.maxCandidateAttempts ?? 80
	const solverConfig = resolveSolverConfig(options.solver)
	const stream = deriveStreamSeed(
		GENERATION_VERSION,
		options.profile,
		options.seed,
	)

	const rejectionCounts: Record<string, number> = {}
	let lastSolverStatus: string | undefined
	const knownFingerprints = options.knownFingerprints ?? new Set<string>()
	const knownCanonicals = options.knownCanonicals ?? new Set<string>()

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const attemptSeed = (stream + attempt * 0x9e3779b9) >>> 0
		const { board } = createCandidateBoard(options.profile, attemptSeed)
		const structural = runStructuralGuards(board, options.profile)
		if (!structural.ok) {
			bump(rejectionCounts, structural.reason ?? 'invalid_candidate')
			continue
		}

		const validation = validateBoard(board)
		if (!validation.ok) {
			bump(rejectionCounts, 'invalid_candidate')
			continue
		}

		const { canonical, fingerprint } = puzzleFingerprint(board)
		if (
			knownFingerprints.has(fingerprint) ||
			knownCanonicals.has(canonical)
		) {
			// Confirm canonical before treating as duplicate when hash hits.
			if (knownCanonicals.has(canonical)) {
				bump(rejectionCounts, 'duplicate')
				continue
			}
			// Hash collision bucket without canonical match — not a duplicate.
		}

		const solved = solveBoard(board, {
			appendPolicy: solverConfig.appendPolicy,
			maxAppends: solverConfig.maxAppends,
			maxStates: solverConfig.maxStates,
			maxDepth: solverConfig.maxDepth,
		})
		lastSolverStatus = solved.status

		if (solved.status === 'cutoff') {
			bump(rejectionCounts, 'solver_cutoff')
			continue
		}
		if (solved.status === 'unsolvable') {
			bump(rejectionCounts, 'solver_unsolvable')
			continue
		}
		if (solved.status === 'invalid') {
			bump(rejectionCounts, 'solver_invalid')
			continue
		}
		if (solved.status !== 'solved') {
			bump(rejectionCounts, 'solver_unsolvable')
			continue
		}

		const replay = replaySolution(board, solved.path)
		if (!replay.ok) {
			bump(rejectionCounts, 'replay_failed')
			continue
		}

		const metrics = analyzeDifficulty(
			board,
			solved.path,
			solved.stats,
			solverConfig,
			{ deadEndAnalysis: options.deadEndAnalysis === true },
		)

		const post = runPostSolveGuards(metrics, options.profile)
		if (!post.ok) {
			bump(rejectionCounts, post.reason ?? 'profile_mismatch')
			continue
		}

		const profileOk = metricsMatchProfile(metrics, options.profile)
		if (!profileOk.ok) {
			bump(rejectionCounts, 'profile_mismatch')
			continue
		}

		// Final duplicate check with canonical confirmation.
		if (knownCanonicals.has(canonical)) {
			bump(rejectionCounts, 'duplicate')
			continue
		}

		const immutableBoard = cloneBoard(board)
		const values = immutableBoard.cells.map((c) => c.value)

		return {
			status: 'accepted',
			attempts: attempt + 1,
			rejectionCounts,
			puzzle: {
				identity: {
					generationVersion: GENERATION_VERSION,
					difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION,
					seed: options.seed,
					profile: options.profile,
					fingerprint,
					canonical,
				},
				board: immutableBoard,
				values,
				width: immutableBoard.width,
				path: solved.path,
				metrics,
				solverStats: solved.stats,
			},
		}
	}

	return {
		status: 'exhausted',
		reason: 'attempt_budget_exhausted',
		attempts: maxAttempts,
		rejectionCounts,
		requestedSeed: options.seed,
		profile: options.profile,
		lastSolverStatus,
	}
}
