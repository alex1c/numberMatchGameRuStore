/**
 * Rewarded ad transaction lifecycle — pure state machine.
 *
 * Physical Yandex/RN lesson (ForestMusic REWARDED_GAME_RELEASE):
 * `await ad.show()` may never settle after the ad closes. UI recovery must
 * hang off reward / dismiss / fail callbacks (+ optional fail-safe), not only
 * the show() promise.
 *
 * Callback order robustness:
 * - reward → dismiss
 * - dismiss → reward (reward still grants within grace)
 * - duplicate reward / dismiss are idempotent
 * - fail-safe never invents a reward
 */

import type { RewardPurpose } from './config'

export type RewardedLifecycleResult =
	| 'granted'
	| 'cancelled'
	| 'failed'
	| 'stale_session'

export type RewardedUiPhase =
	| 'idle'
	| 'loading'
	| 'showing'
	| /** Reward earned; help action may still be running. */
		'earned'
	| 'settled'

export interface RewardedLifecycleSnapshot {
	readonly id: string
	readonly purpose: RewardPurpose
	readonly sessionToken: string
	readonly phase: RewardedUiPhase
	readonly earned: boolean
	readonly helpApplied: boolean
	readonly settled: boolean
	readonly dismissed: boolean
	readonly result: RewardedLifecycleResult | null
	/** True while ad UI should show "Загрузка рекламы…" (not Hint Ищу…). */
	readonly adBusy: boolean
}

export interface RewardedLifecycleOptions {
	readonly id: string
	readonly purpose: RewardPurpose
	readonly sessionToken: string
	readonly isSessionValid: () => boolean
	/** Apply exactly one help action; called at most once after verified reward. */
	readonly applyHelp: () => void
	/** Grace after dismiss before treating as cancelled (allows close→reward). */
	readonly rewardAfterDismissGraceMs?: number
	/** Absolute fail-safe so a broken native lifecycle cannot lock UI forever. */
	readonly failSafeMs?: number
	readonly onSnapshot?: (snapshot: RewardedLifecycleSnapshot) => void
	/** Injectable timer APIs for Jest fake timers. */
	readonly setTimeoutFn?: typeof setTimeout
	readonly clearTimeoutFn?: typeof clearTimeout
}

export const REWARD_AFTER_DISMISS_GRACE_MS = 750
export const REWARDED_FAILSAFE_MS = 90_000

export interface RewardedLifecycleController {
	readonly snapshot: () => RewardedLifecycleSnapshot
	readonly markLoading: () => void
	readonly markShowing: () => void
	readonly onVerifiedReward: () => boolean
	readonly onDismissed: () => void
	readonly onFailed: () => void
	readonly waitForSettlement: () => Promise<RewardedLifecycleResult>
	readonly dispose: () => void
}

/**
 * Create one rewarded transaction. Settlement is idempotent.
 */
export function createRewardedLifecycle(
	options: RewardedLifecycleOptions,
): RewardedLifecycleController {
	const graceMs =
		options.rewardAfterDismissGraceMs ?? REWARD_AFTER_DISMISS_GRACE_MS
	const failSafeMs = options.failSafeMs ?? REWARDED_FAILSAFE_MS
	const schedule = options.setTimeoutFn ?? setTimeout
	const clearSchedule = options.clearTimeoutFn ?? clearTimeout

	let phase: RewardedUiPhase = 'loading'
	let earned = false
	let helpApplied = false
	let settled = false
	let dismissed = false
	let result: RewardedLifecycleResult | null = null
	let graceTimer: ReturnType<typeof setTimeout> | null = null
	let failSafeTimer: ReturnType<typeof setTimeout> | null = null

	let resolveWait: ((r: RewardedLifecycleResult) => void) | null = null
	const waitPromise = new Promise<RewardedLifecycleResult>((resolve) => {
		resolveWait = resolve
	})

	const snapshot = (): RewardedLifecycleSnapshot => ({
		id: options.id,
		purpose: options.purpose,
		sessionToken: options.sessionToken,
		phase,
		earned,
		helpApplied,
		settled,
		dismissed,
		result,
		// Ad chrome clears on dismiss even while waiting for a possible late reward.
		adBusy:
			!settled &&
			!dismissed &&
			(phase === 'loading' || phase === 'showing'),
	})

	const emit = () => {
		options.onSnapshot?.(snapshot())
	}

	const clearTimers = () => {
		if (graceTimer !== null) {
			clearSchedule(graceTimer)
			graceTimer = null
		}
		if (failSafeTimer !== null) {
			clearSchedule(failSafeTimer)
			failSafeTimer = null
		}
	}

	const settle = (next: RewardedLifecycleResult) => {
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

	const tryApplyHelp = (): boolean => {
		if (helpApplied) {
			return false
		}
		if (!options.isSessionValid()) {
			settle('stale_session')
			return false
		}
		helpApplied = true
		phase = 'earned'
		// Clear ad-busy chrome before help starts (earned phase ⇒ adBusy false).
		emit()
		options.applyHelp()
		return true
	}

	const scheduleCancelIfNoReward = () => {
		if (graceTimer !== null || settled || earned) {
			return
		}
		graceTimer = schedule(() => {
			graceTimer = null
			if (!settled && !earned) {
				settle('cancelled')
			}
		}, graceMs)
	}

	failSafeTimer = schedule(() => {
		failSafeTimer = null
		if (settled) {
			return
		}
		if (earned) {
			settle('granted')
			return
		}
		settle('failed')
	}, failSafeMs)

	emit()

	return {
		snapshot,
		markLoading: () => {
			if (settled) {
				return
			}
			phase = 'loading'
			emit()
		},
		markShowing: () => {
			if (settled) {
				return
			}
			phase = 'showing'
			emit()
		},
		onVerifiedReward: () => {
			if (settled) {
				return false
			}
			if (earned) {
				return false
			}
			earned = true
			if (graceTimer !== null) {
				clearSchedule(graceTimer)
				graceTimer = null
			}
			const applied = tryApplyHelp()
			if (!applied) {
				// Session became invalid inside tryApplyHelp (already settled).
				return false
			}
			settle('granted')
			return true
		},
		onDismissed: () => {
			dismissed = true
			if (settled) {
				return
			}
			if (earned) {
				settle('granted')
				return
			}
			// Keep transaction open briefly for close→reward ordering.
			emit()
			scheduleCancelIfNoReward()
		},
		onFailed: () => {
			if (settled) {
				return
			}
			if (earned) {
				settle('granted')
				return
			}
			settle('failed')
		},
		waitForSettlement: () => waitPromise,
		dispose: () => {
			clearTimers()
			if (!settled) {
				settle(earned ? 'granted' : 'cancelled')
			}
		},
	}
}
