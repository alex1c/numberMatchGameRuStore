/**
 * Pure navigation helper tests (no React Native rendering).
 */

import {
	pushRoute,
	replaceRoute,
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

	it('plans Training without banners; Game/Home/About reserve ads', () => {
		expect(routeToBannerPlacement('training')).toBe('training')
		expect(shouldReserveBanner('training')).toBe(false)
		expect(shouldReserveBanner('home')).toBe(true)
		expect(shouldReserveBanner('about')).toBe(true)
		expect(shouldReserveBanner('game')).toBe(true)
		expect(shouldReserveBanner('densityLab')).toBe(false)
	})

	it('pushRoute avoids duplicate top entries', () => {
		const stack = pushRoute([{ name: 'home' }], { name: 'levels' })
		expect(pushRoute(stack, { name: 'levels' })).toEqual(stack)
	})

	it('replaceRoute swaps the top without growing the stack', () => {
		const stack = [{ name: 'home' as const }, { name: 'training' as const }]
		expect(replaceRoute(stack, { name: 'game' })).toEqual([
			{ name: 'home' },
			{ name: 'game' },
		])
		expect(replaceRoute([{ name: 'home' }], { name: 'training' })).toEqual([
			{ name: 'training' },
		])
	})
})
