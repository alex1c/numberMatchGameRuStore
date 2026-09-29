/**
 * Approximate board-vs-viewport fill metrics for Density Lab diagnostics.
 * Pure layout math — not a difficulty score.
 */

import {
	boardRowCount,
	computeBoardLayout,
} from '../../components/game/boardLayout'

export interface ViewportFillInput {
	/** Measured ScrollView / board viewport height (dp). */
	readonly viewportHeight: number
	/** Measured content width available to the board (dp). */
	readonly availableWidth: number
	readonly boardWidth: number
	readonly cellCount: number
	/** Vertical gap between rows — matches NumberBoard row gap. */
	readonly rowGap?: number
}

export interface ViewportFillMetrics {
	readonly cellSize: number
	readonly gap: number
	readonly sideMargin: number
	readonly contentWidth: number
	readonly rowCount: number
	readonly boardHeight: number
	readonly viewportHeight: number
	/** boardHeight / viewportHeight — visual occupancy heuristic. */
	readonly viewportFillRatio: number
	readonly viewportFillPercent: number
}

/**
 * Estimate initial rendered board height and fill ratio.
 * Uses the same cell sizing formula as production NumberBoard.
 */
export function computeViewportFill(
	input: ViewportFillInput,
): ViewportFillMetrics {
	const rowGap = input.rowGap ?? 4
	const layout = computeBoardLayout(input.availableWidth, input.boardWidth)
	const rowCount = boardRowCount(input.cellCount, input.boardWidth)
	const boardHeight =
		rowCount <= 0
			? 0
			: rowCount * layout.cellSize + Math.max(0, rowCount - 1) * rowGap
	const viewportHeight = Math.max(0, input.viewportHeight)
	const ratio = viewportHeight <= 0 ? 0 : boardHeight / viewportHeight
	return {
		cellSize: layout.cellSize,
		gap: layout.gap,
		sideMargin: layout.sideMargin,
		contentWidth: layout.contentWidth,
		rowCount,
		boardHeight,
		viewportHeight,
		viewportFillRatio: ratio,
		viewportFillPercent: Math.round(ratio * 1000) / 10,
	}
}

/**
 * Reference handset content width used in calibration docs/reports.
 * Matches NumberBoard: ~360 logical width minus horizontal padding (16×2).
 */
export const DENSITY_REFERENCE_CONTENT_WIDTH = 328

/** Typical board viewport height under Game header/status/controls (estimate). */
export const DENSITY_REFERENCE_VIEWPORT_HEIGHT = 520
