/**
 * Density Lab fixture + isolation tests (PHASE 5A calibration).
 */

import {
	DENSITY_FIXTURES,
	computeViewportFill,
	DENSITY_REFERENCE_CONTENT_WIDTH,
	DENSITY_REFERENCE_VIEWPORT_HEIGHT,
	loadDensityFixture,
	getDensityFixtures,
} from '../index'
import { CAMPAIGN_CATALOG_SIGNATURE, resolveCampaignLevel } from '../../../game/campaign'
import {
	PersistRepository,
	buildActiveSession,
	createMemoryAdapter,
} from '../../../storage'
import { getAvailableMoves, validateBoard } from '../../../game/core'
import { replaySolution, solveBoard } from '../../../game/solver'
import { GENERATION_SOLVER_CONFIG } from '../../../game/generator'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('density fixtures', () => {
	it('has unique ordered IDs covering required variants', () => {
		const ids = getDensityFixtures().map((f) => f.id)
		expect(ids).toEqual([
			'density-current',
			'density-7x5',
			'density-7x6',
			'density-8x5',
			'density-8x6',
			'density-9x4',
			'density-9x5',
		])
		expect(new Set(ids).size).toBe(ids.length)
	})

	it.each(DENSITY_FIXTURES.map((f) => [f.id, f] as const))(
		'%s loads with expected shape, solves, and replays',
		(_id, meta) => {
			const loaded = loadDensityFixture(meta.id)
			expect(loaded.ok).toBe(true)
			if (!loaded.ok) {
				return
			}
			expect(loaded.board.width).toBe(meta.width)
			expect(loaded.board.cells.length).toBe(meta.initialCells)
			expect(validateBoard(loaded.board).ok).toBe(true)
			expect(getAvailableMoves(loaded.board).length).toBeGreaterThan(0)

			const solved = solveBoard(loaded.board, GENERATION_SOLVER_CONFIG)
			expect(solved.status).toBe('solved')
			if (solved.status !== 'solved') {
				return
			}
			expect(replaySolution(loaded.board, solved.path).ok).toBe(true)
			expect(loaded.identity.fingerprint).toBe(meta.fingerprint)
			expect(loaded.identity.label).toContain(`${meta.width}×`)
		},
	)

	it('baseline is production EASY width 5 sparse board', () => {
		const current = DENSITY_FIXTURES[0]!
		expect(current.id).toBe('density-current')
		expect(current.width).toBe(5)
		expect(current.initialCells).toBeLessThan(20)
	})

	it('includes a dense EASY-ish proof (8×5) with many openings and ≤1 append', () => {
		const dense = DENSITY_FIXTURES.find((f) => f.id === 'density-8x5')!
		const baseline = DENSITY_FIXTURES.find((f) => f.id === 'density-current')!
		expect(dense.initialCells).toBeGreaterThan(baseline.initialCells * 2)
		expect(dense.initialLegalMoves).toBeGreaterThanOrEqual(3)
		expect(dense.appendCount).toBeLessThanOrEqual(1)
		expect(dense.solutionDepth).toBeGreaterThan(0)
	})
})

describe('viewport fill helper', () => {
	it('computes fill ratio from layout formula', () => {
		const fill = computeViewportFill({
			viewportHeight: DENSITY_REFERENCE_VIEWPORT_HEIGHT,
			availableWidth: DENSITY_REFERENCE_CONTENT_WIDTH,
			boardWidth: 8,
			cellCount: 40,
		})
		expect(fill.rowCount).toBe(5)
		expect(fill.cellSize).toBeGreaterThanOrEqual(36)
		expect(fill.cellSize).toBeLessThanOrEqual(56)
		expect(fill.viewportFillRatio).toBeGreaterThan(0)
		expect(fill.boardHeight).toBe(
			fill.rowCount * fill.cellSize + (fill.rowCount - 1) * 4,
		)
	})
})

describe('density lab isolation', () => {
	it('does not mutate campaign progress or training when loading fixtures', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()
		await repo.setTrainingCompleted(true)
		await repo.setHighestCompletedLevel(4)

		const level = resolveCampaignLevel(5)
		expect(level.status).toBe('ok')
		if (level.status !== 'ok') {
			return
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 5,
				seed: level.entry.seed,
				profile: level.entry.profile,
				fingerprint: level.entry.fingerprint,
				board: level.board,
				initialBoard: level.board,
				history: [],
				counters: { matchesRemoved: 2, appendActions: 0, undoActions: 0 },
			}),
		)

		const before = repo.getRoot()
		// Density load is pure — must not touch repository.
		const loaded = loadDensityFixture('density-8x5')
		expect(loaded.ok).toBe(true)
		const after = repo.getRoot()
		expect(after.highestCompletedLevel).toBe(4)
		expect(after.trainingCompleted).toBe(true)
		expect(after.activeSession?.level).toBe(5)
		expect(after.activeSession?.fingerprint).toBe(
			before.activeSession?.fingerprint,
		)
		expect(after.revision).toBe(before.revision)
	})

	it('campaign signature constant remains cs6e442b58', () => {
		expect(CAMPAIGN_CATALOG_SIGNATURE).toBe('cs6e442b58')
	})

	it('Density Lab entry is DEV-gated in Home source', () => {
		const homePath = join(
			__dirname,
			'..',
			'..',
			'..',
			'screens',
			'HomeScreen.tsx',
		)
		const src = readFileSync(homePath, 'utf8')
		expect(src).toContain("onNavigate('densityLab')")
		expect(src).toContain("__DEV__")
		expect(src).toContain('dev-density-lab')
	})
})
