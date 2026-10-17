/**
 * Round 3 P2-1 / P2-2 — rewarded ownership + unhandled rejection + native dispose.
 */

import { NativeModules } from 'react-native'

import {
	loadRewardedAdOwned,
	type DisposableRewardedAd,
	type RewardedLoaderHandle,
} from '../rewardedLoadOwnership'
import {
	disposeRewardedAdNative,
	invokeNativeRewardedDeleteAd,
} from '../rewardedNativeDisposal'
import { REWARDED_LOAD_TIMEOUT_MS } from '../service'

function makeAd(id: string): DisposableRewardedAd & { _id: string } {
	let deleted = false
	const ad: DisposableRewardedAd & { _id: string } = {
		_id: id,
		onRewarded: null,
		onAdDismissed: null,
		onAdFailedToShow: null,
		show: async () => undefined,
		delete: () => {
			deleted = true
			ad._id = ''
			ad.onRewarded = null
			ad.onAdDismissed = null
			ad.onAdFailedToShow = null
		},
	}
	Object.defineProperty(ad, '__deleted', {
		get: () => deleted,
	})
	return ad
}

describe('P2-1 native rewarded disposal', () => {
	const originalModule = NativeModules.YandexRewardedAdModule

	afterEach(() => {
		NativeModules.YandexRewardedAdModule = originalModule
	})

	it('disposeRewardedAdNative clears JS listeners and invokes native deleteAd', () => {
		const nativeCalls: string[] = []
		NativeModules.YandexRewardedAdModule = {
			deleteAd: (adId: string) => {
				nativeCalls.push(adId)
			},
		}
		const ad = makeAd('rw-native-1')
		ad.onRewarded = () => undefined
		ad.onAdDismissed = () => undefined

		const result = disposeRewardedAdNative(ad)

		expect(result.jsDeleted).toBe(true)
		expect(result.nativeDeleted).toBe(true)
		expect(nativeCalls).toEqual(['rw-native-1'])
		expect(ad.onRewarded).toBeNull()
		expect(ad.onAdDismissed).toBeNull()
		expect(ad.onAdFailedToShow).toBeNull()
	})

	it('invokeNativeRewardedDeleteAd returns false without bridge', () => {
		NativeModules.YandexRewardedAdModule = undefined
		expect(invokeNativeRewardedDeleteAd('x')).toBe(false)
	})

	it('timeout then late resolve invokes native deleteAd exactly once', async () => {
		jest.useFakeTimers()
		const nativeCalls: string[] = []
		NativeModules.YandexRewardedAdModule = {
			deleteAd: (adId: string) => {
				nativeCalls.push(adId)
			},
		}

		let resolveLoad!: (ad: DisposableRewardedAd) => void
		const loadPromise = new Promise<DisposableRewardedAd>((resolve) => {
			resolveLoad = resolve
		})
		const ad = makeAd('late-1')
		const loader: RewardedLoaderHandle = {
			loadAd: async () => loadPromise,
			cancelLoading: async () => undefined,
		}

		const ownedPromise = loadRewardedAdOwned({
			loader,
			adUnitId: 'unit',
			timeoutMs: REWARDED_LOAD_TIMEOUT_MS,
		})
		jest.advanceTimersByTime(REWARDED_LOAD_TIMEOUT_MS)
		const owned = await ownedPromise
		expect(owned.ad).toBeNull()
		expect(owned.timedOut).toBe(true)

		resolveLoad(ad)
		await Promise.resolve()
		await Promise.resolve()

		expect(nativeCalls).toEqual(['late-1'])
		owned.disposeLateOrUnused()
		expect(nativeCalls).toEqual(['late-1'])
		jest.useRealTimers()
	})

	it('stale attempt after load invokes native deleteAd', async () => {
		const nativeCalls: string[] = []
		NativeModules.YandexRewardedAdModule = {
			deleteAd: (adId: string) => {
				nativeCalls.push(adId)
			},
		}
		const ad = makeAd('stale-1')
		const loader: RewardedLoaderHandle = {
			loadAd: async () => ad,
			cancelLoading: async () => undefined,
		}
		const owned = await loadRewardedAdOwned({
			loader,
			adUnitId: 'unit',
			timeoutMs: 60_000,
			isAbandoned: () => true,
		})
		expect(owned.ad).toBeNull()
		expect(nativeCalls).toEqual(['stale-1'])
	})
})

describe('P2-2 unhandled rejection + settlement paths', () => {
	const originalModule = NativeModules.YandexRewardedAdModule
	let unhandled: unknown[] = []
	let onUnhandled: (reason: unknown) => void

	beforeEach(() => {
		unhandled = []
		onUnhandled = (reason) => {
			unhandled.push(reason)
		}
		process.on('unhandledRejection', onUnhandled)
		NativeModules.YandexRewardedAdModule = {
			deleteAd: () => undefined,
		}
	})

	afterEach(() => {
		process.off('unhandledRejection', onUnhandled)
		NativeModules.YandexRewardedAdModule = originalModule
		jest.useRealTimers()
	})

	async function flushMicrotasks(): Promise<void> {
		await Promise.resolve()
		await Promise.resolve()
		await Promise.resolve()
	}

	it('immediate network rejection does not leave unhandledRejection', async () => {
		const loader: RewardedLoaderHandle = {
			loadAd: async () => {
				throw new Error('network down')
			},
			cancelLoading: async () => undefined,
		}
		await expect(
			loadRewardedAdOwned({
				loader,
				adUnitId: 'u',
				timeoutMs: 60_000,
			}),
		).rejects.toThrow('network down')
		await flushMicrotasks()
		expect(unhandled).toEqual([])
	})

	it('timeout clears timer and handles late reject without unhandledRejection', async () => {
		jest.useFakeTimers()
		let rejectLoad!: (err: Error) => void
		const loadPromise = new Promise<DisposableRewardedAd>((_resolve, reject) => {
			rejectLoad = reject
		})
		let cancelCount = 0
		const loader: RewardedLoaderHandle = {
			loadAd: async () => loadPromise,
			cancelLoading: async () => {
				cancelCount += 1
			},
		}
		const ownedPromise = loadRewardedAdOwned({
			loader,
			adUnitId: 'u',
			timeoutMs: 1_000,
		})
		jest.advanceTimersByTime(1_000)
		const owned = await ownedPromise
		expect(owned.timedOut).toBe(true)
		expect(cancelCount).toBe(1)

		rejectLoad(new Error('late network'))
		await flushMicrotasks()
		expect(unhandled).toEqual([])
		owned.disposeLateOrUnused()
		expect(unhandled).toEqual([])
	})

	it('late resolve after timeout disposes once; no dangling timer', async () => {
		jest.useFakeTimers()
		let resolveLoad!: (ad: DisposableRewardedAd) => void
		const loadPromise = new Promise<DisposableRewardedAd>((resolve) => {
			resolveLoad = resolve
		})
		const nativeCalls: string[] = []
		NativeModules.YandexRewardedAdModule = {
			deleteAd: (id: string) => {
				nativeCalls.push(id)
			},
		}
		const ad = makeAd('late-ok')
		const loader: RewardedLoaderHandle = {
			loadAd: async () => loadPromise,
			cancelLoading: async () => undefined,
		}
		const ownedPromise = loadRewardedAdOwned({
			loader,
			adUnitId: 'u',
			timeoutMs: 500,
		})
		jest.advanceTimersByTime(500)
		await ownedPromise
		resolveLoad(ad)
		await flushMicrotasks()
		expect(nativeCalls).toEqual(['late-ok'])
		// Extra timer ticks must not double-dispose.
		jest.advanceTimersByTime(5_000)
		await flushMicrotasks()
		expect(nativeCalls).toEqual(['late-ok'])
		expect(unhandled).toEqual([])
	})

	it('duplicate cleanup is idempotent', async () => {
		const nativeCalls: string[] = []
		NativeModules.YandexRewardedAdModule = {
			deleteAd: (id: string) => {
				nativeCalls.push(id)
			},
		}
		const ad = makeAd('dup')
		const loader: RewardedLoaderHandle = {
			loadAd: async () => ad,
			cancelLoading: async () => undefined,
		}
		const owned = await loadRewardedAdOwned({
			loader,
			adUnitId: 'u',
			timeoutMs: 60_000,
		})
		owned.disposeLateOrUnused()
		owned.disposeLateOrUnused()
		expect(nativeCalls.filter((id) => id === 'dup').length).toBeGreaterThanOrEqual(
			1,
		)
		expect(unhandled).toEqual([])
	})
})
