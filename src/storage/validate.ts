/**
 * Strict validation of persisted JSON — never cast blindly.
 */

import {
	isCellValue,
	validateBoard,
	type BoardState,
} from '../game/core'
import { isCampaignDensity, isDifficultyProfile } from '../game/generator'
import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from '../game/campaign'
import type { StarCount } from '../game/stars'
import { starBoardFromRawOrRepair } from './starsPersist'
import { DAILY_VERSION } from '../daily/config'
import { isValidLocalDateKey, type LocalDateKey } from '../daily/date'
import {
	createDefaultSettings,
	createDefaultStatistics,
} from './defaults'
import {
	createEmptyDailyState,
	type PersistedDailyActiveSession,
	type PersistedDailyState,
} from '../daily/types'
import type {
	PersistedActiveSession,
	PersistedBoardV1,
	PersistedCountersV1,
	PersistedRootV2,
	PersistedRootV3,
	PersistedSettings,
	PersistedStatistics,
	ThemePreference,
} from './types'
import { PERSIST_HISTORY_BOUND, PERSIST_SCHEMA_VERSION } from './types'
import { deserializeBoard } from './serialize'

export type ValidateResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly reason: string }

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean'
}

function isFiniteInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value)
}

/** Validate a persisted board snapshot and underlying BoardState invariants. */
export function validatePersistedBoard(
	raw: unknown,
): ValidateResult<PersistedBoardV1> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'board must be an object' }
	}
	if (!isFiniteInt(raw.width) || raw.width <= 0) {
		return { ok: false, reason: 'board.width invalid' }
	}
	if (!isFiniteInt(raw.nextCellSeq) || raw.nextCellSeq < 1) {
		return { ok: false, reason: 'board.nextCellSeq invalid' }
	}
	if (!Array.isArray(raw.cells)) {
		return { ok: false, reason: 'board.cells must be an array' }
	}

	const cells: PersistedBoardV1['cells'][number][] = []
	for (let i = 0; i < raw.cells.length; i += 1) {
		const cell = raw.cells[i]
		if (!isObject(cell)) {
			return { ok: false, reason: `board.cells[${i}] not an object` }
		}
		if (typeof cell.id !== 'string' || cell.id.length === 0) {
			return { ok: false, reason: `board.cells[${i}].id invalid` }
		}
		if (typeof cell.value !== 'number' || !isCellValue(cell.value)) {
			return { ok: false, reason: `board.cells[${i}].value invalid` }
		}
		if (!isBoolean(cell.removed)) {
			return { ok: false, reason: `board.cells[${i}].removed invalid` }
		}
		cells.push({
			id: cell.id,
			value: cell.value,
			removed: cell.removed,
		})
	}

	const board: PersistedBoardV1 = {
		width: raw.width,
		nextCellSeq: raw.nextCellSeq,
		cells,
	}

	const runtime: BoardState = deserializeBoard(board)
	const core = validateBoard(runtime)
	if (!core.ok) {
		return { ok: false, reason: `board core invalid: ${core.reason}` }
	}

	return { ok: true, value: board }
}

function validateCounters(raw: unknown): ValidateResult<PersistedCountersV1> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'counters must be an object' }
	}
	if (!isFiniteInt(raw.matchesRemoved) || raw.matchesRemoved < 0) {
		return { ok: false, reason: 'counters.matchesRemoved invalid' }
	}
	if (!isFiniteInt(raw.appendActions) || raw.appendActions < 0) {
		return { ok: false, reason: 'counters.appendActions invalid' }
	}
	if (!isFiniteInt(raw.undoActions) || raw.undoActions < 0) {
		return { ok: false, reason: 'counters.undoActions invalid' }
	}
	return {
		ok: true,
		value: {
			matchesRemoved: raw.matchesRemoved,
			appendActions: raw.appendActions,
			undoActions: raw.undoActions,
		},
	}
}

/** Validate an active session blob (Campaign v2 / gv3). */
export function validateActiveSession(
	raw: unknown,
): ValidateResult<PersistedActiveSession> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'activeSession must be an object' }
	}
	if (raw.mode !== 'campaign') {
		return { ok: false, reason: 'activeSession.mode must be campaign' }
	}
	if (raw.purpose !== 'progression' && raw.purpose !== 'replay') {
		return { ok: false, reason: 'activeSession.purpose invalid' }
	}
	if (raw.status !== 'in_progress' && raw.status !== 'completed') {
		return { ok: false, reason: 'activeSession.status invalid' }
	}
	if (
		!isFiniteInt(raw.level) ||
		raw.level < 1 ||
		raw.level > CAMPAIGN_LEVEL_COUNT
	) {
		return { ok: false, reason: 'activeSession.level out of range' }
	}
	if (!isFiniteInt(raw.generationVersion)) {
		return { ok: false, reason: 'activeSession.generationVersion invalid' }
	}
	if (!isFiniteInt(raw.seed)) {
		return { ok: false, reason: 'activeSession.seed invalid' }
	}
	if (typeof raw.profile !== 'string' || !isDifficultyProfile(raw.profile)) {
		return { ok: false, reason: 'activeSession.profile invalid' }
	}
	if (typeof raw.fingerprint !== 'string' || raw.fingerprint.length === 0) {
		return { ok: false, reason: 'activeSession.fingerprint invalid' }
	}
	if (typeof raw.density !== 'number' || !isCampaignDensity(raw.density)) {
		return { ok: false, reason: 'activeSession.density invalid' }
	}
	if (!isBoolean(raw.usedHint)) {
		return { ok: false, reason: 'activeSession.usedHint invalid' }
	}
	if (!isBoolean(raw.usedUndo)) {
		return { ok: false, reason: 'activeSession.usedUndo invalid' }
	}
	// Schema v2 in-place extension: missing free* defaults from used* so
	// pre-split development saves stay consistent; new writes always store both.
	const freeHintConsumed = isBoolean(raw.freeHintConsumed)
		? raw.freeHintConsumed
		: raw.usedHint === true
	const freeUndoConsumed = isBoolean(raw.freeUndoConsumed)
		? raw.freeUndoConsumed
		: raw.usedUndo === true

	const board = validatePersistedBoard(raw.board)
	if (!board.ok) {
		return { ok: false, reason: `activeSession.board: ${board.reason}` }
	}

	let initialBoard: PersistedBoardV1 | undefined
	if (raw.initialBoard !== undefined) {
		const initial = validatePersistedBoard(raw.initialBoard)
		if (!initial.ok) {
			return {
				ok: false,
				reason: `activeSession.initialBoard: ${initial.reason}`,
			}
		}
		initialBoard = initial.value
	}

	if (!Array.isArray(raw.history)) {
		return { ok: false, reason: 'activeSession.history must be an array' }
	}
	if (raw.history.length > PERSIST_HISTORY_BOUND) {
		return {
			ok: false,
			reason: `activeSession.history exceeds bound ${PERSIST_HISTORY_BOUND}`,
		}
	}
	const history: PersistedBoardV1[] = []
	for (let i = 0; i < raw.history.length; i += 1) {
		const snap = validatePersistedBoard(raw.history[i])
		if (!snap.ok) {
			return {
				ok: false,
				reason: `activeSession.history[${i}]: ${snap.reason}`,
			}
		}
		history.push(snap.value)
	}

	const counters = validateCounters(raw.counters)
	if (!counters.ok) {
		return { ok: false, reason: counters.reason }
	}

	if (!isFiniteInt(raw.nextCellSeq) || raw.nextCellSeq < 1) {
		return { ok: false, reason: 'activeSession.nextCellSeq invalid' }
	}
	if (raw.nextCellSeq !== board.value.nextCellSeq) {
		return {
			ok: false,
			reason: 'activeSession.nextCellSeq mismatches board.nextCellSeq',
		}
	}

	const session: PersistedActiveSession = {
		mode: 'campaign',
		purpose: raw.purpose,
		status: raw.status,
		level: raw.level,
		generationVersion: raw.generationVersion,
		seed: raw.seed,
		profile: raw.profile,
		fingerprint: raw.fingerprint,
		density: raw.density,
		board: board.value,
		history,
		counters: counters.value,
		nextCellSeq: raw.nextCellSeq,
		usedHint: raw.usedHint,
		usedUndo: raw.usedUndo,
		freeHintConsumed,
		freeUndoConsumed,
	}
	if (initialBoard) {
		return { ok: true, value: { ...session, initialBoard } }
	}
	return { ok: true, value: session }
}

function isThemePreference(value: unknown): value is ThemePreference {
	return value === 'system' || value === 'light' || value === 'dark'
}

function statisticsFromRawOrDefault(raw: unknown): PersistedStatistics {
	const defaults = createDefaultStatistics()
	if (!isObject(raw)) {
		return defaults
	}
	return {
		pairsRemoved:
			isFiniteInt(raw.pairsRemoved) && raw.pairsRemoved >= 0
				? raw.pairsRemoved
				: defaults.pairsRemoved,
		appendActions:
			isFiniteInt(raw.appendActions) && raw.appendActions >= 0
				? raw.appendActions
				: defaults.appendActions,
		hintsDelivered:
			isFiniteInt(raw.hintsDelivered) && raw.hintsDelivered >= 0
				? raw.hintsDelivered
				: defaults.hintsDelivered,
		undoActions:
			isFiniteInt(raw.undoActions) && raw.undoActions >= 0
				? raw.undoActions
				: defaults.undoActions,
	}
}

function settingsFromRawOrDefault(raw: unknown): PersistedSettings {
	const defaults = createDefaultSettings()
	if (!isObject(raw)) {
		return defaults
	}
	return {
		themePreference: isThemePreference(raw.themePreference)
			? raw.themePreference
			: defaults.themePreference,
	}
}

function achievementIdsFromRawOrDefault(raw: unknown): readonly string[] {
	if (!Array.isArray(raw)) {
		return []
	}
	const ids: string[] = []
	for (const item of raw) {
		if (typeof item === 'string' && item.length > 0) {
			ids.push(item)
		}
	}
	return ids
}

/** Validate in-progress daily session blob. */
export function validateDailyActiveSession(
	raw: unknown,
): ValidateResult<PersistedDailyActiveSession> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'activeDaily must be an object' }
	}
	if (raw.mode !== 'daily') {
		return { ok: false, reason: 'activeDaily.mode must be daily' }
	}
	if (
		typeof raw.dateKey !== 'string' ||
		!isValidLocalDateKey(raw.dateKey as LocalDateKey)
	) {
		return { ok: false, reason: 'activeDaily.dateKey invalid' }
	}
	if (!isFiniteInt(raw.generationVersion)) {
		return { ok: false, reason: 'activeDaily.generationVersion invalid' }
	}
	if (!isFiniteInt(raw.seed)) {
		return { ok: false, reason: 'activeDaily.seed invalid' }
	}
	if (typeof raw.profile !== 'string' || !isDifficultyProfile(raw.profile)) {
		return { ok: false, reason: 'activeDaily.profile invalid' }
	}
	if (typeof raw.fingerprint !== 'string' || raw.fingerprint.length === 0) {
		return { ok: false, reason: 'activeDaily.fingerprint invalid' }
	}
	if (typeof raw.density !== 'number' || !isCampaignDensity(raw.density)) {
		return { ok: false, reason: 'activeDaily.density invalid' }
	}
	if (!isBoolean(raw.usedHint)) {
		return { ok: false, reason: 'activeDaily.usedHint invalid' }
	}
	if (!isBoolean(raw.usedUndo)) {
		return { ok: false, reason: 'activeDaily.usedUndo invalid' }
	}
	const freeHintConsumed = isBoolean(raw.freeHintConsumed)
		? raw.freeHintConsumed
		: raw.usedHint === true
	const freeUndoConsumed = isBoolean(raw.freeUndoConsumed)
		? raw.freeUndoConsumed
		: raw.usedUndo === true

	const board = validatePersistedBoard(raw.board)
	if (!board.ok) {
		return { ok: false, reason: `activeDaily.board: ${board.reason}` }
	}

	let initialBoard: PersistedBoardV1 | undefined
	if (raw.initialBoard !== undefined) {
		const initial = validatePersistedBoard(raw.initialBoard)
		if (!initial.ok) {
			return {
				ok: false,
				reason: `activeDaily.initialBoard: ${initial.reason}`,
			}
		}
		initialBoard = initial.value
	}

	if (!Array.isArray(raw.history)) {
		return { ok: false, reason: 'activeDaily.history must be an array' }
	}
	if (raw.history.length > PERSIST_HISTORY_BOUND) {
		return {
			ok: false,
			reason: `activeDaily.history exceeds bound ${PERSIST_HISTORY_BOUND}`,
		}
	}
	const history: PersistedBoardV1[] = []
	for (let i = 0; i < raw.history.length; i += 1) {
		const snap = validatePersistedBoard(raw.history[i])
		if (!snap.ok) {
			return {
				ok: false,
				reason: `activeDaily.history[${i}]: ${snap.reason}`,
			}
		}
		history.push(snap.value)
	}

	const counters = validateCounters(raw.counters)
	if (!counters.ok) {
		return { ok: false, reason: counters.reason }
	}

	if (!isFiniteInt(raw.nextCellSeq) || raw.nextCellSeq < 1) {
		return { ok: false, reason: 'activeDaily.nextCellSeq invalid' }
	}
	if (raw.nextCellSeq !== board.value.nextCellSeq) {
		return {
			ok: false,
			reason: 'activeDaily.nextCellSeq mismatches board.nextCellSeq',
		}
	}

	const session: PersistedDailyActiveSession = {
		mode: 'daily',
		dateKey: raw.dateKey as LocalDateKey,
		generationVersion: raw.generationVersion,
		seed: raw.seed,
		profile: raw.profile,
		fingerprint: raw.fingerprint,
		density: raw.density,
		board: board.value,
		history,
		counters: counters.value,
		nextCellSeq: raw.nextCellSeq,
		usedHint: raw.usedHint,
		usedUndo: raw.usedUndo,
		freeHintConsumed,
		freeUndoConsumed,
	}
	if (initialBoard) {
		return { ok: true, value: { ...session, initialBoard } }
	}
	return { ok: true, value: session }
}

/** Validate daily subtree; missing pieces default to empty daily state. */
export function validateDailyState(raw: unknown): ValidateResult<PersistedDailyState> {
	const empty = createEmptyDailyState()
	if (!isObject(raw)) {
		return { ok: true, value: empty }
	}
	if (raw.dailyVersion !== DAILY_VERSION) {
		return {
			ok: false,
			reason: `unsupported dailyVersion: ${String(raw.dailyVersion)}`,
		}
	}
	if (!isFiniteInt(raw.currentStreak) || raw.currentStreak < 0) {
		return { ok: false, reason: 'daily.currentStreak invalid' }
	}
	if (!isFiniteInt(raw.bestStreak) || raw.bestStreak < 0) {
		return { ok: false, reason: 'daily.bestStreak invalid' }
	}
	if (
		raw.lastCompletedDateKey !== null &&
		(typeof raw.lastCompletedDateKey !== 'string' ||
			!isValidLocalDateKey(raw.lastCompletedDateKey as LocalDateKey))
	) {
		return { ok: false, reason: 'daily.lastCompletedDateKey invalid' }
	}
	if (!Array.isArray(raw.history)) {
		return { ok: false, reason: 'daily.history must be an array' }
	}
	const history: PersistedDailyState['history'][number][] = []
	for (let i = 0; i < raw.history.length; i += 1) {
		const row = raw.history[i]
		if (!isObject(row)) {
			return { ok: false, reason: `daily.history[${i}] not an object` }
		}
		if (
			typeof row.dateKey !== 'string' ||
			!isValidLocalDateKey(row.dateKey as LocalDateKey)
		) {
			return { ok: false, reason: `daily.history[${i}].dateKey invalid` }
		}
		if (
			typeof row.bestStars !== 'number' ||
			row.bestStars < 0 ||
			row.bestStars > 3
		) {
			return { ok: false, reason: `daily.history[${i}].bestStars invalid` }
		}
		if (!isBoolean(row.completed)) {
			return { ok: false, reason: `daily.history[${i}].completed invalid` }
		}
		history.push({
			dateKey: row.dateKey as LocalDateKey,
			bestStars: row.bestStars as StarCount,
			completed: row.completed,
		})
	}

	let activeDaily: PersistedDailyActiveSession | null = null
	if (raw.activeDaily !== null && raw.activeDaily !== undefined) {
		const session = validateDailyActiveSession(raw.activeDaily)
		if (!session.ok) {
			return { ok: false, reason: session.reason }
		}
		activeDaily = session.value
	}

	return {
		ok: true,
		value: {
			dailyVersion: DAILY_VERSION,
			history,
			currentStreak: raw.currentStreak,
			bestStreak: raw.bestStreak,
			lastCompletedDateKey: raw.lastCompletedDateKey as LocalDateKey | null,
			activeDaily,
		},
	}
}

function validateCampaignCore(raw: Record<string, unknown>): ValidateResult<{
	readonly revision: number
	readonly trainingCompleted: boolean
	readonly highestCompletedLevel: number
	readonly bestStars: StarCount[]
	readonly activeSession: PersistedActiveSession | null
}> {
	if (raw.campaignVersion !== CAMPAIGN_VERSION) {
		return {
			ok: false,
			reason: `unsupported campaignVersion: ${String(raw.campaignVersion)}`,
		}
	}
	if (!isFiniteInt(raw.revision) || raw.revision < 0) {
		return { ok: false, reason: 'revision invalid' }
	}
	if (!isBoolean(raw.trainingCompleted)) {
		return { ok: false, reason: 'trainingCompleted invalid' }
	}
	if (
		!isFiniteInt(raw.highestCompletedLevel) ||
		raw.highestCompletedLevel < 0 ||
		raw.highestCompletedLevel > CAMPAIGN_LEVEL_COUNT
	) {
		return { ok: false, reason: 'highestCompletedLevel out of range' }
	}

	let activeSession: PersistedActiveSession | null = null
	if (raw.activeSession !== null && raw.activeSession !== undefined) {
		const session = validateActiveSession(raw.activeSession)
		if (!session.ok) {
			return { ok: false, reason: session.reason }
		}
		activeSession = session.value
	}

	const bestStars = starBoardFromRawOrRepair(
		raw.bestStars,
		raw.highestCompletedLevel,
	) as StarCount[]

	return {
		ok: true,
		value: {
			revision: raw.revision,
			trainingCompleted: raw.trainingCompleted,
			highestCompletedLevel: raw.highestCompletedLevel,
			bestStars,
			activeSession,
		},
	}
}

/**
 * Parse and validate schema v2 root (migration input).
 */
export function validatePersistedRootV2(
	raw: unknown,
): ValidateResult<PersistedRootV2> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'root must be an object' }
	}
	if (raw.schemaVersion !== 2) {
		return {
			ok: false,
			reason: `expected schemaVersion 2, got ${String(raw.schemaVersion)}`,
		}
	}
	const core = validateCampaignCore(raw)
	if (!core.ok) {
		return core
	}
	return {
		ok: true,
		value: {
			schemaVersion: 2,
			campaignVersion: CAMPAIGN_VERSION,
			...core.value,
		},
	}
}

/**
 * Parse and validate a raw object into PersistedRootV3.
 * Optional v3 sections receive safe defaults when absent (migration repair).
 */
export function validatePersistedRoot(
	raw: unknown,
): ValidateResult<PersistedRootV3> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'root must be an object' }
	}
	if (raw.schemaVersion !== PERSIST_SCHEMA_VERSION) {
		return {
			ok: false,
			reason: `unsupported schemaVersion: ${String(raw.schemaVersion)}`,
		}
	}
	const core = validateCampaignCore(raw)
	if (!core.ok) {
		return core
	}

	const daily = validateDailyState(raw.daily)
	if (!daily.ok) {
		return { ok: false, reason: daily.reason }
	}

	return {
		ok: true,
		value: {
			schemaVersion: PERSIST_SCHEMA_VERSION,
			campaignVersion: CAMPAIGN_VERSION,
			...core.value,
			daily: daily.value,
			statistics: statisticsFromRawOrDefault(raw.statistics),
			achievementNotifiedIds: achievementIdsFromRawOrDefault(
				raw.achievementNotifiedIds,
			),
			settings: settingsFromRawOrDefault(raw.settings),
		},
	}
}

/** Parse a JSON text blob into a validated root (or failure). */
export function parsePersistedRootJson(
	text: string,
): ValidateResult<PersistedRootV3> {
	let parsed: unknown
	try {
		parsed = JSON.parse(text) as unknown
	} catch {
		return { ok: false, reason: 'invalid JSON' }
	}
	return validatePersistedRoot(parsed)
}
