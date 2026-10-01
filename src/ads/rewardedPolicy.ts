/**
 * Rewarded grant guard — only the SDK verified-reward callback may grant help.
 * Dismissal, load errors, and failed-to-show paths intentionally do nothing.
 */

export interface RewardGrantGuard {
	readonly onVerifiedReward: () => boolean
	readonly onDismissed: () => void
	readonly hasGranted: () => boolean
}

/**
 * Create a one-shot grant guard optionally tied to a live session token check.
 * Even if the SDK fires reward twice, onGrant runs at most once.
 */
export function createRewardGrantGuard(
	onGrant: () => void,
	isTokenValid?: () => boolean,
): RewardGrantGuard {
	let granted = false

	return {
		onVerifiedReward: () => {
			if (granted) {
				return false
			}
			if (isTokenValid && !isTokenValid()) {
				return false
			}
			granted = true
			onGrant()
			return true
		},
		onDismissed: () => undefined,
		hasGranted: () => granted,
	}
}
