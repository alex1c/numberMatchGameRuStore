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
	StartDailyPuzzleResult,
	DailySummary,
} from './AppStateProvider'

export {
	campaignIdentity,
	dailyIdentity,
	prepareCampaignLevel,
	gameSessionFromPersisted,
	gameSessionFromPersistedDaily,
	frontierLevel,
	isLevelUnlocked,
} from './campaignSession'
export type { AchievementNotifyContext } from './achievementsNotify'
export { evaluateAchievementUnlocks } from './achievementsNotify'
export type { CampaignStartResult } from './campaignSession'
