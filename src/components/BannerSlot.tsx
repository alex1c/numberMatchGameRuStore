/**
 * App-owned BannerSlot — reserved geometry + Yandex BannerView lifecycle.
 * Screens pass placement only; this component owns SDK load/fail callbacks.
 * Failed loads keep reserved height to avoid gameplay layout jumping.
 */

import { useEffect, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { BannerAdSize, BannerView } from 'yandex-mobile-ads'

import {
	getBannerUnitId,
	type BannerPlacement,
} from '../ads'
import { trackEvent } from '../analytics'
import { BANNER_SLOT_HEIGHT, useTheme } from '../theme'

interface BannerSlotProps {
	/** When null/undefined, slot collapses (Training / Density Lab). */
	readonly placement?: BannerPlacement | null
	readonly visible?: boolean
	readonly testID?: string
}

export function BannerSlot({
	placement = null,
	visible = true,
	testID = 'banner-slot',
}: BannerSlotProps) {
	const theme = useTheme()
	const [bannerSize, setBannerSize] = useState<Awaited<
		ReturnType<typeof BannerAdSize.stickySize>
	> | null>(null)
	const loadedForPlacement = useRef<BannerPlacement | null>(null)

	const show = visible && placement !== null && placement !== undefined

	useEffect(() => {
		if (!show || !placement) {
			return
		}
		let active = true
		void BannerAdSize.stickySize(Dimensions.get('window').width)
			.then((size) => {
				if (!active) {
					return
				}
				setBannerSize(size)
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [show, placement])

	if (!show || !placement) {
		return null
	}

	const slotHeight = Math.max(
		BANNER_SLOT_HEIGHT,
		bannerSize?.height ?? BANNER_SLOT_HEIGHT,
	)

	return (
		<View
			style={[
				styles.slot,
				{
					height: slotHeight,
					backgroundColor: theme.colors.bannerSlot,
				},
			]}
			testID={testID}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			{bannerSize ? (
				<BannerView
					size={bannerSize}
					adRequest={{ adUnitId: getBannerUnitId(placement) }}
					style={styles.ad}
					onAdLoaded={() => {
						if (loadedForPlacement.current !== placement) {
							loadedForPlacement.current = placement
							trackEvent('ad_banner_loaded', { placement })
						}
					}}
					onAdFailedToLoad={() => {
						trackEvent('ad_banner_failed', {
							placement,
							error_category: 'load_failed',
						})
					}}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	slot: {
		width: '100%',
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	ad: {
		width: '100%',
		height: '100%',
	},
})

export { BANNER_SLOT_HEIGHT }
