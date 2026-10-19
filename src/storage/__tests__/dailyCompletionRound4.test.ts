/**
 * Round 4 P2 — write_failed is not accepted; identity mismatch preserves newer Daily.
 */

import {
	__setLocalNowForTests,
	currentLocalDateKey,
} from '../../daily'
import { createBoard, type CellValue } from '../../game/core'
import {
	PersistRepository,
	buildDailyActiveSession,
	createFailingWriteAdapter,
	createMemoryAdapter,
	type StorageAdapter,
} from '../index'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

describe('Round 4 P2 Daily completion write failure', () => {
	afterEach(() => {
		__setLocalNowForTests(null)
	})

	it('storage rejection on Daily completion write returns write_failed', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
		const memory = createMemoryAdapter()
		const setup = new PersistRepository(memory)
		await setup.hydrate()
		const board = sampleBoard()
		await setup.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-19',
				seed: 1,
				profile: 'EASY',
				fingerprint: 'fail-write',
				density: 7,
				board,
				history: [board],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
				usedHint: false,
				usedUndo: false,
				freeHintConsumed: false,
				freeUndoConsumed: false,
			}),
		)

		const failing = createFailingWriteAdapter(memory, 0)
		const repo = new PersistRepository(failing)
		await repo.hydrate()
		expect(repo.getRoot().daily.activeDaily?.fingerprint).toBe('fail-write')

		const result = await repo.commitDailyCompletion({
			dateKey: '2026-10-19',
			fingerprint: 'fail-write',
			stars: 3,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})

		expect(result.status).toBe('write_failed')
		expect(repo.getRoot().daily.history).toEqual([])
		expect(repo.getRoot().daily.currentStreak).toBe(0)
		// Recoverable attempt preserved after rollback.
		expect(repo.getRoot().daily.activeDaily?.fingerprint).toBe('fail-write')
		expect(repo.getRoot().daily.activeDaily?.history.length).toBe(1)
	})

	it('retry after storage recovery succeeds once', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
		const memory = createMemoryAdapter()
		const setup = new PersistRepository(memory)
		await setup.hydrate()
		const board = sampleBoard()
		await setup.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-19',
				seed: 1,
				profile: 'EASY',
				fingerprint: 'retry-ok',
				density: 7,
				board,
				history: [],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)

		let fail = true
		const flaky: StorageAdapter = {
			getItem: (k) => memory.getItem(k),
			removeItem: (k) => memory.removeItem(k),
			setItem: async (k, v) => {
				if (fail) {
					throw new Error('transient')
				}
				return memory.setItem(k, v)
			},
		}
		const repo = new PersistRepository(flaky)
		await repo.hydrate()

		const first = await repo.commitDailyCompletion({
			dateKey: '2026-10-19',
			fingerprint: 'retry-ok',
			stars: 3,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})
		expect(first.status).toBe('write_failed')
		expect(repo.getRoot().daily.activeDaily?.fingerprint).toBe('retry-ok')

		fail = false
		const second = await repo.commitDailyCompletion({
			dateKey: '2026-10-19',
			fingerprint: 'retry-ok',
			stars: 3,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})
		expect(second.status).toBe('accepted')
		expect(repo.getRoot().daily.history).toHaveLength(1)
		expect(repo.getRoot().daily.activeDaily).toBeNull()
		expect(repo.getRoot().daily.currentStreak).toBe(1)
	})

	it('failure after another queued mutation does not false-accept', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
		const memory = createMemoryAdapter()
		const setup = new PersistRepository(memory)
		await setup.hydrate()
		await setup.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-19',
				seed: 1,
				profile: 'EASY',
				fingerprint: 'queued-fail',
				density: 7,
				board: sampleBoard(),
				history: [],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)

		let writes = 0
		const gated: StorageAdapter = {
			getItem: (k) => memory.getItem(k),
			removeItem: (k) => memory.removeItem(k),
			setItem: async (k, v) => {
				writes += 1
				// First write (stats) ok; second (daily completion) fails.
				if (writes >= 2) {
					throw new Error('fail completion write')
				}
				return memory.setItem(k, v)
			},
		}
		const repo = new PersistRepository(gated)
		await repo.hydrate()

		const stats = repo.bumpStatistics({ pairs: 2 })
		const completion = repo.commitDailyCompletion({
			dateKey: '2026-10-19',
			fingerprint: 'queued-fail',
			stars: 2,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: true,
			usedUndo: false,
		})
		await stats
		const result = await completion
		expect(result.status).toBe('write_failed')
		expect(repo.getRoot().statistics.pairsRemoved).toBe(2)
		expect(repo.getRoot().daily.history).toEqual([])
		expect(repo.getRoot().daily.activeDaily?.fingerprint).toBe('queued-fail')
	})
})

describe('Round 4 P2 identity mismatch preserves newer Daily', () => {
	afterEach(() => {
		__setLocalNowForTests(null)
	})

	it('old completion with mismatched fingerprint does not clear newer session', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 19, 15, 0, 0))
		expect(currentLocalDateKey()).toBe('2026-10-19')
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-19',
				seed: 7,
				profile: 'HARD',
				fingerprint: 'newer-daily',
				density: 9,
				board,
				history: [board, board],
				counters: { matchesRemoved: 3, appendActions: 2, undoActions: 1 },
				usedHint: true,
				usedUndo: true,
				freeHintConsumed: true,
				freeUndoConsumed: true,
			}),
		)

		const before = repo.getRoot().daily.activeDaily
		expect(before?.fingerprint).toBe('newer-daily')

		const result = await repo.commitDailyCompletion({
			dateKey: '2026-10-19',
			fingerprint: 'older-daily',
			stars: 3,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})

		expect(result.status).toBe('rejected')
		if (result.status === 'rejected') {
			expect(result.reason).toBe('identity_mismatch')
		}
		const after = repo.getRoot().daily.activeDaily
		expect(after).not.toBeNull()
		expect(after?.fingerprint).toBe('newer-daily')
		expect(after?.seed).toBe(7)
		expect(after?.profile).toBe('HARD')
		expect(after?.density).toBe(9)
		expect(after?.history.length).toBe(2)
		expect(after?.counters).toEqual({
			matchesRemoved: 3,
			appendActions: 2,
			undoActions: 1,
		})
		expect(after?.usedHint).toBe(true)
		expect(after?.usedUndo).toBe(true)
		expect(after?.freeHintConsumed).toBe(true)
		expect(after?.freeUndoConsumed).toBe(true)
		expect(repo.getRoot().daily.history).toEqual([])
		expect(repo.getRoot().daily.currentStreak).toBe(0)
	})

	it('old completion with mismatched date does not clear newer session', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 19, 15, 0, 0))
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-19',
				seed: 3,
				profile: 'EASY',
				fingerprint: 'today-daily',
				density: 7,
				board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)

		const result = await repo.commitDailyCompletion({
			dateKey: '2026-10-18',
			fingerprint: 'today-daily',
			stars: 1,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})
		expect(result.status).toBe('rejected')
		if (result.status === 'rejected') {
			expect(result.reason).toBe('identity_mismatch')
		}
		expect(repo.getRoot().daily.activeDaily?.dateKey).toBe('2026-10-19')
		expect(repo.getRoot().daily.activeDaily?.fingerprint).toBe('today-daily')
		expect(repo.getRoot().daily.history).toEqual([])
	})
})
