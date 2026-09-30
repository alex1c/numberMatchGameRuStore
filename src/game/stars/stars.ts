/**
 * Campaign mastery stars — pure helpers (no React / storage).
 *
 * ★ Completion — always awarded on clear.
 * ★ No Hint — awarded when usedHint is false.
 * ★ No Undo — awarded when usedUndo is false.
 */

export type StarCount = 0 | 1 | 2 | 3

export interface AttemptHelpFlags {
	readonly usedHint: boolean
	readonly usedUndo: boolean
}

/**
 * Stars earned by a completed attempt (always ≥ 1).
 */
export function starsFromAttempt(flags: AttemptHelpFlags): StarCount {
	let stars: StarCount = 1
	if (!flags.usedHint) {
		stars = (stars + 1) as StarCount
	}
	if (!flags.usedUndo) {
		stars = (stars + 1) as StarCount
	}
	return stars
}

/** Best-of merge — never decreases. */
export function mergeBestStars(
	previous: StarCount,
	attempt: StarCount,
): StarCount {
	return (attempt > previous ? attempt : previous) as StarCount
}

/** Clamp / validate a raw star value. */
export function normalizeStarCount(value: unknown): StarCount | null {
	if (value === 0 || value === 1 || value === 2 || value === 3) {
		return value
	}
	if (typeof value === 'number' && Number.isInteger(value)) {
		if (value < 0) return 0
		if (value > 3) return 3
		return value as StarCount
	}
	return null
}

/**
 * Compact per-level best stars: length 1000, index 0 = Level 1.
 * Missing / unset levels are 0.
 */
export function createEmptyStarBoard(levelCount: number): StarCount[] {
	return Array.from({ length: levelCount }, () => 0 as StarCount)
}

export function totalStars(board: readonly StarCount[]): number {
	let sum = 0
	for (const s of board) {
		sum += s
	}
	return sum
}

export function maxStarsPossible(levelCount: number): number {
	return levelCount * 3
}

/**
 * Set best stars for a 1-based level; returns a new array.
 */
export function withBestStars(
	board: readonly StarCount[],
	level: number,
	attemptStars: StarCount,
): StarCount[] {
	if (!Number.isInteger(level) || level < 1 || level > board.length) {
		return [...board]
	}
	const index = level - 1
	const next = board.slice() as StarCount[]
	next[index] = mergeBestStars(board[index] ?? 0, attemptStars)
	return next
}
