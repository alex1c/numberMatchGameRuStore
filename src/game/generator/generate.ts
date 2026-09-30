/**
 * Deterministic puzzle generation pipeline.
 *
 * seed → namespaced stream → candidates → solve → replay → metrics → guards → profile
 */

import { cloneBoard, validateBoard } from '../core'
import { replaySolution, solveBoard } from '../solver'
import {
	createCandidateBoard,
	createCandidateBoardGv3,
} from './candidate'
import { isCampaignDensity, type CampaignDensity } from './density'
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
	DIFFICULTY_PROFILE_VERSION_V1,
	GENERATION_VERSION,
	GENERATION_VERSION_V2,
	deriveStreamSeed,
	isDifficultyProfile,
	isSupportedGenerationVersion,
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

function resolveGenerationVersion(
	options: GeneratePuzzleOptions,
): typeof GENERATION_VERSION | typeof GENERATION_VERSION_V2 {
	return options.generationVersion ?? GENERATION_VERSION
}

function resolveDifficultyProfileVersion(
	generationVersion: number,
): number {
	return generationVersion >= 3
		? DIFFICULTY_PROFILE_VERSION
		: DIFFICULTY_PROFILE_VERSION_V1
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
	const generationVersion = resolveGenerationVersion(options)
	if (!isSupportedGenerationVersion(generationVersion)) {
		return `unsupported generationVersion: ${generationVersion}`
	}
	if (generationVersion >= 3) {
		if (options.density === undefined) {
			return 'density is required for generationVersion 3'
		}
		if (!isCampaignDensity(options.density)) {
			return `unsupported density: ${String(options.density)}`
		}
	}
	return null
}

/**
 * Generate one accepted puzzle for a profile, or a typed failure.
 * Fully deterministic for the same options + known-duplicate sets.
 *
 * Default generationVersion is 3 (requires density). Pass generationVersion: 2
 * for the historical gv2 sparse-board path (density ignored).
 */
export function generatePuzzle(
	options: GeneratePuzzleOptions,
): GeneratePuzzleResult {
	const configError = validateGenerateOptions(options)
	if (configError) {
		return { status: 'invalid_config', reason: configError }
	}

	const generationVersion = resolveGenerationVersion(options)
	const difficultyProfileVersion =
		resolveDifficultyProfileVersion(generationVersion)
	const density: CampaignDensity | undefined =
		generationVersion >= 3 ? options.density : undefined

	const maxAttempts = options.maxCandidateAttempts ?? 80
	const solverConfig = resolveSolverConfig(options.solver)
	const stream = deriveStreamSeed(
		generationVersion,
		options.profile,
		options.seed,
		density,
	)

	const rejectionCounts: Record<string, number> = {}
	let lastSolverStatus: string | undefined
	const knownFingerprints = options.knownFingerprints ?? new Set<string>()
	const knownCanonicals = options.knownCanonicals ?? new Set<string>()

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const attemptSeed = (stream + attempt * 0x9e3779b9) >>> 0
		const { board } =
			generationVersion >= 3 && density !== undefined
				? createCandidateBoardGv3({
						profile: options.profile,
						density,
						attemptSeed,
					})
				: createCandidateBoard(options.profile, attemptSeed)

		const structural = runStructuralGuards(
			board,
			options.profile,
			difficultyProfileVersion,
		)
		if (!structural.ok) {
			bump(rejectionCounts, structural.reason ?? 'invalid_candidate')
			continue
		}

		const validation = validateBoard(board)
		if (!validation.ok) {
			bump(rejectionCounts, 'invalid_candidate')
			continue
		}

		const { canonical, fingerprint } = puzzleFingerprint(
			board,
			generationVersion,
		)
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
			{
				deadEndAnalysis: options.deadEndAnalysis === true,
				difficultyProfileVersion,
			},
		)

		const post = runPostSolveGuards(
			metrics,
			options.profile,
			difficultyProfileVersion,
		)
		if (!post.ok) {
			bump(rejectionCounts, post.reason ?? 'profile_mismatch')
			continue
		}

		const profileOk = metricsMatchProfile(
			metrics,
			options.profile,
			difficultyProfileVersion,
		)
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
					generationVersion,
					difficultyProfileVersion,
					seed: options.seed,
					profile: options.profile,
					fingerprint,
					canonical,
					...(density !== undefined ? { density } : {}),
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
