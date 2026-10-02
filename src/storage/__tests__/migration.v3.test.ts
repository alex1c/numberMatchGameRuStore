/**
 * Schema v2 → v3 migration preserves campaign progress and help flags.
 */

import { createBoard, type CellValue } from '../../game/core'
import { getCampaignEntry } from '../../game/campaign'
import {
	PERSIST_SCHEMA_VERSION,
	buildActiveSession,
	createDefaultRoot,
	migrateToCurrent,
} from '../index'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

describe('migrateToCurrent schema v3', () => {
	it('v2 sample with campaign progress, stars, activeSession, and help flags migrates with ALL preserved', () => {
		const entry = getCampaignEntry(5)
		const board = sampleBoard()
		const rootV2 = {
			schemaVersion: 2 as const,
			campaignVersion: 2 as const,
			revision: 11,
			trainingCompleted: true,
			highestCompletedLevel: 5,
			bestStars: createDefaultRoot().bestStars.map((star, index) =>
				index < 5 ? (star < 2 ? 2 : star) : star,
			),
			activeSession: buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 6,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board,
				initialBoard: board,
				history: [board],
				counters: { matchesRemoved: 2, appendActions: 1, undoActions: 0 },
				usedHint: true,
				usedUndo: false,
				freeHintConsumed: true,
				freeUndoConsumed: false,
			}),
		}

		const migrated = migrateToCurrent(JSON.stringify(rootV2))

		expect(migrated.schemaVersion).toBe(PERSIST_SCHEMA_VERSION)
		expect(migrated.campaignVersion).toBe(2)
		expect(migrated.revision).toBe(11)
		expect(migrated.trainingCompleted).toBe(true)
		expect(migrated.highestCompletedLevel).toBe(5)
		expect(migrated.bestStars.slice(0, 5).every((s) => s >= 2)).toBe(true)

		expect(migrated.activeSession).not.toBeNull()
		expect(migrated.activeSession?.level).toBe(6)
		expect(migrated.activeSession?.usedHint).toBe(true)
		expect(migrated.activeSession?.usedUndo).toBe(false)
		expect(migrated.activeSession?.freeHintConsumed).toBe(true)
		expect(migrated.activeSession?.freeUndoConsumed).toBe(false)
		expect(migrated.activeSession?.counters.matchesRemoved).toBe(2)

		expect(migrated.daily.history).toEqual([])
		expect(migrated.daily.activeDaily).toBeNull()
		expect(migrated.statistics).toEqual({
			pairsRemoved: 0,
			appendActions: 0,
			hintsDelivered: 0,
			undoActions: 0,
		})
		expect(migrated.achievementNotifiedIds).toEqual([])
		expect(migrated.settings.themePreference).toBe('system')
	})

	it('schema v1 produces v3 with reset campaign', () => {
		const raw = JSON.stringify({
			schemaVersion: 1,
			campaignVersion: 1,
			revision: 2,
			trainingCompleted: true,
			highestCompletedLevel: 9,
			activeSession: null,
		})
		const migrated = migrateToCurrent(raw)
		expect(migrated.schemaVersion).toBe(3)
		expect(migrated.trainingCompleted).toBe(true)
		expect(migrated.highestCompletedLevel).toBe(0)
		expect(migrated.daily).toBeDefined()
	})
})
