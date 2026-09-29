/**
 * In-memory GameSession store — survives Home ↔ Game while process lives.
 * No AsyncStorage in PHASE 4.
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
import { createGameSession, reduceGameSession } from './reducer'
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
	readonly requestHint: () => void
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null)

export function GameSessionProvider({
	children,
}: {
	readonly children: ReactNode
}) {
	const [session, setSession] = useState<GameSessionState | null>(null)
	const sessionRef = useRef<GameSessionState | null>(null)
	const hintInFlight = useRef(false)

	useEffect(() => {
		sessionRef.current = session
	}, [session])

	const startSession = useCallback(
		(
			identity: SessionPuzzleIdentity,
			board: BoardState,
			options?: { readonly undoAfterCompletion?: boolean },
		) => {
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
		hintInFlight.current = false
		sessionRef.current = null
		setSession(null)
	}, [])

	const requestHint = useCallback(() => {
		const current = sessionRef.current
		if (!current || current.completed || current.hintBusy || hintInFlight.current) {
			return
		}
		hintInFlight.current = true
		setSession((prev) =>
			prev ? reduceGameSession(prev, { type: 'SET_HINT_BUSY', busy: true }) : prev,
		)

		// Explicit user action only — yield so UI can paint busy state first.
		setTimeout(() => {
			const live = sessionRef.current
			if (!live) {
				hintInFlight.current = false
				return
			}
			try {
				const result = solveBoard(live.board, HINT_SOLVER_OPTIONS)
				if (result.status === 'solved' && result.path[0]) {
					const first = result.path[0]
					if (first.type === 'match') {
						setSession((prev) =>
							prev
								? reduceGameSession(prev, {
										type: 'APPLY_HINT',
										kind: 'match',
										indices: [first.aIndex, first.bIndex],
										message: strings.hintReady,
									})
								: prev,
						)
					} else {
						setSession((prev) =>
							prev
								? reduceGameSession(prev, {
										type: 'APPLY_HINT',
										kind: 'append',
										message: strings.hintAppend,
									})
								: prev,
						)
					}
				} else if (result.status === 'cutoff') {
					if (__DEV__) {
						console.warn(
							`[NumberMatch] hint cutoff ${result.reason} ` +
								`explored=${result.stats.exploredStates}`,
						)
					}
					setSession((prev) =>
						prev
							? reduceGameSession(prev, {
									type: 'APPLY_HINT',
									kind: 'unavailable',
									message: strings.hintUnavailable,
								})
							: prev,
					)
				} else if (result.status === 'unsolvable') {
					if (__DEV__) {
						console.warn('[NumberMatch] hint unsolvable on proven fixture')
					}
					setSession((prev) =>
						prev
							? reduceGameSession(prev, {
									type: 'APPLY_HINT',
									kind: 'unavailable',
									message: strings.hintUnavailable,
								})
							: prev,
					)
				} else {
					if (__DEV__) {
						console.warn('[NumberMatch] hint invalid', result)
					}
					setSession((prev) =>
						prev
							? reduceGameSession(prev, {
									type: 'APPLY_HINT',
									kind: 'unavailable',
									message: strings.hintUnavailable,
								})
							: prev,
					)
				}
			} catch (err) {
				if (__DEV__) {
					console.warn('[NumberMatch] hint error', err)
				}
				setSession((prev) =>
					prev
						? reduceGameSession(prev, {
								type: 'APPLY_HINT',
								kind: 'unavailable',
								message: strings.hintUnavailable,
							})
						: prev,
				)
			} finally {
				hintInFlight.current = false
			}
		}, 0)
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
