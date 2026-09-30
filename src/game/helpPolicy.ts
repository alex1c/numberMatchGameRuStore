/**
 * Future Hint/Undo entitlement policy — separated from session/solver core.
 *
 * This phase keeps help free enough for QA. Rewarded ads will wrap these
 * helpers later without changing BoardState / solver / star flag semantics.
 *
 * Star rule: any successfully consumed Hint/Undo still sets usedHint/usedUndo
 * even if the entitlement came from a rewarded ad.
 */

export type HelpKind = 'hint' | 'undo'

export interface HelpEntitlementDecision {
	readonly allowed: boolean
	/** True when this consume should be free (first use on the attempt). */
	readonly free: boolean
	/**
	 * Future: when true, UI may offer a rewarded ad for additional uses.
	 * Never set by this phase — reserved for monetization integration.
	 */
	readonly requiresReward: boolean
	readonly reason?: string
}

export interface HelpAttemptUsage {
	readonly hintUses: number
	readonly undoUses: number
}

/**
 * Decide whether Hint/Undo may proceed for the current attempt.
 * Phase policy: always allow; first use free; additional still free (no ads).
 */
export function decideHelpEntitlement(
	kind: HelpKind,
	usage: HelpAttemptUsage,
): HelpEntitlementDecision {
	const uses = kind === 'hint' ? usage.hintUses : usage.undoUses
	return {
		allowed: true,
		free: uses === 0,
		requiresReward: false,
	}
}

/**
 * Documented future behavior when a rewarded ad fails / is unavailable:
 * do not consume entitlement and do not mutate game state.
 * (No implementation yet — monetization phase.)
 */
export const REWARDED_FAILURE_POLICY =
	'If rewarded ad fails or is unavailable: do not consume entitlement and do not mutate the game.' as const
