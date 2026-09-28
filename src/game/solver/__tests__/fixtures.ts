/**
 * Solver fixtures S1–S10 for PHASE 2.
 * Production code must not depend on this module.
 */

import { boardFromFixture, createBoard, type BoardState } from '../../core'

export interface SolverFixture {
	readonly id: string
	readonly description: string
	readonly board: BoardState
	readonly options?: {
		readonly maxStates?: number
		readonly maxDepth?: number
		readonly maxAppends?: number
		readonly appendPolicy?: 'when_stuck' | 'anytime'
	}
}

/** S1 — already cleared. */
export function fixtureS1(): SolverFixture {
	return {
		id: 'S1',
		description: 'already cleared board',
		board: boardFromFixture('. .', 2),
	}
}

/** S2 — one sum-10 match. */
export function fixtureS2(): SolverFixture {
	return {
		id: 'S2',
		description: 'single 1+9 match',
		board: boardFromFixture('1 9', 2),
	}
}

/** S3 — identical pair. */
export function fixtureS3(): SolverFixture {
	return {
		id: 'S3',
		description: 'identical 7+7',
		board: boardFromFixture('7 7', 2),
	}
}

/**
 * S4 — blocker opens after another removal (needs ≥2 matches).
 * Vertical 1+9 is blocked by 8 until 2+8 is removed; 7+3 also clears.
 */
export function fixtureS4(): SolverFixture {
	return {
		id: 'S4',
		description: 'blocker opens after prior match',
		board: boardFromFixture(`
			1 2
			8 7
			9 3
		`, 2),
	}
}

/**
 * S5 — row-boundary linear required (not H/V/Diag).
 * Width 3: index 2 (8) ↔ index 3 (2) are end-of-row → start-of-next.
 * No other opening match exists on this board.
 */
export function fixtureS5(): SolverFixture {
	return {
		id: 'S5',
		description: 'linear end-of-row → start-of-next-row',
		board: boardFromFixture(`
			1 3 8
			2
		`, 3),
	}
}

/** S6 — diagonal required. */
export function fixtureS6(): SolverFixture {
	return {
		id: 'S6',
		description: 'diagonal 9+1',
		board: boardFromFixture(`
			9 .
			. 1
		`, 2),
	}
}

/**
 * S7 — append required.
 * No legal pairs until active values are appended; then vertical twins clear.
 */
export function fixtureS7(): SolverFixture {
	return {
		id: 'S7',
		description: 'append required to unlock matches',
		board: boardFromFixture('1 2 3', 3),
		options: { maxAppends: 1 },
	}
}

/** S8 — artificial tiny state budget forces cutoff. */
export function fixtureS8(): SolverFixture {
	return {
		id: 'S8',
		description: 'forced max_states cutoff',
		board: boardFromFixture(`
			1 2 3
			4 5 6
		`, 3),
		options: { maxAppends: 3, maxStates: 1, maxDepth: 64 },
	}
}

/** S9 — invalid board (duplicate ids). */
export function fixtureS9(): SolverFixture {
	const base = createBoard([1, 2], 2)
	const board: BoardState = {
		...base,
		cells: [
			{ ...base.cells[0]!, id: 'dup' },
			{ ...base.cells[1]!, id: 'dup' },
		],
	}
	return {
		id: 'S9',
		description: 'malformed duplicate ids',
		board,
	}
}

/**
 * S10 — genuine unsolvable under maxAppends=0.
 *
 * Proof: `getAvailableMoves` is empty (1,2,3 pairwise incompatible and not
 * connectable as matches). With maxAppends=0 append is forbidden, so the only
 * node has zero transitions → finite model exhausted → unsolvable.
 */
export function fixtureS10(): SolverFixture {
	return {
		id: 'S10',
		description: 'unsolvable with maxAppends=0 (no pairs)',
		board: boardFromFixture('1 2 3', 3),
		options: { maxAppends: 0 },
	}
}

export const ALL_SOLVER_FIXTURES: readonly (() => SolverFixture)[] = [
	fixtureS1,
	fixtureS2,
	fixtureS3,
	fixtureS4,
	fixtureS5,
	fixtureS6,
	fixtureS7,
	fixtureS8,
	fixtureS9,
	fixtureS10,
]
