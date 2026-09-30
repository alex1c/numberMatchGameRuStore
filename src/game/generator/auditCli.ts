/**
 * Audit CLI — Node-only entrypoint.
 *
 * Usage:
 *   npm run generator:audit -- --small
 *   npm run generator:audit -- --400
 *   npm run generator:audit -- --full
 *   npm run generator:audit -- --full --compare
 *   npm run generator:audit:gv3
 *   npm run generator:audit -- --gv3 --density all
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import {
	auditFingerprintSignature,
	default400Targets,
	defaultFullTargets,
	defaultGv3AuditTargets,
	defaultSmallTargets,
	median,
	percentile,
	runAudit,
	type AuditReport,
	type AcceptedPuzzle,
	type AuditProfileTarget,
	type CampaignDensity,
	CAMPAIGN_DENSITIES,
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
	GENERATION_VERSION_V2,
	GENERATION_SOLVER_CONFIG,
} from './index'

function parseArgs(argv: string[]) {
	const gv3 = argv.includes('--gv3')
	const mode = argv.includes('--full')
		? 'full'
		: argv.includes('--400')
			? '400'
			: gv3
				? 'gv3'
				: 'small'
	const compare = argv.includes('--compare')
	const write = argv.includes('--write')
	const densityIdx = argv.indexOf('--density')
	let densityFilter: 'all' | CampaignDensity | null = null
	if (densityIdx >= 0) {
		const raw = argv[densityIdx + 1]
		if (raw === 'all') {
			densityFilter = 'all'
		} else {
			const n = Number(raw)
			if (n === 7 || n === 8 || n === 9 || n === 10) {
				densityFilter = n
			}
		}
	}
	return { mode, compare, write, gv3: gv3 || mode === 'gv3', densityFilter }
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
		'Profile\tDensity\tAccepted\tAttempts\tAcc%\tCutoff\tUnsolv\tDup\tOther',
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
			`${p.profile}\t${p.density ?? '-'}\t${p.accepted}\t${p.attempts}\t${acc}\t${cutoff}\t${unsolv}\t${dup}\t${other}`,
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
	const headers = [
		'metric',
		...report.profiles.map((p) =>
			p.density !== undefined ? `${p.profile}@${p.density}` : p.profile,
		),
	]
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

function resolveTargets(
	mode: string,
	gv3: boolean,
	densityFilter: 'all' | CampaignDensity | null,
): AuditProfileTarget[] {
	if (gv3 || mode === 'gv3') {
		let targets = defaultGv3AuditTargets()
		if (densityFilter !== null && densityFilter !== 'all') {
			targets = targets.filter((t) => t.density === densityFilter)
		}
		return targets
	}
	// Historical gv2 audit targets (no density).
	if (mode === 'full') return defaultFullTargets()
	if (mode === '400') return default400Targets()
	return defaultSmallTargets()
}

function main(): void {
	const { mode, compare, write, gv3, densityFilter } = parseArgs(
		process.argv.slice(2),
	)
	const generationVersion = gv3 ? GENERATION_VERSION : GENERATION_VERSION_V2
	const targets = resolveTargets(mode, gv3, densityFilter)
	const baseSeed =
		mode === 'gv3' || gv3
			? 30_000
			: mode === 'full'
				? 10_000
				: mode === '400'
					? 5_000
					: 42

	console.log('Number Match generator audit')
	console.log(
		JSON.stringify(
			{
				mode,
				gv3,
				densityFilter,
				baseSeed,
				generationVersion,
				difficultyProfileVersion: gv3
					? DIFFICULTY_PROFILE_VERSION
					: 1,
				solver: GENERATION_SOLVER_CONFIG,
				targetCount: targets.reduce((s, t) => s + t.count, 0),
				densities: gv3 ? [...CAMPAIGN_DENSITIES] : undefined,
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
		generationVersion,
	})
	printSummary(report, `${mode} audit`)
	metricTable(report)

	const worst = worstTen(report)
	console.log('\n=== Worst 10 by exploredStates ===')
	for (const p of worst) {
		console.log(
			[
				p.identity.profile,
				p.identity.density !== undefined
					? `d${p.identity.density}`
					: '',
				p.identity.seed,
				p.identity.fingerprint,
				`cells=${p.metrics.initialCells}`,
				`depth=${p.metrics.solutionActionCount}`,
				`states=${p.metrics.exploredStates}`,
				`choices=${p.metrics.choiceStates}`,
				`appends=${p.metrics.appendActionCount}`,
				`rows=${p.metrics.maxRowsDuringSolution}`,
				`score=${p.metrics.difficultyScore}`,
				`dead=${p.metrics.deadEnd.deadEndRatio ?? 'null'}`,
				`ms=${p.metrics.solverElapsedMs}`,
			]
				.filter(Boolean)
				.join(' '),
		)
	}

	if (compare) {
		const report2 = runAudit({
			targets,
			baseSeed,
			maxAttemptsPerPuzzle: 120,
			deadEndAnalysis: false,
			generationVersion,
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
				generationVersion,
				difficultyProfileVersion: gv3
					? DIFFICULTY_PROFILE_VERSION
					: 1,
				solver: GENERATION_SOLVER_CONFIG,
				baseSeed,
				mode,
				gv3,
				generatedAt: new Date().toISOString(),
			},
			ok: report.ok,
			acceptedTotal: report.acceptedTotal,
			attemptsTotal: report.attemptsTotal,
			elapsedMs: report.elapsedMs,
			profiles: report.profiles.map((p) => ({
				profile: p.profile,
				density: p.density,
				target: p.target,
				accepted: p.accepted,
				attempts: p.attempts,
				rejectionCounts: p.rejectionCounts,
				fingerprints: p.puzzles.map((x) => x.identity.fingerprint),
				seeds: p.puzzles.map((x) => x.identity.seed),
			})),
			worst: worst.map((p) => ({
				profile: p.identity.profile,
				density: p.identity.density,
				seed: p.identity.seed,
				fingerprint: p.identity.fingerprint,
				metrics: p.metrics,
			})),
			nearDuplicates: report.nearDuplicates,
		}
		const path = resolve(
			dir,
			`${gv3 ? 'gv3' : mode}-summary.json`,
		)
		writeFileSync(path, JSON.stringify(compact, null, 2), 'utf8')
		console.log('wrote', path)
	}

	void rejectCount

	if (!report.ok) {
		process.exitCode = 1
	}
}

main()
