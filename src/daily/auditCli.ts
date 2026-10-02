/**
 * Daily calendar audit CLI — Node-only entrypoint.
 *
 * Usage:
 *   npm run daily:audit
 */

import { auditDailyCalendar, formatDailyAuditReport } from './audit'

function main(): void {
	console.log('Number Match daily audit (365-day window)')
	const report = auditDailyCalendar({
		dayCount: 365,
		onProgress: (info) => {
			if (
				info.index === 1 ||
				info.index % 50 === 0 ||
				info.index === info.total
			) {
				console.log(`checked ${info.index}/${info.total} (${info.dateKey})`)
			}
		},
	})

	console.log(formatDailyAuditReport(report))

	if (!report.ok) {
		process.exitCode = 1
	}
}

main()
