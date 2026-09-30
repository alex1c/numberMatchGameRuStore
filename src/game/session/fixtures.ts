/**
 * Playtest / DEV fixture catalog for PHASE 4 gameplay.
 * Representative seeds reconstruct via generatePuzzle — no Node/audit imports.
 */

import { boardFromFixture, type BoardState } from '../core'
import {
	REPRESENTATIVE_UI_SEEDS,
	generatePuzzle,
	puzzleFingerprint,
	type DifficultyProfile,
} from '../generator'
import type { SessionPuzzleIdentity } from './types'

export interface PlaytestFixture {
	readonly id: string
	readonly label: string
	readonly note: string
	readonly kind: 'generated' | 'hand'
	readonly profile: DifficultyProfile | 'CUSTOM'
	readonly seed: number
	/** Expected fingerprint for generated fixtures (assert in DEV). */
	readonly expectedFingerprint?: string
	/** Hand-built board factory (tests / partial-row / completion). */
	readonly buildBoard?: () => BoardState
}

/** Physical OPPO gap regression: same values, wrong geometry, no moves. */
export function buildPhysicalGapBoard(): BoardState {
	return boardFromFixture(`
		2 6 . . .
		. . . 2 6
	`)
}

/** Tiny completion board: 1 9 */
export function buildCompletionBoard(): BoardState {
	return boardFromFixture('1 9')
}

/** Invalid-selection board: 1 2 9 */
export function buildInvalidSelectionBoard(): BoardState {
	return boardFromFixture('1 2 9')
}

/** Partial last row width 7. */
export function buildPartialRowBoard(): BoardState {
	return boardFromFixture(`
		1 2 3 4 5 6 7
		8 9 1 2 3 4 5
		6 7 8
	`)
}

/** Partial final row with removed cells. */
export function buildPartialRemovedBoard(): BoardState {
	return boardFromFixture(`
		1 2 3 4 5 6 7
		8 . . 2
	`)
}

/** Already-cleared board for edge-case DEV. */
export function buildClearedBoard(): BoardState {
	return boardFromFixture('. .')
}

/** Synthetic taller board for scroll layout DEV (not a generator product). */
export function buildLargeLayoutBoard(): BoardState {
	const rows: string[] = []
	for (let r = 0; r < 12; r += 1) {
		rows.push('1 2 3 4 5 6 7')
	}
	return boardFromFixture(rows.join('\n'))
}

/** Primary playtest profiles — one typical seed each. */
export const PLAYTEST_PROFILE_FIXTURES: readonly PlaytestFixture[] = [
	{
		id: 'easy-typical',
		label: 'EASY',
		note: 'EASY typical A',
		kind: 'generated',
		profile: 'EASY',
		seed: 10000,
	},
	{
		id: 'medium-typical',
		label: 'MEDIUM',
		note: 'MEDIUM typical A',
		kind: 'generated',
		profile: 'MEDIUM',
		seed: 10000,
	},
	{
		id: 'hard-typical',
		label: 'HARD',
		note: 'HARD typical A',
		kind: 'generated',
		profile: 'HARD',
		seed: 10000,
	},
	{
		id: 'expert-typical',
		label: 'EXPERT',
		note: 'EXPERT typical A',
		kind: 'generated',
		profile: 'EXPERT',
		seed: 10000,
	},
]

/** DEV-only extended fixtures (guard UI with __DEV__). */
export const DEV_EXTENDED_FIXTURES: readonly PlaytestFixture[] = [
	{
		id: 'densest',
		label: 'densest',
		note: 'max initial cell count EXPERT (40)',
		kind: 'generated',
		profile: 'EXPERT',
		seed: 10001,
	},
	{
		id: 'largest-growth',
		label: 'largest growth',
		note: 'high maxRows during solution (8)',
		kind: 'generated',
		profile: 'EXPERT',
		seed: 10006,
	},
	{
		id: 'high-choice',
		label: 'highest choice',
		note: 'high choiceStates along path',
		kind: 'generated',
		profile: 'EXPERT',
		seed: 10018,
	},
	{
		id: 'expert-10016',
		label: 'EXPERT 10016',
		note: 'solver performance fixture gv2 — do NOT auto-solve',
		kind: 'generated',
		profile: 'EXPERT',
		seed: 10016,
	},
	{
		id: 'hint-stress-expert',
		label: 'Hint stress EXPERT',
		note: 'DEV Hint latency — heavy EXPERT gv2; tap Подсказка and read console Hint: N ms',
		kind: 'generated',
		profile: 'EXPERT',
		seed: 10016,
	},
	{
		id: 'physical-gap-regression',
		label: 'physical-gap-regression',
		note: '2 6 / . . . 2 6 — compatible values, no legal line; DEV QA',
		kind: 'hand',
		profile: 'CUSTOM',
		seed: 0,
		buildBoard: buildPhysicalGapBoard,
	},
	{
		id: 'partial-row',
		label: 'partial row',
		note: 'hand layout width 7 incomplete last row',
		kind: 'hand',
		profile: 'CUSTOM',
		seed: 0,
		buildBoard: buildPartialRowBoard,
	},
	{
		id: 'partial-removed',
		label: 'partial + removed',
		note: 'hand layout partial row with gaps',
		kind: 'hand',
		profile: 'CUSTOM',
		seed: 0,
		buildBoard: buildPartialRemovedBoard,
	},
	{
		id: 'completion-tiny',
		label: 'completion 1-9',
		note: 'tiny clearable board',
		kind: 'hand',
		profile: 'CUSTOM',
		seed: 0,
		buildBoard: buildCompletionBoard,
	},
	{
		id: 'large-layout',
		label: 'large layout',
		note: 'synthetic 12×7 scroll stress',
		kind: 'hand',
		profile: 'CUSTOM',
		seed: 0,
		buildBoard: buildLargeLayoutBoard,
	},
	{
		id: 'cleared',
		label: 'already cleared',
		note: 'edge: empty board',
		kind: 'hand',
		profile: 'CUSTOM',
		seed: 0,
		buildBoard: buildClearedBoard,
	},
]

export type LoadFixtureResult =
	| {
			readonly ok: true
			readonly identity: SessionPuzzleIdentity
			readonly board: BoardState
	  }
	| {
			readonly ok: false
			readonly error: string
	  }

/**
 * Resolve a fixture into identity + initial BoardState.
 * Generated fixtures call generatePuzzle once; hand boards use factories.
 */
export function loadPlaytestFixture(
	fixture: PlaytestFixture,
): LoadFixtureResult {
	if (fixture.kind === 'hand') {
		if (!fixture.buildBoard) {
			return { ok: false, error: `hand fixture ${fixture.id} missing board` }
		}
		const board = fixture.buildBoard()
		const { fingerprint } = puzzleFingerprint(board, 2)
		return {
			ok: true,
			identity: {
				generationVersion: 2,
				difficultyProfileVersion: 1,
				seed: fixture.seed,
				profile: fixture.profile,
				fingerprint,
				label: fixture.label,
			},
			board,
		}
	}

	if (fixture.profile === 'CUSTOM') {
		return { ok: false, error: `generated fixture ${fixture.id} has CUSTOM profile` }
	}

	const result = generatePuzzle({
		seed: fixture.seed,
		profile: fixture.profile,
		// DEV playtest fixtures are frozen against gv2 sparse semantics.
		generationVersion: 2,
	})

	if (result.status !== 'accepted') {
		return {
			ok: false,
			error: `generatePuzzle failed for ${fixture.id}: ${result.status}`,
		}
	}

	const { puzzle } = result
	if (
		fixture.expectedFingerprint &&
		puzzle.identity.fingerprint !== fixture.expectedFingerprint
	) {
		if (__DEV__) {
			console.warn(
				`[NumberMatch] fingerprint mismatch for ${fixture.id}: ` +
					`expected ${fixture.expectedFingerprint}, got ${puzzle.identity.fingerprint}`,
			)
		}
		return {
			ok: false,
			error: `fingerprint mismatch for ${fixture.id}`,
		}
	}

	return {
		ok: true,
		identity: {
			generationVersion: puzzle.identity.generationVersion,
			difficultyProfileVersion: puzzle.identity.difficultyProfileVersion,
			seed: puzzle.identity.seed,
			profile: puzzle.identity.profile,
			fingerprint: puzzle.identity.fingerprint,
			label: fixture.label,
		},
		board: puzzle.board,
	}
}

/** Map REPRESENTATIVE_UI_SEEDS into DEV fixture entries (metadata only). */
export function representativeAsDevFixtures(): readonly PlaytestFixture[] {
	return REPRESENTATIVE_UI_SEEDS.map((seed) => ({
		id: `rep-${seed.profile}-${seed.seed}-${seed.label}`,
		label: seed.label,
		note: seed.note,
		kind: 'generated' as const,
		profile: seed.profile,
		seed: seed.seed,
	}))
}
