/**
 * Provisional tutorial-friendly puzzle candidates (not final campaign levels).
 * Curated deterministic boards — each has an explicit learning goal and
 * solver-proven representative path using production core.
 */

import {
	boardFromFixture,
	boardToFixture,
	createBoard,
	type BoardState,
	type CellValue,
} from '../core'
import { replaySolution, solveBoard } from '../solver'
import { puzzleFingerprint } from './fingerprint'
import { GENERATION_SOLVER_CONFIG } from './profiles'
import { GENERATION_VERSION } from './version'

export interface TutorialCandidate {
	readonly id: number
	readonly learningGoal: string
	readonly seed: number
	readonly generationVersion: number
	readonly width: number
	readonly board: BoardState
	readonly readable: string
	readonly fingerprint: string
	readonly solutionDepth: number
	readonly specialMechanic: string
	readonly solverStatus: 'solved'
	readonly proofNote: string
}

function prove(board: BoardState): {
	pathLength: number
	fingerprint: string
} {
	const solved = solveBoard(board, GENERATION_SOLVER_CONFIG)
	if (solved.status !== 'solved') {
		throw new Error(`tutorial board not solved: ${solved.status}`)
	}
	const replay = replaySolution(board, solved.path)
	if (!replay.ok) {
		throw new Error(`tutorial replay failed: ${replay.reason}`)
	}
	return {
		pathLength: solved.path.length,
		fingerprint: puzzleFingerprint(board).fingerprint,
	}
}

function pack(
	id: number,
	learningGoal: string,
	seed: number,
	board: BoardState,
	specialMechanic: string,
	proofNote: string,
): TutorialCandidate {
	const { pathLength, fingerprint } = prove(board)
	return {
		id,
		learningGoal,
		seed,
		generationVersion: GENERATION_VERSION,
		width: board.width,
		board,
		readable: boardToFixture(board),
		fingerprint,
		solutionDepth: pathLength,
		specialMechanic,
		solverStatus: 'solved',
		proofNote,
	}
}

/** Deterministic curated tutorial set (provisional). */
export function getTutorialCandidates(): readonly TutorialCandidate[] {
	return [
		pack(
			1,
			'Equal pair',
			9001,
			boardFromFixture('7 7', 2),
			'equal',
			'Opening move is the only 7+7 match.',
		),
		pack(
			2,
			'sum to 10',
			9002,
			boardFromFixture('1 9', 2),
			'sum10',
			'Opening move is the only 1+9 match.',
		),
		pack(
			3,
			'pair through removed cells',
			9003,
			boardFromFixture('1 . 9', 3),
			'gap-horizontal',
			'1 and 9 match horizontally across a removed cell.',
		),
		pack(
			4,
			'horizontal matching',
			9004,
			boardFromFixture('2 8 3 7', 4),
			'horizontal',
			'Two adjacent horizontal sum-10 pairs clear the board.',
		),
		pack(
			5,
			'vertical matching',
			9005,
			boardFromFixture(`
				4 1
				6 9
			`, 2),
			'vertical',
			'Primary clears are vertical 4+6 and 1+9.',
		),
		pack(
			6,
			'diagonal matching',
			9006,
			boardFromFixture(`
				9 .
				. 1
			`, 2),
			'diagonal',
			'The only match is diagonal 9+1 across empty cells.',
		),
		pack(
			7,
			'row-boundary / linear',
			9007,
			boardFromFixture(`
				1 3 8
				2
			`, 3),
			'linear-only',
			'Only opening match is linear 8↔2 across the row boundary.',
		),
		pack(
			8,
			'multi-step sequence',
			9008,
			boardFromFixture(`
				1 2
				8 7
				9 3
			`, 2),
			'multi-step',
			'Requires at least two removals; 1+9 blocked until 2+8 clears.',
		),
		pack(
			9,
			'simple append',
			9009,
			createBoard([1, 2, 3] as CellValue[], 3),
			'append',
			'No opening matches; one append unlocks vertical twins.',
		),
		pack(
			10,
			'mixed mechanics',
			9010,
			boardFromFixture(`
				5 5 1
				9 4 6
			`, 3),
			'mixed',
			'Combines equal 5+5 with sum-10 opportunities on a compact board.',
		),
	]
}
