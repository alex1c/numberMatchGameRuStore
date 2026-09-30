/**
 * Campaign density — fixed board width 8, variable initial row count.
 * Independent of difficulty profile (EASY can exist on any density).
 */

/** Rows at width 8 — production campaign densities. */
export type CampaignDensity = 7 | 8 | 9 | 10

export const CAMPAIGN_DENSITIES: readonly CampaignDensity[] = [
	7, 8, 9, 10,
] as const

export const CAMPAIGN_BOARD_WIDTH = 8 as const

/** initialCells = density * width (8). */
export function densityInitialCells(rows: CampaignDensity): number {
	return rows * CAMPAIGN_BOARD_WIDTH
}

export function isCampaignDensity(value: number): value is CampaignDensity {
	return value === 7 || value === 8 || value === 9 || value === 10
}
