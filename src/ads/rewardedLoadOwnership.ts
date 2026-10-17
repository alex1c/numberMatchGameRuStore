/**
 * Owns a rewarded load Promise so timeout / cancel / stale always dispose
 * a late-arriving native ad exactly once. Never leave orphan listeners or
 * unhandled rejections. Disposal goes through disposeRewardedAdNative so
 * native adsStorage release is invoked when an ad id is present.
 */

import {
	disposeRewardedAdNative,
	type DisposableRewardedWithId,
} from './rewardedNativeDisposal'

export interface DisposableRewardedAd extends DisposableRewardedWithId {
	readonly delete: () => void
	show: () => Promise<void>
	onRewarded: ((reward?: unknown) => void) | null
	onAdDismissed: (() => void) | null
	onAdFailedToShow: ((error?: unknown) => void) | null
}

export interface RewardedLoaderHandle {
	readonly loadAd: (params: {
		readonly adUnitId: string
	}) => Promise<DisposableRewardedAd>
	readonly cancelLoading: () => Promise<void>
}

export interface OwnedRewardedLoadResult {
	readonly ad: DisposableRewardedAd | null
	readonly timedOut: boolean
	readonly cancelled: boolean
	readonly disposeLateOrUnused: () => void
}

export interface OwnedRewardedLoadOptions {
	readonly loader: RewardedLoaderHandle
	readonly adUnitId: string
	readonly timeoutMs: number
	readonly isAbandoned?: () => boolean
	readonly setTimeoutFn?: typeof setTimeout
	readonly clearTimeoutFn?: typeof clearTimeout
}

/**
 * Race load vs timeout. On timeout/abandon, cancelLoading best-effort and
 * attach a continuation that deletes any late-resolved ad exactly once.
 * Both fulfillment and rejection of the load Promise are always handled.
 */
export async function loadRewardedAdOwned(
	options: OwnedRewardedLoadOptions,
): Promise<OwnedRewardedLoadResult> {
	const schedule = options.setTimeoutFn ?? setTimeout
	const clearSchedule = options.clearTimeoutFn ?? clearTimeout

	let finished = false
	let timedOut = false
	let cancelled = false
	let disposed = false
	let ownedAd: DisposableRewardedAd | null = null

	const disposeOnce = (ad: DisposableRewardedAd | null) => {
		if (!ad || disposed) {
			return
		}
		disposed = true
		disposeRewardedAdNative(ad)
	}

	const disposeLateOrUnused = () => {
		disposeOnce(ownedAd)
		ownedAd = null
	}

	/** Always settle — never leave an unhandledRejection on loadPromise. */
	const attachLateDisposal = () => {
		void loadPromise.then(
			(late) => {
				if (late) {
					disposeOnce(late)
				}
			},
			() => undefined,
		)
	}

	let timeoutId: ReturnType<typeof setTimeout> | null = null

	const loadPromise = options.loader.loadAd({ adUnitId: options.adUnitId }).then(
		(ad) => {
			if (finished || timedOut || cancelled || options.isAbandoned?.()) {
				disposeOnce(ad)
				return null
			}
			ownedAd = ad
			return ad
		},
		(err: unknown) => {
			if (finished || timedOut || cancelled) {
				return null
			}
			throw err
		},
	)

	const timeoutPromise = new Promise<null>((resolve) => {
		timeoutId = schedule(() => {
			timeoutId = null
			timedOut = true
			finished = true
			void options.loader.cancelLoading().catch(() => undefined)
			resolve(null)
		}, options.timeoutMs)
	})

	try {
		const ad = await Promise.race([loadPromise, timeoutPromise])
		if (timeoutId !== null) {
			clearSchedule(timeoutId)
			timeoutId = null
		}
		finished = true

		if (timedOut || options.isAbandoned?.()) {
			cancelled = options.isAbandoned?.() === true && !timedOut
			attachLateDisposal()
			return {
				ad: null,
				timedOut,
				cancelled,
				disposeLateOrUnused,
			}
		}

		if (!ad) {
			return {
				ad: null,
				timedOut: false,
				cancelled: true,
				disposeLateOrUnused,
			}
		}

		ownedAd = ad
		return {
			ad,
			timedOut: false,
			cancelled: false,
			disposeLateOrUnused,
		}
	} catch (err) {
		if (timeoutId !== null) {
			clearSchedule(timeoutId)
			timeoutId = null
		}
		finished = true
		// Handle both late resolve and the already-rejected loadPromise.
		attachLateDisposal()
		throw err
	}
}
