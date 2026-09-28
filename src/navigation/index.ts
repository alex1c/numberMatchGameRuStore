/**
 * Lightweight stack navigation with deliberate Android Back handling.
 * Home is the only route that allows the system to exit the app.
 */

import { useCallback, useEffect, useState } from 'react'
import { BackHandler } from 'react-native'

import {
	pushRoute,
	replaceStack,
	resolveBackTarget,
	type AppRoute,
	type AppRouteName,
} from './types'

export function useAppNavigation(initial: AppRouteName = 'home') {
	const [stack, setStack] = useState<AppRoute[]>([{ name: initial }])
	const current = stack[stack.length - 1]?.name ?? 'home'

	const navigate = useCallback((name: AppRouteName) => {
		setStack((prev) => pushRoute(prev, { name }))
	}, [])

	const goHome = useCallback(() => {
		setStack(replaceStack({ name: 'home' }))
	}, [])

	const goBack = useCallback((): boolean => {
		const target = resolveBackTarget(stack)
		if (target === null) {
			return false
		}
		if (target === 'home') {
			setStack(replaceStack({ name: 'home' }))
			return true
		}
		setStack((prev) => {
			if (prev.length <= 1) {
				return replaceStack({ name: 'home' })
			}
			return prev.slice(0, -1)
		})
		return true
	}, [stack])

	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			'hardwareBackPress',
			() => goBack(),
		)
		return () => subscription.remove()
	}, [goBack])

	return {
		current,
		stack,
		navigate,
		goHome,
		goBack,
	}
}

export type { AppRoute, AppRouteName }
export {
	pushRoute,
	popRoute,
	replaceStack,
	resolveBackTarget,
	routeToBannerPlacement,
} from './types'
