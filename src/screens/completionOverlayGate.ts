/**
 * Pure completion-overlay gate — Daily success UI requires an accepted commit.
 * Keeps GameScreen free of “session.completed ⇒ always overlay” regressions.
 */

import type { CompletionMode } from '../components/game/CompletionOverlay'

export interface CompletionOverlayGateInput {
	readonly sessionCompleted: boolean
	readonly completionKey: string | null
	readonly dismissedCompletionKey: string | null
	/** Runtime Daily source with activeDaily still present. */
	readonly isDaily: boolean
	/** Accepted Daily commit snapshot is mounted for presentation. */
	readonly isDailyCompletion: boolean
	readonly hasDailySnapshot: boolean
	readonly isCampaign: boolean
	readonly isDensityLab: boolean
	readonly campaignPurpose: 'progression' | 'replay' | null
}

export interface CompletionOverlayGateResult {
	readonly showCompletion: boolean
	readonly mode: CompletionMode
	readonly showRestart: boolean
	readonly showingAsDaily: boolean
}

/**
 * Decide whether the completion Modal may render and which mode/actions apply.
 *
 * Daily: never show until an accepted commit produced a snapshot.
 * Rejected Daily must not fall through to mode=dev with Restart.
 */
export function resolveCompletionOverlayGate(
	input: CompletionOverlayGateInput,
): CompletionOverlayGateResult {
	const showingAsDaily = input.isDaily || input.isDailyCompletion

	const showCompletion = input.isDailyCompletion
		? input.hasDailySnapshot &&
			input.completionKey !== null &&
			input.completionKey !== input.dismissedCompletionKey
		: !input.isDaily &&
			input.sessionCompleted &&
			input.completionKey !== null &&
			input.completionKey !== input.dismissedCompletionKey

	const mode: CompletionMode = showingAsDaily
		? 'daily'
		: !input.isCampaign
			? 'dev'
			: input.campaignPurpose === 'replay'
				? 'campaign_replay'
				: 'campaign_progression'

	const showRestart =
		showCompletion &&
		!input.isCampaign &&
		!input.isDensityLab &&
		!showingAsDaily

	return {
		showCompletion,
		mode,
		showRestart,
		showingAsDaily,
	}
}
