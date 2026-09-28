/**
 * PRNG golden + determinism tests.
 */

import { createPrng, normalizeSeed } from '../prng'

describe('seeded PRNG', () => {
	it('same seed yields identical sequence', () => {
		const a = createPrng(12345)
		const b = createPrng(12345)
		const seqA = Array.from({ length: 20 }, () => a.next())
		const seqB = Array.from({ length: 20 }, () => b.next())
		expect(seqA).toEqual(seqB)
	})

	it('different seeds usually differ', () => {
		const a = createPrng(1)
		const b = createPrng(2)
		expect(a.next()).not.toBe(b.next())
	})

	it('matches golden Mulberry32 sequence for seed 1', () => {
		const prng = createPrng(1)
		const seq = Array.from({ length: 5 }, () => prng.next())
		// Frozen Mulberry32 contract (independent of generationVersion)
		expect(seq.map((n) => n.toFixed(8))).toEqual([
			'0.62707394',
			'0.00273572',
			'0.52744704',
			'0.98105097',
			'0.96837790',
		])
	})

	it('nextInt respects bounds', () => {
		const prng = createPrng(99)
		for (let i = 0; i < 100; i += 1) {
			const n = prng.nextInt(7)
			expect(n).toBeGreaterThanOrEqual(0)
			expect(n).toBeLessThan(7)
		}
	})

	it('normalizeSeed handles adversarial inputs', () => {
		expect(normalizeSeed(0)).toBe(0)
		expect(normalizeSeed(1)).toBe(1)
		expect(normalizeSeed(2147483647)).toBe(2147483647)
		expect(typeof normalizeSeed(-1)).toBe('number')
		expect(typeof normalizeSeed(Number.MAX_SAFE_INTEGER)).toBe('number')
	})
})
