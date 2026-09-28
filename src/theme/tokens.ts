/**
 * Theme color tokens for light and dark modes.
 * Dense gameplay palette can refine later; this is foundation only.
 */

export type ColorSchemeName = 'light' | 'dark'

export interface ThemeColors {
	readonly background: string
	readonly surface: string
	readonly text: string
	readonly textMuted: string
	readonly accent: string
	readonly border: string
	readonly bannerSlot: string
}

export const colors: Record<ColorSchemeName, ThemeColors> = {
	light: {
		background: '#EEF3F0',
		surface: '#E2EAE5',
		text: '#1C2B24',
		textMuted: '#5A6B62',
		accent: '#2F6B4F',
		border: '#C5D2C8',
		bannerSlot: 'transparent',
	},
	dark: {
		background: '#121A16',
		surface: '#1B2620',
		text: '#E8F0EB',
		textMuted: '#9AADA2',
		accent: '#6FBF93',
		border: '#2F3F36',
		bannerSlot: 'transparent',
	},
}

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
} as const

/** Reserved banner geometry height before ad SDK integration. */
export const BANNER_SLOT_HEIGHT = 50

export const typography = {
	title: {
		fontSize: 28,
		fontWeight: '700' as const,
	},
	subtitle: {
		fontSize: 16,
		fontWeight: '500' as const,
	},
	body: {
		fontSize: 15,
		fontWeight: '400' as const,
	},
	caption: {
		fontSize: 13,
		fontWeight: '400' as const,
	},
	badge: {
		fontSize: 14,
		fontWeight: '700' as const,
		letterSpacing: 1,
	},
} as const
