/**
 * Persistence layer tests — schema v2, stars, migration, session validation.
 */

import { appendRemainingNumbers, createBoard, type CellValue } from '../../game/core'
import { getCampaignEntry } from '../../game/campaign'
import {
	PERSIST_HISTORY_BOUND,
	PERSIST_SCHEMA_VERSION,
	PersistRepository,
	PersistWriteQueue,
	STORAGE_KEY,
	buildActiveSession,
	createDefaultRoot,
	createFailingWriteAdapter,
	createMemoryAdapter,
	migrateToCurrent,
	parsePersistedRootJson,
	roundTripBoard,
	validatePersistedRoot,
	validateSessionSemantics,
} from '../index'
import { maxStarsPossible, totalStars } from '../../game/stars'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

function sampleSession(
	overrides: Partial<Parameters<typeof buildActiveSession>[0]> = {},
) {
	const board = sampleBoard()
	return buildActiveSession({
		purpose: 'progression',
		status: 'in_progress',
		level: 1,
		seed: 42,
		profile: 'EASY',
		fingerprint: 'f00000001',
		density: 7,
		board,
		initialBoard: board,
		history: [],
		counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
		usedHint: false,
		usedUndo: false,
		...overrides,
	})
}

describe('serialize / validate', () => {
	it('round-trips a board including after append', () => {
		const board = sampleBoard()
		const appended = appendRemainingNumbers(board)
		const back = roundTripBoard(appended)
		expect(back).toEqual(appended)
		expect(back.nextCellSeq).toBe(appended.nextCellSeq)
	})

	it('rejects invalid root JSON without casting', () => {
		const result = parsePersistedRootJson('{"schemaVersion":1}')
		expect(result.ok).toBe(false)
	})

	it('accepts a valid default-shaped root (schema v2)', () => {
		const root = createDefaultRoot()
		expect(root.schemaVersion).toBe(PERSIST_SCHEMA_VERSION)
		expect(root.bestStars).toHaveLength(1000)
		const result = validatePersistedRoot(root)
		expect(result.ok).toBe(true)
	})
})

describe('migrateToCurrent', () => {
	it('returns defaults for null / empty', () => {
		expect(migrateToCurrent(null).schemaVersion).toBe(2)
		expect(migrateToCurrent('').highestCompletedLevel).toBe(0)
	})

	it('returns defaults for unknown future schema', () => {
		const raw = JSON.stringify({
			schemaVersion: 99,
			campaignVersion: 2,
			revision: 3,
			trainingCompleted: true,
			highestCompletedLevel: 50,
			activeSession: null,
		})
		const migrated = migrateToCurrent(raw)
		expect(migrated.highestCompletedLevel).toBe(0)
		expect(migrated.trainingCompleted).toBe(false)
	})

	it('schema v1 → v2 preserves training and resets campaign/stars', () => {
		const raw = JSON.stringify({
			schemaVersion: 1,
			campaignVersion: 1,
			revision: 4,
			trainingCompleted: true,
			highestCompletedLevel: 12,
			activeSession: { mode: 'campaign' },
		})
		const migrated = migrateToCurrent(raw)
		expect(migrated.schemaVersion).toBe(2)
		expect(migrated.campaignVersion).toBe(2)
		expect(migrated.trainingCompleted).toBe(true)
		expect(migrated.highestCompletedLevel).toBe(0)
		expect(migrated.activeSession).toBeNull()
		expect(totalStars(migrated.bestStars)).toBe(0)
	})

	it('keeps a valid v2 document', () => {
		const root = {
			...createDefaultRoot(),
			revision: 4,
			highestCompletedLevel: 12,
			trainingCompleted: true,
		}
		// Repair stars for frontier so validation invariant holds.
		const withStars = {
			...root,
			bestStars: root.bestStars.map((s, i) =>
				i < 12 ? (s < 1 ? 1 : s) : s,
			),
		}
		const migrated = migrateToCurrent(JSON.stringify(withStars))
		expect(migrated.revision).toBe(4)
		expect(migrated.highestCompletedLevel).toBe(12)
		expect(migrated.trainingCompleted).toBe(true)
	})
})

describe('validateSessionSemantics', () => {
	it('accepts progression at frontier+1', () => {
		const session = sampleSession({ level: 3 })
		const result = validateSessionSemantics(
			{ highestCompletedLevel: 2 },
			session,
			{ catalogAvailable: false },
		)
		expect(result.ok).toBe(true)
	})

	it('rejects progression not at frontier', () => {
		const session = sampleSession({ level: 5 })
		const result = validateSessionSemantics(
			{ highestCompletedLevel: 2 },
			session,
			{ catalogAvailable: false },
		)
		expect(result.ok).toBe(false)
	})
})

describe('stars persistence', () => {
	it('completion awards stars; replay cannot lower best', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const entry = getCampaignEntry(1)
		const board = sampleBoard()
		const cleared = {
			...board,
			cells: board.cells.map((c) => ({ ...c, removed: true })),
		}

		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board,
				initialBoard: board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)

		await repo.commitProgressionCompletion({
			level: 1,
			board: cleared,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			seed: entry.seed,
			profile: entry.profile,
			fingerprint: entry.fingerprint,
			density: entry.density,
			usedHint: true,
			usedUndo: true,
		})
		expect(repo.getRoot().bestStars[0]).toBe(1)
		expect(repo.getTotalStars()).toBe(1)

		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'replay',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board,
				initialBoard: board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)
		await repo.commitReplayCompletion({
			level: 1,
			board: cleared,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			seed: entry.seed,
			profile: entry.profile,
			fingerprint: entry.fingerprint,
			density: entry.density,
			usedHint: false,
			usedUndo: false,
		})
		expect(repo.getRoot().bestStars[0]).toBe(3)
		expect(repo.getTotalStars()).toBe(3)

		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'replay',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board,
				initialBoard: board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)
		await repo.commitReplayCompletion({
			level: 1,
			board: cleared,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			seed: entry.seed,
			profile: entry.profile,
			fingerprint: entry.fingerprint,
			density: entry.density,
			usedHint: true,
			usedUndo: true,
		})
		expect(repo.getRoot().bestStars[0]).toBe(3)
		expect(repo.getTotalStars()).toBe(3)
	})

	it('cold restore preserves usedHint and freeHintConsumed on active session', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()
		const entry = getCampaignEntry(1)
		const board = sampleBoard()
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board,
				initialBoard: board,
				history: [board],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				usedHint: true,
				usedUndo: false,
				freeHintConsumed: true,
				freeUndoConsumed: false,
			}),
		)

		const repo2 = new PersistRepository(adapter)
		const root = await repo2.hydrate()
		expect(root.activeSession?.usedHint).toBe(true)
		expect(root.activeSession?.usedUndo).toBe(false)
		expect(root.activeSession?.freeHintConsumed).toBe(true)
		expect(root.activeSession?.freeUndoConsumed).toBe(false)
	})

	it('defaults missing free* from used* for pre-split schema v2 saves', () => {
		const board = sampleBoard()
		const raw = {
			...createDefaultRoot(),
			activeSession: {
				mode: 'campaign',
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				generationVersion: 3,
				seed: 1,
				profile: 'EASY',
				fingerprint: 'f1',
				density: 7,
				board: {
					width: board.width,
					nextCellSeq: board.nextCellSeq,
					cells: board.cells.map((c) => ({
						id: c.id,
						value: c.value,
						removed: c.removed,
					})),
				},
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
				nextCellSeq: board.nextCellSeq,
				usedHint: true,
				usedUndo: false,
				// freeHintConsumed / freeUndoConsumed intentionally omitted
			},
		}
		const parsed = validatePersistedRoot(raw)
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) {
			return
		}
		expect(parsed.value.activeSession?.freeHintConsumed).toBe(true)
		expect(parsed.value.activeSession?.freeUndoConsumed).toBe(false)
	})

	it('total stars max is 3000', () => {
		expect(maxStarsPossible(1000)).toBe(3000)
	})
})

describe('write queue / history bound', () => {
	it('exposes history bound constant', () => {
		expect(PERSIST_HISTORY_BOUND).toBe(64)
	})

	it('recovers from failing write adapter', async () => {
		const base = createMemoryAdapter()
		const failing = createFailingWriteAdapter(base, 0)
		const repo = new PersistRepository(failing)
		await repo.hydrate()
		await repo.setTrainingCompleted(true)
		// May keep prior disk truth depending on adapter failure mode.
		expect(repo.isHydrated()).toBe(true)
		void PersistWriteQueue
		void STORAGE_KEY
	})
})
