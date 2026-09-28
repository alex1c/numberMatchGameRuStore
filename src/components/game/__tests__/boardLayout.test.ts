/**
 * Board layout sizing helpers.
 */

import { boardRowCount, computeBoardLayout } from '../boardLayout'

describe('computeBoardLayout', () => {
	it('keeps columns aligned with symmetric margins', () => {
		const layout = computeBoardLayout(360, 9)
		expect(layout.boardWidth).toBe(9)
		expect(layout.cellSize).toBeGreaterThanOrEqual(36)
		expect(layout.cellSize).toBeLessThanOrEqual(56)
		expect(layout.contentWidth + layout.sideMargin * 2).toBeLessThanOrEqual(
			layout.availableWidth,
		)
		expect(layout.contentWidth).toBe(
			layout.cellSize * 9 + layout.gap * 8,
		)
	})

	it('boardRowCount uses ceil(length/width) including removed geometry', () => {
		expect(boardRowCount(17, 7)).toBe(3)
		expect(boardRowCount(0, 7)).toBe(0)
	})
})
