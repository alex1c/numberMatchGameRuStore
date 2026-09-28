/**
 * Representative seeds for UI / physical QA (generationVersion=2 audit).
 * Reconstruct with generatePuzzle({ seed, profile }).
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
	{ label: 'MEDIUM typical C', profile: 'MEDIUM', seed: 10057, note: 'later MEDIUM sample' },
	{ label: 'HARD typical A', profile: 'HARD', seed: 10000, note: 'audit base HARD' },
	{ label: 'HARD typical B', profile: 'HARD', seed: 10025, note: 'mid-range HARD' },
	{ label: 'HARD typical C', profile: 'HARD', seed: 10045, note: 'maxRows edge HARD' },
	{ label: 'EXPERT typical A', profile: 'EXPERT', seed: 10000, note: 'audit base EXPERT' },
	{ label: 'EXPERT typical B', profile: 'EXPERT', seed: 10040, note: 'mid-range EXPERT' },
	{ label: 'EXPERT typical C', profile: 'EXPERT', seed: 10080, note: 'later EXPERT sample' },
	{ label: 'densest', profile: 'EXPERT', seed: 10001, note: 'max initial cells (40)' },
	{ label: 'largest growth', profile: 'EXPERT', seed: 10006, note: 'maxRowsDuringSolution=8' },
	{ label: 'highest choice', profile: 'EXPERT', seed: 10018, note: 'high choiceStates' },
	{
		label: 'solver performance',
		profile: 'EXPERT',
		seed: 10016,
		note: 'worst exploredStates in gv2 full audit (135)',
	},
]
