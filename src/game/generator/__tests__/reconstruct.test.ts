/**
 * Generator reconstruct tests.
 */

import {
	generatePuzzle,
	reconstructGeneratedPuzzle,
	GENERATION_VERSION,
	GENERATION_VERSION_V2,
} from '../index'

describe('reconstructGeneratedPuzzle', () => {
	it('rebuilds the accepted gv3 board without solving', () => {
		const generated = generatePuzzle({
			seed: 4242,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		expect(generated.status).toBe('accepted')
		if (generated.status !== 'accepted') return

		const reconstructed = reconstructGeneratedPuzzle({
			generationVersion: GENERATION_VERSION,
			seed: generated.puzzle.identity.seed,
			profile: generated.puzzle.identity.profile,
			density: generated.puzzle.identity.density,
			expectedFingerprint: generated.puzzle.identity.fingerprint,
		})
		expect(reconstructed.status).toBe('ok')
		if (reconstructed.status !== 'ok') return
		expect(reconstructed.fingerprint).toBe(
			generated.puzzle.identity.fingerprint,
		)
		expect(reconstructed.canonical).toBe(generated.puzzle.identity.canonical)
		expect(reconstructed.board).toEqual(generated.puzzle.board)
		expect(reconstructed.attempts).toBe(generated.attempts)
	})

	it('rebuilds historical gv2 boards without density', () => {
		const generated = generatePuzzle({
			seed: 4242,
			profile: 'EASY',
			generationVersion: GENERATION_VERSION_V2,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		expect(generated.status).toBe('accepted')
		if (generated.status !== 'accepted') return

		const reconstructed = reconstructGeneratedPuzzle({
			generationVersion: GENERATION_VERSION_V2,
			seed: generated.puzzle.identity.seed,
			profile: generated.puzzle.identity.profile,
			expectedFingerprint: generated.puzzle.identity.fingerprint,
		})
		expect(reconstructed.status).toBe('ok')
		if (reconstructed.status !== 'ok') return
		expect(reconstructed.board).toEqual(generated.puzzle.board)
	})

	it('fails closed when fingerprint is absent', () => {
		const result = reconstructGeneratedPuzzle({
			generationVersion: GENERATION_VERSION,
			seed: 1,
			profile: 'EASY',
			density: 7,
			expectedFingerprint: 'f00000000',
			maxAttempts: 5,
		})
		expect(result.status).toBe('not_found')
	})
})
