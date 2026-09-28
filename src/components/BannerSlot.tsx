/**
 * App-owned BannerSlot — geometry contract only.
 * Not a fake ad: no ad copy, no SDK, no placeholder marketing text.
 */

import { StyleSheet, View } from 'react-native'

import { BANNER_SLOT_HEIGHT, useTheme } from '../theme'

interface BannerSlotProps {
	readonly visible?: boolean
	readonly testID?: string
}

export function BannerSlot({
	visible = true,
	testID = 'banner-slot',
}: BannerSlotProps) {
	const theme = useTheme()
	if (!visible) {
		return null
	}
	return (
		<View
			style={[styles.slot, { backgroundColor: theme.colors.bannerSlot }]}
			testID={testID}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		/>
	)
}

const styles = StyleSheet.create({
	slot: {
		height: BANNER_SLOT_HEIGHT,
		width: '100%',
	},
})

export { BANNER_SLOT_HEIGHT }
