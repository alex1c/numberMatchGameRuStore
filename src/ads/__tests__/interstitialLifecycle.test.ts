/**
 * Interstitial lifecycle — dismiss/fail settle without awaiting show().
 */

import {
	INTERSTITIAL_FAILSAFE_MS,
	createInterstitialLifecycle,
} from '../interstitialLifecycle'

describe('interstitial lifecycle callback orders', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	afterEach(() => {
		jest.useRealTimers()
	})

	it('dismiss while show Promise unresolved settles once', async () => {
		const lifecycle = createInterstitialLifecycle({ id: 'i1', failSafeMs: 50_000 })
		lifecycle.markShowing()
		lifecycle.onDismissed()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('dismissed')
		// Late show Promise settlement must be a no-op.
		lifecycle.onDismissed()
		lifecycle.onFailed()
		expect(lifecycle.snapshot().result).toBe('dismissed')
	})

	it('failure while show Promise unresolved settles once', async () => {
		const lifecycle = createInterstitialLifecycle({ id: 'i2', failSafeMs: 50_000 })
		lifecycle.markShowing()
		lifecycle.onFailed()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('failed')
		lifecycle.onFailed()
		lifecycle.onDismissed()
		expect(lifecycle.snapshot().result).toBe('failed')
	})

	it('duplicate dismiss is idempotent', async () => {
		const lifecycle = createInterstitialLifecycle({ id: 'i3' })
		lifecycle.markShowing()
		lifecycle.onDismissed()
		lifecycle.onDismissed()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('dismissed')
	})

	it('fail-safe settles when callbacks never arrive', async () => {
		const lifecycle = createInterstitialLifecycle({
			id: 'i4',
			failSafeMs: INTERSTITIAL_FAILSAFE_MS,
		})
		lifecycle.markShowing()
		jest.advanceTimersByTime(INTERSTITIAL_FAILSAFE_MS)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('failed')
	})

	it('dispose settles cancelled if still open', async () => {
		const lifecycle = createInterstitialLifecycle({ id: 'i5' })
		lifecycle.markShowing()
		lifecycle.dispose()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('cancelled')
	})
})
