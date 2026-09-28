/**
 * Generator identity / versioning contracts.
 */

/** Bump only on breaking generation algorithm / PRNG / fingerprint / play semantics. */
export const GENERATION_VERSION = 2 as const

/** Bump when provisional difficulty thresholds / profile ranges change. */
export const DIFFICULTY_PROFILE_VERSION = 1 as const

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
 * Derive a namespaced uint32 seed so the same user seed under different
 * profiles / generation versions walks independent candidate streams.
 */
export function deriveStreamSeed(
	generationVersion: number,
	profile: DifficultyProfile,
	requestedSeed: number,
): number {
	const profileCode =
		profile === 'EASY' ? 1 : profile === 'MEDIUM' ? 2 : profile === 'HARD' ? 3 : 4
	let x = requestedSeed | 0
	x = Math.imul(x ^ (generationVersion * 0x9e3779b9), 0x85ebca6b) >>> 0
	x = Math.imul(x ^ (profileCode * 0xc2b2ae35), 0x27d4eb2d) >>> 0
	x ^= x >>> 16
	return x >>> 0
}
