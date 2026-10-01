/**
 * Hint/Undo entitlement policy — separated from session/solver core.
 *
 * Free help is tracked via session usedHint / usedUndo (also star flags):
 * - first delivered Hint/Undo per attempt is free
 * - additional requests require a rewarded ad (Campaign only)
 * - failed / unavailable Hint does not consume free allowance
 * - Restart resets both flags (new attempt)
 * - cold restore preserves flags via schema v2 activeSession
 *
 * Star rule: any successfully delivered Hint/Undo sets usedHint/usedUndo
 * even when the entitlement came from a rewarded ad.
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

export interface HelpAttemptUsage {
	readonly usedHint: boolean
	readonly usedUndo: boolean
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

	const alreadyUsed = kind === 'hint' ? usage.usedHint : usage.usedUndo

	if (!monetized) {
		return {
			allowed: true,
			free: true,
			requiresReward: false,
			source: 'dev_bypass',
		}
	}

	if (!alreadyUsed) {
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
 * do not consume entitlement and do not mutate game state.
 */
export const REWARDED_FAILURE_POLICY =
	'If rewarded ad fails or is unavailable: do not consume entitlement and do not mutate the game.' as const
