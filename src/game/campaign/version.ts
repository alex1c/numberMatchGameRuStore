/**
 * Campaign catalog identity — bump CAMPAIGN_VERSION when catalog semantics change.
 */

/** Historical Campaign v1 (gv2, no density) — archived, not used at runtime. */
export const CAMPAIGN_VERSION_V1 = 1 as const

/** Frozen campaign content version shipped with the app (gv3 + density). */
export const CAMPAIGN_VERSION = 2 as const

/** Fixed campaign width for first release. */
export const CAMPAIGN_LEVEL_COUNT = 1000 as const
