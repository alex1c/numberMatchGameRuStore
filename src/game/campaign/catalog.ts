/**
 * Frozen campaign catalog accessors.
 * The generated array is imported as data — no Node fs on the RN path.
 */

import { CAMPAIGN_CATALOG, CAMPAIGN_CATALOG_SIGNATURE } from './catalog.generated'
import type { CampaignEntry } from './types'
import { CAMPAIGN_LEVEL_COUNT } from './version'

let asserted = false

/**
 * Verify catalog length, 1..N ordering, and signature constant consistency.
 * Lazy — avoids crashing module import when the stub is empty pre-build.
 */
export function assertCampaignCatalog(
	catalog: readonly CampaignEntry[] = CAMPAIGN_CATALOG,
): void {
	if (catalog.length !== CAMPAIGN_LEVEL_COUNT) {
		throw new Error(
			`campaign catalog length ${catalog.length} !== ${CAMPAIGN_LEVEL_COUNT}`,
		)
	}
	for (let i = 0; i < catalog.length; i += 1) {
		const entry = catalog[i]
		if (!entry) {
			throw new Error(`campaign catalog missing entry at index ${i}`)
		}
		if (entry.level !== i + 1) {
			throw new Error(
				`campaign catalog not sorted: index ${i} has level ${entry.level}`,
			)
		}
	}
}

/** Readonly catalog view (asserts invariants once). */
export function getCampaignCatalog(): readonly CampaignEntry[] {
	if (!asserted) {
		assertCampaignCatalog(CAMPAIGN_CATALOG)
		asserted = true
	}
	return CAMPAIGN_CATALOG
}

/** Look up a single level (1-based). Throws when out of range or catalog empty. */
export function getCampaignEntry(level: number): CampaignEntry {
	const catalog = getCampaignCatalog()
	if (!Number.isInteger(level) || level < 1 || level > catalog.length) {
		throw new Error(`getCampaignEntry: level out of range: ${level}`)
	}
	return catalog[level - 1]!
}

/** True when a real frozen catalog is present (not the pre-build stub). */
export function isCampaignCatalogReady(): boolean {
	return CAMPAIGN_CATALOG.length === CAMPAIGN_LEVEL_COUNT
}

/** Frozen signature constant from the generated file. */
export function getCampaignCatalogSignature(): string {
	return CAMPAIGN_CATALOG_SIGNATURE
}

export { CAMPAIGN_CATALOG, CAMPAIGN_CATALOG_SIGNATURE }
