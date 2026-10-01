import {
	decideHelpEntitlement,
	isFreeHintConsumed,
	isFreeUndoConsumed,
	isHelpMonetized,
} from '../helpPolicy'

describe('isHelpMonetized', () => {
	it('monetizes campaign only', () => {
		expect(isHelpMonetized('campaign')).toBe(true)
		expect(isHelpMonetized('dev_fixture')).toBe(false)
		expect(isHelpMonetized('none')).toBe(false)
		expect(isHelpMonetized(null)).toBe(false)
	})
})

describe('decideHelpEntitlement — Hint', () => {
	it('first Hint is free', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ usedHint: false, usedUndo: false },
			{ monetized: true },
		)
		expect(d.allowed).toBe(true)
		expect(d.free).toBe(true)
		expect(d.requiresReward).toBe(false)
		expect(d.source).toBe('free')
		expect(isFreeHintConsumed({ usedHint: false, usedUndo: false })).toBe(false)
	})

	it('second Hint requires rewarded', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ usedHint: true, usedUndo: false },
			{ monetized: true },
		)
		expect(d.requiresReward).toBe(true)
		expect(d.free).toBe(false)
		expect(d.source).toBe('rewarded')
		expect(isFreeHintConsumed({ usedHint: true, usedUndo: false })).toBe(true)
	})

	it('DEV fixture bypasses rewarded', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ usedHint: true, usedUndo: false },
			{ monetized: false },
		)
		expect(d.requiresReward).toBe(false)
		expect(d.source).toBe('dev_bypass')
	})

	it('blocks Hint after completion', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ usedHint: false, usedUndo: false },
			{ monetized: true, completed: true },
		)
		expect(d.allowed).toBe(false)
	})
})

describe('decideHelpEntitlement — Undo', () => {
	it('first Undo is free when history exists', () => {
		const d = decideHelpEntitlement(
			'undo',
			{ usedHint: false, usedUndo: false },
			{ monetized: true, hasUndoHistory: true },
		)
		expect(d.free).toBe(true)
		expect(d.requiresReward).toBe(false)
		expect(isFreeUndoConsumed({ usedHint: false, usedUndo: false })).toBe(false)
	})

	it('second Undo requires rewarded', () => {
		const d = decideHelpEntitlement(
			'undo',
			{ usedHint: false, usedUndo: true },
			{ monetized: true, hasUndoHistory: true },
		)
		expect(d.requiresReward).toBe(true)
		expect(isFreeUndoConsumed({ usedHint: false, usedUndo: true })).toBe(true)
	})

	it('empty history never asks for ad', () => {
		const d = decideHelpEntitlement(
			'undo',
			{ usedHint: false, usedUndo: true },
			{ monetized: true, hasUndoHistory: false },
		)
		expect(d.allowed).toBe(false)
		expect(d.requiresReward).toBe(false)
		expect(d.reason).toBe('empty_history')
	})

	it('blocks Undo after completion', () => {
		const d = decideHelpEntitlement(
			'undo',
			{ usedHint: false, usedUndo: false },
			{ monetized: true, hasUndoHistory: true, completed: true },
		)
		expect(d.allowed).toBe(false)
	})
})

describe('cold restore / restart semantics (documented via flags)', () => {
	it('usedHint true means free Hint already consumed after restore', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ usedHint: true, usedUndo: false },
			{ monetized: true },
		)
		expect(d.requiresReward).toBe(true)
	})

	it('restart clears flags → free again', () => {
		const d = decideHelpEntitlement(
			'hint',
			{ usedHint: false, usedUndo: false },
			{ monetized: true },
		)
		expect(d.free).toBe(true)
	})

	it('rewarded failure does not change free entitlement flags', () => {
		expect(isFreeHintConsumed({ usedHint: true, usedUndo: false })).toBe(true)
		expect(isFreeHintConsumed({ usedHint: false, usedUndo: false })).toBe(false)
	})
})