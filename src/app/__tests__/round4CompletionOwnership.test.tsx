/**
 * Round 4 P1 — stale Daily completion must not corrupt an active Campaign.
 *
 * Real AppStateProvider + GameSessionProvider; same ownership protocol as
 * GameScreen (attemptId + sessionSource + Daily identity).
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { Alert } from 'react-native'
import renderer, { act } from 'react-test-renderer'

import {
	__setLocalNowForTests,
	currentLocalDateKey,
} from '../../daily'
import { getCampaignEntry } from '../../game/campaign'
import { createBoard, type CellValue } from '../../game/core'
import {
	GameSessionProvider,
	useGameSession,
	type GameSessionState,
} from '../../game/session'
import {
	PersistRepository,
	buildActiveSession,
	buildDailyActiveSession,
	createMemoryAdapter,
	type StorageAdapter,
} from '../../storage'
import { ThemeProvider } from '../../theme'
import {
	AppStateProvider,
	useAppState,
	type DailyCompletionUiResult,
} from '../AppStateProvider'
import { campaignIdentity } from '../campaignSession'

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

function nearCompleteBoard() {
	return createBoard([1, 9] as CellValue[], 2)
}

/** Two adjacent sum-to-10 pairs so Campaign can play two real matches. */
function twoMoveBoard() {
	return createBoard([1, 9, 2, 8] as CellValue[], 2)
}

interface ProbeApi {
	getSessionSource(): string
	getAttemptId(): number
	getSession(): GameSessionState | null
	getRoot(): ReturnType<PersistRepository['getRoot']>
	prepareDailyCompleted(): Promise<{
		readonly attemptId: number
		readonly dateKey: string
		readonly fingerprint: string
		readonly session: GameSessionState
	}>
	/** Runtime switch — markCampaign + startSession (no persist wait). */
	switchToCampaignRuntime(): Promise<{
		readonly boardRemoved: readonly boolean[]
		readonly historyLen: number
		readonly attemptId: number
	}>
	settleDaily(
		ownership: {
			readonly attemptId: number
			readonly dateKey: string
			readonly fingerprint: string
			readonly getAttemptId: () => number
		},
		session: GameSessionState,
	): Promise<DailyCompletionUiResult>
	persistCampaignAndComplete(): Promise<boolean>
}

function OwnershipProbe({
	onReady,
}: {
	readonly onReady: (api: ProbeApi) => void
}) {
	const app = useAppState()
	const game = useGameSession()
	const appRef = useRef(app)
	const gameRef = useRef(game)
	const ready = useRef(false)

	// Sync latest context into refs outside render (lint: react-hooks/refs).
	useLayoutEffect(() => {
		appRef.current = app
		gameRef.current = game
	}, [app, game])

	useEffect(() => {
		if (ready.current || app.hydrateStatus !== 'ready') {
			return
		}
		ready.current = true
		onReady({
			getSessionSource: () => appRef.current.getSessionSource(),
			getAttemptId: () => gameRef.current.getAttemptId(),
			getSession: () => gameRef.current.session,
			getRoot: () => appRef.current.repository.getRoot(),
			prepareDailyCompleted: async () => {
				const today = currentLocalDateKey()
				const board = nearCompleteBoard()
				await appRef.current.repository.setActiveDailySession(
					buildDailyActiveSession({
						dateKey: today,
						seed: 42,
						profile: 'EASY',
						fingerprint: 'daily-stale-race',
						density: 7,
						board,
						initialBoard: board,
						history: [],
						counters: {
							matchesRemoved: 0,
							appendActions: 0,
							undoActions: 0,
						},
					}),
				)
				appRef.current.markDailySession()
				const restored = appRef.current.buildRestoredDailySession()
				if (!restored) {
					throw new Error('daily restore failed')
				}
				const completed: GameSessionState = {
					...restored,
					completed: true,
					counters: {
						matchesRemoved: 1,
						appendActions: 0,
						undoActions: 0,
					},
				}
				gameRef.current.restoreSession(completed)
				return {
					attemptId: gameRef.current.getAttemptId(),
					dateKey: today,
					fingerprint: 'daily-stale-race',
					session: completed,
				}
			},
			switchToCampaignRuntime: async () => {
				const entry = getCampaignEntry(1)
				const board = twoMoveBoard()
				const identity = campaignIdentity(1, {
					seed: entry.seed,
					profile: entry.profile,
					fingerprint: entry.fingerprint,
				})
				const g = gameRef.current
				const a = appRef.current
				// Runtime ownership switch without awaiting persist (avoids queue deadlock).
				a.markCampaignSession()
				g.startSession(identity, board, { undoAfterCompletion: false })
				// Yield so React commits startSession; g.session tracks state, not ref.
				await Promise.resolve()
				// First adjacent pair (1,9), then (2,8).
				g.dispatch({ type: 'SELECT_CELL', index: 0 })
				g.dispatch({ type: 'SELECT_CELL', index: 1 })
				await Promise.resolve()
				g.dispatch({ type: 'SELECT_CELL', index: 0 })
				g.dispatch({ type: 'SELECT_CELL', index: 1 })
				await Promise.resolve()
				const live = gameRef.current.session
				return {
					boardRemoved: live?.board.cells.map((c) => c.removed) ?? [],
					historyLen: live?.history.length ?? 0,
					attemptId: gameRef.current.getAttemptId(),
				}
			},
			settleDaily: (ownership, session) =>
				appRef.current.commitDailyCompletion(session, ownership),
			persistCampaignAndComplete: async () => {
				const live = gameRef.current.session
				if (!live) return false
				await appRef.current.startCampaignLevel(1, 'progression')
				appRef.current.markCampaignSession()
				const completed = { ...live, completed: true as const }
				gameRef.current.restoreSession(completed)
				const next = await appRef.current.commitProgressionCompletion(
					1,
					completed,
				)
				return next != null
			},
		})
	}, [app.hydrateStatus, onReady])

	return null
}

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
		await Promise.resolve()
	})
}

describe('Round 4 P1 stale Daily vs Campaign ownership', () => {
	afterEach(() => {
		__setLocalNowForTests(null)
		jest.restoreAllMocks()
	})

	async function setupRace(options: {
		readonly outcome: 'accepted' | 'expired' | 'rejected' | 'write_failed'
	}): Promise<{
		readonly sessionSource: string
		readonly historyLen: number
		readonly matchesRemoved: number
		readonly uiResult: DailyCompletionUiResult
		readonly alertCount: number
		readonly campaignCommitted: boolean
		readonly highestCompleted: number
		readonly campaignAttemptId: number
	}> {
		__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
		const memory = createMemoryAdapter()
		const setupRepo = new PersistRepository(memory)
		await setupRepo.hydrate()
		const entry = getCampaignEntry(1)
		await setupRepo.setActiveSession(
			buildActiveSession({
				purpose: 'progression',
				status: 'in_progress',
				level: 1,
				seed: entry.seed,
				profile: entry.profile,
				fingerprint: entry.fingerprint,
				density: entry.density,
				board: sampleBoard(),
				history: [],
				counters: { matchesRemoved: 0, appendActions: 0, undoActions: 0 },
			}),
		)

		let release!: () => void
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		let armed = false
		let writesAfterArm = 0
		const gated: StorageAdapter = {
			getItem: (k) => memory.getItem(k),
			removeItem: (k) => memory.removeItem(k),
			setItem: async (k, v) => {
				if (armed) {
					writesAfterArm += 1
					if (writesAfterArm === 1) {
						await gate
						if (options.outcome === 'write_failed') {
							throw new Error('simulated daily write failure')
						}
					}
				}
				return memory.setItem(k, v)
			},
		}

		let api: ProbeApi | null = null
		let alertCount = 0
		jest.spyOn(Alert, 'alert').mockImplementation(() => {
			alertCount += 1
		})

		await act(async () => {
			renderer.create(
				<ThemeProvider>
					<AppStateProvider adapter={gated}>
						<GameSessionProvider>
							<OwnershipProbe
								onReady={(probe) => {
									api = probe
								}}
							/>
						</GameSessionProvider>
					</AppStateProvider>
				</ThemeProvider>,
			)
		})
		// Wait until hydrate completes and probe registers.
		for (let i = 0; i < 20 && !api; i += 1) {
			await flush()
		}
		if (!api) {
			throw new Error('probe not ready')
		}
		// Explicit copy — TS control-flow after `for (; !api ;)` can collapse to never.
		const probe: ProbeApi = api

		const daily = await act(async () => probe.prepareDailyCompleted())
		await flush()

		if (options.outcome === 'expired') {
			__setLocalNowForTests(() => new Date(2026, 9, 20, 0, 5, 0))
		}

		const ownershipFingerprint =
			options.outcome === 'rejected' ? 'wrong-fingerprint' : daily.fingerprint

		armed = true
		writesAfterArm = 0

		// Start Daily commit (blocks on write) while still Daily-owned.
		// Do not wrap in act/await — that would deadlock on the write gate.
		const settlePromise = probe.settleDaily(
			{
				attemptId: daily.attemptId,
				dateKey: daily.dateKey,
				fingerprint: ownershipFingerprint,
				getAttemptId: () => probe.getAttemptId(),
			},
			daily.session,
		)
		await flush()

		// Switch runtime to Campaign and make moves (no persist — no queue deadlock).
		const campaignSnap = await act(async () => probe.switchToCampaignRuntime())
		await flush()

		expect(probe.getSessionSource()).toBe('campaign')
		expect(probe.getAttemptId()).not.toBe(daily.attemptId)
		expect(probe.getSession()).not.toBeNull()

		const liveBefore = probe.getSession()!
		const boardBeforeRelease = liveBefore.board.cells.map((c) => c.removed)
		const historyBeforeRelease = liveBefore.history.length
		const matchesBeforeRelease = liveBefore.counters.matchesRemoved
		const cellCountBeforeRelease = liveBefore.board.cells.length
		// Two real matches: history grows; row collapse may drop removed cells.
		expect(historyBeforeRelease).toBeGreaterThanOrEqual(1)
		expect(matchesBeforeRelease).toBeGreaterThanOrEqual(1)

		release()
		let uiResult!: DailyCompletionUiResult
		await act(async () => {
			uiResult = await settlePromise
		})
		await flush()

		expect(uiResult.status).toBe('stale_runtime')
		expect(probe.getSessionSource()).toBe('campaign')
		expect(probe.getSession()).not.toBeNull()
		expect(probe.getSession()!.board.cells.map((c) => c.removed)).toEqual(
			boardBeforeRelease,
		)
		expect(probe.getSession()!.history.length).toBe(historyBeforeRelease)
		expect(probe.getSession()!.counters.matchesRemoved).toBe(
			matchesBeforeRelease,
		)
		expect(probe.getSession()!.board.cells.length).toBe(cellCountBeforeRelease)
		expect(alertCount).toBe(0)

		const campaignCommitted = await act(async () =>
			probe.persistCampaignAndComplete(),
		)
		await flush()

		const root = probe.getRoot()
		return {
			sessionSource: probe.getSessionSource(),
			historyLen: historyBeforeRelease,
			matchesRemoved: matchesBeforeRelease,
			uiResult,
			alertCount,
			campaignCommitted: campaignCommitted === true,
			highestCompleted: root.highestCompletedLevel,
			campaignAttemptId: campaignSnap.attemptId,
		}
	}

	it(
		'old Daily accepted → Campaign remains intact',
		async () => {
			const r = await setupRace({ outcome: 'accepted' })
			expect(r.uiResult.status).toBe('stale_runtime')
			expect(r.sessionSource).toBe('campaign')
			expect(r.alertCount).toBe(0)
			expect(r.historyLen).toBeGreaterThanOrEqual(1)
			expect(r.matchesRemoved).toBeGreaterThanOrEqual(1)
			expect(r.campaignCommitted).toBe(true)
			expect(r.highestCompleted).toBeGreaterThanOrEqual(1)
		},
		15_000,
	)

	it(
		'old Daily expired → Campaign remains intact',
		async () => {
			const r = await setupRace({ outcome: 'expired' })
			expect(r.uiResult.status).toBe('stale_runtime')
			expect(r.sessionSource).toBe('campaign')
			expect(r.alertCount).toBe(0)
			expect(r.campaignCommitted).toBe(true)
		},
		15_000,
	)

	it(
		'old Daily rejected → Campaign remains intact',
		async () => {
			const r = await setupRace({ outcome: 'rejected' })
			expect(r.uiResult.status).toBe('stale_runtime')
			expect(r.sessionSource).toBe('campaign')
			expect(r.alertCount).toBe(0)
		},
		15_000,
	)

	it(
		'old Daily write_failed → Campaign remains intact',
		async () => {
			const r = await setupRace({ outcome: 'write_failed' })
			expect(r.uiResult.status).toBe('stale_runtime')
			expect(r.sessionSource).toBe('campaign')
			expect(r.alertCount).toBe(0)
		},
		15_000,
	)
})
