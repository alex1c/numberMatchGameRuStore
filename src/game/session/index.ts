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

export { createGameSession, hydrateGameSession, reduceGameSession } from './reducer'

export {
	APPEND_PULSE_REPETITIONS,
	hintOutcomeFromSolveResult,
	immediateHintIfStuck,
	nowMs,
	scheduleAfterPaint,
	shouldStartAppendPulse,
} from './hintRequest'
export type { HintKind, HintOutcome } from './hintRequest'

export { GameSessionProvider, useGameSession } from './GameSessionContext'
export {
	createMonotonicId,
	isTransitionTokenCurrent,
} from './attemptIdentity'
export type {
	AttemptScopedToken,
	ScreenScopedToken,
	TransitionToken,
} from './attemptIdentity'

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
