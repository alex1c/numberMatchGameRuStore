/**
 * Help entitlement — free vs mastery flags are independent.
 */

import { createBoard, type CellValue } from '../core'
import {
	decideHelpEntitlement,
	isFreeHintConsumed,
	isFreeUndoConsumed,
	isHelpMonetized,
} from '../helpPolicy'
import {
	createGameSession,
	hydrateGameSession,
	reduceGameSession,
} from '../session/reducer'
import type { SessionPuzzleIdentity } from '../session/types'
import { starsFromAttempt } from '../stars'

function identity(): SessionPuzzleIdentity {
	return {
		generationVersion: 3,
		difficultyProfileVersion: 2,
		seed: 1,
		profile: 'EASY',
		fingerprint: 'fp-test',
		label: 't',
	}
}

function pairBoard() {
	return createBoard([1, 1, 2, 3] as CellValue[], 4)
}

describe('isHelpMonetized', () => {
	it('monetizes campaign and daily', () => {
		expect(isHelpMonetized('campaign')).toBe(true)
		expect(isHelpMonetized('daily')).toBe(true)
		expect(isHelpMonetized('dev_fixture')).toBe(false)
		expect(isHelpMonetized('none')).toBe(false)
		expect(isHelpMonetized(null)).toBe(false)
	})
})

describe('decideHelpEntitlement — uses free* only', () => {
	it('fresh attempt first Hint free', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ freeHintConsumed: false, freeUndoConsumed: false },
			{ monetized: true },
		)
		expect(d.free).toBe(true)
		expect(d.requiresReward).toBe(false)
		expect(d.source).toBe('free')
	})

	it('second Hint rewarded when freeHintConsumed', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ freeHintConsumed: true, freeUndoConsumed: false },
			{ monetized: true },
		)
		expect(d.requiresReward).toBe(true)
		expect(d.source).toBe('rewarded')
		expect(
			isFreeHintConsumed({
				freeHintConsumed: true,
				freeUndoConsumed: false,
			}),
		).toBe(true)
	})

	it('DEV fixture bypasses rewarded', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ freeHintConsumed: true, freeUndoConsumed: false },
			{ monetized: false },
		)
		expect(d.requiresReward).toBe(false)
		expect(d.source).toBe('dev_bypass')
	})

	it('first Undo free; second rewarded; empty history never asks ad', () => {
		expect(
			decideHelpEntitlement(
				'undo',
				{ freeHintConsumed: false, freeUndoConsumed: false },
				{ monetized: true, hasUndoHistory: true },
			).free,
		).toBe(true)
		expect(
			decideHelpEntitlement(
				'undo',
				{ freeHintConsumed: false, freeUndoConsumed: true },
				{ monetized: true, hasUndoHistory: true },
			).requiresReward,
		).toBe(true)
		expect(
			decideHelpEntitlement(
				'undo',
				{ freeHintConsumed: false, freeUndoConsumed: true },
				{ monetized: true, hasUndoHistory: false },
			).allowed,
		).toBe(false)
		expect(
			isFreeUndoConsumed({
				freeHintConsumed: false,
				freeUndoConsumed: true,
			}),
		).toBe(true)
	})
})

describe('session free entitlement vs stars', () => {
	it('delivered free Hint sets usedHint and freeHintConsumed', () => {
		let state = createGameSession(identity(), pairBoard())
		expect(state.freeHintConsumed).toBe(false)
		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'match',
			indices: [0, 1],
			message: 'ok',
		})
		expect(state.usedHint).toBe(true)
		expect(state.freeHintConsumed).toBe(true)
	})

	it('failed Hint does not consume free entitlement', () => {
		let state = createGameSession(identity(), pairBoard())
		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'unavailable',
			message: 'no',
		})
		expect(state.usedHint).toBe(false)
		expect(state.freeHintConsumed).toBe(false)
	})

	it('Restart restores free Hint and Undo', () => {
		let state = createGameSession(identity(), pairBoard())
		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'append',
			message: 'add',
		})
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 0 })
		state = reduceGameSession(state, { type: 'SELECT_CELL', index: 1 })
		state = reduceGameSession(state, { type: 'UNDO' })
		expect(state.freeHintConsumed).toBe(true)
		expect(state.freeUndoConsumed).toBe(true)
		state = reduceGameSession(state, { type: 'RESTART' })
		expect(state.usedHint).toBe(false)
		expect(state.usedUndo).toBe(false)
		expect(state.freeHintConsumed).toBe(false)
		expect(state.freeUndoConsumed).toBe(false)
		expect(
			decideHelpEntitlement(
				'hint',
				{
					freeHintConsumed: state.freeHintConsumed,
					freeUndoConsumed: state.freeUndoConsumed,
				},
				{ monetized: true },
			).free,
		).toBe(true)
	})

	it('cold hydrate preserves freeHintConsumed; stars still use usedHint', () => {
		const board = pairBoard()
		const state = hydrateGameSession({
			identity: identity(),
			board,
			initialBoard: board,
			usedHint: true,
			usedUndo: false,
			freeHintConsumed: true,
			freeUndoConsumed: false,
		})
		expect(state.usedHint).toBe(true)
		expect(state.freeHintConsumed).toBe(true)
		expect(
			decideHelpEntitlement(
				'hint',
				{
					freeHintConsumed: state.freeHintConsumed,
					freeUndoConsumed: state.freeUndoConsumed,
				},
				{ monetized: true },
			).requiresReward,
		).toBe(true)
		expect(
			starsFromAttempt({
				usedHint: state.usedHint,
				usedUndo: state.usedUndo,
			}),
		).toBe(2)
	})

	it('createGameSession always starts with free available', () => {
		const state = createGameSession(identity(), pairBoard())
		expect(state.freeHintConsumed).toBe(false)
		expect(state.freeUndoConsumed).toBe(false)
		expect(state.usedHint).toBe(false)
		expect(state.usedUndo).toBe(false)
	})

	it('rewarded-style second delivered Hint keeps free consumed', () => {
		let state = createGameSession(identity(), pairBoard())
		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'match',
			indices: [0, 1],
			message: 'ok',
		})
		state = reduceGameSession(state, {
			type: 'APPLY_HINT',
			kind: 'append',
			message: 'add',
		})
		expect(state.freeHintConsumed).toBe(true)
		expect(state.usedHint).toBe(true)
	})
})
