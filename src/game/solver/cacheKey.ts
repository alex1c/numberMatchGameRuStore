/**
 * Solver transposition / visited cache key.
 *
 * Mathematical board equality uses `toCanonicalBoard` (width + values/removed).
 * Cell IDs and `nextCellSeq` are ignored: append may assign different IDs, but
 * future legal transitions depend only on geometry/content + remaining appends.
 *
 * Remaining append allowance is part of the key because the same board with
 * 0 vs N appends left has different reachable futures.
 */

import { toCanonicalBoard, type BoardState } from '../core'

export function solverCacheKey(
	board: BoardState,
	appendsRemaining: number,
): string {
	return `${toCanonicalBoard(board)}|ar${appendsRemaining}`
}
