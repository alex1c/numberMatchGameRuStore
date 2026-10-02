/**
 * Interstitial ad transaction lifecycle — pure state machine.
 *
 * Physical Yandex/RN lesson (same class as rewarded):
 * `await ad.show()` / `showAd()` may never settle after normal dismissal.
 * Navigation recovery must hang off dismiss / fail callbacks (+ fail-safe),
 * not only the show() promise.
 *
 * Fail-safe semantics (Round 2):
 * - SHOW INITIATION (before onAdShown): short timeout (~12s). If the ad never
 *   reports shown/dismiss/fail, settle as failed so Next/Home is not stuck.
 * - VISIBLE AD (after onAdShown): do NOT auto-navigate under a live ad.
 *   Only dismiss / fail / explicit cancel settle. No 90s blanket timeout.
 *
 * Settlement / cancel are terminal and idempotent.
 */

export type InterstitialLifecycleResult =
	| 'dismissed'
	| 'failed'
	| 'cancelled'

export type InterstitialUiPhase =
	| 'idle'
	| 'show_requested'
	| 'visible'
	| 'settled'

export interface InterstitialLifecycleSnapshot {
	readonly id: string
	readonly phase: InterstitialUiPhase
	readonly settled: boolean
	readonly result: InterstitialLifecycleResult | null
	readonly showing: boolean
	readonly visible: boolean
	readonly cancelled: boolean
}

export interface InterstitialLifecycleOptions {
	readonly id: string
	/**
	 * Max wait after show() until onAdShown / dismiss / fail.
	 * Protects dead native show that never becomes visible.
	 */
	readonly showInitTimeoutMs?: number
	readonly onSnapshot?: (snapshot: InterstitialLifecycleSnapshot) => void
	readonly setTimeoutFn?: typeof setTimeout
	readonly clearTimeoutFn?: typeof clearTimeout
}

/** Dead show() / missing native events — short enough for CTA recovery. */
export const INTERSTITIAL_SHOW_INIT_TIMEOUT_MS = 12_000

/**
 * @deprecated Use INTERSTITIAL_SHOW_INIT_TIMEOUT_MS. Kept so Round-1 tests
 * that imported the old name still compile; value equals show-init timeout.
 */
export const INTERSTITIAL_FAILSAFE_MS = INTERSTITIAL_SHOW_INIT_TIMEOUT_MS

export interface InterstitialLifecycleController {
	readonly snapshot: () => InterstitialLifecycleSnapshot
	readonly markShowRequested: () => void
	/** Alias for markShowRequested (Round-1 API). */
	readonly markShowing: () => void
	readonly onAdShown: () => void
	readonly onDismissed: () => void
	readonly onFailed: () => void
	/** Terminal cancel — late dismiss/fail/show Promise are no-ops. */
	readonly cancel: () => void
	readonly waitForSettlement: () => Promise<InterstitialLifecycleResult>
	readonly dispose: () => void
}

/**
 * Create one interstitial transaction. Settlement is idempotent.
 */
export function createInterstitialLifecycle(
	options: InterstitialLifecycleOptions,
): InterstitialLifecycleController {
	const showInitMs =
		options.showInitTimeoutMs ?? INTERSTITIAL_SHOW_INIT_TIMEOUT_MS
	const schedule = options.setTimeoutFn ?? setTimeout
	const clearSchedule = options.clearTimeoutFn ?? clearTimeout

	let phase: InterstitialUiPhase = 'idle'
	let settled = false
	let cancelled = false
	let result: InterstitialLifecycleResult | null = null
	let showInitTimer: ReturnType<typeof setTimeout> | null = null

	let resolveWait: ((r: InterstitialLifecycleResult) => void) | null = null
	const waitPromise = new Promise<InterstitialLifecycleResult>((resolve) => {
		resolveWait = resolve
	})

	const snapshot = (): InterstitialLifecycleSnapshot => ({
		id: options.id,
		phase,
		settled,
		result,
		showing: !settled && (phase === 'show_requested' || phase === 'visible'),
		visible: !settled && phase === 'visible',
		cancelled,
	})

	const emit = () => {
		options.onSnapshot?.(snapshot())
	}

	const clearTimers = () => {
		if (showInitTimer !== null) {
			clearSchedule(showInitTimer)
			showInitTimer = null
		}
	}

	const settle = (next: InterstitialLifecycleResult) => {
		if (settled) {
			return
		}
		settled = true
		result = next
		if (next === 'cancelled') {
			cancelled = true
		}
		phase = 'settled'
		clearTimers()
		emit()
		resolveWait?.(next)
		resolveWait = null
	}

	const armShowInitTimeout = () => {
		clearTimers()
		showInitTimer = schedule(() => {
			showInitTimer = null
			// Only fail if the ad never became visible.
			if (!settled && phase !== 'visible') {
				settle('failed')
			}
		}, showInitMs)
	}

	emit()

	return {
		snapshot,
		markShowRequested: () => {
			if (settled) {
				return
			}
			phase = 'show_requested'
			armShowInitTimeout()
			emit()
		},
		markShowing: () => {
			if (settled) {
				return
			}
			phase = 'show_requested'
			armShowInitTimeout()
			emit()
		},
		onAdShown: () => {
			if (settled) {
				return
			}
			phase = 'visible'
			// Visible ad: clear initiation timeout — wait for dismiss/fail/cancel.
			clearTimers()
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
		cancel: () => {
			if (settled) {
				return
			}
			settle('cancelled')
		},
		waitForSettlement: () => waitPromise,
		dispose: () => {
			if (!settled) {
				settle('cancelled')
			} else {
				clearTimers()
			}
		},
	}
}
