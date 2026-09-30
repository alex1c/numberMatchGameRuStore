/**
 * Campaign catalog builder CLI — Node-only entrypoint.
 *
 * Usage:
 *   npm run campaign:build
 *   npm run campaign:build -- --levels 50
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
	buildCampaignCatalog,
	formatCatalogSource,
} from './builder'
import {
	countDensitiesInCampaign,
	countProfilesInCampaign,
	maxExpertStreak,
} from './rhythm'
import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from './version'
import { GENERATION_VERSION } from '../generator'

function parseLevels(argv: string[]): number {
	const idx = argv.indexOf('--levels')
	if (idx >= 0) {
		const raw = argv[idx + 1]
		const n = raw ? Number(raw) : NaN
		if (Number.isInteger(n) && n > 0 && n <= CAMPAIGN_LEVEL_COUNT) {
			return n
		}
		console.error('invalid --levels value')
		process.exit(2)
	}
	return CAMPAIGN_LEVEL_COUNT
}

function main(): void {
	const levels = parseLevels(process.argv.slice(2))
	console.log('Number Match campaign catalog build')
	console.log(
		JSON.stringify(
			{
				levels,
				campaignVersion: CAMPAIGN_VERSION,
				generationVersion: GENERATION_VERSION,
				rhythmCounts: countProfilesInCampaign(),
				densityCounts: countDensitiesInCampaign(),
				maxExpertStreak: maxExpertStreak(),
			},
			null,
			2,
		),
	)

	const result = buildCampaignCatalog({
		levelCount: levels,
		onProgress: (info) => {
			if (info.level === 1 || info.level % 25 === 0 || info.level === info.total) {
				console.log(
					`level ${info.level}/${info.total} ${info.profile} seed=${info.seed} fp=${info.fingerprint}`,
				)
			}
		},
	})

	console.log(
		`done ok=${result.ok} entries=${result.entries.length} elapsedMs=${result.elapsedMs} signature=${result.signature}`,
	)
	if (result.errors.length > 0) {
		console.error('errors:', result.errors)
	}

	if (!result.ok) {
		process.exitCode = 1
		return
	}

	// Only overwrite the shipped catalog when building the full 1000 levels.
	if (levels !== CAMPAIGN_LEVEL_COUNT) {
		console.log(
			`skipping catalog.generated.ts write (levels=${levels}, need ${CAMPAIGN_LEVEL_COUNT})`,
		)
		return
	}

	// Resolve from project cwd so tsx does not depend on __dirname/ESM shape.
	const outPath = resolve(
		process.cwd(),
		'src/game/campaign/catalog.generated.ts',
	)
	const source = formatCatalogSource(result.entries, result.signature)
	writeFileSync(outPath, source, 'utf8')
	console.log('wrote', outPath)
}

main()
