/**
 * Generator identity / versioning contracts.
 */

/**
 * Historical generation algorithm used by Campaign v1 / reconstruct of
 * pre-density catalogs. Kept exported so gv2 reconstruct stays available.
 */
export const GENERATION_VERSION_V2 = 2 as const

/** Current production generation — fixed width 8 + CampaignDensity rows. */
export const GENERATION_VERSION = 3 as const

/** Profile ranges that gate on cell count (gv2 sparse boards). */
export const DIFFICULTY_PROFILE_VERSION_V1 = 1 as const

/**
 * Density-independent profile ranges (gv3).
 * Score formula also changes — see computeDifficultyScoreV2.
 */
export const DIFFICULTY_PROFILE_VERSION = 2 as const

export type DifficultyProfile = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'

export const DIFFICULTY_PROFILES: readonly DifficultyProfile[] = [
	'EASY',
	'MEDIUM',
	'HARD',
	'EXPERT',
] as const

export function isDifficultyProfile(value: string): value is DifficultyProfile {
	return (
		value === 'EASY' ||
		value === 'MEDIUM' ||
		value === 'HARD' ||
		value === 'EXPERT'
	)
}

/**
 * Supported generation versions for generate / reconstruct paths.
 */
export function isSupportedGenerationVersion(
	value: number,
): value is typeof GENERATION_VERSION | typeof GENERATION_VERSION_V2 {
	return value === GENERATION_VERSION || value === GENERATION_VERSION_V2
}

/**
 * Derive a namespaced uint32 seed so the same user seed under different
 * profiles / generation versions / densities walks independent streams.
 */
export function deriveStreamSeed(
	generationVersion: number,
	profile: DifficultyProfile,
	requestedSeed: number,
	density?: number,
): number {
	const profileCode =
		profile === 'EASY' ? 1 : profile === 'MEDIUM' ? 2 : profile === 'HARD' ? 3 : 4
	let x = requestedSeed | 0
	x = Math.imul(x ^ (generationVersion * 0x9e3779b9), 0x85ebca6b) >>> 0
	x = Math.imul(x ^ (profileCode * 0xc2b2ae35), 0x27d4eb2d) >>> 0
	if (density !== undefined) {
		// Namespace by density so 8×7 and 8×10 never share a candidate stream.
		x = Math.imul(x ^ (density * 0xa5b1c2d3), 0x165667b1) >>> 0
	}
	x ^= x >>> 16
	return x >>> 0
}
