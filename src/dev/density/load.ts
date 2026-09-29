/**
 * Load Density Lab fixtures into session identity + board.
 * Non-persistent DEV path — never writes campaign persistence.
 */

import {
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
	generatePuzzle,
	puzzleFingerprint,
} from '../../game/generator'
import type { BoardState } from '../../game/core'
import type { SessionPuzzleIdentity } from '../../game/session'
import { createDensityCandidateBoard } from './experimentalCandidate'
import { DENSITY_FIXTURES } from './fixtures'
import type { DensityFixtureId, DensityFixtureMeta } from './types'

export function getDensityFixtures(): readonly DensityFixtureMeta[] {
	return DENSITY_FIXTURES
}

export function getDensityFixture(id: DensityFixtureId): DensityFixtureMeta {
	const found = DENSITY_FIXTURES.find((f) => f.id === id)
	if (!found) {
		throw new Error(`Unknown density fixture: ${id}`)
	}
	return found
}

export function isDensityFixtureId(value: string): value is DensityFixtureId {
	return DENSITY_FIXTURES.some((f) => f.id === value)
}

export type LoadDensityFixtureResult =
	| {
			readonly ok: true
			readonly meta: DensityFixtureMeta
			readonly identity: SessionPuzzleIdentity
			readonly board: BoardState
	  }
	| { readonly ok: false; readonly error: string }

/**
 * Reconstruct the frozen calibration board and verify fingerprint.
 */
export function loadDensityFixture(
	id: DensityFixtureId,
): LoadDensityFixtureResult {
	const meta = getDensityFixture(id)
	let board: BoardState

	if (meta.kind === 'baseline-easy') {
		const generated = generatePuzzle({
			seed: meta.seed,
			profile: 'EASY',
			maxCandidateAttempts: 80,
			deadEndAnalysis: false,
		})
		if (generated.status !== 'accepted') {
			return {
				ok: false,
				error: `baseline generate failed: ${generated.status}`,
			}
		}
		board = generated.puzzle.board
	} else {
		board = createDensityCandidateBoard(
			{ width: meta.width, initialCells: meta.initialCells },
			meta.seed,
			{ equalBias: 0.55, openingPairs: 4 },
		)
	}

	const { fingerprint } = puzzleFingerprint(board)
	if (fingerprint !== meta.fingerprint) {
		return {
			ok: false,
			error: `fingerprint mismatch for ${id}: got ${fingerprint}, expected ${meta.fingerprint}`,
		}
	}

	if (board.width !== meta.width || board.cells.length !== meta.initialCells) {
		return {
			ok: false,
			error: `shape mismatch for ${id}`,
		}
	}

	const identity: SessionPuzzleIdentity = {
		generationVersion: GENERATION_VERSION,
		difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION,
		seed: meta.seed,
		profile: meta.kind === 'baseline-easy' ? 'EASY' : 'CUSTOM',
		fingerprint,
		label: formatDensityHeader(meta),
	}

	return { ok: true, meta, identity, board }
}

/** Header subtitle for Density Lab Game sessions. */
export function formatDensityHeader(meta: DensityFixtureMeta): string {
	return `${meta.width}×${meta.targetRows} · ${meta.initialCells} чисел`
}
