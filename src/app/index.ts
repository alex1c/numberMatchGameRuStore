/**
 * App-layer public exports (PHASE 5).
 */

export {
	AppStateProvider,
	useAppState,
	formatDevDiagnostics,
} from './AppStateProvider'
export type {
	HydrateStatus,
	SessionLaunchSource,
	StartCampaignLevelResult,
} from './AppStateProvider'

export {
	campaignIdentity,
	prepareCampaignLevel,
	gameSessionFromPersisted,
	frontierLevel,
	isLevelUnlocked,
} from './campaignSession'
export type { CampaignStartResult } from './campaignSession'
