/**
 * Candidate board construction — deterministic, profile-shaped.
 * Solvability is never assumed; production solver decides.
 */

import { createBoard, type BoardState, type CellValue } from '../core'
import { createPrng, shuffleInPlace, type SeededPrng } from './prng'
import type { DifficultyProfile } from './version'
import type { CandidateShape } from './types'

const SUM_PARTNERS: Record<number, number> = {
	1: 9,
	2: 8,
	3: 7,
	4: 6,
	5: 5,
	6: 4,
	7: 3,
	8: 2,
	9: 1,
}

export function shapeForProfile(
	profile: DifficultyProfile,
	prng: SeededPrng,
): CandidateShape {
	switch (profile) {
		case 'EASY':
			return {
				width: 5,
				initialCells: prng.nextIntInclusive(12, 16),
			}
		case 'MEDIUM':
			return {
				width: 6,
				initialCells: prng.nextIntInclusive(18, 24),
			}
		case 'HARD':
			return {
				width: 7,
				initialCells: prng.nextIntInclusive(24, 32),
			}
		case 'EXPERT':
			return {
				width: 7,
				initialCells: prng.nextIntInclusive(30, 40),
			}
		default: {
			const _exhaustive: never = profile
			return _exhaustive
		}
	}
}

/**
 * Build a value multiset with paired partners (equal or sum-10), then shuffle.
 */
export function buildPairedValues(
	count: number,
	prng: SeededPrng,
	options?: { readonly equalBias?: number },
): CellValue[] {
	const equalBias = options?.equalBias ?? 0.45
	const values: CellValue[] = []
	while (values.length + 1 < count) {
		const a = (prng.nextInt(9) + 1) as CellValue
		const useEqual = prng.next() < equalBias
		const b = (useEqual ? a : (SUM_PARTNERS[a] as CellValue))
		values.push(a, b)
	}
	if (values.length < count) {
		values.push((prng.nextInt(9) + 1) as CellValue)
	}
	return shuffleInPlace(values, prng)
}

/**
 * Place readable adjacent matchable pairs AFTER shuffle so openings exist.
 * Positions are same-row horizontal neighbors when possible.
 */
export function placeOpeningPairs(
	values: CellValue[],
	width: number,
	prng: SeededPrng,
	pairCount: number,
): CellValue[] {
	const next = values.slice()
	const candidates: number[] = []
	for (let i = 0; i < next.length - 1; i += 1) {
		if (Math.floor(i / width) === Math.floor((i + 1) / width)) {
			candidates.push(i)
		}
	}
	shuffleInPlace(candidates, prng)
	const used = new Set<number>()
	let placed = 0
	for (const start of candidates) {
		if (placed >= pairCount) break
		if (used.has(start) || used.has(start + 1)) continue
		const a = (prng.nextInt(9) + 1) as CellValue
		const b = (
			prng.next() < 0.55 ? a : (SUM_PARTNERS[a] as CellValue)
		)
		next[start] = a
		next[start + 1] = b
		used.add(start)
		used.add(start + 1)
		placed += 1
	}
	return next
}

export function createCandidateBoard(
	profile: DifficultyProfile,
	attemptSeed: number,
): { readonly board: BoardState; readonly shape: CandidateShape } {
	const prng = createPrng(attemptSeed)
	const shape = shapeForProfile(profile, prng)
	let values = buildPairedValues(shape.initialCells, prng, {
		equalBias:
			profile === 'EASY' ? 0.55 : profile === 'MEDIUM' ? 0.45 : 0.4,
	})
	const openings =
		profile === 'EASY' ? 3 : profile === 'MEDIUM' ? 2 : profile === 'HARD' ? 1 : 1
	values = placeOpeningPairs(values, shape.width, prng, openings)
	const board = createBoard(values, shape.width)
	return { board, shape }
}
