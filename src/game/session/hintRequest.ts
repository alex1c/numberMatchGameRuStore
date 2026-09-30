/**
 * Hint execution helpers — pure / schedulable pieces used by GameSession.
 * Keeps solver invocation out of the first React commit so busy UI can paint.
 */

import { hasAvailableMoves, type BoardState } from '../core'
import type { SolveResult } from '../solver'
import { strings } from '../../i18n/strings.ru'

export type HintKind = 'match' | 'append' | 'unavailable'

export interface HintOutcome {
	readonly kind: HintKind
	readonly indices?: readonly number[]
	readonly message: string
	/** True when assistance was delivered (affects usedHint / stars). */
	readonly delivered: boolean
	/** True when solver was skipped because the board is already stuck. */
	readonly skippedSolver: boolean
}

/**
 * When no legal matches remain, Hint must not run an expensive search —
 * Add is the required next action. Counts as delivered assistance.
 */
export function immediateHintIfStuck(
	board: BoardState,
	completed: boolean,
): HintOutcome | null {
	if (completed) {
		return null
	}
	if (hasAvailableMoves(board)) {
		return null
	}
	const hasActive = board.cells.some((c) => !c.removed)
	if (!hasActive) {
		return null
	}
	return {
		kind: 'append',
		message: strings.hintAppend,
		delivered: true,
		skippedSolver: true,
	}
}

/** Map a solver result into a HintOutcome (no board mutation). */
export function hintOutcomeFromSolveResult(result: SolveResult): HintOutcome {
	if (result.status === 'solved' && result.path[0]) {
		const first = result.path[0]
		if (first.type === 'match') {
			return {
				kind: 'match',
				indices: [first.aIndex, first.bIndex],
				message: strings.hintReady,
				delivered: true,
				skippedSolver: false,
			}
		}
		return {
			kind: 'append',
			message: strings.hintAppend,
			delivered: true,
			skippedSolver: false,
		}
	}
	return {
		kind: 'unavailable',
		message: strings.hintUnavailable,
		delivered: false,
		skippedSolver: false,
	}
}

/**
 * Yield at least one paint opportunity before heavy JS work.
 * Nested timeouts: first allows React to commit busy UI; second starts work.
 * (Avoid relying on rAF alone — RN often paints after a macrotask.)
 */
export function scheduleAfterPaint(run: () => void): { cancel: () => void } {
	let cancelled = false
	let innerId: ReturnType<typeof setTimeout> | null = null
	const outerId = setTimeout(() => {
		innerId = setTimeout(() => {
			if (!cancelled) {
				run()
			}
		}, 32)
	}, 16)
	return {
		cancel: () => {
			cancelled = true
			clearTimeout(outerId)
			if (innerId !== null) {
				clearTimeout(innerId)
			}
		},
	}
}

/** Monotonic-ish elapsed ms for DEV diagnostics (RN-safe). */
export function nowMs(): number {
	const perf = (
		globalThis as { performance?: { now?: () => number } }
	).performance
	if (perf && typeof perf.now === 'function') {
		return perf.now()
	}
	return Date.now()
}

/** Finite attention pulses when entering a no-moves state. */
export const APPEND_PULSE_REPETITIONS = 3 as const

export function shouldStartAppendPulse(
	wasPrimary: boolean,
	isPrimary: boolean,
): boolean {
	return !wasPrimary && isPrimary
}
