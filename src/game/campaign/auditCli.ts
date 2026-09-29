/**
 * Campaign catalog audit CLI — Node-only entrypoint.
 *
 * Usage:
 *   npm run campaign:audit
 *   npm run campaign:audit -- --full-generate
 */

import { auditCampaignCatalog, formatAuditReport } from './audit'
import { isCampaignCatalogReady } from './catalog'

function main(): void {
	if (!isCampaignCatalogReady()) {
		console.error('campaign catalog not ready — run npm run campaign:build first')
		process.exitCode = 1
		return
	}

	const fullGenerateProof = process.argv.includes('--full-generate')
	console.log('Number Match campaign audit')
	console.log(JSON.stringify({ fullGenerateProof }, null, 2))

	const report = auditCampaignCatalog({
		fullGenerateProof,
		onProgress: (info) => {
			if (info.level === 1 || info.level % 100 === 0 || info.level === info.total) {
				console.log(`checked ${info.level}/${info.total}`)
			}
		},
	})

	console.log(formatAuditReport(report))

	if (!report.ok || !report.signatureMatchesConstant || !report.signatureRerunEqual) {
		process.exitCode = 1
	}
}

main()
