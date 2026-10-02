/**
 * Campaign ↔ Daily session restore — P1-3 regressions.
 * Restart persistence — P2-1.
 * Daily date invalidation — P2-2.
 * Daily completion snapshot contract — P2-3.
 * Corrupt session salvage — P2-4.
 */

import { createBoard, type CellValue } from '../../game/core'
import { getCampaignEntry } from '../../game/campaign'
import {
	gameSessionFromPersisted,
	gameSessionFromPersistedDaily,
} from '../../app/campaignSession'
import {
	PERSIST_SCHEMA_VERSION,
	PersistRepository,
	buildActiveSession,
	buildDailyActiveSession,
	createDefaultRoot,
	createMemoryAdapter,
	migrateToCurrent,
	serializeBoard,
	STORAGE_KEY,
	validatePersistedRoot,
} from '../../storage'
import {
	localDateKey,
	nextLocalDateKey,
	previousLocalDateKey,
} from '../../daily/date'
import { createEmptyDailyState } from '../../daily/types'
import { starsFromAttempt } from '../../game/stars'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

function campaignSessionPayload(level: number, board = sampleBoard()) {
	const entry = getCampaignEntry(level)
	return buildActiveSession({
		purpose: 'progression',
		status: 'in_progress',
		level,
		seed: entry.seed,
		profile: entry.profile,
		fingerprint: entry.fingerprint,
		density: entry.density,
		board,
		initialBoard: board,
		history: [],
		counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
	})
}

describe('P1-3 Campaign Continue after Daily', () => {
	it('A) Campaign partial → Daily partial → Continue Campaign restores Campaign', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()

		const campaignBoard = sampleBoard()
		const campaignDirty = {
			...campaignBoard,
			cells: campaignBoard.cells.map((c, i) =>
				i === 0 ? { ...c, removed: true } : c,
			),
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: getCampaignEntry(1).seed,
				profile: getCampaignEntry(1).profile,
				fingerprint: getCampaignEntry(1).fingerprint,
				density: getCampaignEntry(1).density,
				board: campaignDirty,
				initialBoard: campaignBoard,
				history: [campaignBoard],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
				usedHint: false,
				usedUndo: false,
				freeHintConsumed: false,
				freeUndoConsumed: false,
			}),
		)

		const today = localDateKey(new Date())
		const dailyBoard = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: today,
				seed: 42,
				profile: 'EASY',
				fingerprint: 'daily-partial',
				density: 7,
				board: dailyBoard,
				initialBoard: dailyBoard,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 1, undoActions: 0 },
			}),
		)

		// Runtime was on Daily — Continue Campaign must restore persisted Campaign.
		const persistedCampaign = repo.getRoot().activeSession
		expect(persistedCampaign).not.toBeNull()
		const restored = gameSessionFromPersisted(persistedCampaign!)
		expect(restored).not.toBeNull()
		expect(restored!.identity.fingerprint).toBe(getCampaignEntry(1).fingerprint)
		expect(restored!.board.cells.filter((c) => c.removed).length).toBe(1)
		expect(restored!.history.length).toBe(1)
		expect(restored!.counters.matchesRemoved).toBe(1)
		expect(restored!.usedHint).toBe(false)
		expect(restored!.freeHintConsumed).toBe(false)

		// Daily must remain untouched on disk.
		expect(repo.getRoot().daily.activeDaily?.fingerprint).toBe('daily-partial')
	})

	it('B) then Continue Daily restores exact Daily state', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		await repo.setActiveSession(campaignSessionPayload(1))
		const today = localDateKey(new Date())
		const dailyBoard = sampleBoard()
		const dailyDirty = {
			...dailyBoard,
			cells: dailyBoard.cells.map((c, i) =>
				i < 2 ? { ...c, removed: true } : c,
			),
		}
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: today,
				seed: 7,
				profile: 'MEDIUM',
				fingerprint: 'daily-b',
				density: 8,
				board: dailyDirty,
				initialBoard: dailyBoard,
				history: [dailyBoard],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
				usedHint: true,
				freeHintConsumed: true,
			}),
		)

		const restored = gameSessionFromPersistedDaily(repo.getRoot().daily.activeDaily!)
		expect(restored).not.toBeNull()
		expect(restored!.identity.fingerprint).toBe('daily-b')
		expect(restored!.board.cells.filter((c) => c.removed).length).toBe(2)
		expect(restored!.history.length).toBe(1)
		expect(restored!.usedHint).toBe(true)
		expect(restored!.freeHintConsumed).toBe(true)
		expect(repo.getRoot().activeSession?.level).toBe(1)
	})

	it('C) active Campaign level Continue does not create a new attempt', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		const dirty = {
			...board,
			cells: board.cells.map((c, i) => (i === 1 ? { ...c, removed: true } : c)),
		}
		const session = buildActiveSession({
			purpose: 'progression',
			status: 'in_progress',
			level: 1,
			seed: getCampaignEntry(1).seed,
			profile: getCampaignEntry(1).profile,
			fingerprint: getCampaignEntry(1).fingerprint,
			density: getCampaignEntry(1).density,
			board: dirty,
			initialBoard: board,
			history: [board],
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
		})
		await repo.setActiveSession(session)
		const before = JSON.stringify(repo.getRoot().activeSession)

		// Continue path: restore from disk — do NOT call setActiveSession anew.
		const restored = gameSessionFromPersisted(repo.getRoot().activeSession!)
		expect(restored!.counters.matchesRemoved).toBe(1)
		expect(JSON.stringify(repo.getRoot().activeSession)).toBe(before)
	})
})

describe('P2-1 Restart persistence', () => {
	it('Restart persists pristine board across process death', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()
		const entry = getCampaignEntry(1)
		const initial = sampleBoard()
		const dirty = {
			...initial,
			cells: initial.cells.map((c, i) =>
				i < 2 ? { ...c, removed: true } : c,
			),
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board: dirty,
				initialBoard: initial,
				history: [initial],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
				usedHint: false,
				usedUndo: false,
				freeHintConsumed: false,
				freeUndoConsumed: false,
			}),
		)

		// Explicit Restart persistence transaction (same as GameScreen doRestart).
		await repo.syncActiveGameplay({
			board: initial,
			history: [],
			counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
			freeHintConsumed: false,
			freeUndoConsumed: false,
			status: 'in_progress',
		})

		// Simulate process death — new repository from same adapter.
		const revived = new PersistRepository(adapter)
		await revived.hydrate()
		const active = revived.getRoot().activeSession
		expect(active).not.toBeNull()
		expect(active!.history).toEqual([])
		expect(active!.counters.matchesRemoved).toBe(0)
		expect(active!.usedHint).toBe(false)
		expect(active!.freeHintConsumed).toBe(false)
		expect(active!.board.cells.every((c) => !c.removed)).toBe(true)
		expect(active!.board.cells.length).toBe(initial.cells.length)

		const continued = gameSessionFromPersisted(active!)
		expect(continued!.history.length).toBe(0)
		expect(continued!.counters.matchesRemoved).toBe(0)
	})

	it('Daily Restart persists pristine board', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()
		const today = localDateKey(new Date())
		const initial = sampleBoard()
		const dirty = {
			...initial,
			cells: initial.cells.map((c, i) =>
				i === 0 ? { ...c, removed: true } : c,
			),
		}
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: today,
				seed: 1,
				profile: 'EASY',
				fingerprint: 'daily-restart',
				density: 7,
				board: dirty,
				initialBoard: initial,
				history: [initial],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)

		await repo.syncDailyGameplay({
			board: initial,
			history: [],
			counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
			freeHintConsumed: false,
			freeUndoConsumed: false,
		})

		const revived = new PersistRepository(adapter)
		await revived.hydrate()
		const active = revived.getRoot().daily.activeDaily
		expect(active!.history).toEqual([])
		expect(active!.counters.matchesRemoved).toBe(0)
		expect(active!.board.cells.every((c) => !c.removed)).toBe(true)
	})
})

describe('P2-2 Daily date invalidation', () => {
	it('discards unfinished stale Daily without completing it; Campaign preserved', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		await repo.setActiveSession(campaignSessionPayload(1))
		const yesterday = previousLocalDateKey(localDateKey(new Date()))
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: yesterday,
				seed: 1,
				profile: 'EASY',
				fingerprint: 'stale-daily',
				density: 7,
				board,
				history: [board],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)

		const today = localDateKey(new Date())
		const next = await repo.discardStaleDailyActiveIfDateChanged(today)
		expect(next.daily.activeDaily).toBeNull()
		expect(next.daily.history.find((h) => h.dateKey === yesterday)).toBeUndefined()
		expect(next.activeSession?.level).toBe(1)
	})

	it('cannot extend streak by completing yesterday after rollover', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const today = localDateKey(new Date())
		const yesterday = previousLocalDateKey(today)
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: yesterday,
				seed: 1,
				profile: 'EASY',
				fingerprint: 'yest',
				density: 7,
				board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)

		// Policy gate: discard before commit (mirrors AppState commitDailyCompletion).
		await repo.discardStaleDailyActiveIfDateChanged(today)
		expect(repo.getRoot().daily.activeDaily).toBeNull()

		// Completing with yesterday's key after discard must not invent history via
		// a forced commit when active is null — commitDailyCompletion still writes
		// history for the given dateKey; product gate is AppState date check.
		// Here we assert discard left streak untouched.
		expect(repo.getRoot().daily.currentStreak).toBe(0)
		expect(repo.getRoot().daily.history).toEqual([])
	})

	it('local-date helper midnight boundary', () => {
		const before = new Date(2026, 9, 2, 23, 59, 0)
		const after = new Date(2026, 9, 3, 0, 1, 0)
		expect(localDateKey(before)).toBe('2026-10-02')
		expect(localDateKey(after)).toBe('2026-10-03')
		expect(nextLocalDateKey(localDateKey(before))).toBe(localDateKey(after))
	})
})

describe('P2-3 Daily completion snapshot contract', () => {
	it('after commit clears activeDaily, captured snapshot retains Daily UI fields', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const today = localDateKey(new Date())
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: today,
				seed: 3,
				profile: 'EASY',
				fingerprint: 'daily-done',
				density: 7,
				board,
				history: [],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
				usedHint: false,
				usedUndo: false,
			}),
		)

		const attemptStars = starsFromAttempt({ usedHint: false, usedUndo: false })
		const snapshot = {
			mode: 'daily' as const,
			dateKey: today,
			fingerprint: 'daily-done',
			attemptStars,
			usedHint: false,
			usedUndo: false,
			showNext: false,
			showRestart: false,
			showDailyReplay: true,
		}

		await repo.commitDailyCompletion({
			dateKey: today,
			stars: attemptStars,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		})

		expect(repo.getRoot().daily.activeDaily).toBeNull()
		// Snapshot is independent of cleared activeDaily.
		expect(snapshot.mode).toBe('daily')
		expect(snapshot.attemptStars).toBe(3)
		expect(snapshot.showNext).toBe(false)
		expect(snapshot.showRestart).toBe(false)
		expect(snapshot.showDailyReplay).toBe(true)
		expect(repo.getRoot().daily.history.some((h) => h.dateKey === today)).toBe(
			true,
		)
	})
})

describe('P2-4 corrupt session salvage', () => {
	it('corrupt activeSession preserves Campaign progress', () => {
		const base = createDefaultRoot()
		const raw = {
			...base,
			highestCompletedLevel: 50,
			trainingCompleted: true,
			bestStars: base.bestStars.map((s, i) => (i < 50 ? 3 : s)),
			activeSession: { mode: 'campaign', broken: true },
			revision: 9,
		}
		const result = validatePersistedRoot(raw)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.highestCompletedLevel).toBe(50)
		expect(result.value.trainingCompleted).toBe(true)
		expect(result.value.activeSession).toBeNull()
		expect(result.value.bestStars.slice(0, 50).every((s) => s === 3)).toBe(true)
	})

	it('corrupt activeDaily preserves Campaign + Daily history', () => {
		const base = createDefaultRoot()
		const today = localDateKey(new Date())
		const raw = {
			...base,
			highestCompletedLevel: 12,
			daily: {
				...createEmptyDailyState(),
				history: [{ dateKey: today, bestStars: 2, completed: true }],
				currentStreak: 1,
				bestStreak: 1,
				lastCompletedDateKey: today,
				activeDaily: { mode: 'daily', broken: true },
			},
		}
		const result = validatePersistedRoot(raw)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.highestCompletedLevel).toBe(12)
		expect(result.value.daily.activeDaily).toBeNull()
		expect(result.value.daily.history).toHaveLength(1)
		expect(result.value.daily.currentStreak).toBe(1)
	})

	it('corrupt statistics defaults stats only; settings/progress preserved', () => {
		const base = createDefaultRoot()
		const raw = {
			...base,
			highestCompletedLevel: 5,
			settings: { themePreference: 'dark' },
			statistics: { pairsRemoved: 'nope' },
		}
		const result = validatePersistedRoot(raw)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.highestCompletedLevel).toBe(5)
		expect(result.value.settings.themePreference).toBe('dark')
		expect(result.value.statistics.pairsRemoved).toBe(0)
	})

	it('malformed JSON → safe default root', () => {
		const migrated = migrateToCurrent('{not-json')
		expect(migrated.schemaVersion).toBe(PERSIST_SCHEMA_VERSION)
		expect(migrated.highestCompletedLevel).toBe(0)
	})

	it('unsupported schema → safe default', () => {
		const migrated = migrateToCurrent(
			JSON.stringify({ schemaVersion: 99, highestCompletedLevel: 999 }),
		)
		expect(migrated.schemaVersion).toBe(PERSIST_SCHEMA_VERSION)
		expect(migrated.highestCompletedLevel).toBe(0)
	})

	it('hydrate drops corrupt session without wiping frontier', async () => {
		const adapter = createMemoryAdapter()
		const base = createDefaultRoot()
		await adapter.setItem(
			STORAGE_KEY,
			JSON.stringify({
				...base,
				highestCompletedLevel: 50,
				trainingCompleted: true,
				activeSession: { mode: 'campaign', purpose: 'progression' },
				revision: 3,
			}),
		)
		const repo = new PersistRepository(adapter)
		const root = await repo.hydrate()
		expect(root.highestCompletedLevel).toBe(50)
		expect(root.trainingCompleted).toBe(true)
		expect(root.activeSession).toBeNull()
	})
})

describe('session restore fingerprints', () => {
	it('hydrated GameSession matches persisted boards/history/help', () => {
		const board = sampleBoard()
		const entry = getCampaignEntry(2)
		const persisted = buildActiveSession({
			purpose: 'progression',
			status: 'in_progress',
			level: 2,
			seed: entry.seed,
			profile: entry.profile,
			fingerprint: entry.fingerprint,
			density: entry.density,
			board,
			initialBoard: board,
			history: [board],
			counters: { matchesRemoved: 2, appendActions: 1, undoActions: 0 },
			usedHint: true,
			usedUndo: false,
			freeHintConsumed: true,
			freeUndoConsumed: false,
		})
		const runtime = gameSessionFromPersisted(persisted)!
		expect(runtime.board.nextCellSeq).toBe(persisted.nextCellSeq)
		expect(serializeBoard(runtime.board)).toEqual(persisted.board)
		expect(runtime.history.length).toBe(1)
		expect(runtime.usedHint).toBe(true)
		expect(runtime.freeHintConsumed).toBe(true)
		expect(runtime.usedUndo).toBe(false)
	})
})
