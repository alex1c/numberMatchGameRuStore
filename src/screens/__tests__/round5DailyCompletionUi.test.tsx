/**
 * Round 5 — Daily completion UI ownership + explicit write_failed Retry.
 *
 * Real AppStateProvider + GameSessionProvider + GameScreen + PersistRepository.
 * Inspects CompletionOverlay props and GameScreen Retry callbacks.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { Alert } from 'react-native'
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer'

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
import { CompletionOverlay } from '../../components/game/CompletionOverlay'
import {
	PersistRepository,
	buildActiveSession,
	buildDailyActiveSession,
	createMemoryAdapter,
	type StorageAdapter,
} from '../../storage'
import { ThemeProvider } from '../../theme'
import { AppStateProvider, useAppState } from '../../app'
import { campaignIdentity } from '../../app/campaignSession'
import { GameScreen } from '../GameScreen'

jest.mock('../../ads', () => {
	const actual = jest.requireActual('../../ads') as Record<string, unknown>
	return {
		...actual,
		maybeShowInterstitialAtTransition: jest.fn(async () => {}),
		requestRewarded: jest.fn(async () => ({
			granted: false,
			status: 'skipped',
		})),
		cancelActiveInterstitialTransition: jest.fn(),
		notifyCampaignLevelCompleted: jest.fn(),
		notifyCampaignLevelStarted: jest.fn(),
	}
})

jest.mock('../../analytics', () => ({
	trackEvent: jest.fn(),
}))

/** Test-only gate/counter around PersistRepository.commitDailyCompletion. */
let testCommitGate: Promise<void> | null = null
let testCommitCount = 0
const originalCommitDailyCompletion =
	PersistRepository.prototype.commitDailyCompletion

function nearCompleteBoard() {
	return createBoard([1, 9] as CellValue[], 2)
}

/** Two adjacent pairs plus leftovers so Campaign is not cleared by two matches. */
function twoMoveBoard() {
	return createBoard([1, 9, 2, 8, 3, 4, 5, 6] as CellValue[], 2)
}

function sampleBoard() {
	return createBoard([1, 2, 3, 4, 5, 6] as CellValue[], 3)
}

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
		await Promise.resolve()
	})
}

interface HarnessApi {
	getSessionSource(): string
	getAttemptId(): number
	getSession(): GameSessionState | null
	getRoot(): ReturnType<PersistRepository['getRoot']>
	getCommitCount(): number
	getOverlayProps(): {
		readonly visible: boolean
		readonly mode: string
		readonly attemptStars: number | undefined
		readonly hasReplay: boolean
		readonly showRestart: boolean
	} | null
	hasPersistError(): boolean
	pressRetry(): void
	switchToCampaignRuntime(): Promise<{
		readonly historyLen: number
		readonly matchesRemoved: number
		readonly attemptId: number
	}>
	replaceWithNewDaily(): Promise<void>
}

function ControlProbe({
	onReady,
	treeRef,
}: {
	readonly onReady: (api: HarnessApi) => void
	readonly treeRef: React.MutableRefObject<ReactTestRenderer | null>
}) {
	const app = useAppState()
	const game = useGameSession()
	const appRef = useRef(app)
	const gameRef = useRef(game)
	const ready = useRef(false)

	useLayoutEffect(() => {
		appRef.current = app
		gameRef.current = game
	}, [app, game])

	useEffect(() => {
		if (ready.current || app.hydrateStatus !== 'ready') {
			return
		}
		ready.current = true

		appRef.current.markDailySession()
		const restored = appRef.current.buildRestoredDailySession()
		if (!restored) {
			throw new Error('daily restore failed')
		}
		const completed: GameSessionState = {
			...restored,
			completed: true,
			counters: {
				matchesRemoved: Math.max(1, restored.counters.matchesRemoved),
				appendActions: restored.counters.appendActions,
				undoActions: restored.counters.undoActions,
			},
		}
		gameRef.current.restoreSession(completed)

		onReady({
			getSessionSource: () => appRef.current.getSessionSource(),
			getAttemptId: () => gameRef.current.getAttemptId(),
			getSession: () => gameRef.current.session,
			getRoot: () => appRef.current.repository.getRoot(),
			getCommitCount: () => testCommitCount,
			getOverlayProps: () => {
				const tree = treeRef.current
				if (!tree) return null
				const overlay = tree.root.findAllByType(
					CompletionOverlay as unknown as React.ComponentType<unknown>,
				)[0]
				if (!overlay) return null
				const props = overlay.props as {
					visible: boolean
					mode: string
					attemptStars?: number
					onReplay?: () => void
					showRestart?: boolean
				}
				return {
					visible: props.visible,
					mode: props.mode,
					attemptStars: props.attemptStars,
					hasReplay: typeof props.onReplay === 'function',
					showRestart: props.showRestart === true,
				}
			},
			hasPersistError: () => {
				const tree = treeRef.current
				if (!tree) return false
				return (
					tree.root.findAllByProps({
						testID: 'daily-completion-persist-error',
					}).length > 0
				)
			},
			pressRetry: () => {
				const tree = treeRef.current
				if (!tree) return
				const btn = tree.root.findByProps({
					testID: 'daily-completion-retry',
				})
				const onPress = btn.props.onPress as (() => void) | undefined
				onPress?.()
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
				a.markCampaignSession()
				g.startSession(identity, board, { undoAfterCompletion: false })
				await Promise.resolve()
				g.dispatch({ type: 'SELECT_CELL', index: 0 })
				g.dispatch({ type: 'SELECT_CELL', index: 1 })
				await Promise.resolve()
				g.dispatch({ type: 'SELECT_CELL', index: 0 })
				g.dispatch({ type: 'SELECT_CELL', index: 1 })
				await Promise.resolve()
				const live = gameRef.current.session
				return {
					historyLen: live?.history.length ?? 0,
					matchesRemoved: live?.counters.matchesRemoved ?? 0,
					attemptId: gameRef.current.getAttemptId(),
				}
			},
			replaceWithNewDaily: async () => {
				const today = currentLocalDateKey()
				const board = nearCompleteBoard()
				await appRef.current.repository.setActiveDailySession(
					buildDailyActiveSession({
						dateKey: today,
						seed: 99,
						profile: 'MEDIUM',
						fingerprint: 'daily-replacement',
						density: 8,
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
				const next = appRef.current.buildRestoredDailySession()
				if (!next) {
					throw new Error('replacement daily restore failed')
				}
				gameRef.current.restoreSession(next)
			},
		})
	}, [app.hydrateStatus, onReady, treeRef])

	return null
}

describe('Round 5 Daily completion UI & Retry', () => {
	beforeEach(() => {
		testCommitCount = 0
		testCommitGate = null
		PersistRepository.prototype.commitDailyCompletion = async function (
			this: PersistRepository,
			input: Parameters<typeof originalCommitDailyCompletion>[0],
		) {
			testCommitCount += 1
			if (testCommitGate) {
				await testCommitGate
			}
			return originalCommitDailyCompletion.call(this, input)
		}
	})

	afterEach(() => {
		__setLocalNowForTests(null)
		testCommitGate = null
		testCommitCount = 0
		PersistRepository.prototype.commitDailyCompletion =
			originalCommitDailyCompletion
		jest.restoreAllMocks()
	})

	async function mountSeededHarness(options: {
		readonly adapter: StorageAdapter
		readonly commitGate?: Promise<void>
	}): Promise<{
		readonly api: HarnessApi
		readonly tree: ReactTestRenderer
		readonly alertCount: { current: number }
	}> {
		let api: HarnessApi | null = null
		const treeRef: { current: ReactTestRenderer | null } = { current: null }
		testCommitGate = options.commitGate ?? null
		const alertCount = { current: 0 }
		jest.spyOn(Alert, 'alert').mockImplementation(() => {
			alertCount.current += 1
		})

		let tree!: ReactTestRenderer
		await act(async () => {
			tree = renderer.create(
				<ThemeProvider>
					<AppStateProvider adapter={options.adapter}>
						<GameSessionProvider>
							<ControlProbe
								treeRef={treeRef}
								onReady={(probe) => {
									api = probe
								}}
							/>
							<GameScreen
								onHome={() => undefined}
								onTraining={() => undefined}
							/>
						</GameSessionProvider>
					</AppStateProvider>
				</ThemeProvider>,
			)
			treeRef.current = tree
		})

		for (let i = 0; i < 40 && !api; i += 1) {
			await flush()
		}
		if (!api) {
			throw new Error('harness not ready')
		}
		return { api, tree, alertCount }
	}

	async function seedTodayDaily(
		memory: ReturnType<typeof createMemoryAdapter>,
		fingerprint: string,
	): Promise<void> {
		const setup = new PersistRepository(memory)
		await setup.hydrate()
		const board = nearCompleteBoard()
		await setup.setActiveDailySession(
			buildDailyActiveSession({
				dateKey: '2026-10-19',
				seed: 1,
				profile: 'EASY',
				fingerprint,
				density: 7,
				board,
				initialBoard: board,
				history: [],
				counters: {
					matchesRemoved: 0,
					appendActions: 0,
					undoActions: 0,
				},
				usedHint: false,
				usedUndo: false,
			}),
		)
	}

	it(
		'A — valid Daily shows daily overlay with stars and Replay',
		async () => {
			__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
			const memory = createMemoryAdapter()
			await seedTodayDaily(memory, 'daily-valid')

			const { api, alertCount } = await mountSeededHarness({
				adapter: memory,
			})
			for (let i = 0; i < 30; i += 1) {
				await flush()
				const overlay = api.getOverlayProps()
				if (overlay?.visible && overlay.mode === 'daily') {
					break
				}
			}

			const overlay = api.getOverlayProps()
			expect(overlay).not.toBeNull()
			expect(overlay!.visible).toBe(true)
			expect(overlay!.mode).toBe('daily')
			expect(overlay!.attemptStars).toBe(3)
			expect(overlay!.hasReplay).toBe(true)
			expect(overlay!.showRestart).toBe(false)
			expect(api.hasPersistError()).toBe(false)
			expect(alertCount.current).toBe(0)
			expect(api.getRoot().daily.history.length).toBe(1)
			expect(api.getRoot().daily.history[0]?.bestStars).toBe(3)
			expect(api.getCommitCount()).toBe(1)
		},
		15_000,
	)

	it(
		'B — midnight expiry: no overlay, alert shown, no history',
		async () => {
			__setLocalNowForTests(() => new Date(2026, 9, 19, 23, 59, 50))
			const memory = createMemoryAdapter()
			await seedTodayDaily(memory, 'daily-midnight')

			let release!: () => void
			const commitGate = new Promise<void>((resolve) => {
				release = resolve
			})

			const { api, alertCount } = await mountSeededHarness({
				adapter: memory,
				commitGate,
			})
			await flush()
			expect(api.getCommitCount()).toBe(1)

			__setLocalNowForTests(() => new Date(2026, 9, 20, 0, 5, 0))
			release()
			for (let i = 0; i < 30; i += 1) {
				await flush()
				if (alertCount.current > 0) break
			}

			expect(api.getRoot().daily.history).toEqual([])
			expect(api.getRoot().daily.currentStreak).toBe(0)
			expect(alertCount.current).toBe(1)
			const overlay = api.getOverlayProps()
			expect(overlay === null || overlay.visible === false).toBe(true)
			expect(api.hasPersistError()).toBe(false)
		},
		15_000,
	)

	it(
		'C — persistent storage failure: one auto request, explicit Retry once',
		async () => {
			__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
			const memory = createMemoryAdapter()
			await seedTodayDaily(memory, 'daily-fail')
			const setup = new PersistRepository(memory)
			await setup.hydrate()
			const active = setup.getRoot().daily.activeDaily
			if (active) {
				await setup.setActiveDailySession({
					...active,
					history: [active.board],
					counters: {
						matchesRemoved: 1,
						appendActions: 0,
						undoActions: 0,
					},
				})
			}

			let release!: () => void
			const commitGate = new Promise<void>((resolve) => {
				release = resolve
			})
			const failing: StorageAdapter = {
				getItem: (k) => memory.getItem(k),
				removeItem: (k) => memory.removeItem(k),
				setItem: async () => {
					throw new Error('persistent write failure')
				},
			}

			const { api } = await mountSeededHarness({
				adapter: failing,
				commitGate,
			})
			await flush()
			expect(api.getCommitCount()).toBe(1)

			release()
			for (let i = 0; i < 25; i += 1) {
				await flush()
				if (api.hasPersistError()) break
			}

			expect(api.getCommitCount()).toBe(1)
			expect(api.hasPersistError()).toBe(true)
			expect(api.getOverlayProps()?.visible ?? false).toBe(false)
			expect(api.getRoot().daily.activeDaily?.fingerprint).toBe('daily-fail')
			expect(api.getRoot().daily.history).toEqual([])
			expect(api.getSession()?.completed).toBe(true)

			// Flush repeatedly — must not auto-retry.
			for (let i = 0; i < 20; i += 1) {
				await flush()
			}
			expect(api.getCommitCount()).toBe(1)

			await act(async () => {
				api.pressRetry()
			})
			for (let i = 0; i < 20; i += 1) {
				await flush()
			}
			expect(api.getCommitCount()).toBe(2)
			expect(api.hasPersistError()).toBe(true)
			expect(api.getOverlayProps()?.visible ?? false).toBe(false)
		},
		15_000,
	)

	it(
		'D — Retry recovery accepts once with history/streak',
		async () => {
			__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
			const memory = createMemoryAdapter()
			await seedTodayDaily(memory, 'daily-retry-ok')

			// Fail only the next write after arming (skip sync writes during boot).
			let failNextWrite = false
			let release!: () => void
			const commitGate = new Promise<void>((resolve) => {
				release = resolve
			})
			const gated: StorageAdapter = {
				getItem: (k) => memory.getItem(k),
				removeItem: (k) => memory.removeItem(k),
				setItem: async (k, v) => {
					if (failNextWrite) {
						failNextWrite = false
						throw new Error('transient write failure')
					}
					return memory.setItem(k, v)
				},
			}

			const { api } = await mountSeededHarness({
				adapter: gated,
				commitGate,
			})
			await flush()
			failNextWrite = true
			release()
			for (let i = 0; i < 25; i += 1) {
				await flush()
				if (api.hasPersistError()) break
			}
			expect(api.getCommitCount()).toBe(1)
			expect(api.hasPersistError()).toBe(true)

			await act(async () => {
				api.pressRetry()
			})
			for (let i = 0; i < 30; i += 1) {
				await flush()
				const overlay = api.getOverlayProps()
				if (overlay?.visible && overlay.mode === 'daily') break
			}

			expect(api.getCommitCount()).toBe(2)
			const overlay = api.getOverlayProps()
			expect(overlay?.visible).toBe(true)
			expect(overlay?.mode).toBe('daily')
			expect(overlay?.attemptStars).toBe(3)
			expect(overlay?.hasReplay).toBe(true)
			expect(api.hasPersistError()).toBe(false)
			expect(api.getRoot().daily.history.length).toBe(1)
			expect(api.getRoot().daily.currentStreak).toBeGreaterThanOrEqual(1)
		},
		15_000,
	)

	it(
		'E — stale Daily settle leaves Campaign intact (accepted)',
		async () => {
			__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
			const memory = createMemoryAdapter()
			const setup = new PersistRepository(memory)
			await setup.hydrate()
			const entry = getCampaignEntry(1)
			await setup.setActiveSession(
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
					counters: {
						matchesRemoved: 0,
						appendActions: 0,
						undoActions: 0,
					},
				}),
			)
			await seedTodayDaily(memory, 'daily-stale')

			let release!: () => void
			const commitGate = new Promise<void>((resolve) => {
				release = resolve
			})

			const { api, alertCount } = await mountSeededHarness({
				adapter: memory,
				commitGate,
			})
			await flush()
			expect(api.getCommitCount()).toBe(1)

			const campaign = await act(async () =>
				api.switchToCampaignRuntime(),
			)
			await flush()
			expect(api.getSessionSource()).toBe('campaign')
			expect(campaign.matchesRemoved).toBeGreaterThanOrEqual(1)
			const historyBefore = api.getSession()!.history.length
			const matchesBefore = api.getSession()!.counters.matchesRemoved

			release()
			for (let i = 0; i < 20; i += 1) {
				await flush()
			}

			expect(api.getSessionSource()).toBe('campaign')
			expect(api.getSession()!.history.length).toBe(historyBefore)
			expect(api.getSession()!.counters.matchesRemoved).toBe(matchesBefore)
			expect(alertCount.current).toBe(0)
			expect(api.hasPersistError()).toBe(false)
			const overlay = api.getOverlayProps()
			expect(overlay === null || overlay.visible === false).toBe(true)
		},
		15_000,
	)

	it(
		'F — old Daily result must not mutate a newer Daily attempt',
		async () => {
			__setLocalNowForTests(() => new Date(2026, 9, 19, 12, 0, 0))
			const memory = createMemoryAdapter()
			await seedTodayDaily(memory, 'daily-old')

			let release!: () => void
			const commitGate = new Promise<void>((resolve) => {
				release = resolve
			})

			const { api, alertCount } = await mountSeededHarness({
				adapter: memory,
				commitGate,
			})
			await flush()
			expect(api.getCommitCount()).toBe(1)

			await act(async () => {
				await api.replaceWithNewDaily()
			})
			await flush()
			const newAttemptId = api.getAttemptId()
			expect(api.getRoot().daily.activeDaily?.fingerprint).toBe(
				'daily-replacement',
			)

			release()
			for (let i = 0; i < 20; i += 1) {
				await flush()
			}

			expect(api.getAttemptId()).toBe(newAttemptId)
			expect(api.getRoot().daily.activeDaily?.fingerprint).toBe(
				'daily-replacement',
			)
			expect(api.getRoot().daily.history).toEqual([])
			expect(alertCount.current).toBe(0)
			expect(api.getOverlayProps()?.visible ?? false).toBe(false)
		},
		15_000,
	)
})
