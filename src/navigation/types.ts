/**
 * Planned application routes for Number Match.
 * Full screen designs arrive in later phases — this is navigation architecture.
 *
 * Training is replayable and is never an ad surface.
 */

export type AppRouteName =
	| 'home'
	| 'game'
	| 'levels'
	| 'daily'
	| 'statistics'
	| 'achievements'
	| 'settings'
	| 'training'
	| 'about'

export type AppRoute = { readonly name: AppRouteName }

/**
 * Android Back targets:
 * - home → null (system exit)
 * - about → previous (often settings) when present, else home
 * - training / other hubs → home
 */
export function resolveBackTarget(stack: readonly AppRoute[]): AppRouteName | null {
	if (stack.length === 0) {
		return null
	}
	const top = stack[stack.length - 1]
	if (!top || top.name === 'home') {
		return null
	}
	if (top.name === 'about') {
		const previous = stack[stack.length - 2]
		return previous?.name ?? 'home'
	}
	return 'home'
}

export function pushRoute(
	stack: readonly AppRoute[],
	route: AppRoute,
): AppRoute[] {
	const top = stack[stack.length - 1]
	if (top?.name === route.name) {
		return [...stack]
	}
	return [...stack, route]
}

export function popRoute(stack: readonly AppRoute[]): AppRoute[] {
	if (stack.length <= 1) {
		return [{ name: 'home' }]
	}
	return stack.slice(0, -1)
}

export function replaceStack(route: AppRoute): AppRoute[] {
	return [route]
}

/**
 * Replace the top route (or set the only route).
 * Used for Training → Level 1 and Next/Replay so Back still goes Home.
 */
export function replaceRoute(
	stack: readonly AppRoute[],
	route: AppRoute,
): AppRoute[] {
	if (stack.length <= 1) {
		return [route]
	}
	return [...stack.slice(0, -1), route]
}

/** Map route → banner placement policy key. */
export function routeToBannerPlacement(
	route: AppRouteName,
):
	| 'home'
	| 'levels'
	| 'daily'
	| 'statistics'
	| 'achievements'
	| 'settings'
	| 'about'
	| 'training'
	| 'game' {
	switch (route) {
		case 'home':
			return 'home'
		case 'levels':
			return 'levels'
		case 'daily':
			return 'daily'
		case 'statistics':
			return 'statistics'
		case 'achievements':
			return 'achievements'
		case 'settings':
			return 'settings'
		case 'about':
			return 'about'
		case 'training':
			return 'training'
		case 'game':
			return 'game'
		default: {
			const _exhaustive: never = route
			return _exhaustive
		}
	}
}
