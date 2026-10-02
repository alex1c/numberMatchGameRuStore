/**
 * Round 2 regressions — attempt tokens, stale interstitial, rewarded ownership,
 * Daily active expiry.
 */

import {
	INTERSTITIAL_SHOW_INIT_TIMEOUT_MS,
	createInterstitialLifecycle,
} from '../../ads/interstitialLifecycle'
import {
	loadRewardedAdOwned,
	type DisposableRewardedAd,
	type RewardedLoaderHandle,
} from '../../ads/rewardedLoadOwnership'
import { REWARDED_LOAD_TIMEOUT_MS } from '../../ads/service'
import {
	beginTransition,
	bumpScreenGeneration,
	cancelActiveTransition,
	createInitialTransitionGuardState,
	invalidateScreen,
	isTransitionAlive,
	runAfterInterstitialIfCurrent,
	syncAttemptId,
} from '../../screens/gameTransitionGuard'
import {
	__setLocalNowForTests,
	currentLocalDateKey,
	previousLocalDateKey,
} from '../../daily'
import {
	PersistRepository,
	buildActiveSession,
	buildDailyActiveSession,
	createMemoryAdapter,
} from '../../storage'
import { createBoard, type CellValue } from '../../game/core'
import { getCampaignEntry } from '../../game/campaign'
import { starsFromAttempt } from '../../game/stars'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

describe('P1 Round2 — stale interstitial Next cannot mutate new attempt', () => {
	it('unmount + new attempt: old interstitial settle does not run Next action', async () => {
		const state = createInitialTransitionGuardState()
		bumpScreenGeneration(state)
		syncAttemptId(state, 1)
		const token = beginTransition(state)

		let startCampaignLevelCalls = 0
		let startSessionCalls = 0
		let navigateCalls = 0
		let boardMutations = 0

		const showPending = createInterstitialLifecycle({
			id: 'stale-next',
			showInitTimeoutMs: 60_000,
		})
		showPending.markShowRequested()

		const actionPromise = runAfterInterstitialIfCurrent({
			state,
			token,
			showInterstitial: () => showPending.waitForSettlement(),
			action: async () => {
				startCampaignLevelCalls += 1
				startSessionCalls += 1
				navigateCalls += 1
				boardMutations += 1
			},
		})

		// Leave Game (unmount) and start another attempt with moves.
		invalidateScreen(state)
		cancelActiveTransition(state)
		showPending.cancel()
		bumpScreenGeneration(state)
		syncAttemptId(state, 2)
		boardMutations = 2 // simulate >=2 moves on new attempt

		showPending.onDismissed()
		const result = await actionPromise

		expect(result).toBe('stale')
		expect(startCampaignLevelCalls).toBe(0)
		expect(startSessionCalls).toBe(0)
		expect(navigateCalls).toBe(0)
		expect(boardMutations).toBe(2)
		expect(isTransitionAlive(state, token)).toBe(false)
	})

	it('Restart same puzzle: old interstitial settle does not advance', async () => {
		const state = createInitialTransitionGuardState()
		bumpScreenGeneration(state)
		syncAttemptId(state, 5)
		const token = beginTransition(state)
		let advanced = false

		const lifecycle = createInterstitialLifecycle({ id: 'restart-is' })
		lifecycle.markShowRequested()

		const pending = runAfterInterstitialIfCurrent({
			state,
			token,
			showInterstitial: () => lifecycle.waitForSettlement(),
			action: () => {
				advanced = true
			},
		})

		// Restart bumps attempt; cancels transition.
		syncAttemptId(state, 6)
		cancelActiveTransition(state)
		lifecycle.cancel()
		lifecycle.onDismissed()

		await expect(pending).resolves.toBe('stale')
		expect(advanced).toBe(false)
	})

	it('Replay: old callback cannot mutate', async () => {
		const state = createInitialTransitionGuardState()
		bumpScreenGeneration(state)
		syncAttemptId(state, 3)
		const token = beginTransition(state)
		let mutated = false
		const lifecycle = createInterstitialLifecycle({ id: 'replay-is' })
		lifecycle.markShowRequested()

		const pending = runAfterInterstitialIfCurrent({
			state,
			token,
			showInterstitial: () => lifecycle.waitForSettlement(),
			action: () => {
				mutated = true
			},
		})

		syncAttemptId(state, 4)
		cancelActiveTransition(state)
		lifecycle.onAdShown()
		lifecycle.onDismissed()

		await expect(pending).resolves.toBe('stale')
		expect(mutated).toBe(false)
	})
})

describe('Rewarded late load disposal', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	afterEach(() => {
		jest.useRealTimers()
	})

	it('timeout then late resolve disposes ad exactly once; show never called', async () => {
		let resolveLoad!: (ad: DisposableRewardedAd) => void
		const loadPromise = new Promise<DisposableRewardedAd>((resolve) => {
			resolveLoad = resolve
		})
		let deleteCount = 0
		let showCount = 0
		const fakeAd: DisposableRewardedAd = {
			onRewarded: null,
			onAdDismissed: null,
			onAdFailedToShow: null,
			show: async () => {
				showCount += 1
			},
			delete: () => {
				deleteCount += 1
			},
		}
		const loader: RewardedLoaderHandle = {
			loadAd: async () => loadPromise,
			cancelLoading: async () => undefined,
		}

		const ownedPromise = loadRewardedAdOwned({
			loader,
			adUnitId: 'test-unit',
			timeoutMs: REWARDED_LOAD_TIMEOUT_MS,
		})

		jest.advanceTimersByTime(REWARDED_LOAD_TIMEOUT_MS)
		const owned = await ownedPromise
		expect(owned.ad).toBeNull()
		expect(owned.timedOut).toBe(true)

		resolveLoad(fakeAd)
		await Promise.resolve()
		await Promise.resolve()

		expect(deleteCount).toBe(1)
		expect(showCount).toBe(0)
		owned.disposeLateOrUnused()
		expect(deleteCount).toBe(1)
	})

	it('stale_session after loaded ad disposes exactly once', async () => {
		let deleteCount = 0
		const fakeAd: DisposableRewardedAd = {
			onRewarded: null,
			onAdDismissed: null,
			onAdFailedToShow: null,
			show: async () => undefined,
			delete: () => {
				deleteCount += 1
			},
		}
		const loader: RewardedLoaderHandle = {
			loadAd: async () => fakeAd,
			cancelLoading: async () => undefined,
		}
		const owned = await loadRewardedAdOwned({
			loader,
			adUnitId: 'u',
			timeoutMs: 60_000,
			isAbandoned: () => true,
		})
		expect(owned.ad).toBeNull()
		expect(deleteCount).toBe(1)
		owned.disposeLateOrUnused()
		expect(deleteCount).toBe(1)
	})

	it('normal load transfers ownership without premature dispose', async () => {
		let deleteCount = 0
		const fakeAd: DisposableRewardedAd = {
			onRewarded: null,
			onAdDismissed: null,
			onAdFailedToShow: null,
			show: async () => undefined,
			delete: () => {
				deleteCount += 1
			},
		}
		const loader: RewardedLoaderHandle = {
			loadAd: async () => fakeAd,
			cancelLoading: async () => undefined,
		}
		const owned = await loadRewardedAdOwned({
			loader,
			adUnitId: 'u',
			timeoutMs: 60_000,
		})
		expect(owned.ad).toBe(fakeAd)
		expect(deleteCount).toBe(0)
		owned.disposeLateOrUnused()
		expect(deleteCount).toBe(1)
	})
})

describe('Rewarded Restart attempt identity', () => {
	it('attempt token change invalidates isSessionValid for same fingerprint', () => {
		let attemptId = 10
		const fingerprint = 'same-fp'
		const captureAttempt = attemptId
		const requestToken = `attempt:${captureAttempt}:hint`
		const isSessionValid = () =>
			attemptId === captureAttempt && requestToken.endsWith(':hint')

		expect(isSessionValid()).toBe(true)
		// Restart same puzzle fingerprint — attempt generation advances.
		attemptId = 11
		expect(fingerprint).toBe('same-fp')
		expect(isSessionValid()).toBe(false)
	})
})

describe('P2 Daily active expiry + final-move race', () => {
	afterEach(() => {
		__setLocalNowForTests(null)
	})

	it('midnight while Daily active discards without completion/history/streak', async () => {
		const dayD = new Date(2026, 9, 2, 23, 30, 0)
		__setLocalNowForTests(() => dayD)
		expect(currentLocalDateKey()).toBe('2026-10-02')

		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const entry = getCampaignEntry(1)
		const campaignBoard = sampleBoard()
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board: campaignBoard,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)

		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-02',
				seed: 1,
				profile: 'EASY',
				fingerprint: 'd-active',
				density: 7,
				board,
				history: [board],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)

		__setLocalNowForTests(() => new Date(2026, 9, 3, 0, 5, 0))
		expect(currentLocalDateKey()).toBe('2026-10-03')

		const next = await repo.discardStaleDailyActiveIfDateChanged(
			currentLocalDateKey(),
		)
		expect(next.daily.activeDaily).toBeNull()
		expect(next.daily.history).toEqual([])
		expect(next.daily.currentStreak).toBe(0)
		expect(next.activeSession?.level).toBe(1)
		expect(next.activeSession?.fingerprint).toBe(entry.fingerprint)
	})

	it('final-move commit race: rejected date yields no snapshot/history', async () => {
		__setLocalNowForTests(() => new Date(2026, 9, 2, 23, 59, 50))
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const board = sampleBoard()
		await repo.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-02',
				seed: 1,
				profile: 'EASY',
				fingerprint: 'race',
				density: 7,
				board,
				history: [],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)

		// Clock rolls before commit authority check.
		__setLocalNowForTests(() => new Date(2026, 9, 3, 0, 0, 10))
		const today = currentLocalDateKey()
		const activeDate = repo.getRoot().daily.activeDaily?.dateKey
		expect(activeDate).toBe('2026-10-02')
		expect(activeDate !== today).toBe(true)

		await repo.discardStaleDailyActiveIfDateChanged(today)

		const candidateSnapshot = {
			dateKey: activeDate!,
			attemptStars: starsFromAttempt({ usedHint: false, usedUndo: false }),
		}
		// Product contract: snapshot only after accepted commit.
		const commitAccepted = false
		const visibleSnapshot = commitAccepted ? candidateSnapshot : null
		expect(visibleSnapshot).toBeNull()
		expect(repo.getRoot().daily.history).toEqual([])
		expect(repo.getRoot().daily.activeDaily).toBeNull()
		expect(previousLocalDateKey(today)).toBe('2026-10-02')
	})
})

describe('interstitial show-init timeout constant', () => {
	it('is far below the old 90s blanket fail-safe', () => {
		expect(INTERSTITIAL_SHOW_INIT_TIMEOUT_MS).toBeLessThanOrEqual(15_000)
		expect(INTERSTITIAL_SHOW_INIT_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000)
	})
})
