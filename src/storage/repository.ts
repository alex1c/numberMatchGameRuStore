/**
 * Persistence repository — hydrate once, mutate via revisioned writes.
 */

import {
	CAMPAIGN_VERSION,
	getCampaignEntry,
	isCampaignCatalogReady,
} from '../game/campaign'
import { GENERATION_VERSION } from '../game/generator'
import { createDefaultRoot } from './defaults'
import { migrateToCurrent } from './migrate'
import { boundHistory, cloneRoot, serializeBoard } from './serialize'
import type {
	PersistedActiveSession,
	PersistedRootV1,
	StorageAdapter,
} from './types'
import { STORAGE_KEY } from './types'
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
	root: Pick<PersistedRootV1, 'highestCompletedLevel'>,
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
			// Next unsolved level.
			if (session.level !== highest + 1) {
				return {
					ok: false,
					reason:
						`progression in_progress level ${session.level} !== frontier ${highest + 1}`,
				}
			}
		} else if (session.status === 'completed') {
			// Just-finished level should match the recorded frontier.
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
	private root: PersistedRootV1 | null = null
	private hydratePromise: Promise<PersistedRootV1> | null = null
	private readonly queue: PersistWriteQueue

	constructor(private readonly adapter: StorageAdapter) {
		this.queue = new PersistWriteQueue(adapter)
	}

	/** Load once; subsequent calls return the cached root. */
	async hydrate(): Promise<PersistedRootV1> {
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

	private async hydrateOnce(): Promise<PersistedRootV1> {
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

		// Align campaignVersion when catalog ships a newer constant.
		if (root.campaignVersion !== CAMPAIGN_VERSION) {
			if (isDev) {
				console.warn(
					`[storage] campaignVersion ${root.campaignVersion} → ${CAMPAIGN_VERSION}; dropping active session`,
				)
			}
			root = {
				...root,
				campaignVersion: CAMPAIGN_VERSION,
				activeSession: null,
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
	getRoot(): PersistedRootV1 {
		if (!this.root) {
			throw new Error('PersistRepository.getRoot: not hydrated')
		}
		return this.root
	}

	/** True when hydrate has completed at least once. */
	isHydrated(): boolean {
		return this.root !== null
	}

	/**
	 * Apply an updater, bump revision, and enqueue a write.
	 * Returns the new root on success; restores previous root on stale/failure.
	 */
	async update(
		updater: (current: PersistedRootV1) => PersistedRootV1,
	): Promise<{ root: PersistedRootV1; write: WriteQueueResult }> {
		const current = await this.hydrate()
		const previous = current
		const draft = updater(cloneRoot(current))
		let next: PersistedRootV1 = {
			...draft,
			schemaVersion: 1,
			campaignVersion: CAMPAIGN_VERSION,
			revision: current.revision + 1,
			activeSession: draft.activeSession
				? {
						...draft.activeSession,
						history: boundHistory(draft.activeSession.history),
					}
				: null,
		}

		// Re-validate session semantics before committing.
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
			// Failure recovery: prefer disk state when possible.
			try {
				const raw = await this.adapter.getItem(STORAGE_KEY)
				this.root = migrateToCurrent(raw)
			} catch {
				this.root = previous
			}
		}
		return { root: this.root, write }
	}

	async setTrainingCompleted(completed: boolean): Promise<PersistedRootV1> {
		const { root } = await this.update((current) => ({
			...current,
			trainingCompleted: completed,
		}))
		return root
	}

	async setHighestCompletedLevel(level: number): Promise<PersistedRootV1> {
		const { root } = await this.update((current) => ({
			...current,
			highestCompletedLevel: level,
		}))
		return root
	}

	async setActiveSession(
		session: PersistedActiveSession | null,
	): Promise<PersistedRootV1> {
		const { root } = await this.update((current) => ({
			...current,
			activeSession: session,
		}))
		return root
	}

	async clearActiveSession(): Promise<PersistedRootV1> {
		return this.setActiveSession(null)
	}

	/**
	 * Legacy helper: bump frontier and clear active session.
	 * Prefer commitProgressionCompletion for campaign UI (keeps completed session).
	 */
	async completeProgressionLevel(level: number): Promise<PersistedRootV1> {
		const { root } = await this.update((current) => {
			const highest = Math.max(current.highestCompletedLevel, level)
			return {
				...current,
				highestCompletedLevel: highest,
				activeSession: null,
			}
		})
		return root
	}

	/**
	 * Atomic progression completion (§ completion transaction):
	 * - highestCompletedLevel = max(current, level)
	 * - active session marked completed with history discarded (storage savings)
	 * Idempotent when called again for the same or lower level.
	 */
	async commitProgressionCompletion(input: {
		readonly level: number
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly counters: PersistedActiveSession['counters']
		readonly seed: number
		readonly profile: PersistedActiveSession['profile']
		readonly fingerprint: string
		readonly initialBoard?: Parameters<typeof serializeBoard>[0]
		readonly generationVersion?: number
	}): Promise<PersistedRootV1> {
		const { root } = await this.update((current) => {
			const highest = Math.max(current.highestCompletedLevel, input.level)
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
				board,
				// Discard undo history after completion to shrink the blob.
				history: [],
				counters: input.counters,
				nextCellSeq: board.nextCellSeq,
				...(input.initialBoard
					? { initialBoard: serializeBoard(input.initialBoard) }
					: current.activeSession?.initialBoard
						? { initialBoard: current.activeSession.initialBoard }
						: {}),
			}
			return {
				...current,
				highestCompletedLevel: highest,
				activeSession: completedSession,
			}
		})
		return root
	}

	/**
	 * Replay completion: mark session completed, discard history,
	 * do NOT bump highestCompletedLevel (frontier unchanged).
	 */
	async commitReplayCompletion(input: {
		readonly level: number
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly counters: PersistedActiveSession['counters']
		readonly seed: number
		readonly profile: PersistedActiveSession['profile']
		readonly fingerprint: string
		readonly initialBoard?: Parameters<typeof serializeBoard>[0]
		readonly generationVersion?: number
	}): Promise<PersistedRootV1> {
		const { root } = await this.update((current) => {
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
				board,
				history: [],
				counters: input.counters,
				nextCellSeq: board.nextCellSeq,
				...(input.initialBoard
					? { initialBoard: serializeBoard(input.initialBoard) }
					: current.activeSession?.initialBoard
						? { initialBoard: current.activeSession.initialBoard }
						: {}),
			}
			return {
				...current,
				activeSession: completedSession,
			}
		})
		return root
	}

	/**
	 * Sync in-progress gameplay board / history / counters into activeSession.
	 * No-op when there is no campaign active session.
	 */
	async syncActiveGameplay(input: {
		readonly board: Parameters<typeof serializeBoard>[0]
		readonly history: readonly Parameters<typeof serializeBoard>[0][]
		readonly counters: PersistedActiveSession['counters']
		readonly status?: PersistedActiveSession['status']
	}): Promise<PersistedRootV1> {
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
				},
			}
		})
		return root
	}

	/** Wipe storage and reset to defaults (tests / settings / DEV). */
	async resetAll(): Promise<PersistedRootV1> {
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
	readonly board: Parameters<typeof serializeBoard>[0]
	readonly initialBoard?: Parameters<typeof serializeBoard>[0]
	readonly history?: readonly Parameters<typeof serializeBoard>[0][]
	readonly counters: PersistedActiveSession['counters']
	readonly generationVersion?: number
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
		board,
		history: boundHistory(history),
		counters: input.counters,
		nextCellSeq: board.nextCellSeq,
	}
	if (input.initialBoard) {
		return {
			...session,
			initialBoard: serializeBoard(input.initialBoard),
		}
	}
	return session
}
