/**
 * Campaign catalog entry types (compact, reconstructable).
 */

import type { DifficultyProfile } from '../generator'

/**
 * Optional early-level teaching tag derived from opening / path analysis.
 * Used by levels 1–10 during catalog build; later levels omit it.
 */
export type CampaignLearningRole =
	| 'equal'
	| 'sum10'
	| 'vertical'
	| 'diagonal-only'
	| 'linear-only'
	| 'append'

/** One frozen campaign level — reconstructable via seed + profile + fingerprint. */
export interface CampaignEntry {
	readonly level: number
	readonly seed: number
	readonly profile: DifficultyProfile
	readonly fingerprint: string
	readonly difficultyScore: number
	readonly solutionDepth: number
	readonly appendCount: number
	readonly maxRows: number
	readonly learningRole?: CampaignLearningRole
}
