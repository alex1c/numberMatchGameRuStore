/**
 * Representative seeds for future PHASE 4 UI / physical QA.
 * Selected from generationVersion=1 / difficultyProfileVersion=1 full audit
 * (baseSeed 10000). Reconstruct with generatePuzzle({ seed, profile }).
 */

import type { DifficultyProfile } from './version'

export interface RepresentativeSeed {
	readonly label: string
	readonly profile: DifficultyProfile
	readonly seed: number
	readonly note: string
}

export const REPRESENTATIVE_UI_SEEDS: readonly RepresentativeSeed[] = [
	{ label: 'EASY typical A', profile: 'EASY', seed: 10000, note: 'audit base EASY' },
	{ label: 'EASY typical B', profile: 'EASY', seed: 10010, note: 'mid-range EASY' },
	{ label: 'EASY typical C', profile: 'EASY', seed: 10050, note: 'later EASY sample' },
	{ label: 'MEDIUM typical A', profile: 'MEDIUM', seed: 10000, note: 'audit base MEDIUM' },
	{ label: 'MEDIUM typical B', profile: 'MEDIUM', seed: 10020, note: 'mid-range MEDIUM' },
	{ label: 'MEDIUM typical C', profile: 'MEDIUM', seed: 10057, note: 'high search-cost MEDIUM (edge)' },
	{ label: 'HARD typical A', profile: 'HARD', seed: 10000, note: 'audit base HARD' },
	{ label: 'HARD typical B', profile: 'HARD', seed: 10025, note: 'mid-range HARD' },
	{ label: 'HARD typical C', profile: 'HARD', seed: 10237, note: 'higher-state HARD' },
	{ label: 'EXPERT typical A', profile: 'EXPERT', seed: 10000, note: 'audit base EXPERT' },
	{ label: 'EXPERT typical B', profile: 'EXPERT', seed: 10040, note: 'mid-range EXPERT' },
	{ label: 'EXPERT typical C', profile: 'EXPERT', seed: 10080, note: 'high search-cost EXPERT' },
	{ label: 'densest', profile: 'EXPERT', seed: 10025, note: 'large initial cell count EXPERT' },
	{ label: 'largest growth', profile: 'EXPERT', seed: 10057, note: 'high maxRows during solution' },
	{ label: 'highest choice', profile: 'EXPERT', seed: 10048, note: 'high choiceStates along path' },
]
