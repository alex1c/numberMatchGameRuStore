/**
 * Persisted best-stars board — validate, clamp, and frontier repair.
 */

import { CAMPAIGN_LEVEL_COUNT } from '../game/campaign'
import {
	createEmptyStarBoard,
	normalizeStarCount,
	type StarCount,
} from '../game/stars'

/** Fixed length stored in schema v2 (index 0 = level 1). */
export const PERSISTED_STAR_BOARD_LENGTH = CAMPAIGN_LEVEL_COUNT

/**
 * Parse raw JSON stars into a validated board.
 * Wrong length or non-array → null (caller applies fail-closed empty board).
 */
export function parseStarBoard(raw: unknown): StarCount[] | null {
	if (!Array.isArray(raw)) {
		return null
	}
	if (raw.length !== PERSISTED_STAR_BOARD_LENGTH) {
		return null
	}
	const board = createEmptyStarBoard(PERSISTED_STAR_BOARD_LENGTH)
	for (let i = 0; i < raw.length; i += 1) {
		const normalized = normalizeStarCount(raw[i])
		if (normalized === null) {
			return null
		}
		board[i] = normalized
	}
	return board
}

/**
 * Clamp each cell and ensure completed frontier levels have ≥ 1 star.
 */
export function repairStarBoard(
	board: readonly StarCount[],
	highestCompletedLevel: number,
): StarCount[] {
	const next = board.slice() as StarCount[]
	const frontier = Math.min(
		Math.max(0, highestCompletedLevel),
		PERSISTED_STAR_BOARD_LENGTH,
	)
	for (let i = 0; i < next.length; i += 1) {
		const normalized = normalizeStarCount(next[i])
		next[i] = normalized ?? 0
	}
	for (let level = 1; level <= frontier; level += 1) {
		const index = level - 1
		if ((next[index] ?? 0) < 1) {
			next[index] = 1
		}
	}
	return next
}

/** Fail-closed: empty board then frontier repair. */
export function starBoardFromRawOrRepair(
	raw: unknown,
	highestCompletedLevel: number,
): StarCount[] {
	const parsed = parseStarBoard(raw)
	const base =
		parsed ?? createEmptyStarBoard(PERSISTED_STAR_BOARD_LENGTH)
	return repairStarBoard(base, highestCompletedLevel)
}
