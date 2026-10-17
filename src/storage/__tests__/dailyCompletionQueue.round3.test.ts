/**
 * Round 3 P2-3 — Daily completion date check inside the mutation queue.
 */

import {
	__setLocalNowForTests,
	currentLocalDateKey,
} from '../../daily'
import { getCampaignEntry } from '../../game/campaign'
import { createBoard, type CellValue } from '../../game/core'
import {
	PersistRepository,
	buildActiveSession,
	buildDailyActiveSession,
	createMemoryAdapter,
	STORAGE_KEY,
	type StorageAdapter,
} from '../index'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

describe('P2-3 Daily completion inside mutation queue', () => {
	afterEach(() => {
		__setLocalNowForTests(null)
	})

	it('blocks earlier write, enqueues completion on D, advances to D+1, rejects', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 2, 23, 59, 59))
		expect(currentLocalDateKey()).toBe('2026-10-02')

		const memory = createMemoryAdapter()
		// Setup uses a fast adapter; race uses a gated adapter sharing memory.
		const setupRepo = new PersistRepository(memory)
		await setupRepo.hydrate()

		const board = sampleBoard()
		const entry = getCampaignEntry(1)
		await setupRepo.setActiveSession(
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
		)
		await setupRepo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-02',
				seed: 9,
				profile: 'EASY',
				fingerprint: 'daily-queue',
				density: 7,
				board,
				history: [board],
				counters: { matchesRemoved: 2, appendActions: 0, undoActions: 0 },
				usedHint: false,
				usedUndo: false,
			}),
		)

		let releaseFirstWrite!: () => void
		const firstWriteGate = new Promise<void>((resolve) => {
			releaseFirstWrite = resolve
		})
		let gatedWrites = 0
		const gated: StorageAdapter = {
			getItem: (key) => memory.getItem(key),
			removeItem: (key) => memory.removeItem(key),
			setItem: async (key, value) => {
				gatedWrites += 1
				if (gatedWrites === 1) {
					await firstWriteGate
				}
				return memory.setItem(key, value)
			},
		}

		// Fresh repository hydrates from the shared memory (same persist key).
		const repo = new PersistRepository(gated)
		await repo.hydrate()
		expect(repo.getRoot().daily.activeDaily?.dateKey).toBe('2026-10-02')

		// Start a blocking earlier mutation (holds the mutation / write queue).
		const blocking = repo.bumpStatistics({ pairs: 1 })

		// Enqueue Daily completion while still on date D (pre-queue check would pass).
		const completionPromise = repo.commitDailyCompletion({
			dateKey: '2026-10-02',
			fingerprint: 'daily-queue',
			stars: 3,
			counters: { matchesRemoved: 2, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})

		// Midnight advances before the queued updater runs.
		__setLocalNowForTests(() => new Date(2026, 9, 3, 0, 0, 5))
		expect(currentLocalDateKey()).toBe('2026-10-03')

		releaseFirstWrite()
		await blocking
		const result = await completionPromise

		expect(result.status).toBe('expired')
		if (result.status === 'expired') {
			expect(result.attemptedDateKey).toBe('2026-10-02')
			expect(result.todayKey).toBe('2026-10-03')
		}

		const root = repo.getRoot()
		expect(root.daily.history).toEqual([])
		expect(root.daily.currentStreak).toBe(0)
		expect(root.daily.bestStreak).toBe(0)
		expect(root.daily.activeDaily).toBeNull()
		// Campaign untouched.
		expect(root.activeSession?.level).toBe(1)
		expect(root.activeSession?.fingerprint).toBe(entry.fingerprint)
		expect(root.bestStars.every((s) => s === 0)).toBe(true)

		const disk = JSON.parse((await memory.getItem(STORAGE_KEY))!)
		expect(disk.daily.history).toEqual([])
		expect(disk.daily.activeDaily).toBeNull()
	})

	it('same-day completion still accepts stars + streak', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 2, 12, 0, 0))
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-02',
				seed: 1,
				profile: 'EASY',
				fingerprint: 'ok',
				density: 7,
				board,
				history: [],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)
		const result = await repo.commitDailyCompletion({
			dateKey: '2026-10-02',
			fingerprint: 'ok',
			stars: 3,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})
		expect(result.status).toBe('accepted')
		expect(repo.getRoot().daily.history.some((h) => h.dateKey === '2026-10-02')).toBe(
			true,
		)
		expect(repo.getRoot().daily.currentStreak).toBe(1)
	})
})
