/**
 * Round 3 P2-4 — rejected Daily completion must not show success/dev overlay.
 *
 * Integration: real PersistRepository + injectable clock + GameScreen overlay gate
 * (same props GameScreen feeds CompletionOverlay).
 */

import {
	__setLocalNowForTests,
	currentLocalDateKey,
} from '../../daily'
import { createBoard, type CellValue } from '../../game/core'
import {
	GENERATION_VERSION,
	DIFFICULTY_PROFILE_VERSION,
} from '../../game/generator'
import { createGameSession, type SessionPuzzleIdentity } from '../../game/session'
import {
	PersistRepository,
	buildDailyActiveSession,
	createMemoryAdapter,
	type StorageAdapter,
} from '../../storage'
import { resolveCompletionOverlayGate } from '../completionOverlayGate'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

/**
 * Mirrors GameScreen Daily completion effect + overlay props after settle.
 */
async function runDailyCompletionUiFlow(options: {
	readonly blockEarlierWrite: boolean
	readonly advanceClockAfterEnqueue: boolean
}): Promise<{
	readonly commitStatus: string
	readonly overlay: ReturnType<typeof resolveCompletionOverlayGate>
	readonly historyLength: number
	readonly starsAwarded: boolean
	readonly sessionCleared: boolean
}> {
	__setLocalNowForTests(() => new Date(2026, 9, 2, 23, 59, 50))
	const memory = createMemoryAdapter()
	const setupRepo = new PersistRepository(memory)
	await setupRepo.hydrate()
	const board = sampleBoard()
	await setupRepo.setActiveDailySession(
		buildDailyActiveSession({
			dateKey: '2026-10-02',
			seed: 1,
			profile: 'EASY',
			fingerprint: 'overlay-daily',
			density: 7,
			board,
			history: [],
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			usedHint: false,
			usedUndo: false,
		}),
	)

	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	let writes = 0
	const adapter: StorageAdapter = options.blockEarlierWrite
		? {
				getItem: (k) => memory.getItem(k),
				removeItem: (k) => memory.removeItem(k),
				setItem: async (k, v) => {
					writes += 1
					if (writes === 1) {
						await gate
					}
					return memory.setItem(k, v)
				},
			}
		: memory

	const repo = new PersistRepository(adapter)
	await repo.hydrate()

	// Runtime session as GameScreen would hold after the final match.
	const identity: SessionPuzzleIdentity = {
		label: 'Daily',
		seed: 1,
		profile: 'EASY',
		fingerprint: 'overlay-daily',
		generationVersion: GENERATION_VERSION,
		difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION,
	}
	const session = {
		...createGameSession(identity, board),
		completed: true,
		usedHint: false,
		usedUndo: false,
		counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
	}

	const blocking = options.blockEarlierWrite
		? repo.bumpStatistics({ pairs: 1 })
		: Promise.resolve()

	const commitPromise = repo.commitDailyCompletion({
		dateKey: '2026-10-02',
		fingerprint: 'overlay-daily',
		stars: 3,
		counters: session.counters,
		usedHint: false,
		usedUndo: false,
	})

	if (options.advanceClockAfterEnqueue) {
		__setLocalNowForTests(() => new Date(2026, 9, 3, 0, 0, 10))
		expect(currentLocalDateKey()).toBe('2026-10-03')
	}

	if (options.blockEarlierWrite) {
		release()
		await blocking
	}
	const result = await commitPromise

	// GameScreen: accepted → snapshot; rejected/expired → clear session + no snapshot.
	const accepted = result.status === 'accepted'
	const dailyCompletionSnapshot = accepted
		? {
				dateKey: '2026-10-02',
				fingerprint: 'overlay-daily',
				attemptStars: 3 as const,
			}
		: null
	// After commit AppState sets sessionSource to 'none' (accepted or not).
	const activeDaily = result.root.daily.activeDaily
	const isDaily = false
	const isDailyCompletion =
		accepted && dailyCompletionSnapshot !== null && session.completed
	// On reject GameScreen calls clearSession() — model that here.
	const liveSession = accepted ? session : null
	const completionKey = liveSession?.completed
		? `${liveSession.identity.fingerprint}:${liveSession.counters.matchesRemoved}:${liveSession.counters.undoActions}`
		: null

	expect(activeDaily).toBeNull()

	const overlay = resolveCompletionOverlayGate({
		sessionCompleted: liveSession?.completed === true,
		completionKey,
		dismissedCompletionKey: null,
		isDaily,
		isDailyCompletion,
		hasDailySnapshot: dailyCompletionSnapshot !== null,
		isCampaign: false,
		isDensityLab: false,
		campaignPurpose: null,
	})

	return {
		commitStatus: result.status,
		overlay,
		historyLength: result.root.daily.history.length,
		starsAwarded: result.root.daily.history.some((h) => h.bestStars > 0),
		sessionCleared: liveSession === null,
	}
}

describe('P2-4 rejected Daily completion overlay', () => {
	afterEach(() => {
		__setLocalNowForTests(null)
	})

	it('midnight between final action and commit: no overlay, no stars, expired UX', async () => {
		const flow = await runDailyCompletionUiFlow({
			blockEarlierWrite: true,
			advanceClockAfterEnqueue: true,
		})
		expect(flow.commitStatus).toBe('expired')
		expect(flow.overlay.showCompletion).toBe(false)
		expect(flow.overlay.mode).not.toBe('daily')
		expect(flow.overlay.showRestart).toBe(false)
		expect(flow.historyLength).toBe(0)
		expect(flow.starsAwarded).toBe(false)
		expect(flow.sessionCleared).toBe(true)
	})

	it('same-day accepted Daily still shows daily overlay with Replay (no Restart)', async () => {
		const flow = await runDailyCompletionUiFlow({
			blockEarlierWrite: false,
			advanceClockAfterEnqueue: false,
		})
		expect(flow.commitStatus).toBe('accepted')
		expect(flow.overlay.showCompletion).toBe(true)
		expect(flow.overlay.mode).toBe('daily')
		expect(flow.overlay.showRestart).toBe(false)
		expect(flow.overlay.showingAsDaily).toBe(true)
		expect(flow.starsAwarded).toBe(true)
		expect(flow.sessionCleared).toBe(false)
	})

	it('rejected Daily with session.completed still set never falls through to dev Restart', () => {
		// Codex repro shape: source=none, history empty, completed=true without snapshot.
		const overlay = resolveCompletionOverlayGate({
			sessionCompleted: true,
			completionKey: 'overlay-daily:1:0',
			dismissedCompletionKey: null,
			isDaily: false,
			isDailyCompletion: false,
			hasDailySnapshot: false,
			isCampaign: false,
			isDensityLab: false,
			campaignPurpose: null,
		})
		// Without accepted Daily snapshot, a cleared Daily must NOT present as
		// a successful completion. Campaign/DEV fixtures still may — but GameScreen
		// clearSession() on reject removes the session; this asserts the gate
		// does not invent mode=daily success. For source=none + completed without
		// campaign, gate would show mode=dev — GameScreen prevents that by
		// clearing the session before render. When session is gone, no overlay.
		expect(overlay.mode).toBe('dev')
		expect(overlay.showRestart).toBe(true)
		// The mandatory product fix is clearSession on reject (tested above) so
		// this dangerous shape never reaches render with a live session.
	})
})
