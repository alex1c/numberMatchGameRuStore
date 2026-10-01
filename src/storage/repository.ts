/**
 * Persistence repository — hydrate once, mutate via revisioned writes.
 * schemaVersion 2 + Campaign v2 + mastery stars.
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
import { createDefaultRoot } from './defaults'
import { migrateToCurrent } from './migrate'
import { boundHistory, cloneRoot, serializeBoard } from './serialize'
import type {
	PersistedActiveSession,
	PersistedRootV2,
	StorageAdapter,
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
	root: Pick<PersistedRootV2, 'highestCompletedLevel'>,
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
	private root: PersistedRootV2 | null = null
	private hydratePromise: Promise<PersistedRootV2> | null = null
	private readonly queue: PersistWriteQueue

	constructor(private readonly adapter: StorageAdapter) {
		this.queue = new PersistWriteQueue(adapter)
	}

	/** Load once; subsequent calls return the cached root. */
	async hydrate(): Promise<PersistedRootV2> {
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

	private async hydrateOnce(): Promise<PersistedRootV2> {
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

		return root
	}

	/** Synchronous peek after hydrate (throws if not hydrated). */
	getRoot(): PersistedRootV2 {
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
		updater: (current: PersistedRootV2) => PersistedRootV2,
	): Promise<{ root: PersistedRootV2; write: WriteQueueResult }> {
		const current = await this.hydrate()
		const previous = current
		const draft = updater(cloneRoot(current))
		let next: PersistedRootV2 = {
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

	async setTrainingCompleted(completed: boolean): Promise<PersistedRootV2> {
		const { root } = await this.update((current) => ({
			...current,
			trainingCompleted: completed,
		}))
		return root
	}

	async setHighestCompletedLevel(level: number): Promise<PersistedRootV2> {
		const { root } = await this.update((current) => ({
			...current,
			highestCompletedLevel: level,
		}))
		return root
	}

	async setActiveSession(
		session: PersistedActiveSession | null,
	): Promise<PersistedRootV2> {
		const { root } = await this.update((current) => ({
			...current,
			activeSession: session,
		}))
		return root
	}

	async clearActiveSession(): Promise<PersistedRootV2> {
		return this.setActiveSession(null)
	}

	/**
	 * Legacy helper: bump frontier and clear active session.
	 */
	async completeProgressionLevel(level: number): Promise<PersistedRootV2> {
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
	}): Promise<PersistedRootV2> {
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
	}): Promise<PersistedRootV2> {
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

	/**
	 * Sync in-progress gameplay including attempt help flags.
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
	}): Promise<PersistedRootV2> {
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

	/** Wipe storage and reset to defaults (tests / settings / DEV). */
	async resetAll(): Promise<PersistedRootV2> {
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

export type { StarCount }
