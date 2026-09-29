/**
 * Serialized write queue with revision checks and failure recovery.
 */

import type { PersistedRootV1, StorageAdapter } from './types'
import { STORAGE_KEY } from './types'
import { migrateToCurrent } from './migrate'

export type WriteQueueResult =
	| { readonly ok: true; readonly revision: number }
	| {
			readonly ok: false
			readonly reason: 'stale_write' | 'write_failed' | 'serialize_failed'
			readonly message: string
	  }

/**
 * Ensures persistence writes run one-at-a-time and reject stale revisions.
 * On write failure, re-reads storage so the in-memory root can recover.
 */
export class PersistWriteQueue {
	private chain: Promise<void> = Promise.resolve()
	private lastWrittenRevision = -1

	constructor(private readonly adapter: StorageAdapter) {}

	/** Last revision successfully written through this queue (or -1). */
	getLastWrittenRevision(): number {
		return this.lastWrittenRevision
	}

	/**
	 * Enqueue a write of the given root. Rejects when root.revision is older
	 * than the last successful write (stale writer).
	 */
	enqueueWrite(root: PersistedRootV1): Promise<WriteQueueResult> {
		const run = async (): Promise<WriteQueueResult> => {
			if (
				this.lastWrittenRevision >= 0 &&
				root.revision < this.lastWrittenRevision
			) {
				return {
					ok: false,
					reason: 'stale_write',
					message:
						`stale revision ${root.revision} < last written ${this.lastWrittenRevision}`,
				}
			}

			// Also reject against what is currently on disk when present.
			try {
				const existing = await this.adapter.getItem(STORAGE_KEY)
				if (existing !== null) {
					const disk = migrateToCurrent(existing)
					if (root.revision < disk.revision) {
						this.lastWrittenRevision = Math.max(
							this.lastWrittenRevision,
							disk.revision,
						)
						return {
							ok: false,
							reason: 'stale_write',
							message:
								`stale revision ${root.revision} < disk ${disk.revision}`,
						}
					}
				}
			} catch {
				// Disk read failure — continue and attempt write; recovery below.
			}

			let payload: string
			try {
				payload = JSON.stringify(root)
			} catch (err) {
				return {
					ok: false,
					reason: 'serialize_failed',
					message: err instanceof Error ? err.message : 'stringify failed',
				}
			}

			try {
				await this.adapter.setItem(STORAGE_KEY, payload)
				this.lastWrittenRevision = root.revision
				return { ok: true, revision: root.revision }
			} catch (err) {
				// Failure recovery: best-effort re-read so callers can re-hydrate.
				try {
					const existing = await this.adapter.getItem(STORAGE_KEY)
					if (existing !== null) {
						const disk = migrateToCurrent(existing)
						this.lastWrittenRevision = Math.max(
							this.lastWrittenRevision,
							disk.revision,
						)
					}
				} catch {
					// ignore secondary failure
				}
				return {
					ok: false,
					reason: 'write_failed',
					message: err instanceof Error ? err.message : 'write failed',
				}
			}
		}

		const next = this.chain.then(run, run)
		// Keep the chain alive even when a write fails.
		this.chain = next.then(
			() => undefined,
			() => undefined,
		)
		return next
	}

	/** Reset revision tracking (tests / after external wipe). */
	reset(): void {
		this.lastWrittenRevision = -1
		this.chain = Promise.resolve()
	}
}
