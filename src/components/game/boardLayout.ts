/**
 * Deterministic board cell sizing from measured viewport width.
 * Does not change puzzle width — only visual cell size.
 */

export interface BoardLayoutMetrics {
	readonly availableWidth: number
	readonly boardWidth: number
	readonly gap: number
	readonly cellSize: number
	readonly sideMargin: number
	readonly contentWidth: number
}

const GAP = 4
const MIN_CELL = 36
const MAX_CELL = 56

/**
 * Compute square cell size for `boardWidth` columns inside `availableWidth`.
 * Leaves symmetric leftover as side margins (no column drift).
 */
export function computeBoardLayout(
	availableWidth: number,
	boardWidth: number,
): BoardLayoutMetrics {
	const cols = Math.max(1, boardWidth)
	const width = Math.max(0, Math.floor(availableWidth))
	const gapsTotal = GAP * (cols - 1)
	const raw = Math.floor((width - gapsTotal) / cols)
	const cellSize = Math.max(MIN_CELL, Math.min(MAX_CELL, raw))
	const contentWidth = cellSize * cols + gapsTotal
	const sideMargin = Math.max(0, Math.floor((width - contentWidth) / 2))
	return {
		availableWidth: width,
		boardWidth: cols,
		gap: GAP,
		cellSize,
		sideMargin,
		contentWidth,
	}
}

/** Row count from linear length — removed cells still occupy geometry. */
export function boardRowCount(cellCount: number, boardWidth: number): number {
	if (cellCount <= 0 || boardWidth <= 0) {
		return 0
	}
	return Math.ceil(cellCount / boardWidth)
}
