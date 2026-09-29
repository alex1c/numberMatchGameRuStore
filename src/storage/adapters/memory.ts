/**
 * In-memory StorageAdapter for unit tests.
 */

import type { StorageAdapter } from '../types'

export function createMemoryAdapter(
	initial?: Record<string, string>,
): StorageAdapter {
	const map = new Map<string, string>(
		initial ? Object.entries(initial) : undefined,
	)
	return {
		async getItem(key: string): Promise<string | null> {
			return map.has(key) ? map.get(key)! : null
		},
		async setItem(key: string, value: string): Promise<void> {
			map.set(key, value)
		},
		async removeItem(key: string): Promise<void> {
			map.delete(key)
		},
	}
}

/** Adapter that fails writes after N successful setItem calls (race tests). */
export function createFailingWriteAdapter(
	inner: StorageAdapter,
	failAfter: number,
): StorageAdapter & { readonly writes: number } {
	const state = { writes: 0 }
	return {
		get writes() {
			return state.writes
		},
		getItem: (key) => inner.getItem(key),
		removeItem: (key) => inner.removeItem(key),
		async setItem(key: string, value: string): Promise<void> {
			state.writes += 1
			if (state.writes > failAfter) {
				throw new Error('simulated write failure')
			}
			await inner.setItem(key, value)
		},
	}
}
