/**
 * Persistence module public API (PHASE 5).
 */

export { STORAGE_KEY, STORAGE_KEYS, PERSIST_HISTORY_BOUND } from './types'
export type {
	GamePersistencePort,
	PersistedActiveSession,
	PersistedBoardV1,
	PersistedCellV1,
	PersistedCountersV1,
	PersistedGameEnvelopeV1,
	PersistedRoot,
	PersistedRootV1,
	PersistedRootV2,
	PersistedRootV3,
	PersistedSessionPurpose,
	PersistedSessionStatus,
	PersistedSettings,
	PersistedStatistics,
	StorageAdapter,
	ThemePreference,
} from './types'
export { PERSIST_SCHEMA_VERSION } from './types'

export {
	createDefaultRoot,
	createDefaultSettings,
	createDefaultStatistics,
} from './defaults'

export {
	serializeBoard,
	deserializeBoard,
	boundHistory,
	cloneRoot,
	cloneActiveSession,
	sessionBoards,
	roundTripBoard,
} from './serialize'

export {
	validatePersistedBoard,
	validateActiveSession,
	validateDailyActiveSession,
	validateDailyState,
	validatePersistedRoot,
	validatePersistedRootV2,
	parsePersistedRootJson,
} from './validate'
export type { ValidateResult } from './validate'

export {
	migrateToCurrent,
	migrateParsedOrDefault,
	migrateRootV2ToV3,
} from './migrate'

export { PersistWriteQueue } from './writeQueue'
export type { WriteQueueResult } from './writeQueue'

export {
	PersistRepository,
	validateSessionSemantics,
	buildActiveSession,
	buildDailyActiveSession,
} from './repository'

export {
	parseStarBoard,
	repairStarBoard,
	starBoardFromRawOrRepair,
	PERSISTED_STAR_BOARD_LENGTH,
} from './starsPersist'

export { createMemoryAdapter, createFailingWriteAdapter } from './adapters/memory'
export { createAsyncStorageAdapter } from './adapters/asyncStorage'
