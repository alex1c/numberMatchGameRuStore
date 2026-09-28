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
	/** Active number cell fill */
	readonly cell: string
	readonly cellSelected: string
	readonly cellHint: string
	readonly cellInvalid: string
	readonly cellRemoved: string
	/** Subtle empty-slot fill (removed position inside a live row) */
	readonly cellSlotFill: string
	readonly cellSlotBorder: string
	readonly cellDigit: string
	readonly cellDigitSelected: string
	readonly controlPrimary: string
	readonly controlPrimaryText: string
	readonly controlSecondary: string
	readonly controlDisabled: string
	readonly controlDisabledText: string
	readonly overlay: string
	readonly danger: string
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
		cell: '#F7FAF8',
		cellSelected: '#2F6B4F',
		cellHint: '#D4E8DB',
		cellInvalid: '#E8C8C4',
		cellRemoved: 'transparent',
		cellSlotFill: 'rgba(28, 43, 36, 0.04)',
		cellSlotBorder: 'rgba(28, 43, 36, 0.14)',
		cellDigit: '#1C2B24',
		cellDigitSelected: '#F7FAF8',
		controlPrimary: '#2F6B4F',
		controlPrimaryText: '#F7FAF8',
		controlSecondary: '#E2EAE5',
		controlDisabled: '#D5DED8',
		controlDisabledText: '#8A9A90',
		overlay: 'rgba(18, 26, 22, 0.55)',
		danger: '#A04840',
	},
	dark: {
		background: '#121A16',
		surface: '#1B2620',
		text: '#E8F0EB',
		textMuted: '#9AADA2',
		accent: '#6FBF93',
		border: '#2F3F36',
		bannerSlot: 'transparent',
		cell: '#243029',
		cellSelected: '#6FBF93',
		cellHint: '#2F4A3A',
		cellInvalid: '#4A2E2C',
		cellRemoved: 'transparent',
		cellSlotFill: 'rgba(232, 240, 235, 0.05)',
		cellSlotBorder: 'rgba(232, 240, 235, 0.16)',
		cellDigit: '#E8F0EB',
		cellDigitSelected: '#121A16',
		controlPrimary: '#6FBF93',
		controlPrimaryText: '#121A16',
		controlSecondary: '#1B2620',
		controlDisabled: '#1F2A24',
		controlDisabledText: '#5A6B62',
		overlay: 'rgba(0, 0, 0, 0.65)',
		danger: '#D08078',
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
