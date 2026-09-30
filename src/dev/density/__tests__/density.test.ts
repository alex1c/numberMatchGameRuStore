/**
 * Density Lab fixture + isolation tests (PHASE 5A / V2 calibration).
 */

import {
	DENSITY_FIXTURES,
	DENSITY_V2_VERTICAL_IDS,
	computeViewportFill,
	DENSITY_REFERENCE_CONTENT_WIDTH,
	DENSITY_REFERENCE_VIEWPORT_HEIGHT,
	loadDensityFixture,
	getDensityFixtures,
	getDensityV2VerticalFixtures,
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
	it('has unique IDs across full catalog', () => {
		const ids = getDensityFixtures().map((f) => f.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toContain('density-8x6')
		expect(ids).toContain('density-8x10')
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
		const current = DENSITY_FIXTURES.find((f) => f.id === 'density-current')!
		expect(current.width).toBe(5)
		expect(current.initialCells).toBeLessThan(20)
	})

	it('includes a dense EASY-ish proof (8×5) with many openings and ≤1 append', () => {
		const dense = DENSITY_FIXTURES.find((f) => f.id === 'density-8x5')!
		const baseline = DENSITY_FIXTURES.find((f) => f.id === 'density-current')!
		expect(dense.initialCells).toBeGreaterThan(baseline.initialCells * 2)
		expect(dense.initialLegalMoves).toBeGreaterThanOrEqual(3)
		expect(dense.appendCount).toBeLessThanOrEqual(1)
	})
})

describe('density V2 vertical fill (8 columns)', () => {
	it('exposes exactly five 8-column row variants', () => {
		expect([...DENSITY_V2_VERTICAL_IDS]).toEqual([
			'density-8x6',
			'density-8x7',
			'density-8x8',
			'density-8x9',
			'density-8x10',
		])
		const fixtures = getDensityV2VerticalFixtures()
		expect(fixtures).toHaveLength(5)
	})

	it.each(
		[
			['density-8x6', 6, 48],
			['density-8x7', 7, 56],
			['density-8x8', 8, 64],
			['density-8x9', 9, 72],
			['density-8x10', 10, 80],
		] as const,
	)('%s is width 8 with %i rows / %i cells', (id, rows, cells) => {
		const meta = getDensityV2VerticalFixtures().find((f) => f.id === id)!
		expect(meta.width).toBe(8)
		expect(meta.targetRows).toBe(rows)
		expect(meta.initialCells).toBe(cells)
		expect(meta.initialCells).toBe(meta.width * meta.targetRows)
		expect(meta.appendCount).toBeLessThanOrEqual(1)
		expect(meta.initialLegalMoves).toBeGreaterThanOrEqual(4)

		const loaded = loadDensityFixture(id)
		expect(loaded.ok).toBe(true)
		if (!loaded.ok) {
			return
		}
		expect(loaded.board.width).toBe(8)
		expect(loaded.board.cells.length).toBe(cells)
	})

	it('keeps OPPO-tested 8×6 fingerprint from V1', () => {
		const eightSix = getDensityV2VerticalFixtures().find(
			(f) => f.id === 'density-8x6',
		)!
		expect(eightSix.fingerprint).toBe('ffbc8a6fd')
		expect(eightSix.seed).toBe(2684023931)
	})
})

describe('viewport fill helper', () => {
	it('computes fill ratio from layout formula', () => {
		const fill = computeViewportFill({
			viewportHeight: DENSITY_REFERENCE_VIEWPORT_HEIGHT,
			availableWidth: DENSITY_REFERENCE_CONTENT_WIDTH,
			boardWidth: 8,
			cellCount: 64,
		})
		expect(fill.rowCount).toBe(8)
		expect(fill.cellSize).toBeGreaterThanOrEqual(36)
		expect(fill.cellSize).toBeLessThanOrEqual(56)
		expect(fill.viewportFillRatio).toBeGreaterThan(0.5)
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
				density: level.entry.density,
				board: level.board,
				initialBoard: level.board,
				history: [],
				counters: { matchesRemoved: 2, appendActions: 0, undoActions: 0 },
			}),
		)

		const before = repo.getRoot()
		const loaded = loadDensityFixture('density-8x8')
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

	it('campaign signature constant is Campaign v2 cs71c703ce', () => {
		expect(CAMPAIGN_CATALOG_SIGNATURE).toBe('cs71c703ce')
	})

	it('Density Lab entry is DEV-gated in Home source', () => {
		const homePath = join(__dirname, '../../../screens/HomeScreen.tsx')
		const src = readFileSync(homePath, 'utf8')
		expect(src).toContain("onNavigate('densityLab')")
		expect(src).toContain('__DEV__')
		expect(src).toContain('dev-density-lab')
	})
})
