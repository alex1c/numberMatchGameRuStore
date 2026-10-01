/**
 * Hint/Undo entitlement policy — separated from session/solver core.
 *
 * Four attempt fields (do not couple):
 * - usedHint / usedUndo — mastery/star facts only
 * - freeHintConsumed / freeUndoConsumed — monetization free allowance only
 *
 * Free entitlement is consumed only when useful help is actually delivered.
 * Stars use usedHint/usedUndo exclusively.
 */

export type HelpKind = 'hint' | 'undo'

export type HelpSource = 'free' | 'rewarded' | 'dev_bypass'

export interface HelpEntitlementDecision {
	readonly allowed: boolean
	/** True when this consume should be free (first use on the attempt). */
	readonly free: boolean
	/** When true, UI must show rewarded prompt before granting help. */
	readonly requiresReward: boolean
	readonly source: HelpSource
	readonly reason?: string
}

/** Monetization entitlement inputs — never derive from usedHint/usedUndo. */
export interface HelpAttemptUsage {
	readonly freeHintConsumed: boolean
	readonly freeUndoConsumed: boolean
}

export function isFreeHintConsumed(usage: HelpAttemptUsage): boolean {
	return usage.freeHintConsumed
}

export function isFreeUndoConsumed(usage: HelpAttemptUsage): boolean {
	return usage.freeUndoConsumed
}

/**
 * Whether Campaign monetization applies for this launch source.
 * DEV fixtures / Density Lab bypass rewarded prompts to avoid ad spam.
 * Production Campaign is always monetized (even inside a debug build).
 */
export function isHelpMonetized(
	sessionSource: 'campaign' | 'dev_fixture' | 'none' | null | undefined,
): boolean {
	return sessionSource === 'campaign'
}

/**
 * Decide whether Hint/Undo may proceed and whether a rewarded ad is required.
 */
export function decideHelpEntitlement(
	kind: HelpKind,
	usage: HelpAttemptUsage,
	options?: {
		readonly monetized?: boolean
		readonly hasUndoHistory?: boolean
		readonly completed?: boolean
	},
): HelpEntitlementDecision {
	const monetized = options?.monetized !== false
	const completed = options?.completed === true

	if (completed) {
		return {
			allowed: false,
			free: false,
			requiresReward: false,
			source: 'free',
			reason: 'completed',
		}
	}

	if (kind === 'undo' && options?.hasUndoHistory === false) {
		return {
			allowed: false,
			free: false,
			requiresReward: false,
			source: 'free',
			reason: 'empty_history',
		}
	}

	const freeConsumed =
		kind === 'hint' ? isFreeHintConsumed(usage) : isFreeUndoConsumed(usage)

	if (!monetized) {
		return {
			allowed: true,
			free: true,
			requiresReward: false,
			source: 'dev_bypass',
		}
	}

	if (!freeConsumed) {
		return {
			allowed: true,
			free: true,
			requiresReward: false,
			source: 'free',
		}
	}

	return {
		allowed: true,
		free: false,
		requiresReward: true,
		source: 'rewarded',
	}
}

/**
 * Documented behavior when a rewarded ad fails / is unavailable:
 * do not consume entitlement and do not mutate the game.
 */
export const REWARDED_FAILURE_POLICY =
	'If rewarded ad fails or is unavailable: do not consume entitlement and do not mutate the game.' as const
