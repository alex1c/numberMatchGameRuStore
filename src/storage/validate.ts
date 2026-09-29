/**
 * Strict validation of persisted JSON — never cast blindly.
 */

import {
	isCellValue,
	validateBoard,
	type BoardState,
} from '../game/core'
import { isDifficultyProfile } from '../game/generator'
import { CAMPAIGN_LEVEL_COUNT } from '../game/campaign'
import type {
	PersistedActiveSession,
	PersistedBoardV1,
	PersistedCountersV1,
	PersistedRootV1,
} from './types'
import { PERSIST_HISTORY_BOUND } from './types'
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

/** Validate an active session blob. */
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
		board: board.value,
		history,
		counters: counters.value,
		nextCellSeq: raw.nextCellSeq,
	}
	if (initialBoard) {
		return { ok: true, value: { ...session, initialBoard } }
	}
	return { ok: true, value: session }
}

/**
 * Parse and validate a raw JSON string or object into PersistedRootV1.
 * Does not apply session/catalog semantic checks — see migrate / repository.
 */
export function validatePersistedRoot(
	raw: unknown,
): ValidateResult<PersistedRootV1> {
	if (!isObject(raw)) {
		return { ok: false, reason: 'root must be an object' }
	}
	if (raw.schemaVersion !== 1) {
		return { ok: false, reason: `unsupported schemaVersion: ${String(raw.schemaVersion)}` }
	}
	if (raw.campaignVersion !== 1) {
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

	return {
		ok: true,
		value: {
			schemaVersion: 1,
			campaignVersion: 1,
			revision: raw.revision,
			trainingCompleted: raw.trainingCompleted,
			highestCompletedLevel: raw.highestCompletedLevel,
			activeSession,
		},
	}
}

/** Parse a JSON text blob into a validated root (or failure). */
export function parsePersistedRootJson(
	text: string,
): ValidateResult<PersistedRootV1> {
	let parsed: unknown
	try {
		parsed = JSON.parse(text) as unknown
	} catch {
		return { ok: false, reason: 'invalid JSON' }
	}
	return validatePersistedRoot(parsed)
}
