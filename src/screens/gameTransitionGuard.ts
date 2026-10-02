/**
 * Pure helpers for GameScreen Next/Home interstitial transitions.
 * Integration tests drive these without mounting RN views.
 */

import type { TransitionToken } from '../game/session/attemptIdentity'
import { isTransitionTokenCurrent } from '../game/session/attemptIdentity'

export interface TransitionGuardState {
	screenGeneration: number
	attemptId: number
	transitionSeq: number
	activeTransitionId: number | null
}

export function createInitialTransitionGuardState(): TransitionGuardState {
	return {
		screenGeneration: 0,
		attemptId: 0,
		transitionSeq: 0,
		activeTransitionId: null,
	}
}

export function bumpScreenGeneration(state: TransitionGuardState): void {
	state.screenGeneration += 1
	state.activeTransitionId = null
}

export function invalidateScreen(state: TransitionGuardState): void {
	state.screenGeneration = 0
	state.activeTransitionId = null
}

export function syncAttemptId(
	state: TransitionGuardState,
	attemptId: number,
): void {
	if (state.attemptId !== attemptId) {
		state.attemptId = attemptId
		state.activeTransitionId = null
	}
}

export function beginTransition(state: TransitionGuardState): TransitionToken {
	state.transitionSeq += 1
	state.activeTransitionId = state.transitionSeq
	return {
		screenGeneration: state.screenGeneration,
		attemptId: state.attemptId,
		transitionId: state.transitionSeq,
	}
}

export function liveTransitionToken(state: TransitionGuardState): TransitionToken {
	return {
		screenGeneration: state.screenGeneration,
		attemptId: state.attemptId,
		transitionId: state.activeTransitionId ?? -1,
	}
}

export function isTransitionAlive(
	state: TransitionGuardState,
	token: TransitionToken,
): boolean {
	if (state.screenGeneration <= 0) {
		return false
	}
	if (state.activeTransitionId !== token.transitionId) {
		return false
	}
	return isTransitionTokenCurrent(token, {
		screenGeneration: state.screenGeneration,
		attemptId: state.attemptId,
		transitionId: token.transitionId,
	})
}

export function cancelActiveTransition(state: TransitionGuardState): void {
	state.activeTransitionId = null
}

/**
 * After interstitial settlement: run `action` only if the transition token
 * is still alive. Returns whether the action ran.
 */
export async function runAfterInterstitialIfCurrent(options: {
	readonly state: TransitionGuardState
	readonly token: TransitionToken
	readonly showInterstitial: () => Promise<unknown>
	readonly onCancelInterstitial?: () => void
	readonly action: () => void | Promise<void>
}): Promise<'completed' | 'stale' | 'cancelled'> {
	await options.showInterstitial()
	if (!isTransitionAlive(options.state, options.token)) {
		options.onCancelInterstitial?.()
		return 'stale'
	}
	await options.action()
	if (!isTransitionAlive(options.state, options.token)) {
		return 'cancelled'
	}
	return 'completed'
}
