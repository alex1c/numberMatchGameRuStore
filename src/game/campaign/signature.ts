/**
 * Deterministic campaign catalog signature (portable FNV-1a, no Node crypto).
 */

import type { CampaignEntry } from './types'

/** Compact ordered payload used for signature hashing. */
export function campaignEntrySignaturePart(entry: CampaignEntry): string {
	return `${entry.level}|${entry.seed}|${entry.profile}|${entry.fingerprint}`
}

/**
 * Stable signature over the full ordered catalog.
 * Same entries in the same order always produce the same hex string.
 */
export function computeCampaignSignature(
	entries: readonly CampaignEntry[],
): string {
	const body = entries.map(campaignEntrySignaturePart).join(';')
	let hash = 0x811c9dc5
	for (let i = 0; i < body.length; i += 1) {
		hash ^= body.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	return `cs${hash.toString(16).padStart(8, '0')}`
}
