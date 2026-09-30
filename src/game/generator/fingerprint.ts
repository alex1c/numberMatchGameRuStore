/**
 * Canonical fingerprint for catalog duplicate detection.
 * Portable — no Node crypto. Hash is a bucket aid; equality uses canonical.
 */

import { toCanonicalBoard, type BoardState } from '../core'
import { GENERATION_VERSION } from './version'

/** Full canonical puzzle body used for exact duplicate detection. */
export function puzzleCanonical(
	board: BoardState,
	generationVersion: number = GENERATION_VERSION,
): string {
	return `gv${generationVersion}|${toCanonicalBoard(board)}`
}

/**
 * Compact FNV-1a 32-bit hex over the canonical string.
 * Collisions possible — always confirm with canonical equality.
 */
export function fingerprintFromCanonical(canonical: string): string {
	let hash = 0x811c9dc5
	for (let i = 0; i < canonical.length; i += 1) {
		hash ^= canonical.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	return `f${hash.toString(16).padStart(8, '0')}`
}

export function puzzleFingerprint(
	board: BoardState,
	generationVersion: number = GENERATION_VERSION,
): {
	readonly canonical: string
	readonly fingerprint: string
} {
	const canonical = puzzleCanonical(board, generationVersion)
	return { canonical, fingerprint: fingerprintFromCanonical(canonical) }
}
