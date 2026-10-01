/**
 * Rewarded lifecycle callback-order tests (fake timers, no ad SDK).
 */

import {
	REWARD_AFTER_DISMISS_GRACE_MS,
	REWARDED_FAILSAFE_MS,
	createRewardedLifecycle,
	type RewardedLifecycleSnapshot,
} from '../rewardedLifecycle'

function createTx(overrides?: {
	readonly isSessionValid?: () => boolean
	readonly applyHelp?: () => void
	readonly onSnapshot?: (s: RewardedLifecycleSnapshot) => void
	readonly graceMs?: number
	readonly failSafeMs?: number
}) {
	const applyHelp = overrides?.applyHelp ?? jest.fn()
	const snapshots: RewardedLifecycleSnapshot[] = []
	const lifecycle = createRewardedLifecycle({
		id: 't1',
		purpose: 'hint',
		sessionToken: 'fp:1',
		isSessionValid: overrides?.isSessionValid ?? (() => true),
		applyHelp,
		rewardAfterDismissGraceMs: overrides?.graceMs ?? REWARD_AFTER_DISMISS_GRACE_MS,
		failSafeMs: overrides?.failSafeMs ?? REWARDED_FAILSAFE_MS,
		onSnapshot: (s) => {
			snapshots.push(s)
			overrides?.onSnapshot?.(s)
		},
	})
	return { lifecycle, applyHelp, snapshots }
}

describe('rewarded lifecycle callback orders', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	afterEach(() => {
		jest.useRealTimers()
	})

	it('reward → close grants exactly once and clears adBusy', async () => {
		const { lifecycle, applyHelp } = createTx()
		lifecycle.markShowing()
		expect(lifecycle.snapshot().adBusy).toBe(true)

		expect(lifecycle.onVerifiedReward()).toBe(true)
		expect(applyHelp).toHaveBeenCalledTimes(1)
		expect(lifecycle.snapshot().adBusy).toBe(false)
		expect(lifecycle.snapshot().phase).toBe('settled')

		lifecycle.onDismissed()
		expect(applyHelp).toHaveBeenCalledTimes(1)

		await expect(lifecycle.waitForSettlement()).resolves.toBe('granted')
	})

	it('close → reward within grace still grants once', async () => {
		const { lifecycle, applyHelp } = createTx({ graceMs: 500 })
		lifecycle.markShowing()
		lifecycle.onDismissed()
		expect(applyHelp).not.toHaveBeenCalled()
		expect(lifecycle.snapshot().settled).toBe(false)

		expect(lifecycle.onVerifiedReward()).toBe(true)
		expect(applyHelp).toHaveBeenCalledTimes(1)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('granted')
	})

	it('reward only then delayed close stays granted', async () => {
		const { lifecycle, applyHelp } = createTx()
		lifecycle.onVerifiedReward()
		jest.advanceTimersByTime(5_000)
		lifecycle.onDismissed()
		expect(applyHelp).toHaveBeenCalledTimes(1)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('granted')
	})

	it('close without reward cancels after grace — no help', async () => {
		const { lifecycle, applyHelp } = createTx({ graceMs: 400 })
		lifecycle.onDismissed()
		expect(lifecycle.snapshot().settled).toBe(false)
		jest.advanceTimersByTime(400)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('cancelled')
		expect(applyHelp).not.toHaveBeenCalled()
		expect(lifecycle.snapshot().adBusy).toBe(false)
	})

	it('load/show failure settles failed without help', async () => {
		const { lifecycle, applyHelp } = createTx()
		lifecycle.onFailed()
		await expect(lifecycle.waitForSettlement()).resolves.toBe('failed')
		expect(applyHelp).not.toHaveBeenCalled()
		expect(lifecycle.snapshot().adBusy).toBe(false)
	})

	it('duplicate reward callback applies help once', async () => {
		const { lifecycle, applyHelp } = createTx()
		expect(lifecycle.onVerifiedReward()).toBe(true)
		expect(lifecycle.onVerifiedReward()).toBe(false)
		expect(applyHelp).toHaveBeenCalledTimes(1)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('granted')
	})

	it('duplicate dismiss without reward cancels once', async () => {
		const { lifecycle, applyHelp } = createTx({ graceMs: 200 })
		lifecycle.onDismissed()
		lifecycle.onDismissed()
		jest.advanceTimersByTime(200)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('cancelled')
		expect(applyHelp).not.toHaveBeenCalled()
	})

	it('session change during ad → stale_session, no help apply side effects beyond check', async () => {
		let valid = true
		const applyHelp = jest.fn()
		const { lifecycle } = createTx({
			isSessionValid: () => valid,
			applyHelp,
		})
		valid = false
		expect(lifecycle.onVerifiedReward()).toBe(false)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('stale_session')
		expect(applyHelp).not.toHaveBeenCalled()
	})

	it('reward after grace cancel does not grant', async () => {
		const { lifecycle, applyHelp } = createTx({ graceMs: 100 })
		lifecycle.onDismissed()
		jest.advanceTimersByTime(100)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('cancelled')
		expect(lifecycle.onVerifiedReward()).toBe(false)
		expect(applyHelp).not.toHaveBeenCalled()
	})

	it('fail-safe settles failed when show never returns', async () => {
		const { lifecycle, applyHelp } = createTx({ failSafeMs: 1_000 })
		lifecycle.markShowing()
		// Simulate hung show() — no callbacks.
		jest.advanceTimersByTime(1_000)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('failed')
		expect(applyHelp).not.toHaveBeenCalled()
		expect(lifecycle.snapshot().adBusy).toBe(false)
	})

	it('close without reward clears adBusy immediately while grace runs', () => {
		const { lifecycle } = createTx({ graceMs: 500 })
		lifecycle.markShowing()
		expect(lifecycle.snapshot().adBusy).toBe(true)
		lifecycle.onDismissed()
		expect(lifecycle.snapshot().adBusy).toBe(false)
		expect(lifecycle.snapshot().settled).toBe(false)
	})

	it('successful rewarded undo purpose applies once', async () => {
		const applyHelp = jest.fn()
		const lifecycle = createRewardedLifecycle({
			id: 'u1',
			purpose: 'undo',
			sessionToken: 'fp:2',
			isSessionValid: () => true,
			applyHelp,
			failSafeMs: 60_000,
		})
		lifecycle.onVerifiedReward()
		lifecycle.onDismissed()
		expect(applyHelp).toHaveBeenCalledTimes(1)
		await expect(lifecycle.waitForSettlement()).resolves.toBe('granted')
	})
})
