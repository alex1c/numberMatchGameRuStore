/**
 * Number Match generator public API (PHASE 3).
 */

export {
	GENERATION_VERSION,
	DIFFICULTY_PROFILE_VERSION,
	DIFFICULTY_PROFILES,
	deriveStreamSeed,
	isDifficultyProfile,
} from './version'
export type { DifficultyProfile } from './version'

export {
	createPrng,
	normalizeSeed,
	shuffleInPlace,
} from './prng'
export type { SeededPrng } from './prng'

export {
	fingerprintFromCanonical,
	puzzleCanonical,
	puzzleFingerprint,
} from './fingerprint'

export { createCandidateBoard, shapeForProfile } from './candidate'

export {
	GENERATION_SOLVER_CONFIG,
	PROFILE_RANGES,
	computeDifficultyScore,
	metricsMatchProfile,
} from './profiles'

export { analyzeDifficulty } from './metrics'
export { generatePuzzle, validateGenerateOptions } from './generate'
export {
	runAudit,
	defaultFullTargets,
	default400Targets,
	defaultSmallTargets,
	auditFingerprintSignature,
	median,
	percentile,
} from './audit'
export type {
	AuditOptions,
	AuditProfileTarget,
	AuditReport,
	ProfileAuditStats,
} from './audit'

export { findNearDuplicates } from './nearDuplicate'

export { getTutorialCandidates } from './tutorialCandidates'
export type { TutorialCandidate } from './tutorialCandidates'

export { REPRESENTATIVE_UI_SEEDS } from './representativeSeeds'
export type { RepresentativeSeed } from './representativeSeeds'

export type {
	AcceptedPuzzle,
	CandidateShape,
	DeadEndMetrics,
	DifficultyMetrics,
	GeneratePuzzleOptions,
	GeneratePuzzleResult,
	GeneratorSolverConfig,
	PuzzleIdentity,
	RejectionReason,
} from './types'
