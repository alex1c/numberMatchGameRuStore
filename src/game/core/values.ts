/**
 * Value-domain helpers for Number Match.
 * Compatibility here is only about digits — geometry is separate.
 */

import type { CellValue } from './types'

/** True when `n` is an integer in the legal Number Match domain 1..9. */
export function isCellValue(n: number): n is CellValue {
	return Number.isInteger(n) && n >= 1 && n <= 9
}

/**
 * Two values are matchable when they are equal OR sum to 10.
 * Out-of-domain inputs are rejected (return false), not thrown.
 * 5+5 satisfies both rules but is a single legal pair, not a special case.
 */
export function areValuesMatchable(a: number, b: number): boolean {
	if (!isCellValue(a) || !isCellValue(b)) {
		return false
	}
	return a === b || a + b === 10
}
