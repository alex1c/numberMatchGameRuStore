/**
 * Near-duplicate diagnostics for accepted catalogs.
 */

export function valueFrequencyVector(values: readonly number[]): string {
	const counts = new Array(10).fill(0) as number[]
	for (const v of values) {
		if (v >= 1 && v <= 9) {
			counts[v] = (counts[v] ?? 0) + 1
		}
	}
	return counts.slice(1).join(',')
}

export function prefixKey(values: readonly number[], length = 12): string {
	return values.slice(0, length).join('')
}

export interface NearDuplicatePair {
	readonly aFingerprint: string
	readonly bFingerprint: string
	readonly reason: string
}

/**
 * Simple suspicious pairs: same frequency vector or identical long prefix.
 */
export function findNearDuplicates(
	items: readonly {
		readonly fingerprint: string
		readonly values: readonly number[]
	}[],
): NearDuplicatePair[] {
	const pairs: NearDuplicatePair[] = []
	const byFreq = new Map<string, string[]>()
	const byPrefix = new Map<string, string[]>()

	for (const item of items) {
		const freq = valueFrequencyVector(item.values)
		const pref = prefixKey(item.values, 12)
		const fList = byFreq.get(freq) ?? []
		fList.push(item.fingerprint)
		byFreq.set(freq, fList)
		const pList = byPrefix.get(pref) ?? []
		pList.push(item.fingerprint)
		byPrefix.set(pref, pList)
	}

	for (const [freq, list] of byFreq) {
		if (list.length < 2) continue
		for (let i = 1; i < list.length && i < 4; i += 1) {
			pairs.push({
				aFingerprint: list[0]!,
				bFingerprint: list[i]!,
				reason: `same_freq:${freq}`,
			})
		}
	}
	for (const [pref, list] of byPrefix) {
		if (list.length < 2 || pref.length < 8) continue
		for (let i = 1; i < list.length && i < 4; i += 1) {
			pairs.push({
				aFingerprint: list[0]!,
				bFingerprint: list[i]!,
				reason: `same_prefix:${pref}`,
			})
		}
	}
	return pairs.slice(0, 25)
}
