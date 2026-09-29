/**
 * Density fixture search CLI — Node only.
 * Usage: npx tsx src/dev/density/searchCli.ts
 */

import { generatePuzzle } from '../../game/generator'
import { DENSITY_EASYISH_RANGES, DENSITY_SEARCH_TARGETS, searchDensityFixture } from './search'
import type { DensityFixtureMeta } from './types'

function baselineCurrent(): DensityFixtureMeta {
	const result = generatePuzzle({
		seed: 10000,
		profile: 'EASY',
		maxCandidateAttempts: 80,
		deadEndAnalysis: false,
	})
	if (result.status !== 'accepted') {
		throw new Error(`baseline EASY generate failed: ${result.status}`)
	}
	const p = result.puzzle
	const rows = Math.ceil(p.board.cells.length / p.board.width)
	return {
		id: 'density-current',
		label: 'CURRENT — 5 cols',
		width: p.board.width,
		targetRows: rows,
		initialCells: p.board.cells.length,
		seed: p.identity.seed,
		kind: 'baseline-easy',
		fingerprint: p.identity.fingerprint,
		solutionDepth: p.metrics.solutionActionCount,
		initialLegalMoves: p.metrics.initialLegalMoves,
		choiceStates: p.metrics.choiceStates,
		forcedRatio: p.metrics.forcedRatio,
		appendCount: p.metrics.appendActionCount,
		maxRowsDuringSolution: p.metrics.maxRowsDuringSolution,
		difficultyScore: p.metrics.difficultyScore,
		note: 'CURRENT BASELINE — production EASY shape',
	}
}

function main(): void {
	const fixtures: DensityFixtureMeta[] = [baselineCurrent()]
	console.log('baseline', fixtures[0])

	for (const target of DENSITY_SEARCH_TARGETS) {
		const hit = searchDensityFixture(target, DENSITY_EASYISH_RANGES)
		if (!hit) {
			console.error('FAILED', target.id)
			process.exitCode = 1
			return
		}
		console.log(
			'OK',
			hit.meta.id,
			`seed=${hit.meta.seed}`,
			`cells=${hit.meta.initialCells}`,
			`open=${hit.meta.initialLegalMoves}`,
			`depth=${hit.meta.solutionDepth}`,
			`app=${hit.meta.appendCount}`,
			`score=${hit.meta.difficultyScore.toFixed(1)}`,
			`fp=${hit.meta.fingerprint}`,
			`attempts=${hit.attempts}`,
		)
		fixtures.push(hit.meta)
	}

	console.log('\n// Paste into fixtures.generated.ts')
	console.log(JSON.stringify(fixtures, null, '\t'))
}

main()
