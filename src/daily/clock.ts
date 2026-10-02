/**
 * Controllable local-calendar clock for Daily date authority.
 * Production uses device local time; tests inject a fake now.
 */

import { localDateKey, type LocalDateKey } from './date'

let nowOverride: (() => Date) | null = null

/** Current local Date — injectable for midnight / expiry tests. */
export function getLocalNow(): Date {
	return nowOverride ? nowOverride() : new Date()
}

/** Device-local YYYY-MM-DD for the authoritative "today". */
export function currentLocalDateKey(): LocalDateKey {
	return localDateKey(getLocalNow())
}

/** Jest seam — pass null to restore real clock. */
export function __setLocalNowForTests(fn: (() => Date) | null): void {
	nowOverride = fn
}
