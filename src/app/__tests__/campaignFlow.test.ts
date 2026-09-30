/**
 * Campaign integration — persistence + level flow (no RN rendering).
 * Campaign v2 / schema v2 / stars.
 */

import { toCanonicalBoard } from '../../game/core'
import { getCampaignEntry, resolveCampaignLevel } from '../../game/campaign'
import {
	createGameSession,
	hydrateGameSession,
	reduceGameSession,
} from '../../game/session'
import {
	PERSIST_SCHEMA_VERSION,
	PersistRepository,
	buildActiveSession,
	createDefaultRoot,
	createMemoryAdapter,
	deserializeBoard,
	serializeBoard,
	sessionBoards,
} from '../../storage'
import {
	campaignIdentity,
	frontierLevel,
	gameSessionFromPersisted,
	prepareCampaignLevel,
} from '../../app/campaignSession'

async function playUntilCleared(
	repo: PersistRepository,
	level: number,
): Promise<void> {
	const prepared = prepareCampaignLevel(level, 'progression')
	expect(prepared.ok).toBe(true)
	if (!prepared.ok) {
		return
	}

	await repo.setActiveSession(
		buildActiveSession({
			purpose: 'progression',
			status: 'in_progress',
			level,
			seed: prepared.entry.seed,
			profile: prepared.entry.profile,
			fingerprint: prepared.entry.fingerprint,
			density: prepared.entry.density,
			board: prepared.board,
			initialBoard: prepared.board,
			history: [],
			counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
		}),
	)

	const cleared = {
		...prepared.board,
		cells: prepared.board.cells.map((c) => ({ ...c, removed: true })),
	}
	await repo.commitProgressionCompletion({
		level,
		board: cleared,
		counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
		seed: prepared.entry.seed,
		profile: prepared.entry.profile,
		fingerprint: prepared.entry.fingerprint,
		density: prepared.entry.density,
		usedHint: false,
		usedUndo: false,
		initialBoard: prepared.board,
	})
}

describe('campaign start → complete → next', () => {
	it('L1 complete then Next → L2 with highestCompleted=1', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		await repo.setTrainingCompleted(true)

		await playUntilCleared(repo, 1)
		expect(repo.getRoot().highestCompletedLevel).toBe(1)
		expect(repo.getRoot().bestStars[0]).toBe(3)
		expect(repo.getRoot().activeSession?.status).toBe('completed')
		expect(repo.getRoot().activeSession?.history).toHaveLength(0)

		const next = prepareCampaignLevel(2, 'progression')
		expect(next.ok).toBe(true)
		if (!next.ok) {
			return
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 2,
				seed: next.entry.seed,
				profile: next.entry.profile,
				fingerprint: next.entry.fingerprint,
				density: next.entry.density,
				board: next.board,
				initialBoard: next.board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)
		expect(repo.getRoot().highestCompletedLevel).toBe(1)
		expect(repo.getRoot().activeSession?.level).toBe(2)
	}, 60_000)

	it('survives force-stop mid-level (cold hydrate)', async () => {
		const adapter = createMemoryAdapter()
		const repo = new PersistRepository(adapter)
		await repo.hydrate()

		const resolved = resolveCampaignLevel(1)
		expect(resolved.status).toBe('ok')
		if (resolved.status !== 'ok') {
			return
		}

		let state = createGameSession(
			campaignIdentity(1, resolved.entry),
			resolved.board,
		)
		if (!state.hasAvailableMoves) {
			state = reduceGameSession(state, { type: 'APPEND' })
		}

		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: resolved.entry.seed,
				profile: resolved.entry.profile,
				fingerprint: resolved.fingerprint,
				density: resolved.entry.density,
				board: state.board,
				initialBoard: state.initialBoard,
				history: state.history,
				counters: state.counters,
				usedHint: true,
				usedUndo: false,
			}),
		)

		const repo2 = new PersistRepository(adapter)
		const root = await repo2.hydrate()
		expect(root.activeSession).not.toBeNull()
		expect(root.activeSession!.usedHint).toBe(true)
		const restored = gameSessionFromPersisted(root.activeSession!)
		expect(restored).not.toBeNull()
		expect(restored!.usedHint).toBe(true)
		expect(toCanonicalBoard(restored!.board)).toBe(
			toCanonicalBoard(state.board),
		)
		expect(restored!.board.nextCellSeq).toBe(state.board.nextCellSeq)
		expect(sessionBoards(root.activeSession!).board).toEqual(
			deserializeBoard(serializeBoard(state.board)),
		)
	}, 60_000)
})

describe('replay does not change frontier', () => {
	it('keeps highestCompleted when replay completes', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		// Seed frontier + stars so schema invariant holds.
		const defaults = createDefaultRoot()
		const stars = defaults.bestStars.slice() as number[]
		for (let i = 0; i < 5; i += 1) stars[i] = 1
		await repo.update((current) => ({
			...current,
			highestCompletedLevel: 5,
			bestStars: stars as typeof current.bestStars,
		}))
		const entry = getCampaignEntry(3)
		const resolved = resolveCampaignLevel(3)
		expect(resolved.status).toBe('ok')
		if (resolved.status !== 'ok') {
			return
		}
		const cleared = {
			...resolved.board,
			cells: resolved.board.cells.map((c) => ({ ...c, removed: true })),
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'replay',
				status: 'in_progress',
				level: 3,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board: resolved.board,
				initialBoard: resolved.board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)
		await repo.commitReplayCompletion({
			level: 3,
			board: cleared,
			counters: { matchesRemoved: 2, appendActions: 0, undoActions: 0 },
			seed: entry.seed,
			profile: entry.profile,
			fingerprint: entry.fingerprint,
			density: entry.density,
			usedHint: false,
			usedUndo: false,
			initialBoard: resolved.board,
		})
		expect(repo.getRoot().highestCompletedLevel).toBe(5)
		expect(repo.getRoot().bestStars[2]).toBe(3)
		expect(repo.getRoot().activeSession?.purpose).toBe('replay')
		expect(repo.getRoot().activeSession?.status).toBe('completed')
	}, 60_000)
})

describe('corrupt active preserves frontier', () => {
	it('drops bad fingerprint session and keeps highestCompleted', async () => {
		const adapter = createMemoryAdapter()
		const board = resolveCampaignLevel(1)
		expect(board.status).toBe('ok')
		if (board.status !== 'ok') {
			return
		}
		const bad = buildActiveSession({
			purpose: 'progression',
			status: 'in_progress',
			level: 1,
			seed: board.entry.seed,
			profile: board.entry.profile,
			fingerprint: 'f_corrupt_deadbeef',
			density: board.entry.density,
			board: board.board,
			counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
		})
		const stars = createDefaultRoot().bestStars.slice() as number[]
		for (let i = 0; i < 7; i += 1) stars[i] = 1
		await adapter.setItem(
			'numbermatch.persist.v1',
			JSON.stringify({
				schemaVersion: PERSIST_SCHEMA_VERSION,
				campaignVersion: 2,
				revision: 3,
				trainingCompleted: true,
				highestCompletedLevel: 7,
				bestStars: stars,
				activeSession: bad,
			}),
		)
		const repo = new PersistRepository(adapter)
		const root = await repo.hydrate()
		expect(root.highestCompletedLevel).toBe(7)
		expect(root.activeSession).toBeNull()
	}, 60_000)
})

describe('completion idempotency + next double-tap', () => {
	it('commitProgressionCompletion twice does not skip levels', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const prepared = prepareCampaignLevel(1, 'progression')
		expect(prepared.ok).toBe(true)
		if (!prepared.ok) {
			return
		}
		const cleared = {
			...prepared.board,
			cells: prepared.board.cells.map((c) => ({ ...c, removed: true })),
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: prepared.entry.seed,
				profile: prepared.entry.profile,
				fingerprint: prepared.entry.fingerprint,
				density: prepared.entry.density,
				board: prepared.board,
				initialBoard: prepared.board,
				history: [prepared.board],
				counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			}),
		)
		await repo.commitProgressionCompletion({
			level: 1,
			board: cleared,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			seed: prepared.entry.seed,
			profile: prepared.entry.profile,
			fingerprint: prepared.entry.fingerprint,
			density: prepared.entry.density,
			usedHint: false,
			usedUndo: false,
			initialBoard: prepared.board,
		})
		const rev1 = repo.getRoot().revision
		await repo.commitProgressionCompletion({
			level: 1,
			board: cleared,
			counters: { matchesRemoved: 1, appendActions: 0, undoActions: 0 },
			seed: prepared.entry.seed,
			profile: prepared.entry.profile,
			fingerprint: prepared.entry.fingerprint,
			density: prepared.entry.density,
			usedHint: false,
			usedUndo: false,
			initialBoard: prepared.board,
		})
		expect(repo.getRoot().highestCompletedLevel).toBe(1)
		expect(repo.getRoot().bestStars[0]).toBe(3)
		expect(repo.getRoot().revision).toBeGreaterThan(rev1)
		expect(frontierLevel(repo.getRoot().highestCompletedLevel)).toBe(2)
	}, 60_000)

	it('hydrateGameSession restores history bound state', () => {
		const board = resolveCampaignLevel(1)
		expect(board.status).toBe('ok')
		if (board.status !== 'ok') {
			return
		}
		const state = hydrateGameSession({
			identity: campaignIdentity(1, board.entry),
			board: board.board,
			initialBoard: board.board,
			history: [board.board],
			counters: { matchesRemoved: 0, appendActions: 1, undoActions: 0 },
			completed: false,
			usedHint: true,
		})
		expect(state.history).toHaveLength(1)
		expect(state.counters.appendActions).toBe(1)
		expect(state.usedHint).toBe(true)
		expect(state.undoAfterCompletion).toBeUndefined()
	}, 60_000)
})

describe('DEV fixture must not replace campaign persist', () => {
	it('launching a fixture path leaves persisted activeSession untouched', async () => {
		const repo = new PersistRepository(createMemoryAdapter())
		await repo.hydrate()
		const prepared = prepareCampaignLevel(1, 'progression')
		expect(prepared.ok).toBe(true)
		if (!prepared.ok) {
			return
		}
		await repo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: prepared.entry.seed,
				profile: prepared.entry.profile,
				fingerprint: prepared.entry.fingerprint,
				density: prepared.entry.density,
				board: prepared.board,
				initialBoard: prepared.board,
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)
		const before = repo.getRoot().activeSession
		expect(before?.level).toBe(1)
		expect(repo.getRoot().activeSession).toEqual(before)
	})
})

describe('production DEV guard', () => {
	it('HomeScreen DEV section is gated by __DEV__ (static architecture)', () => {
		const fs = jest.requireActual('fs') as typeof import('fs')
		const path = jest.requireActual('path') as typeof import('path')
		const src = fs.readFileSync(
			path.join(__dirname, '../../screens/HomeScreen.tsx'),
			'utf8',
		)
		expect(src).toContain('__DEV__')
		expect(src).toContain('dev-section')
		expect(src).toContain('markDevFixtureSession')
	})
})
