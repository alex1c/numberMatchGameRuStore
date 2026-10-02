/**
 * Interstitial lifecycle — dismiss/fail settle without awaiting show().
 */

import {
	INTERSTITIAL_SHOW_INIT_TIMEOUT_MS,
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
		const lifecycle = createInterstitialLifecycle({
			id: 'i1',
			showInitTimeoutMs: 50_000,
		})
		lifecycle.markShowing()
		lifecycle.onDismissed()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('dismissed')
		lifecycle.onDismissed()
		lifecycle.onFailed()
		expect(lifecycle.snapshot().result).toBe('dismissed')
	})

	it('failure while show Promise unresolved settles once', async () => {
		const lifecycle = createInterstitialLifecycle({
			id: 'i2',
			showInitTimeoutMs: 50_000,
		})
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

	it('show-init timeout settles when ad never becomes visible', async () => {
		const lifecycle = createInterstitialLifecycle({
			id: 'i4',
			showInitTimeoutMs: INTERSTITIAL_SHOW_INIT_TIMEOUT_MS,
		})
		lifecycle.markShowRequested()
		jest.advanceTimersByTime(INTERSTITIAL_SHOW_INIT_TIMEOUT_MS)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('failed')
	})

	it('visible ad is NOT failed by show-init timeout', async () => {
		const lifecycle = createInterstitialLifecycle({
			id: 'i4b',
			showInitTimeoutMs: 5_000,
		})
		lifecycle.markShowRequested()
		lifecycle.onAdShown()
		jest.advanceTimersByTime(60_000)
		expect(lifecycle.snapshot().settled).toBe(false)
		lifecycle.onDismissed()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('dismissed')
	})

	it('cancel is terminal; late dismiss is no-op', async () => {
		const lifecycle = createInterstitialLifecycle({ id: 'i5' })
		lifecycle.markShowing()
		lifecycle.cancel()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('cancelled')
		lifecycle.onDismissed()
		lifecycle.onFailed()
		expect(lifecycle.snapshot().result).toBe('cancelled')
	})

	it('dispose settles cancelled if still open', async () => {
		const lifecycle = createInterstitialLifecycle({ id: 'i6' })
		lifecycle.markShowing()
		lifecycle.dispose()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('cancelled')
	})
})
