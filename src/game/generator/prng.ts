/**
 * Seeded Mulberry32 PRNG — portable across Node / Jest / React Native.
 * Uses explicit unsigned 32-bit arithmetic for stable sequences.
 */

/** Normalize any finite number into a uint32 seed. */
export function normalizeSeed(seed: number): number {
	if (!Number.isFinite(seed)) {
		throw new Error(`normalizeSeed: seed must be finite, got ${String(seed)}`)
	}
	// Mix signed / large values into uint32 space.
	let x = seed >>> 0
	if (seed < 0 || seed > 0xffffffff || !Number.isInteger(seed)) {
		// Additional mix for non-uint32 inputs (negatives, floats, large ints).
		x = Math.imul(seed | 0, 0x9e3779b9) >>> 0
		x ^= Math.floor(Math.abs(seed)) >>> 0
		x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0
		x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
		x = (x ^ (x >>> 16)) >>> 0
	}
	return x >>> 0
}

export interface SeededPrng {
	readonly seed: number
	/** Next float in [0, 1). */
	next(): number
	/** Integer in [0, maxExclusive). */
	nextInt(maxExclusive: number): number
	/** Inclusive integer range. */
	nextIntInclusive(min: number, max: number): number
}

/**
 * Create a Mulberry32 generator from a normalized seed.
 * Same seed ⇒ same sequence forever.
 */
export function createPrng(seed: number): SeededPrng {
	let state = normalizeSeed(seed)
	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
	return {
		seed: state,
		next,
		nextInt(maxExclusive: number): number {
			if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
				throw new Error(`nextInt: maxExclusive must be positive integer`)
			}
			return Math.floor(next() * maxExclusive)
		},
		nextIntInclusive(min: number, max: number): number {
			if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
				throw new Error(`nextIntInclusive: invalid range ${min}..${max}`)
			}
			return min + Math.floor(next() * (max - min + 1))
		},
	}
}

/** Fisher–Yates shuffle using the provided PRNG (mutates a copy). */
export function shuffleInPlace<T>(items: T[], prng: SeededPrng): T[] {
	for (let i = items.length - 1; i > 0; i -= 1) {
		const j = prng.nextInt(i + 1)
		const tmp = items[i]!
		items[i] = items[j]!
		items[j] = tmp
	}
	return items
}
