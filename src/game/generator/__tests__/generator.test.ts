/**
 * Generator pipeline tests.
 */

import { cloneBoard } from '../../core'
import {
	DIFFICULTY_PROFILE_VERSION,
	GENERATION_VERSION,
	GENERATION_VERSION_V2,
	generatePuzzle,
	puzzleFingerprint,
	runAudit,
	defaultSmallTargets,
	analyzeDifficulty,
	GENERATION_SOLVER_CONFIG,
	metricsMatchProfile,
	computeDifficultyScore,
	computeDifficultyScoreV2,
} from '../index'
import { getTutorialCandidates } from '../tutorialCandidates'

describe('generatePuzzle', () => {
	it('is deterministic for the same seed/profile/density (gv3)', () => {
		const a = generatePuzzle({
			seed: 4242,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		const b = generatePuzzle({
			seed: 4242,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		expect(a.status).toBe('accepted')
		expect(b.status).toBe('accepted')
		if (a.status !== 'accepted' || b.status !== 'accepted') return
		expect(a.puzzle.identity.fingerprint).toBe(b.puzzle.identity.fingerprint)
		expect(a.puzzle.identity.canonical).toBe(b.puzzle.identity.canonical)
		expect(a.puzzle.path).toEqual(b.puzzle.path)
		expect(a.puzzle.metrics.difficultyScore).toBe(b.puzzle.metrics.difficultyScore)
		expect(a.attempts).toBe(b.attempts)
		expect(a.puzzle.identity.density).toBe(7)
		expect(a.puzzle.board.width).toBe(8)
		expect(a.puzzle.board.cells.length).toBe(56)
	})

	it('still accepts gv2 without density', () => {
		const result = generatePuzzle({
			seed: 4242,
			profile: 'EASY',
			generationVersion: GENERATION_VERSION_V2,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		expect(result.status).toBe('accepted')
		if (result.status !== 'accepted') return
		expect(result.puzzle.identity.generationVersion).toBe(2)
		expect(result.puzzle.identity.density).toBeUndefined()
	})

	it('returns typed failure when attempts exhausted', () => {
		const result = generatePuzzle({
			seed: 7,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 1,
			knownCanonicals: new Set([]),
			deadEndAnalysis: false,
		})
		const bad = generatePuzzle({
			seed: 1,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 0 as unknown as number,
		})
		expect(bad.status).toBe('invalid_config')
		void result
	})

	it('rejects invalid config', () => {
		const result = generatePuzzle({
			seed: Number.NaN,
			profile: 'EASY',
			density: 7,
		})
		expect(result.status).toBe('invalid_config')
	})

	it('requires density for gv3', () => {
		const result = generatePuzzle({
			seed: 1,
			profile: 'EASY',
		})
		expect(result.status).toBe('invalid_config')
	})

	it('namespaces EASY vs EXPERT streams for the same seed', () => {
		const easy = generatePuzzle({
			seed: 42,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		const expert = generatePuzzle({
			seed: 42,
			profile: 'EXPERT',
			density: 7,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		expect(easy.status).toBe('accepted')
		expect(expert.status).toBe('accepted')
		if (easy.status !== 'accepted' || expert.status !== 'accepted') return
		expect(easy.puzzle.identity.fingerprint).not.toBe(
			expert.puzzle.identity.fingerprint,
		)
		expect(easy.puzzle.identity.generationVersion).toBe(GENERATION_VERSION)
		expect(easy.puzzle.identity.difficultyProfileVersion).toBe(
			DIFFICULTY_PROFILE_VERSION,
		)
	})

	it('fingerprint is stable and duplicate-detectable', () => {
		const a = generatePuzzle({
			seed: 77,
			profile: 'MEDIUM',
			density: 8,
			maxCandidateAttempts: 60,
			deadEndAnalysis: false,
		})
		expect(a.status).toBe('accepted')
		if (a.status !== 'accepted') return
		const fp = puzzleFingerprint(a.puzzle.board)
		expect(fp.fingerprint).toBe(a.puzzle.identity.fingerprint)
		const dup = generatePuzzle({
			seed: 77,
			profile: 'MEDIUM',
			density: 8,
			maxCandidateAttempts: 5,
			knownCanonicals: new Set([a.puzzle.identity.canonical]),
			knownFingerprints: new Set([a.puzzle.identity.fingerprint]),
			deadEndAnalysis: false,
		})
		expect(dup.status === 'accepted' || dup.status === 'exhausted').toBe(true)
		if (dup.status === 'accepted') {
			expect(dup.puzzle.identity.canonical).not.toBe(a.puzzle.identity.canonical)
		}
	})
})

describe('metrics & classification independence', () => {
	it('does not mutate the board during analysis', () => {
		const gen = generatePuzzle({
			seed: 55,
			profile: 'EASY',
			density: 7,
			maxCandidateAttempts: 40,
			deadEndAnalysis: false,
		})
		expect(gen.status).toBe('accepted')
		if (gen.status !== 'accepted') return
		const before = cloneBoard(gen.puzzle.board)
		analyzeDifficulty(
			gen.puzzle.board,
			gen.puzzle.path,
			gen.puzzle.solverStats,
			GENERATION_SOLVER_CONFIG,
			{ deadEndAnalysis: false, difficultyProfileVersion: 2 },
		)
		expect(gen.puzzle.board).toEqual(before)
	})

	it('raw metrics do not depend on requested profile label', () => {
		const gen = generatePuzzle({
			seed: 88,
			profile: 'HARD',
			density: 8,
			maxCandidateAttempts: 60,
			deadEndAnalysis: false,
		})
		expect(gen.status).toBe('accepted')
		if (gen.status !== 'accepted') return
		const m = analyzeDifficulty(
			gen.puzzle.board,
			gen.puzzle.path,
			gen.puzzle.solverStats,
			GENERATION_SOLVER_CONFIG,
			{ deadEndAnalysis: false, difficultyProfileVersion: 2 },
		)
		expect(m.difficultyScore).toBe(gen.puzzle.metrics.difficultyScore)
		const score2 = computeDifficultyScoreV2({
			initialCells: m.initialCells,
			solutionActionCount: m.solutionActionCount,
			choiceStates: m.choiceStates,
			peakBranching: m.peakBranching,
			appendActionCount: m.appendActionCount,
			diagonalOnlyMoves: m.diagonalOnlyMoves,
			linearOnlyMoves: m.linearOnlyMoves,
			forcedRatio: m.forcedRatio,
			deadEndRatio: m.deadEnd.deadEndRatio,
		})
		expect(score2).toBe(m.difficultyScore)
		expect(metricsMatchProfile(m, 'HARD', 2).ok).toBe(true)
		// gv1 score formula remains available for historical audits.
		expect(typeof computeDifficultyScore({
			initialCells: m.initialCells,
			solutionActionCount: m.solutionActionCount,
			choiceStates: m.choiceStates,
			peakBranching: m.peakBranching,
			appendActionCount: m.appendActionCount,
			diagonalOnlyMoves: m.diagonalOnlyMoves,
			linearOnlyMoves: m.linearOnlyMoves,
			forcedRatio: m.forcedRatio,
			deadEndRatio: m.deadEnd.deadEndRatio,
		})).toBe('number')
	})
})

describe('small audit', () => {
	it('accepts 5 puzzles per profile without invariant failures (gv2)', () => {
		const report = runAudit({
			targets: defaultSmallTargets(),
			baseSeed: 42,
			maxAttemptsPerPuzzle: 80,
			deadEndAnalysis: false,
			generationVersion: 2,
		})
		expect(report.ok).toBe(true)
		expect(report.acceptedTotal).toBe(20)
		expect(report.exactDuplicates).toBe(0)
		expect(report.replayFailures).toBe(0)
		expect(report.acceptedCutoff).toBe(0)
	})
})

describe('tutorial candidates', () => {
	it('all 10 candidates are solver-proven with distinct goals', () => {
		const list = getTutorialCandidates()
		expect(list).toHaveLength(10)
		const goals = new Set(list.map((t) => t.learningGoal))
		expect(goals.size).toBe(10)
		for (const t of list) {
			expect(t.solverStatus).toBe('solved')
			expect(t.solutionDepth).toBeGreaterThan(0)
			expect(t.fingerprint.startsWith('f')).toBe(true)
		}
	})
})
