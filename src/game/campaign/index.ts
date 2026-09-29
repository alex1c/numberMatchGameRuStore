/**
 * Campaign module public API (PHASE 5).
 * Builder / audit CLIs are Node entrypoints — not re-exported here for RN.
 */

export { CAMPAIGN_VERSION, CAMPAIGN_LEVEL_COUNT } from './version'
export type { CampaignEntry, CampaignLearningRole } from './types'

export {
	campaignEntrySignaturePart,
	computeCampaignSignature,
} from './signature'

export {
	profileForLevel,
	countProfilesInCampaign,
	maxExpertStreak,
} from './rhythm'

export {
	assertCampaignCatalog,
	getCampaignCatalog,
	getCampaignEntry,
	isCampaignCatalogReady,
	getCampaignCatalogSignature,
	CAMPAIGN_CATALOG,
	CAMPAIGN_CATALOG_SIGNATURE,
} from './catalog'

export { resolveCampaignLevel } from './resolve'
export type { ResolveCampaignLevelResult } from './resolve'

export {
	auditCampaignCatalog,
	formatAuditReport,
} from './audit'
export type { CampaignAuditOptions, CampaignAuditReport } from './audit'
