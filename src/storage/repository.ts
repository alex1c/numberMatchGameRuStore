/**
 * Persistence repository — hydrate once, mutate via revisioned writes.
 * schemaVersion 3 + Campaign v2 + daily + statistics + settings.
 */

import {
	CAMPAIGN_VERSION,
	getCampaignEntry,
	isCampaignCatalogReady,
} from '../game/campaign'
import { GENERATION_VERSION } from '../game/generator'
import {
	starsFromAttempt,
	totalStars,
	withBestStars,
	type StarCount,
} from '../game/stars'
import { localDateKey, type LocalDateKey } from '../daily/date'
import { recordDailyCompletion } from '../daily/streak'
import type {
	PersistedDailyActiveSession,
	PersistedDailyState,
} from '../daily/types'
import { createDefaultRoot } from './defaults'
import { migrateToCurrent } from './migrate'
import { boundHistory, cloneRoot, serializeBoard } from './serialize'
import type {
	PersistedActiveSession,
	PersistedRootV3,
	PersistedStatistics,
	StorageAdapter,
	ThemePreference,
} from './types'
import { PERSIST_SCHEMA_VERSION, STORAGE_KEY } from './types'
import { PersistWriteQueue, type WriteQueueResult } from './writeQueue'

const isDev =
	typeof __DEV__ !== 'undefined'
		? __DEV__
		: process.env.NODE_ENV !== 'production'

export interface SessionValidationResult {
	readonly ok: boolean
	readonly reason?: string
}

/**
 * Semantic checks for an active session against campaign frontier + catalog.
 * Invalid sessions are dropped on hydrate while preserving highestCompletedLevel.
 */
export function validateSessionSemantics(
	root: Pick<PersistedRootV3, 'highestCompletedLevel'>,
	session: PersistedActiveSession,
	options?: { readonly catalogAvailable?: boolean },
): SessionValidationResult {
	const highest = root.highestCompletedLevel
	const catalogAvailable =
		options?.catalogAvailable ?? isCampaignCatalogReady()

	if (session.generationVersion !== GENERATION_VERSION) {
		return {
			ok: false,
			reason: `generationVersion ${session.generationVersion} !== ${GENERATION_VERSION}`,
		}
	}

	if (session.purpose === 'progression') {
		if (session.status === 'in_progress') {
			if (session.level !== highest + 1) {
				return {
					ok: false,
					reason:
						`progression in_progress level ${session.level} !== frontier ${highest + 1}`,
				}
			}
		} else if (session.status === 'completed') {
			if (session.level !== highest && session.level !== highest + 1) {
				return {
					ok: false,
					reason:
						`progression completed level ${session.level} incompatible with frontier ${highest}`,
				}
			}
		}
	} else if (session.purpose === 'replay') {
		if (highest < 1 || session.level > highest) {
			return {
				ok: false,
				reason:
					`replay level ${session.level} exceeds frontier ${highest}`,
			}
		}
	}

	if (catalogAvailable) {
		try {
			const entry = getCampaignEntry(session.level)
			if (entry.fingerprint !== session.fingerprint) {
				return {
					ok: false,
					reason: 'fingerprint mismatch vs catalog',
				}
			}
			if (entry.seed !== session.seed || entry.profile !== session.profile) {
				return {
					ok: false,
					reason: 'seed/profile mismatch vs catalog',
				}
			}
			if (entry.density !== session.density) {
				return {
					ok: false,
					reason: 'density mismatch vs catalog',
				}
			}
		} catch (err) {
			return {
				ok: false,
				reason: err instanceof Error ? err.message : 'catalog lookup failed',
			}
		}
	}

	return { ok: true }
}

export class PersistRepository {
	private root: PersistedRootV3 | null = null
	private hydratePromise: Promise<PersistedRootV3> | null = null
	private readonly queue: PersistWriteQueue

	constructor(private readonly adapter: StorageAdapter) {
		this.queue = new PersistWriteQueue(adapter)
	}

	/** Load once; subsequent calls return the cached root. */
	async hydrate(): Promise<PersistedRootV3> {
		if (this.root) {
			return this.root
		}
		if (this.hydratePromise) {
			return this.hydratePromise
		}
		this.hydratePromise = this.hydrateOnce()
		try {
			this.root = await this.hydratePromise
			return this.root
		} finally {
			this.hydratePromise = null
		}
	}

	private async hydrateOnce(): Promise<PersistedRootV3> {
		let raw: string | null = null
		try {
			raw = await this.adapter.getItem(STORAGE_KEY)
		} catch (err) {
			if (isDev) {
				console.warn('[storage] hydrate read failed', err)
			}
			raw = null
		}

		let root = migrateToCurrent(raw)

		if (root.campaignVersion !== CAMPAIGN_VERSION) {
			if (isDev) {
				console.warn(
					`[storage] campaignVersion ${root.campaignVersion} → ${CAMPAIGN_VERSION}; resetting campaign`,
				)
			}
			root = {
				...createDefaultRoot(),
				trainingCompleted: root.trainingCompleted,
				revision: root.revision,
			}
		}

		if (root.activeSession) {
			const check = validateSessionSemantics(root, root.activeSession)
			if (!check.ok) {
				if (isDev) {
					console.warn(
						'[storage] dropping invalid active session; preserving frontier',
						check.reason,
					)
				}
				root = { ...root, activeSession: null }
			}
		}

		root = this.discardStaleDailyActiveInMemory(
			root,
			localDateKey(new Date()),
		)

		return root
	}

	/**
	 * Drop in-progress daily when calendar day changed (no write until caller persists).
	 * Pass `todayKey` in tests; defaults to undefined and only compares stored dateKey.
	 */
	private discardStaleDailyActiveInMemory(
		root: PersistedRootV3,
		todayKey: LocalDateKey | undefined,
	): PersistedRootV3 {
		const active = root.daily.activeDaily
		if (!active) {
			return root
		}
		if (todayKey !== undefined && active.dateKey !== todayKey) {
			return {
				...root,
				daily: { ...root.daily, activeDaily: null },
			}
		}
		return root
	}

	/** Synchronous peek after hydrate (throws if not hydrated). */
	getRoot(): PersistedRootV3 {
		if (!this.root) {
			throw new Error('PersistRepository.getRoot: not hydrated')
		}
		return this.root
	}

	/** True when hydrate has completed at least once. */
	isHydrated(): boolean {
		return this.root !== null
	}

	/** Derived mastery total (safe sum of bestStars). */
	getTotalStars(): number {
		return totalStars(this.getRoot().bestStars)
	}

	/**
	 * Apply an updater, bump revision, and enqueue a write.
	 */
	async update(
		updater: (current: PersistedRootV3) => PersistedRootV3,
	): Promise<{ root: PersistedRootV3; write: WriteQueueResult }> {
		const current = await this.hydrate()
		const previous = current
		const draft = updater(cloneRoot(current))
		let next: PersistedRootV3 = {
			...draft,
			schemaVersion: PERSIST_SCHEMA_VERSION,
			campaignVersion: CAMPAIGN_VERSION,
			revision: current.revision + 1,
			activeSession: draft.activeSession
				? {
						...draft.activeSession,
						history: boundHistory(draft.activeSession.history),
					}
				: null,
			daily: draft.daily.activeDaily
				? {
						...draft.daily,
						activeDaily: {
							...draft.daily.activeDaily,
							history: boundHistory(draft.daily.activeDaily.history),
						},
					}
				: draft.daily,
		}

		if (next.activeSession) {
			const check = validateSessionSemantics(next, next.activeSession)
			if (!check.ok) {
				if (isDev) {
					console.warn(
						'[storage] update cleared invalid active session',
						check.reason,
					)
				}
				next = { ...next, activeSession: null }
			}
		}

		this.root = next
		const write = await this.queue.enqueueWrite(next)
		if (!write.ok) {
			try {
				const raw = await this.adapter.getItem(STORAGE_KEY)
				this.root = migrateToCurrent(raw)
			} catch {
				this.root = previous
			}
		}
		return { root: this.root, write }
	}

	async setTrainingCompleted(completed: boolean): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => ({
			...current,
			trainingCompleted: completed,
		}))
		return root
	}

	async setHighestCompletedLevel(level: number): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => ({
			...current,
			highestCompletedLevel: level,
		}))
		return root
	}

	async setActiveSession(
		session: PersistedActiveSession | null,
	): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => ({
			...current,
			activeSession: session,
		}))
		return root
	}

	async clearActiveSession(): Promise<PersistedRootV3> {
		return this.setActiveSession(null)
	}

	/**
	 * Legacy helper: bump frontier and clear active session.
	 */
	async completeProgressionLevel(level: number): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => {
			const highest = Math.max(current.highestCompletedLevel, level)
			const attemptStars = starsFromAttempt({
				usedHint: false,
				usedUndo: false,
			})
			return {
				...current,
				highestCompletedLevel: highest,
				bestStars: withBestStars(current.bestStars, level, attemptStars),
				activeSession: null,
			}
		})
		return root
	}

	/**
	 * Atomic progression completion with stars:
	 * - frontier advance
	 * - bestStars merge (never decreases)
	 * - completed session (history discarded)
	 */
	async commitProgressionCompletion(input: {
		readonly level: number
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly counters: PersistedActiveSession['counters']
		readonly seed: number
		readonly profile: PersistedActiveSession['profile']
		readonly fingerprint: string
		readonly density: PersistedActiveSession['density']
		readonly usedHint: boolean
		readonly usedUndo: boolean
		readonly freeHintConsumed?: boolean
		readonly freeUndoConsumed?: boolean
		readonly initialBoard?: Parameters<typeof serializeBoard>[0]
		readonly generationVersion?: number
	}): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => {
			const highest = Math.max(current.highestCompletedLevel, input.level)
			const attemptStars = starsFromAttempt({
				usedHint: input.usedHint,
				usedUndo: input.usedUndo,
			})
			const bestStars = withBestStars(
				current.bestStars,
				input.level,
				attemptStars,
			)
			const board = serializeBoard(input.board)
			const completedSession: PersistedActiveSession = {
				mode: 'campaign',
				purpose: 'progression',
				status: 'completed',
				level: input.level,
				generationVersion:
					input.generationVersion ??
					current.activeSession?.generationVersion ??
					GENERATION_VERSION,
				seed: input.seed,
				profile: input.profile,
				fingerprint: input.fingerprint,
				density: input.density,
				board,
				history: [],
				counters: input.counters,
				nextCellSeq: board.nextCellSeq,
				usedHint: input.usedHint,
				usedUndo: input.usedUndo,
				freeHintConsumed: input.freeHintConsumed === true,
				freeUndoConsumed: input.freeUndoConsumed === true,
				...(input.initialBoard
					? { initialBoard: serializeBoard(input.initialBoard) }
					: current.activeSession?.initialBoard
						? { initialBoard: current.activeSession.initialBoard }
						: {}),
			}
			return {
				...current,
				highestCompletedLevel: highest,
				bestStars,
				activeSession: completedSession,
			}
		})
		return root
	}

	/**
	 * Replay completion: update best stars if improved; frontier unchanged.
	 */
	async commitReplayCompletion(input: {
		readonly level: number
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly counters: PersistedActiveSession['counters']
		readonly seed: number
		readonly profile: PersistedActiveSession['profile']
		readonly fingerprint: string
		readonly density: PersistedActiveSession['density']
		readonly usedHint: boolean
		readonly usedUndo: boolean
		readonly freeHintConsumed?: boolean
		readonly freeUndoConsumed?: boolean
		readonly initialBoard?: Parameters<typeof serializeBoard>[0]
		readonly generationVersion?: number
	}): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => {
			const attemptStars = starsFromAttempt({
				usedHint: input.usedHint,
				usedUndo: input.usedUndo,
			})
			const bestStars = withBestStars(
				current.bestStars,
				input.level,
				attemptStars,
			)
			const board = serializeBoard(input.board)
			const completedSession: PersistedActiveSession = {
				mode: 'campaign',
				purpose: 'replay',
				status: 'completed',
				level: input.level,
				generationVersion:
					input.generationVersion ??
					current.activeSession?.generationVersion ??
					GENERATION_VERSION,
				seed: input.seed,
				profile: input.profile,
				fingerprint: input.fingerprint,
				density: input.density,
				board,
				history: [],
				counters: input.counters,
				nextCellSeq: board.nextCellSeq,
				usedHint: input.usedHint,
				usedUndo: input.usedUndo,
				freeHintConsumed: input.freeHintConsumed === true,
				freeUndoConsumed: input.freeUndoConsumed === true,
				...(input.initialBoard
					? { initialBoard: serializeBoard(input.initialBoard) }
					: current.activeSession?.initialBoard
						? { initialBoard: current.activeSession.initialBoard }
						: {}),
			}
			return {
				...current,
				bestStars,
				activeSession: completedSession,
			}
		})
		return root
	}

	async setActiveDailySession(
		session: PersistedDailyActiveSession | null,
	): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => ({
			...current,
			daily: { ...current.daily, activeDaily: session },
		}))
		return root
	}

	/** Replace the daily subtree wholesale (hub / migration repair). */
	async setDailyState(daily: PersistedDailyState): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => ({
			...current,
			daily,
		}))
		return root
	}

	/** Sync in-progress daily board + help flags. */
	async syncDailyGameplay(input: {
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly history: readonly Parameters<typeof serializeBoard>[0][]
		readonly counters: PersistedActiveSession['counters']
		readonly usedHint: boolean
		readonly usedUndo: boolean
		readonly freeHintConsumed: boolean
		readonly freeUndoConsumed: boolean
	}): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => {
			const active = current.daily.activeDaily
			if (!active) {
				return current
			}
			const board = serializeBoard(input.board)
			return {
				...current,
				daily: {
					...current.daily,
					activeDaily: {
						...active,
						board,
						history: boundHistory(input.history.map(serializeBoard)),
						counters: input.counters,
						nextCellSeq: board.nextCellSeq,
						usedHint: input.usedHint,
						usedUndo: input.usedUndo,
						freeHintConsumed: input.freeHintConsumed,
						freeUndoConsumed: input.freeUndoConsumed,
					},
				},
			}
		})
		return root
	}

	/**
	 * Record a finished daily puzzle: streak/history via recordDailyCompletion,
	 * clear activeDaily, optional star override from attempt flags.
	 */
	async commitDailyCompletion(input: {
		readonly dateKey: LocalDateKey
		readonly stars?: StarCount
		readonly counters: PersistedActiveSession['counters']
		readonly usedHint: boolean
		readonly usedUndo: boolean
		readonly freeHintConsumed?: boolean
		readonly freeUndoConsumed?: boolean
	}): Promise<PersistedRootV3> {
		const stars =
			input.stars ??
			starsFromAttempt({
				usedHint: input.usedHint,
				usedUndo: input.usedUndo,
			})
		const { root } = await this.update((current) => {
			const daily = recordDailyCompletion(current.daily, input.dateKey, stars)
			return {
				...current,
				daily: { ...daily, activeDaily: null },
			}
		})
		return root
	}

	/** Increment lifetime statistics counters (clamped non-negative). */
	async bumpStatistics(input: {
		readonly pairs?: number
		readonly appends?: number
		readonly hints?: number
		readonly undos?: number
	}): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => {
			const stats: PersistedStatistics = {
				pairsRemoved:
					current.statistics.pairsRemoved + (input.pairs ?? 0),
				appendActions:
					current.statistics.appendActions + (input.appends ?? 0),
				hintsDelivered:
					current.statistics.hintsDelivered + (input.hints ?? 0),
				undoActions: current.statistics.undoActions + (input.undos ?? 0),
			}
			return { ...current, statistics: stats }
		})
		return root
	}

	async setThemePreference(
		preference: ThemePreference,
	): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => ({
			...current,
			settings: { ...current.settings, themePreference: preference },
		}))
		return root
	}

	/** Append achievement ids whose unlock toast was already shown. */
	async markAchievementsNotified(
		ids: readonly string[],
	): Promise<PersistedRootV3> {
		if (ids.length === 0) {
			return this.getRoot()
		}
		const { root } = await this.update((current) => {
			const merged = new Set(current.achievementNotifiedIds)
			for (const id of ids) {
				if (id.length > 0) {
					merged.add(id)
				}
			}
			return {
				...current,
				achievementNotifiedIds: [...merged],
			}
		})
		return root
	}

	/**
	 * Clear stale activeDaily when the local calendar day advanced.
	 * Persists when a stale session is dropped.
	 */
	async discardStaleDailyActiveIfDateChanged(
		todayKey: LocalDateKey,
	): Promise<PersistedRootV3> {
		const current = await this.hydrate()
		const active = current.daily.activeDaily
		if (!active || active.dateKey === todayKey) {
			return current
		}
		const { root } = await this.update((draft) => ({
			...draft,
			daily: { ...draft.daily, activeDaily: null },
		}))
		return root
	}

	/**
	 * Sync in-progress campaign gameplay including attempt help flags.
	 * @deprecated Prefer syncCampaignGameplay — alias kept for callers.
	 */
	async syncActiveGameplay(input: {
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly history: readonly Parameters<typeof serializeBoard>[0][]
		readonly counters: PersistedActiveSession['counters']
		readonly usedHint: boolean
		readonly usedUndo: boolean
		readonly freeHintConsumed: boolean
		readonly freeUndoConsumed: boolean
		readonly status?: PersistedActiveSession['status']
	}): Promise<PersistedRootV3> {
		const { root } = await this.update((current) => {
			if (!current.activeSession) {
				return current
			}
			const board = serializeBoard(input.board)
			return {
				...current,
				activeSession: {
					...current.activeSession,
					status: input.status ?? current.activeSession.status,
					board,
					history: boundHistory(input.history.map(serializeBoard)),
					counters: input.counters,
					nextCellSeq: board.nextCellSeq,
					usedHint: input.usedHint,
					usedUndo: input.usedUndo,
					freeHintConsumed: input.freeHintConsumed,
					freeUndoConsumed: input.freeUndoConsumed,
				},
			}
		})
		return root
	}

	/** Sync in-progress campaign gameplay including attempt help flags. */
	async syncCampaignGameplay(input: Parameters<
		PersistRepository['syncActiveGameplay']
	>[0]): Promise<PersistedRootV3> {
		return this.syncActiveGameplay(input)
	}

	/** Wipe storage and reset to defaults (tests / settings / DEV). */
	async resetAll(): Promise<PersistedRootV3> {
		const fresh = createDefaultRoot()
		this.root = fresh
		this.queue.reset()
		await this.adapter.setItem(STORAGE_KEY, JSON.stringify(fresh))
		return fresh
	}
}

/** Helper to build a session payload from runtime boards. */
export function buildActiveSession(input: {
	readonly purpose: PersistedActiveSession['purpose']
	readonly status: PersistedActiveSession['status']
	readonly level: number
	readonly seed: number
	readonly profile: PersistedActiveSession['profile']
	readonly fingerprint: string
	readonly density: PersistedActiveSession['density']
	readonly board: Parameters<typeof serializeBoard>[0]
	readonly initialBoard?: Parameters<typeof serializeBoard>[0]
	readonly history?: readonly Parameters<typeof serializeBoard>[0][]
	readonly counters: PersistedActiveSession['counters']
	readonly generationVersion?: number
	readonly usedHint?: boolean
	readonly usedUndo?: boolean
	readonly freeHintConsumed?: boolean
	readonly freeUndoConsumed?: boolean
}): PersistedActiveSession {
	const board = serializeBoard(input.board)
	const history = (input.history ?? []).map(serializeBoard)
	const session: PersistedActiveSession = {
		mode: 'campaign',
		purpose: input.purpose,
		status: input.status,
		level: input.level,
		generationVersion: input.generationVersion ?? GENERATION_VERSION,
		seed: input.seed,
		profile: input.profile,
		fingerprint: input.fingerprint,
		density: input.density,
		board,
		history: boundHistory(history),
		counters: input.counters,
		nextCellSeq: board.nextCellSeq,
		usedHint: input.usedHint === true,
		usedUndo: input.usedUndo === true,
		freeHintConsumed: input.freeHintConsumed === true,
		freeUndoConsumed: input.freeUndoConsumed === true,
	}
	if (input.initialBoard) {
		return {
			...session,
			initialBoard: serializeBoard(input.initialBoard),
		}
	}
	return session
}

/** Build a daily active session payload from runtime boards. */
export function buildDailyActiveSession(input: {
	readonly dateKey: LocalDateKey
	readonly seed: number
	readonly profile: PersistedDailyActiveSession['profile']
	readonly fingerprint: string
	readonly density: PersistedDailyActiveSession['density']
	readonly board: Parameters<typeof serializeBoard>[0]
	readonly initialBoard?: Parameters<typeof serializeBoard>[0]
	readonly history?: readonly Parameters<typeof serializeBoard>[0][]
	readonly counters: PersistedDailyActiveSession['counters']
	readonly generationVersion?: number
	readonly usedHint?: boolean
	readonly usedUndo?: boolean
	readonly freeHintConsumed?: boolean
	readonly freeUndoConsumed?: boolean
}): PersistedDailyActiveSession {
	const board = serializeBoard(input.board)
	const history = (input.history ?? []).map(serializeBoard)
	const session: PersistedDailyActiveSession = {
		mode: 'daily',
		dateKey: input.dateKey,
		generationVersion: input.generationVersion ?? GENERATION_VERSION,
		seed: input.seed,
		profile: input.profile,
		fingerprint: input.fingerprint,
		density: input.density,
		board,
		history: boundHistory(history),
		counters: input.counters,
		nextCellSeq: board.nextCellSeq,
		usedHint: input.usedHint === true,
		usedUndo: input.usedUndo === true,
		freeHintConsumed: input.freeHintConsumed === true,
		freeUndoConsumed: input.freeUndoConsumed === true,
	}
	if (input.initialBoard) {
		return {
			...session,
			initialBoard: serializeBoard(input.initialBoard),
		}
	}
	return session
}

export type { StarCount }
