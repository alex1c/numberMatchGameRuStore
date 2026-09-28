/**
 * Deterministic desktop solver benchmark harness (not a Jest flaky timer gate).
 *
 * Usage: npm run solver:bench
 */

import {
	boardFromFixture,
	createBoard,
	type CellValue,
} from '../core'
import { solveBoard, type SolverOptions } from './index'

interface BenchCase {
	readonly name: string
	readonly board: ReturnType<typeof boardFromFixture>
	readonly options: SolverOptions
}

function denseBoard(width: number, rows: number): ReturnType<typeof createBoard> {
	const values: CellValue[] = []
	for (let i = 0; i < width * rows; i += 1) {
		values.push(((i % 9) + 1) as CellValue)
	}
	return createBoard(values, width)
}

const CASES: readonly BenchCase[] = [
	{
		name: 'EASY-like (1 9)',
		board: boardFromFixture('1 9', 2),
		options: { maxAppends: 1, maxStates: 5_000 },
	},
	{
		name: 'MEDIUM-like (blocker chain)',
		board: boardFromFixture(`
			1 2
			8 7
			9 3
		`, 2),
		options: { maxAppends: 2, maxStates: 10_000 },
	},
	{
		name: 'denser 6x6 synthetic',
		board: denseBoard(6, 6),
		options: { maxAppends: 2, maxStates: 25_000, maxDepth: 128 },
	},
	{
		name: 'append-required (1 2 3)',
		board: boardFromFixture('1 2 3', 3),
		options: { maxAppends: 1, maxStates: 5_000 },
	},
]

function countAppends(path: readonly { type: string }[]): number {
	return path.filter((a) => a.type === 'append').length
}

function pad(value: string, width: number): string {
	return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

function main(): void {
	console.log('Number Match solver benchmark (desktop, synthetic fixtures)')
	console.log(
		[
			pad('fixture', 28),
			pad('status', 12),
			pad('states', 8),
			pad('trans', 8),
			pad('depth', 6),
			pad('appends', 8),
			pad('ms', 6),
		].join(' '),
	)

	for (const bench of CASES) {
		const result = solveBoard(bench.board, bench.options)
		const depth =
			result.status === 'solved' ? String(result.stats.solutionDepth ?? 0) : '-'
		const appends =
			result.status === 'solved' ? String(countAppends(result.path)) : '-'
		const status =
			result.status === 'cutoff'
				? `cutoff:${result.reason}`
				: result.status
		console.log(
			[
				pad(bench.name, 28),
				pad(status, 12),
				pad(String(result.stats.exploredStates), 8),
				pad(String(result.stats.generatedTransitions), 8),
				pad(depth, 6),
				pad(appends, 8),
				pad(String(result.stats.elapsedMs), 6),
			].join(' '),
		)
	}
}

main()
