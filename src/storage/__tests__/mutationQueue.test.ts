/**
 * Concurrent root mutation queue — P1-2 lost-update regressions.
 */

import { getCampaignEntry } from '../../game/campaign'
import { createBoard, type CellValue } from '../../game/core'
import {
	PersistRepository,
	buildActiveSession,
	buildDailyActiveSession,
	createFailingWriteAdapter,
	createMemoryAdapter,
	STORAGE_KEY,
} from '../index'
import { localDateKey } from '../../daily/date'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

describe('P1-2 concurrent root mutations', () => {
	it('statistics + theme both survive (Codex race repro)', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()

		await Promise.all([
			repo.bumpStatistics({ pairs: 1 }),
			repo.setThemePreference('dark'),
		])

		const root = repo.getRoot()
		expect(root.statistics.pairsRemoved).toBe(1)
		expect(root.settings.themePreference).toBe('dark')
		expect(root.revision).toBe(2)

		const disk = JSON.parse((await adapter.getItem(STORAGE_KEY))!)
		expect(disk.statistics.pairsRemoved).toBe(1)
		expect(disk.settings.themePreference).toBe('dark')
		expect(disk.revision).toBe(2)
	})

	it('statistics + Campaign session both survive', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		const entry = getCampaignEntry(1)

		await Promise.all([
			repo.bumpStatistics({ pairs: 3 }),
			repo.setActiveSession(
				buildActiveSession({
					purpose: 'progression',
					status: 'in_progress',
					level: 1,
					seed: entry.seed,
					profile: entry.profile,
					fingerprint: entry.fingerprint,
					density: entry.density,
					board,
					initialBoard: board,
					history: [],
					counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				}),
			),
		])

		const root = repo.getRoot()
		expect(root.statistics.pairsRemoved).toBe(3)
		expect(root.activeSession?.level).toBe(1)
		expect(root.activeSession?.fingerprint).toBe(entry.fingerprint)
		expect(root.revision).toBe(2)
	})

	it('statistics + Daily session both survive', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		const today = localDateKey(new Date())

		await Promise.all([
			repo.bumpStatistics({ appends: 2 }),
			repo.setActiveDailySession(
				buildDailyActiveSession({
					dateKey: today,
					seed: 1,
					profile: 'EASY',
					fingerprint: 'daily-fp-test',
					density: 7,
					board,
					initialBoard: board,
					history: [],
					counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				}),
			),
		])

		const root = repo.getRoot()
		expect(root.statistics.appendActions).toBe(2)
		expect(root.daily.activeDaily?.dateKey).toBe(today)
		expect(root.revision).toBe(2)
	})

	it('Campaign completion + achievement notification both survive', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		const entry = getCampaignEntry(1)
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board,
				initialBoard: board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)

		await Promise.all([
			repo.commitProgressionCompletion({
				level: 1,
				board: {
					...board,
					cells: board.cells.map((c) => ({ ...c, removed: true })),
				},
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				usedHint: false,
				usedUndo: false,
				initialBoard: board,
			}),
			repo.markAchievementsNotified(['ach_first_level']),
		])

		const root = repo.getRoot()
		expect(root.highestCompletedLevel).toBe(1)
		expect(root.achievementNotifiedIds).toContain('ach_first_level')
		expect(root.revision).toBeGreaterThanOrEqual(2)
	})

	it('settings + session both survive', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		const entry = getCampaignEntry(1)

		await Promise.all([
			repo.setThemePreference('light'),
			repo.setActiveSession(
				buildActiveSession({
					purpose: 'progression',
					status: 'in_progress',
					level: 1,
					seed: entry.seed,
					profile: entry.profile,
					fingerprint: entry.fingerprint,
					density: entry.density,
					board,
					history: [],
					counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				}),
			),
		])

		const root = repo.getRoot()
		expect(root.settings.themePreference).toBe('light')
		expect(root.activeSession?.level).toBe(1)
	})

	it('10+ mixed concurrent mutations preserve all non-conflicting fields', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()
		const board = sampleBoard()
		const entry = getCampaignEntry(1)
		const today = localDateKey(new Date())

		await Promise.all([
			repo.bumpStatistics({ pairs: 1 }),
			repo.bumpStatistics({ appends: 1 }),
			repo.bumpStatistics({ hints: 1 }),
			repo.bumpStatistics({ undos: 1 }),
			repo.setThemePreference('dark'),
			repo.setTrainingCompleted(true),
			repo.markAchievementsNotified(['a1']),
			repo.markAchievementsNotified(['a2']),
			repo.setActiveSession(
				buildActiveSession({
					purpose: 'progression',
					status: 'in_progress',
					level: 1,
					seed: entry.seed,
					profile: entry.profile,
					fingerprint: entry.fingerprint,
					density: entry.density,
					board,
					history: [],
					counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				}),
			),
			repo.setActiveDailySession(
				buildDailyActiveSession({
					dateKey: today,
					seed: 9,
					profile: 'EASY',
					fingerprint: 'd-fp',
					density: 7,
					board,
					history: [],
					counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				}),
			),
			repo.bumpStatistics({ pairs: 4 }),
			repo.setThemePreference('system'),
		])

		const root = repo.getRoot()
		expect(root.statistics.pairsRemoved).toBe(5)
		expect(root.statistics.appendActions).toBe(1)
		expect(root.statistics.hintsDelivered).toBe(1)
		expect(root.statistics.undoActions).toBe(1)
		expect(root.settings.themePreference).toBe('system')
		expect(root.trainingCompleted).toBe(true)
		expect(root.achievementNotifiedIds).toEqual(
			expect.arrayContaining(['a1', 'a2']),
		)
		expect(root.activeSession?.level).toBe(1)
		expect(root.daily.activeDaily?.dateKey).toBe(today)
		expect(root.revision).toBe(12)

		const disk = JSON.parse((await adapter.getItem(STORAGE_KEY))!)
		expect(disk.revision).toBe(root.revision)
		expect(disk.statistics.pairsRemoved).toBe(5)
		expect(disk.settings.themePreference).toBe('system')
	})

	it('mutation write failure does not poison later valid mutations', async () => {
		const mem = createMemoryAdapter()
		await mem.setItem(
			STORAGE_KEY,
			JSON.stringify({
				...(await (async () => {
					const r = new PersistRepository(createMemoryAdapter())
					await r.hydrate()
					return r.getRoot()
				})()),
			}),
		)

		// Seed a working repo, then switch to failing adapter mid-flight via
		// a custom adapter that fails once then succeeds.
		let failNext = true
		const flaky = {
			getItem: (k: string) => mem.getItem(k),
			setItem: async (k: string, v: string) => {
				if (failNext) {
					failNext = false
					throw new Error('simulated write failure')
				}
				return mem.setItem(k, v)
			},
			removeItem: (k: string) => mem.removeItem(k),
		}
		const repo = new PersistRepository(flaky)
		await repo.hydrate()

		const failed = await repo.bumpStatistics({ pairs: 1 })
		// After failed write, root may roll back — next mutation must still work.
		await repo.setThemePreference('dark')
		const root = repo.getRoot()
		expect(root.settings.themePreference).toBe('dark')
		expect(root.revision).toBeGreaterThanOrEqual(1)
		void failed
	})

	it('failing-write adapter recovers without deadlock', async () => {
		const mem = createMemoryAdapter()
		const failing = createFailingWriteAdapter(mem, 0)
		const repo = new PersistRepository(failing)
		await repo.hydrate()
		const first = await repo.bumpStatistics({ pairs: 1 })
		expect(first).toBeDefined()
		// Queue must still accept another update attempt (no forever deadlock).
		const second = await repo.setThemePreference('light')
		expect(second).toBeDefined()
	})
})
