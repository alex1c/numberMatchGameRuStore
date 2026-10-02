/**
 * Pure local-calendar date helpers for Daily Puzzle.
 * Always operate on local Y/M/D — never UTC day boundaries.
 */

export type LocalDateKey = string // YYYY-MM-DD

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Build YYYY-MM-DD from local calendar fields of `date`. */
export function localDateKey(date: Date): LocalDateKey {
	const y = date.getFullYear()
	const m = date.getMonth() + 1
	const d = date.getDate()
	return `${y}-${pad2(m)}-${pad2(d)}`
}

/** Parse a local date key into a Date at local noon (DST-safe day anchor). */
export function dateFromLocalDateKey(key: LocalDateKey): Date {
	const match = KEY_RE.exec(key)
	if (!match) {
		throw new Error(`Invalid local date key: ${key}`)
	}
	const y = Number(match[1])
	const m = Number(match[2])
	const d = Number(match[3])
	return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function isValidLocalDateKey(value: unknown): value is LocalDateKey {
	if (typeof value !== 'string' || !KEY_RE.test(value)) return false
	try {
		const date = dateFromLocalDateKey(value)
		return localDateKey(date) === value
	} catch {
		return false
	}
}

export function previousLocalDateKey(key: LocalDateKey): LocalDateKey {
	const date = dateFromLocalDateKey(key)
	date.setDate(date.getDate() - 1)
	return localDateKey(date)
}

export function nextLocalDateKey(key: LocalDateKey): LocalDateKey {
	const date = dateFromLocalDateKey(key)
	date.setDate(date.getDate() + 1)
	return localDateKey(date)
}

/**
 * Whole calendar days from `fromKey` to `toKey` (to - from).
 * Same day → 0; next day → 1. Not millisecond/24h arithmetic.
 */
export function daysBetweenLocalDates(
	fromKey: LocalDateKey,
	toKey: LocalDateKey,
): number {
	const from = dateFromLocalDateKey(fromKey)
	const to = dateFromLocalDateKey(toKey)
	const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
	const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
	return Math.round((toUtc - fromUtc) / 86_400_000)
}

/** Recent local calendar keys ending at `todayKey`, oldest → newest. */
export function listRecentLocalDateKeys(
	todayKey: LocalDateKey,
	count: number,
): LocalDateKey[] {
	const keys: LocalDateKey[] = []
	let cursor = todayKey
	for (let i = 0; i < count; i += 1) {
		keys.unshift(cursor)
		cursor = previousLocalDateKey(cursor)
	}
	return keys
}

const MONTHS_RU = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
] as const

/** Natural Russian UI date, e.g. «24 сентября». */
export function formatLocalDateRu(key: LocalDateKey): string {
	const date = dateFromLocalDateKey(key)
	const day = date.getDate()
	const month = MONTHS_RU[date.getMonth()] ?? ''
	return `${day} ${month}`
}

function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value)
}
