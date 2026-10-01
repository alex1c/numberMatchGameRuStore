/**
 * In-memory GameSession store — survives Home ↔ Game while process lives.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'

import { solveBoard, type SolverOptions } from '../solver'
import type { BoardState } from '../core'
import { strings } from '../../i18n/strings.ru'
import {
	createGameSession,
	reduceGameSession,
} from './reducer'
import {
	hintOutcomeFromSolveResult,
	immediateHintIfStuck,
	nowMs,
	scheduleAfterPaint,
	type HintOutcome,
} from './hintRequest'
import type {
	GameSessionAction,
	GameSessionState,
	SessionPuzzleIdentity,
} from './types'

/** Conservative hint budget — never auto-run on heavy fixtures. */
const HINT_SOLVER_OPTIONS: SolverOptions = {
	maxStates: 8_000,
	maxDepth: 96,
	maxAppends: 4,
	appendPolicy: 'when_stuck',
	timeoutMs: 1_500,
}

interface GameSessionContextValue {
	readonly session: GameSessionState | null
	readonly hasSession: boolean
	readonly isDirty: boolean
	readonly startSession: (
		identity: SessionPuzzleIdentity,
		board: BoardState,
		options?: { readonly undoAfterCompletion?: boolean },
	) => void
	/** Restore a full session (cold start / persist hydrate). */
	readonly restoreSession: (state: GameSessionState) => void
	readonly dispatch: (action: GameSessionAction) => void
	readonly clearSession: () => void
	/**
	 * Request a Hint. Resolves with the outcome once busy UI has painted and
	 * the solver (or stuck→Add path) finishes. Resolves null if ignored.
	 */
	readonly requestHint: () => Promise<HintOutcome | null>
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null)

function applyHintOutcome(outcome: HintOutcome): GameSessionAction {
	if (outcome.kind === 'match' && outcome.indices) {
		return {
			type: 'APPLY_HINT',
			kind: 'match',
			indices: outcome.indices,
			message: outcome.message,
		}
	}
	return {
		type: 'APPLY_HINT',
		kind: outcome.kind === 'append' ? 'append' : 'unavailable',
		message: outcome.message,
	}
}

export function GameSessionProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const [session, setSession] = useState<GameSessionState | null>(null)
	const sessionRef = useRef<GameSessionState | null>(null)
	const hintInFlight = useRef(false)
	const hintPaintCancel = useRef<{ cancel: () => void } | null>(null)

	useEffect(() => {
		sessionRef.current = session
	}, [session])

	useEffect(() => {
		return () => {
			hintPaintCancel.current?.cancel()
			hintPaintCancel.current = null
			hintInFlight.current = false
		}
	}, [])

	const startSession = useCallback(
		(
			identity: SessionPuzzleIdentity,
			board: BoardState,
			options?: { readonly undoAfterCompletion?: boolean },
		) => {
			hintPaintCancel.current?.cancel()
			hintPaintCancel.current = null
			hintInFlight.current = false
			const next = createGameSession(identity, board)
			const withPolicy =
				options?.undoAfterCompletion === undefined
					? next
					: { ...next, undoAfterCompletion: options.undoAfterCompletion }
			sessionRef.current = withPolicy
			setSession(withPolicy)
			if (__DEV__) {
				console.log(
					`[NumberMatch] session start ${identity.label} ` +
						`seed=${identity.seed} fp=${identity.fingerprint}`,
				)
			}
		},
		[],
	)

	const restoreSession = useCallback((state: GameSessionState) => {
		hintPaintCancel.current?.cancel()
		hintPaintCancel.current = null
		hintInFlight.current = false
		sessionRef.current = state
		setSession(state)
	}, [])

	const dispatch = useCallback((action: GameSessionAction) => {
		setSession((prev) => {
			if (!prev) {
				return prev
			}
			const next = reduceGameSession(prev, action)
			sessionRef.current = next
			return next
		})
	}, [])

	const clearSession = useCallback(() => {
		hintPaintCancel.current?.cancel()
		hintPaintCancel.current = null
		hintInFlight.current = false
		sessionRef.current = null
		setSession(null)
	}, [])

	const requestHint = useCallback((): Promise<HintOutcome | null> => {
		const current = sessionRef.current
		if (
			!current ||
			current.completed ||
			current.hintBusy ||
			hintInFlight.current
		) {
			return Promise.resolve(null)
		}

		// Accept exactly one request; busy must paint before any solver work.
		hintInFlight.current = true
		const busyNext = reduceGameSession(current, {
			type: 'SET_HINT_BUSY',
			busy: true,
		})
		sessionRef.current = busyNext
		setSession(busyNext)

		return new Promise((resolve) => {
			const finish = (outcome: HintOutcome, elapsedMs?: number) => {
				if (__DEV__ && elapsedMs !== undefined) {
					console.log(
						`[NumberMatch] Hint: ${Math.round(elapsedMs)} ms` +
							(outcome.skippedSolver
								? ' (stuck→Add, no solver)'
								: ''),
					)
				}
				setSession((prev) => {
					if (!prev) {
						return prev
					}
					const next = reduceGameSession(prev, applyHintOutcome(outcome))
					sessionRef.current = next
					return next
				})
				hintInFlight.current = false
				hintPaintCancel.current = null
				resolve(outcome)
			}

			// Fast path: already stuck → emphasize Add, skip expensive solver.
			const stuck = immediateHintIfStuck(current.board, current.completed)
			if (stuck) {
				hintPaintCancel.current = scheduleAfterPaint(() => {
					finish(stuck, 0)
				})
				return
			}

			hintPaintCancel.current = scheduleAfterPaint(() => {
				const live = sessionRef.current
				if (!live || live.completed) {
					hintInFlight.current = false
					hintPaintCancel.current = null
					resolve(null)
					return
				}
				const started = nowMs()
				try {
					const result = solveBoard(live.board, HINT_SOLVER_OPTIONS)
					const elapsed = nowMs() - started
					if (__DEV__ && elapsed >= 1000) {
						console.warn(
							`[NumberMatch] SOLVER PERFORMANCE FOLLOW-UP REQUIRED — Hint ${Math.round(elapsed)} ms`,
						)
					}
					finish(hintOutcomeFromSolveResult(result), elapsed)
				} catch (err) {
					if (__DEV__) {
						console.warn('[NumberMatch] hint error', err)
					}
					finish(
						{
							kind: 'unavailable',
							message: strings.hintUnavailable,
							delivered: false,
							skippedSolver: false,
						},
						nowMs() - started,
					)
				}
			})
		})
	}, [])

	const isDirty = Boolean(
		session &&
			(session.history.length > 0 ||
				session.counters.matchesRemoved > 0 ||
				session.counters.appendActions > 0),
	)

	const value = useMemo<GameSessionContextValue>(
		() => ({
			session,
			hasSession: session !== null,
			isDirty,
			startSession,
			restoreSession,
			dispatch,
			clearSession,
			requestHint,
		}),
		[
			session,
			isDirty,
			startSession,
			restoreSession,
			dispatch,
			clearSession,
			requestHint,
		],
	)

	return (
		<GameSessionContext.Provider value={value}>
			{children}
		</GameSessionContext.Provider>
	)
}

export function useGameSession(): GameSessionContextValue {
	const ctx = useContext(GameSessionContext)
	if (!ctx) {
		throw new Error('useGameSession requires GameSessionProvider')
	}
	return ctx
}
