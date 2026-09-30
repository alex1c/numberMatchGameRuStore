/**
 * Resolve a campaign level into a playable board via reconstruct + fingerprint check.
 */

import { GENERATION_VERSION, reconstructGeneratedPuzzle } from '../generator'
import type { BoardState } from '../core'
import { getCampaignEntry, isCampaignCatalogReady } from './catalog'
import type { CampaignEntry } from './types'

export type ResolveCampaignLevelResult =
	| {
			readonly status: 'ok'
			readonly entry: CampaignEntry
			readonly board: BoardState
			readonly fingerprint: string
			readonly canonical: string
			readonly attempts: number
	  }
	| {
			readonly status: 'error'
			readonly reason: string
			readonly entry?: CampaignEntry
	  }

/**
 * Reconstruct the board for a campaign level and verify fingerprint identity.
 */
export function resolveCampaignLevel(
	level: number,
): ResolveCampaignLevelResult {
	if (!isCampaignCatalogReady()) {
		return { status: 'error', reason: 'campaign_catalog_not_ready' }
	}

	let entry: CampaignEntry
	try {
		entry = getCampaignEntry(level)
	} catch (err) {
		return {
			status: 'error',
			reason: err instanceof Error ? err.message : 'invalid_level',
		}
	}

	const reconstructed = reconstructGeneratedPuzzle({
		generationVersion: GENERATION_VERSION,
		seed: entry.seed,
		profile: entry.profile,
		density: entry.density,
		expectedFingerprint: entry.fingerprint,
	})

	if (reconstructed.status === 'invalid_config') {
		return {
			status: 'error',
			reason: reconstructed.reason,
			entry,
		}
	}
	if (reconstructed.status === 'not_found') {
		return {
			status: 'error',
			reason: 'fingerprint_mismatch_on_reconstruct',
			entry,
		}
	}

	if (reconstructed.fingerprint !== entry.fingerprint) {
		return {
			status: 'error',
			reason: 'fingerprint_mismatch',
			entry,
		}
	}

	return {
		status: 'ok',
		entry,
		board: reconstructed.board,
		fingerprint: reconstructed.fingerprint,
		canonical: reconstructed.canonical,
		attempts: reconstructed.attempts,
	}
}
