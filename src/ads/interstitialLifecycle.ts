/**
 * Interstitial ad transaction lifecycle — pure state machine.
 *
 * Physical Yandex/RN lesson (same class as rewarded):
 * `await ad.show()` / `showAd()` may never settle after normal dismissal.
 * Navigation recovery must hang off dismiss / fail callbacks (+ fail-safe),
 * not only the show() promise.
 *
 * Settlement is idempotent — duplicate dismiss/fail and late Promise
 * settlement after callback settlement are no-ops.
 */

export type InterstitialLifecycleResult =
	| 'dismissed'
	| 'failed'
	| 'cancelled'

export type InterstitialUiPhase =
	| 'idle'
	| 'showing'
	| 'settled'

export interface InterstitialLifecycleSnapshot {
	readonly id: string
	readonly phase: InterstitialUiPhase
	readonly settled: boolean
	readonly result: InterstitialLifecycleResult | null
	readonly showing: boolean
}

export interface InterstitialLifecycleOptions {
	readonly id: string
	/** Absolute fail-safe so a broken native lifecycle cannot lock navigation. */
	readonly failSafeMs?: number
	readonly onSnapshot?: (snapshot: InterstitialLifecycleSnapshot) => void
	readonly setTimeoutFn?: typeof setTimeout
	readonly clearTimeoutFn?: typeof clearTimeout
}

export const INTERSTITIAL_FAILSAFE_MS = 90_000

export interface InterstitialLifecycleController {
	readonly snapshot: () => InterstitialLifecycleSnapshot
	readonly markShowing: () => void
	readonly onDismissed: () => void
	readonly onFailed: () => void
	readonly waitForSettlement: () => Promise<InterstitialLifecycleResult>
	readonly dispose: () => void
}

/**
 * Create one interstitial transaction. Settlement is idempotent.
 */
export function createInterstitialLifecycle(
	options: InterstitialLifecycleOptions,
): InterstitialLifecycleController {
	const failSafeMs = options.failSafeMs ?? INTERSTITIAL_FAILSAFE_MS
	const schedule = options.setTimeoutFn ?? setTimeout
	const clearSchedule = options.clearTimeoutFn ?? clearTimeout

	let phase: InterstitialUiPhase = 'idle'
	let settled = false
	let result: InterstitialLifecycleResult | null = null
	let failSafeTimer: ReturnType<typeof setTimeout> | null = null

	let resolveWait: ((r: InterstitialLifecycleResult) => void) | null = null
	const waitPromise = new Promise<InterstitialLifecycleResult>((resolve) => {
		resolveWait = resolve
	})

	const snapshot = (): InterstitialLifecycleSnapshot => ({
		id: options.id,
		phase,
		settled,
		result,
		showing: !settled && phase === 'showing',
	})

	const emit = () => {
		options.onSnapshot?.(snapshot())
	}

	const clearTimers = () => {
		if (failSafeTimer !== null) {
			clearSchedule(failSafeTimer)
			failSafeTimer = null
		}
	}

	const settle = (next: InterstitialLifecycleResult) => {
		if (settled) {
			return
		}
		settled = true
		result = next
		phase = 'settled'
		clearTimers()
		emit()
		resolveWait?.(next)
		resolveWait = null
	}

	failSafeTimer = schedule(() => {
		failSafeTimer = null
		if (!settled) {
			settle('failed')
		}
	}, failSafeMs)

	emit()

	return {
		snapshot,
		markShowing: () => {
			if (settled) {
				return
			}
			phase = 'showing'
			emit()
		},
		onDismissed: () => {
			if (settled) {
				return
			}
			settle('dismissed')
		},
		onFailed: () => {
			if (settled) {
				return
			}
			settle('failed')
		},
		waitForSettlement: () => waitPromise,
		dispose: () => {
			clearTimers()
			if (!settled) {
				settle('cancelled')
			}
		},
	}
}
