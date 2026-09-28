/**
 * Pure navigation helper tests (no React Native rendering).
 */

import {
	pushRoute,
	resolveBackTarget,
	routeToBannerPlacement,
} from '../types'
import { shouldReserveBanner } from '../../ads/policy'

describe('navigation foundation', () => {
	it('resolves Android Back from hubs to home and exits only on home', () => {
		expect(resolveBackTarget([{ name: 'home' }])).toBeNull()
		expect(resolveBackTarget([{ name: 'home' }, { name: 'settings' }])).toBe(
			'home',
		)
		expect(
			resolveBackTarget([
				{ name: 'home' },
				{ name: 'settings' },
				{ name: 'about' },
			]),
		).toBe('settings')
	})

	it('plans Training as a first-class route without banner reservation', () => {
		expect(routeToBannerPlacement('training')).toBe('training')
		expect(shouldReserveBanner('training')).toBe(false)
		expect(shouldReserveBanner('home')).toBe(true)
		expect(shouldReserveBanner('about')).toBe(true)
		expect(shouldReserveBanner('game')).toBe(false)
	})

	it('pushRoute avoids duplicate top entries', () => {
		const stack = pushRoute([{ name: 'home' }], { name: 'levels' })
		expect(pushRoute(stack, { name: 'levels' })).toEqual(stack)
	})
})
