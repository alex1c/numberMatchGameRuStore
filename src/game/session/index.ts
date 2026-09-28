/**
 * Session module public exports.
 */

export {
	HISTORY_BOUND,
	type GameSessionAction,
	type GameSessionState,
	type SessionCounters,
	type SessionPuzzleIdentity,
} from './types'

export { createGameSession, reduceGameSession } from './reducer'

export { GameSessionProvider, useGameSession } from './GameSessionContext'

export {
	DEV_EXTENDED_FIXTURES,
	PLAYTEST_PROFILE_FIXTURES,
	buildClearedBoard,
	buildCompletionBoard,
	buildInvalidSelectionBoard,
	buildLargeLayoutBoard,
	buildPartialRemovedBoard,
	buildPartialRowBoard,
	buildPhysicalGapBoard,
	loadPlaytestFixture,
	representativeAsDevFixtures,
	type LoadFixtureResult,
	type PlaytestFixture,
} from './fixtures'
