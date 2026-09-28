/**
 * Domain types for Number Match game core.
 * Pure TypeScript — no React, React Native, ads, analytics, or persistence SDKs.
 */

/** Legal digit on a Number Match board. */
export type CellValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Stable cell identity — never reuse after append creates new cells. */
export type CellId = string

/** Zero-based board coordinate derived from a linear index and board width. */
export interface Coordinate {
	readonly row: number
	readonly col: number
}

/**
 * One board cell.
 * Removed cells stay in place within a row until that row is fully empty;
 * fully empty complete rows are then collapsed by `collapseEmptyRows`.
 * Values on removed cells are kept for debugging/history.
 */
export interface Cell {
	readonly id: CellId
	readonly value: CellValue
	readonly removed: boolean
}

/**
 * Immutable board state.
 * `width` is the single source of truth for row/column geometry.
 * `nextCellSeq` allocates unique IDs for appended cells.
 */
export interface BoardState {
	readonly width: number
	readonly cells: readonly Cell[]
	readonly nextCellSeq: number
}

/**
 * A legal match pair expressed as ascending linear indices (aIndex < bIndex).
 * Ordering is deterministic for enumeration and future solver use.
 */
export interface Move {
	readonly aIndex: number
	readonly bIndex: number
}

/** Why a proposed match is rejected (normal gameplay outcomes, not exceptions). */
export type MatchFailureReason =
	| 'same_cell'
	| 'out_of_range'
	| 'removed'
	| 'incompatible_values'
	| 'not_connectable'

export type MatchCheckResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: MatchFailureReason }

/** Result of attempting to remove a pair — invalid moves never mutate. */
export type RemovePairResult =
	| { readonly ok: true; readonly state: BoardState }
	| {
			readonly ok: false
			readonly reason: MatchFailureReason
			readonly state: BoardState
	  }

export type BoardValidationResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: string }

/** How two positions were connected when a match is legal. */
export type ConnectionKind =
	| 'horizontal'
	| 'vertical'
	| 'diagonal'
	| 'linear'
