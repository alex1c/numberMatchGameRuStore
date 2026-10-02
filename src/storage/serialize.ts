/**
 * Board / root serialization helpers (pure, no I/O).
 */

import {
	cloneBoard,
	type BoardState,
	type Cell,
	type CellValue,
} from '../game/core'
import type {
	PersistedActiveSession,
	PersistedBoardV1,
	PersistedRootV3,
} from './types'
import { PERSIST_HISTORY_BOUND } from './types'

/** BoardState → JSON-friendly snapshot. */
export function serializeBoard(board: BoardState): PersistedBoardV1 {
	return {
		width: board.width,
		nextCellSeq: board.nextCellSeq,
		cells: board.cells.map((cell) => ({
			id: cell.id,
			value: cell.value,
			removed: cell.removed,
		})),
	}
}

/** Persisted board → runtime BoardState clone. */
export function deserializeBoard(persisted: PersistedBoardV1): BoardState {
	const cells: Cell[] = persisted.cells.map((cell) => ({
		id: cell.id,
		value: cell.value as CellValue,
		removed: cell.removed,
	}))
	return {
		width: persisted.width,
		nextCellSeq: persisted.nextCellSeq,
		cells,
	}
}

/** Bound history length for persistence (drop oldest). */
export function boundHistory(
	history: readonly PersistedBoardV1[],
	bound: number = PERSIST_HISTORY_BOUND,
): readonly PersistedBoardV1[] {
	if (history.length <= bound) {
		return history
	}
	return history.slice(history.length - bound)
}

/** Deep-clone a root document for safe mutation outside the write queue. */
export function cloneRoot(root: PersistedRootV3): PersistedRootV3 {
	return JSON.parse(JSON.stringify(root)) as PersistedRootV3
}

/** Clone an active session with board clones. */
export function cloneActiveSession(
	session: PersistedActiveSession,
): PersistedActiveSession {
	return JSON.parse(JSON.stringify(session)) as PersistedActiveSession
}

/** Convenience: runtime boards on a session for gameplay hydrate. */
export function sessionBoards(session: PersistedActiveSession): {
	readonly board: BoardState
	readonly initialBoard: BoardState | null
	readonly history: readonly BoardState[]
} {
	return {
		board: deserializeBoard(session.board),
		initialBoard: session.initialBoard
			? deserializeBoard(session.initialBoard)
			: null,
		history: session.history.map(deserializeBoard),
	}
}

/** Round-trip helper used by tests. */
export function roundTripBoard(board: BoardState): BoardState {
	return cloneBoard(deserializeBoard(serializeBoard(board)))
}
