/**
 * Owns a rewarded load Promise so timeout / cancel / stale always dispose
 * a late-arriving native ad exactly once. Never leave orphan listeners.
 */

export interface DisposableRewardedAd {
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
		try {
			ad.onRewarded = null
			ad.onAdDismissed = null
			ad.onAdFailedToShow = null
		} catch {
			// ignore listener clear failures
		}
		try {
			ad.delete()
		} catch {
			// ignore native delete failures
		}
	}

	const disposeLateOrUnused = () => {
		disposeOnce(ownedAd)
		ownedAd = null
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
			// Ensure late load continues to dispose (loadPromise continuation).
			void loadPromise.then((late) => {
				if (late) {
					disposeOnce(late)
				}
			})
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
		void loadPromise.then((late) => {
			if (late) {
				disposeOnce(late)
			}
		})
		throw err
	}
}
