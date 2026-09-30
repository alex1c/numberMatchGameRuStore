/**
 * Number Match generator public API (PHASE 3 / gv3).
 */

export {
	GENERATION_VERSION,
	GENERATION_VERSION_V2,
	DIFFICULTY_PROFILE_VERSION,
	DIFFICULTY_PROFILE_VERSION_V1,
	DIFFICULTY_PROFILES,
	deriveStreamSeed,
	isDifficultyProfile,
	isSupportedGenerationVersion,
} from './version'
export type { DifficultyProfile } from './version'

export {
	CAMPAIGN_BOARD_WIDTH,
	CAMPAIGN_DENSITIES,
	densityInitialCells,
	isCampaignDensity,
} from './density'
export type { CampaignDensity } from './density'

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

export {
	createCandidateBoard,
	createCandidateBoardGv3,
	openingPairsForProfileGv3,
	shapeForProfile,
} from './candidate'

export {
	GENERATION_SOLVER_CONFIG,
	PROFILE_RANGES,
	PROFILE_RANGES_GV3,
	PROFILE_RANGES_V2,
	computeDifficultyScore,
	computeDifficultyScoreV2,
	metricsMatchProfile,
	rangesForProfileVersion,
} from './profiles'

export { analyzeDifficulty } from './metrics'
export { generatePuzzle, validateGenerateOptions } from './generate'
export { reconstructGeneratedPuzzle } from './reconstruct'
export type {
	ReconstructGeneratedPuzzleOptions,
	ReconstructGeneratedPuzzleResult,
} from './reconstruct'
export {
	runAudit,
	defaultFullTargets,
	default400Targets,
	defaultSmallTargets,
	defaultGv3AuditTargets,
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
