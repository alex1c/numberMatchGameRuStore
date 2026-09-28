/**
 * Value-domain tests for Number Match.
 */

import { areValuesMatchable, isCellValue } from '../index'

describe('areValuesMatchable / isCellValue', () => {
	it('accepts domain 1..9', () => {
		for (let n = 1; n <= 9; n += 1) {
			expect(isCellValue(n)).toBe(true)
		}
	})

	it('rejects out-of-domain numbers', () => {
		expect(isCellValue(0)).toBe(false)
		expect(isCellValue(10)).toBe(false)
		expect(isCellValue(1.5)).toBe(false)
		expect(isCellValue(NaN)).toBe(false)
	})

	it('matches equal values', () => {
		expect(areValuesMatchable(1, 1)).toBe(true)
		expect(areValuesMatchable(5, 5)).toBe(true)
		expect(areValuesMatchable(9, 9)).toBe(true)
	})

	it('matches pairs that sum to 10', () => {
		expect(areValuesMatchable(1, 9)).toBe(true)
		expect(areValuesMatchable(2, 8)).toBe(true)
		expect(areValuesMatchable(3, 7)).toBe(true)
		expect(areValuesMatchable(4, 6)).toBe(true)
		expect(areValuesMatchable(9, 1)).toBe(true)
	})

	it('treats 5+5 as one legal pair (equal and sum-10)', () => {
		expect(areValuesMatchable(5, 5)).toBe(true)
	})

	it('rejects incompatible pairs', () => {
		expect(areValuesMatchable(1, 8)).toBe(false)
		expect(areValuesMatchable(2, 7)).toBe(false)
		expect(areValuesMatchable(6, 7)).toBe(false)
		expect(areValuesMatchable(9, 8)).toBe(false)
		expect(areValuesMatchable(3, 4)).toBe(false)
	})

	it('guards out-of-domain inputs without throwing', () => {
		expect(areValuesMatchable(0, 10)).toBe(false)
		expect(areValuesMatchable(1, 10)).toBe(false)
		expect(areValuesMatchable(-1, 9)).toBe(false)
	})
})
