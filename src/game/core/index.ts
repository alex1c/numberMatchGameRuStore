/**
 * Number Match pure game core — public API.
 *
 * Layer rules:
 * - No React / React Native / navigation / AsyncStorage
 * - No ads, AppMetrica, rewards, coins, campaign, Daily, RuStore
 * - Immutable state transitions for safe PHASE 2 solver branching
 * - No-moves ≠ game-over (append is a product-layer decision)
 */

export type {
	BoardState,
	BoardValidationResult,
	Cell,
	CellId,
	CellValue,
	ConnectionKind,
	Coordinate,
	MatchCheckResult,
	MatchFailureReason,
	Move,
	RemovePairResult,
} from './types'

export {
	areValuesMatchable,
	isCellValue,
} from './values'

export {
	coordinateToIndex,
	indexToCoordinate,
	isValidCoordinate,
	isValidIndex,
} from './coordinates'

export {
	arePositionsConnectable,
	getConnectionKinds,
	isDiagonalClear,
	isHorizontalClear,
	isLinearClear,
	isVerticalClear,
} from './geometry'

export {
	cloneBoard,
	countActiveCells,
	createBoard,
	getActiveIndices,
	getActiveValues,
	getCell,
	isBoardCleared,
	makeCellId,
	validateBoard,
} from './board'

export {
	canMatch,
	explainMatch,
} from './match'

export {
	getAvailableMoves,
	hasAvailableMoves,
	removePair,
} from './moves'

export { appendRemainingNumbers } from './append'

export {
	toCanonicalBoard,
	toSerializableBoard,
} from './serialize'

// Fixtures are exported for tests / PHASE 2 solver harnesses only.
export {
	boardFromFixture,
	boardToFixture,
} from './fixtures'
export type { FixtureToken } from './fixtures'
