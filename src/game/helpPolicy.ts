/**
 * Hint/Undo entitlement policy — separated from session/solver core.
 *
 * Free entitlement vs star flags:
 * Schema v2 already persists `usedHint` / `usedUndo` on the attempt.
 * After a *delivered* help action these flags mean both:
 *   A) stars: assistance was used this attempt
 *   B) entitlement: the one free Hint/Undo was consumed
 * They are set only when assistance is actually delivered (not on busy /
 * solver failure / rewarded failure). No schema bump is required.
 *
 * Cold restore preserves these attempt facts. Transient ad transaction state
 * is never persisted.
 *
 * Restart / new replay clears both flags (new attempt with free help again).
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

/** Explicit alias: free Hint already consumed this attempt (= delivered usedHint). */
export function isFreeHintConsumed(usage: HelpAttemptUsage): boolean {
	return usage.usedHint
}

/** Explicit alias: free Undo already consumed this attempt (= delivered usedUndo). */
export function isFreeUndoConsumed(usage: HelpAttemptUsage): boolean {
	return usage.usedUndo
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
