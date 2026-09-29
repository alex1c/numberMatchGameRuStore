/**
 * Persistence layer tests — races, migration, session validation, boards.
 */

import { appendRemainingNumbers, createBoard, type CellValue } from '../../game/core'
import { getCampaignEntry } from '../../game/campaign'
import {
	PERSIST_HISTORY_BOUND,
	PersistRepository,
	PersistWriteQueue,
	STORAGE_KEY,
	buildActiveSession,
	createDefaultRoot,
	createFailingWriteAdapter,
	createMemoryAdapter,
	deserializeBoard,
	migrateToCurrent,
	parsePersistedRootJson,
	roundTripBoard,
	serializeBoard,
	validatePersistedRoot,
	validateSessionSemantics,
} from '../index'

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
		board,
		initialBoard: board,
		history: [],
		counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
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

	it('round-trips a collapsed / partially removed board', () => {
		const board = sampleBoard()
		const cells = board.cells.map((c, i) =>
			i < 3 ? { ...c, removed: true } : c,
		)
		const collapsed = { ...board, cells }
		expect(roundTripBoard(collapsed)).toEqual(collapsed)
	})

	it('rejects invalid root JSON without casting', () => {
		const result = parsePersistedRootJson('{"schemaVersion":1}')
		expect(result.ok).toBe(false)
	})

	it('accepts a valid default-shaped root', () => {
		const root = createDefaultRoot()
		const result = validatePersistedRoot(root)
		expect(result.ok).toBe(true)
	})
})

describe('migrateToCurrent', () => {
	it('returns defaults for null / empty', () => {
		expect(migrateToCurrent(null).schemaVersion).toBe(1)
		expect(migrateToCurrent('').highestCompletedLevel).toBe(0)
	})

	it('returns defaults for unknown future schema', () => {
		const raw = JSON.stringify({
			schemaVersion: 99,
			campaignVersion: 1,
			revision: 3,
			trainingCompleted: true,
			highestCompletedLevel: 50,
			activeSession: null,
		})
		const migrated = migrateToCurrent(raw)
		expect(migrated.highestCompletedLevel).toBe(0)
		expect(migrated.trainingCompleted).toBe(false)
	})

	it('keeps a valid v1 document', () => {
		const root = {
			...createDefaultRoot(),
			revision: 4,
			highestCompletedLevel: 12,
			trainingCompleted: true,
		}
		const migrated = migrateToCurrent(JSON.stringify(root))
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

	it('rejects progression off the frontier', () => {
		const session = sampleSession({ level: 5 })
		const result = validateSessionSemantics(
			{ highestCompletedLevel: 2 },
			session,
			{ catalogAvailable: false },
		)
		expect(result.ok).toBe(false)
	})

	it('accepts replay at or below frontier', () => {
		const session = sampleSession({
			purpose: 'replay',
			level: 4,
		})
		const result = validateSessionSemantics(
			{ highestCompletedLevel: 10 },
			session,
			{ catalogAvailable: false },
		)
		expect(result.ok).toBe(true)
	})

	it('rejects replay above frontier', () => {
		const session = sampleSession({
			purpose: 'replay',
			level: 11,
		})
		const result = validateSessionSemantics(
			{ highestCompletedLevel: 10 },
			session,
			{ catalogAvailable: false },
		)
		expect(result.ok).toBe(false)
	})
})

describe('PersistRepository', () => {
	it('hydrates once and preserves frontier when fingerprint mismatches catalog', async () => {
		const adapter = createMemoryAdapter()
		const board = sampleBoard()
		const session = buildActiveSession({
			purpose: 'progression',
			status: 'in_progress',
			level: 1,
			seed: 999,
			profile: 'EASY',
			fingerprint: 'fdeadbeef',
			board,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
		})
		const stored = {
			...createDefaultRoot(),
			revision: 2,
			highestCompletedLevel: 0,
			activeSession: session,
		}
		await adapter.setItem(STORAGE_KEY, JSON.stringify(stored))

		const repo = new PersistRepository(adapter)
		const root = await repo.hydrate()

		// Catalog is ready: mismatched fingerprint drops active, keeps frontier.
		expect(root.highestCompletedLevel).toBe(0)
		expect(root.revision).toBe(2)
		expect(root.activeSession).toBeNull()
		void board
	})

	it('serializes writes and rejects stale revisions', async () => {
		const adapter = createMemoryAdapter()
		const queue = new PersistWriteQueue(adapter)
		const a = { ...createDefaultRoot(), revision: 1 }
		const b = { ...createDefaultRoot(), revision: 2 }
		const stale = { ...createDefaultRoot(), revision: 1 }

		const r1 = await queue.enqueueWrite(a)
		const r2 = await queue.enqueueWrite(b)
		const r3 = await queue.enqueueWrite(stale)
		expect(r1.ok).toBe(true)
		expect(r2.ok).toBe(true)
		expect(r3.ok).toBe(false)
		if (!r3.ok) {
			expect(r3.reason).toBe('stale_write')
		}

		const disk = JSON.parse((await adapter.getItem(STORAGE_KEY))!) as {
			revision: number
		}
		expect(disk.revision).toBe(2)
	})

	it('handles concurrent update races with monotonic revisions', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()

		const tasks = Array.from({ length: 8 }, (_, i) =>
			repo.update((current) => ({
				...current,
				trainingCompleted: i % 2 === 0,
				highestCompletedLevel: Math.min(1000, current.highestCompletedLevel + 1),
			})),
		)
		const results = await Promise.all(tasks)
		const root = repo.getRoot()
		expect(root.revision).toBeGreaterThanOrEqual(1)
		expect(results.every((r) => r.write.ok || r.write.reason === 'stale_write')).toBe(
			true,
		)
		// At least some writes should succeed.
		expect(results.some((r) => r.write.ok)).toBe(true)
	})

	it('recovers after write failure without losing prior disk state', async () => {
		const inner = createMemoryAdapter()
		await inner.setItem(
			STORAGE_KEY,
			JSON.stringify({ ...createDefaultRoot(), revision: 5 }),
		)
		const failing = createFailingWriteAdapter(inner, 0)
		const queue = new PersistWriteQueue(failing)
		// Seed last-written from disk via a successful path first using inner.
		const warm = new PersistWriteQueue(inner)
		await warm.enqueueWrite({ ...createDefaultRoot(), revision: 5 })

		const result = await queue.enqueueWrite({
			...createDefaultRoot(),
			revision: 6,
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.reason).toBe('write_failed')
		}
		const disk = migrateToCurrent(await inner.getItem(STORAGE_KEY))
		expect(disk.revision).toBe(5)
	})

	it('bounds history at PERSIST_HISTORY_BOUND', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()
		const board = sampleBoard()
		const history = Array.from({ length: PERSIST_HISTORY_BOUND + 10 }, () =>
			serializeBoard(board),
		)
		// Use a real catalog identity so session semantics keep the active session.
		const entry = getCampaignEntry(1)
		const session = {
			...sampleSession({
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
			}),
			history,
			board: serializeBoard(board),
			nextCellSeq: board.nextCellSeq,
		}
		await repo.setActiveSession(session)
		const root = repo.getRoot()
		expect(root.activeSession).not.toBeNull()
		expect(root.activeSession!.history.length).toBeLessThanOrEqual(
			PERSIST_HISTORY_BOUND,
		)
	})

	it('deserializes nextCellSeq from board after append session', () => {
		const board = appendRemainingNumbers(sampleBoard())
		const persisted = serializeBoard(board)
		expect(persisted.nextCellSeq).toBe(board.nextCellSeq)
		expect(deserializeBoard(persisted).nextCellSeq).toBe(board.nextCellSeq)
	})
})
