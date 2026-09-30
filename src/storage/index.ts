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
	PersistedSessionPurpose,
	PersistedSessionStatus,
	StorageAdapter,
} from './types'
export { PERSIST_SCHEMA_VERSION } from './types'

export { createDefaultRoot } from './defaults'

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
	validatePersistedRoot,
	parsePersistedRootJson,
} from './validate'
export type { ValidateResult } from './validate'

export { migrateToCurrent, migrateParsedOrDefault } from './migrate'

export { PersistWriteQueue } from './writeQueue'
export type { WriteQueueResult } from './writeQueue'

export {
	PersistRepository,
	validateSessionSemantics,
	buildActiveSession,
} from './repository'

export {
	parseStarBoard,
	repairStarBoard,
	starBoardFromRawOrRepair,
	PERSISTED_STAR_BOARD_LENGTH,
} from './starsPersist'

export { createMemoryAdapter, createFailingWriteAdapter } from './adapters/memory'
export { createAsyncStorageAdapter } from './adapters/asyncStorage'
