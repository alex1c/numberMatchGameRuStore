/**
 * Density Lab calibration types — DEV experiment only.
 */

export type DensityFixtureId =
	| 'density-current'
	| 'density-7x5'
	| 'density-7x6'
	| 'density-8x5'
	| 'density-8x6'
	| 'density-8x7'
	| 'density-8x8'
	| 'density-8x9'
	| 'density-8x10'
	| 'density-9x4'
	| 'density-9x5'

export interface DensityFixtureMeta {
	readonly id: DensityFixtureId
	readonly label: string
	readonly width: number
	readonly targetRows: number
	readonly initialCells: number
	/** Deterministic construction seed (experimental path or generatePuzzle). */
	readonly seed: number
	readonly kind: 'baseline-easy' | 'experimental-shape'
	readonly fingerprint: string
	readonly solutionDepth: number
	readonly initialLegalMoves: number
	readonly choiceStates: number
	readonly forcedRatio: number
	readonly appendCount: number
	readonly maxRowsDuringSolution: number
	readonly difficultyScore: number
	readonly note: string
}
