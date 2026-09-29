/**
 * DEV-only density calibration candidate builder.
 *
 * Isolated from production profile shapes (EASY width 5, etc.).
 * Does NOT change generationVersion or production generator semantics.
 */

import { createBoard, type BoardState, type CellValue } from '../../game/core'
import {
	buildPairedValues,
	placeOpeningPairs,
} from '../../game/generator/candidate'
import { createPrng } from '../../game/generator'

export interface DensityShapeSpec {
	readonly width: number
	readonly initialCells: number
}

/**
 * Deterministic board for a fixed width × cell count and attempt seed.
 * Uses the same paired-value / opening-pair helpers as production, without
 * consulting PROFILE_RANGES or shapeForProfile.
 */
export function createDensityCandidateBoard(
	spec: DensityShapeSpec,
	attemptSeed: number,
	options?: {
		readonly equalBias?: number
		readonly openingPairs?: number
	},
): BoardState {
	const width = Math.max(1, Math.floor(spec.width))
	const initialCells = Math.max(2, Math.floor(spec.initialCells))
	if (initialCells % 2 !== 0) {
		throw new Error(
			`createDensityCandidateBoard: initialCells must be even for pairing (got ${initialCells})`,
		)
	}
	const prng = createPrng(attemptSeed)
	const equalBias = options?.equalBias ?? 0.55
	const openingPairs = options?.openingPairs ?? 3
	let values: CellValue[] = buildPairedValues(initialCells, prng, { equalBias })
	values = placeOpeningPairs(values, width, prng, openingPairs)
	return createBoard(values, width)
}
