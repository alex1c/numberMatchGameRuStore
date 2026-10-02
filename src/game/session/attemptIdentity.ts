/**
 * Attempt / screen / transition identity model (Round 2).
 *
 * Three separate layers — never conflate them:
 *
 * 1. Puzzle identity
 *    seed / fingerprint / profile / dateKey — WHAT puzzle content is.
 *    Identical across Restart of the same Campaign level or Daily Replay.
 *
 * 2. Persisted attempt / game state
 *    Board, history, help flags, counters in activeSession / activeDaily.
 *    Campaign Continue restores the SAME persisted attempt (do not wipe
 *    gameplay data). Restart writes a new pristine persisted attempt blob.
 *
 * 3. Runtime async-operation generation (`attemptId`)
 *    Monotonic integer owned by GameSessionProvider.
 *    Bumps on: startSession, restoreSession, RESTART, clearSession.
 *    Used ONLY to invalidate in-flight async work (ads, hints, transitions).
 *    Persistence does not store this token.
 *
 * GameScreen additionally owns:
 * - `screenGeneration` — bumps on mount; 0 after unmount.
 * - `transitionId` — unique per Next / Home / Replay interstitial request.
 *
 * A pending transition is valid only when ALL of:
 * screenGeneration, attemptId, transitionId still match the captured token.
 */

export interface AttemptScopedToken {
	readonly attemptId: number
}

export interface ScreenScopedToken {
	readonly screenGeneration: number
	readonly attemptId: number
}

export interface TransitionToken {
	readonly screenGeneration: number
	readonly attemptId: number
	readonly transitionId: number
}

/** Mutable counter for tests and providers. */
export function createMonotonicId(start = 0): {
	readonly next: () => number
	readonly current: () => number
	readonly reset: (value?: number) => void
} {
	let value = start
	return {
		next: () => {
			value += 1
			return value
		},
		current: () => value,
		reset: (next = 0) => {
			value = next
		},
	}
}

export function isTransitionTokenCurrent(
	token: TransitionToken,
	live: TransitionToken,
): boolean {
	return (
		token.screenGeneration === live.screenGeneration &&
		token.attemptId === live.attemptId &&
		token.transitionId === live.transitionId &&
		token.screenGeneration > 0
	)
}
