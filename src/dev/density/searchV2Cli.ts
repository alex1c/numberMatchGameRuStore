/**
 * Search 8-column vertical-fill V2 fixtures (DEV tooling only).
 * Usage: npx tsx src/dev/density/searchV2Cli.ts
 */

import {
	DENSITY_EASYISH_RANGES,
	searchDensityFixture,
	type DensitySearchAcceptRanges,
	type DensitySearchTarget,
} from './search'
import type { DensityFixtureMeta } from './types'

/** Wider bands for tall 8-col boards — still approachable, not EXPERT-shaped. */
const V2_RANGES: DensitySearchAcceptRanges = {
	...DENSITY_EASYISH_RANGES,
	minOpeningMoves: 4,
	maxOpeningMoves: 120,
	minDepth: 12,
	maxDepth: 55,
	maxAppends: 1,
	minScore: 40,
	maxScore: 400,
}

const V2_TARGETS: readonly DensitySearchTarget[] = [
	{
		id: 'density-8x6',
		label: '8 × 6 — 48 чисел',
		width: 8,
		targetRows: 6,
		initialCells: 48,
		note: 'V2 vertical baseline — OPPO preferred width',
		baseSeed: 8_006_001,
		maxAttempts: 200,
	},
	{
		id: 'density-8x7',
		label: '8 × 7 — 56 чисел',
		width: 8,
		targetRows: 7,
		initialCells: 56,
		note: 'V2 vertical 8×7',
		baseSeed: 8_007_001,
		maxAttempts: 200,
	},
	{
		id: 'density-8x8',
		label: '8 × 8 — 64 числа',
		width: 8,
		targetRows: 8,
		initialCells: 64,
		note: 'V2 vertical 8×8',
		baseSeed: 8_008_001,
		maxAttempts: 240,
	},
	{
		id: 'density-8x9',
		label: '8 × 9 — 72 числа',
		width: 8,
		targetRows: 9,
		initialCells: 72,
		note: 'V2 vertical 8×9',
		baseSeed: 8_009_001,
		maxAttempts: 280,
	},
	{
		id: 'density-8x10',
		label: '8 × 10 — 80 чисел',
		width: 8,
		targetRows: 10,
		initialCells: 80,
		note: 'V2 vertical 8×10',
		baseSeed: 8_010_001,
		maxAttempts: 320,
	},
]

function main(): void {
	const fixtures: DensityFixtureMeta[] = []
	for (const target of V2_TARGETS) {
		console.log('searching', target.id, '...')
		const hit = searchDensityFixture(target, V2_RANGES)
		if (!hit) {
			console.error('FAILED', target.id)
			process.exitCode = 1
			return
		}
		const m = hit.meta
		console.log(
			'OK',
			m.id,
			`seed=${m.seed}`,
			`cells=${m.initialCells}`,
			`open=${m.initialLegalMoves}`,
			`depth=${m.solutionDepth}`,
			`app=${m.appendCount}`,
			`maxRows=${m.maxRowsDuringSolution}`,
			`score=${m.difficultyScore.toFixed(1)}`,
			`fp=${m.fingerprint}`,
			`attempts=${hit.attempts}`,
		)
		fixtures.push({
			...m,
			label: target.label,
			note: target.note,
		})
	}
	console.log('\n// V2 metas JSON')
	console.log(JSON.stringify(fixtures, null, '\t'))
}

main()
