/**
 * Audit CLI — Node-only entrypoint.
 *
 * Usage:
 *   npm run generator:audit -- --small
 *   npm run generator:audit -- --400
 *   npm run generator:audit -- --full
 *   npm run generator:audit -- --full --compare
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import {
	auditFingerprintSignature,
	default400Targets,
	defaultFullTargets,
	defaultSmallTargets,
	median,
	percentile,
	runAudit,
	type AuditReport,
	type AcceptedPuzzle,
} from './index'
import { GENERATION_SOLVER_CONFIG } from './profiles'
import {
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
} from './version'

function parseArgs(argv: string[]) {
	const mode = argv.includes('--full')
		? 'full'
		: argv.includes('--400')
			? '400'
			: 'small'
	const compare = argv.includes('--compare')
	const write = argv.includes('--write')
	return { mode, compare, write }
}

function rejectCount(
	report: AuditReport,
	profile: string,
	reason: string,
): number {
	const row = report.profiles.find((p) => p.profile === profile)
	return row?.rejectionCounts[reason] ?? 0
}

function printSummary(report: AuditReport, label: string): void {
	console.log(`\n=== ${label} ===`)
	console.log(
		`ok=${report.ok} accepted=${report.acceptedTotal} attempts=${report.attemptsTotal} elapsedMs=${report.elapsedMs}`,
	)
	console.log(
		'Profile\tAccepted\tAttempts\tAcc%\tCutoff\tUnsolv\tDup\tOther',
	)
	for (const p of report.profiles) {
		const cutoff = p.rejectionCounts.solver_cutoff ?? 0
		const unsolv = p.rejectionCounts.solver_unsolvable ?? 0
		const dup = p.rejectionCounts.duplicate ?? 0
		const other = Object.entries(p.rejectionCounts)
			.filter(
				([k]) =>
					k !== 'solver_cutoff' &&
					k !== 'solver_unsolvable' &&
					k !== 'duplicate',
			)
			.reduce((s, [, v]) => s + v, 0)
		const acc =
			p.attempts === 0 ? 0 : Math.round((p.accepted / p.attempts) * 1000) / 10
		console.log(
			`${p.profile}\t${p.accepted}\t${p.attempts}\t${acc}\t${cutoff}\t${unsolv}\t${dup}\t${other}`,
		)
	}
	console.log(
		`invariants: unsolved=${report.acceptedUnsolved} cutoffAccepted=${report.acceptedCutoff} invalid=${report.acceptedInvalid} exactDup=${report.exactDuplicates} replayFail=${report.replayFailures}`,
	)
	if (report.invariantErrors.length > 0) {
		console.log('errors', report.invariantErrors)
	}
}

function metricTable(report: AuditReport): void {
	console.log('\n=== Difficulty distribution (median / p95 / max) ===')
	const headers = ['metric', ...report.profiles.map((p) => p.profile)]
	console.log(headers.join('\t'))
	const keys: {
		name: string
		pick: (p: AcceptedPuzzle) => number
	}[] = [
		{ name: 'cells', pick: (p) => p.metrics.initialCells },
		{ name: 'depth', pick: (p) => p.metrics.solutionActionCount },
		{ name: 'states', pick: (p) => p.metrics.exploredStates },
		{ name: 'choices', pick: (p) => p.metrics.choiceStates },
		{ name: 'forcedRatio', pick: (p) => p.metrics.forcedRatio },
		{ name: 'appends', pick: (p) => p.metrics.appendActionCount },
		{ name: 'maxRows', pick: (p) => p.metrics.maxRowsDuringSolution },
		{ name: 'score', pick: (p) => p.metrics.difficultyScore },
		{ name: 'initMoves', pick: (p) => p.metrics.initialLegalMoves },
	]
	for (const key of keys) {
		const cells = report.profiles.map((profile) => {
			const values = profile.puzzles.map(key.pick).sort((a, b) => a - b)
			return `${median(values)}/${percentile(values, 95)}/${values[values.length - 1] ?? 0}`
		})
		console.log([key.name, ...cells].join('\t'))
	}
}

function worstTen(report: AuditReport): AcceptedPuzzle[] {
	return report.profiles
		.flatMap((p) => p.puzzles)
		.slice()
		.sort(
			(a, b) =>
				b.metrics.exploredStates - a.metrics.exploredStates ||
				b.metrics.solutionActionCount - a.metrics.solutionActionCount,
		)
		.slice(0, 10)
}

function main(): void {
	const { mode, compare, write } = parseArgs(process.argv.slice(2))
	const targets =
		mode === 'full'
			? defaultFullTargets()
			: mode === '400'
				? default400Targets()
				: defaultSmallTargets()
	const baseSeed = mode === 'full' ? 10_000 : mode === '400' ? 5_000 : 42

	console.log('Number Match generator audit')
	console.log(
		JSON.stringify(
			{
				mode,
				baseSeed,
				generationVersion: GENERATION_VERSION,
				difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION,
				solver: GENERATION_SOLVER_CONFIG,
				targets,
			},
			null,
			2,
		),
	)

	const report = runAudit({
		targets,
		baseSeed,
		maxAttemptsPerPuzzle: 120,
		deadEndAnalysis: false,
	})
	printSummary(report, `${mode} audit`)
	metricTable(report)

	const worst = worstTen(report)
	console.log('\n=== Worst 10 by exploredStates ===')
	for (const p of worst) {
		console.log(
			[
				p.identity.profile,
				p.identity.seed,
				p.identity.fingerprint,
				`cells=${p.metrics.initialCells}`,
				`depth=${p.metrics.solutionActionCount}`,
				`states=${p.metrics.exploredStates}`,
				`choices=${p.metrics.choiceStates}`,
				`appends=${p.metrics.appendActionCount}`,
				`rows=${p.metrics.maxRowsDuringSolution}`,
				`dead=${p.metrics.deadEnd.deadEndRatio ?? 'null'}`,
				`ms=${p.metrics.solverElapsedMs}`,
			].join(' '),
		)
	}

	if (compare) {
		const report2 = runAudit({
			targets,
			baseSeed,
			maxAttemptsPerPuzzle: 120,
			deadEndAnalysis: false,
		})
		const a = auditFingerprintSignature(report)
		const b = auditFingerprintSignature(report2)
		console.log('\n=== Determinism rerun ===')
		console.log('signaturesEqual', a === b)
		if (a !== b) {
			process.exitCode = 2
			console.error('DETERMINISM FAILURE')
			return
		}
	}

	if (write) {
		const dir = resolve('artifacts/generator-audit')
		mkdirSync(dir, { recursive: true })
		const compact = {
			metadata: {
				project: 'numberMatchGameRuStore',
				generationVersion: GENERATION_VERSION,
				difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION,
				solver: GENERATION_SOLVER_CONFIG,
				baseSeed,
				mode,
				generatedAt: new Date().toISOString(),
			},
			ok: report.ok,
			acceptedTotal: report.acceptedTotal,
			attemptsTotal: report.attemptsTotal,
			elapsedMs: report.elapsedMs,
			profiles: report.profiles.map((p) => ({
				profile: p.profile,
				target: p.target,
				accepted: p.accepted,
				attempts: p.attempts,
				rejectionCounts: p.rejectionCounts,
				fingerprints: p.puzzles.map((x) => x.identity.fingerprint),
				seeds: p.puzzles.map((x) => x.identity.seed),
			})),
			worst: worst.map((p) => ({
				profile: p.identity.profile,
				seed: p.identity.seed,
				fingerprint: p.identity.fingerprint,
				metrics: p.metrics,
			})),
			nearDuplicates: report.nearDuplicates,
		}
		const path = resolve(dir, `${mode}-summary.json`)
		writeFileSync(path, JSON.stringify(compact, null, 2), 'utf8')
		console.log('wrote', path)
	}

	// Silence unused in small builds
	void rejectCount

	if (!report.ok) {
		process.exitCode = 1
	}
}

main()
