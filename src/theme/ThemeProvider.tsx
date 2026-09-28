/**
 * Light/dark theme provider using the system color scheme.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import { colors, type ColorSchemeName, type ThemeColors } from './tokens'

export interface AppTheme {
	readonly scheme: ColorSchemeName
	readonly colors: ThemeColors
}

const ThemeContext = createContext<AppTheme>({
	scheme: 'light',
	colors: colors.light,
})

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
	const system = useColorScheme()
	const scheme: ColorSchemeName = system === 'dark' ? 'dark' : 'light'
	const value: AppTheme = {
		scheme,
		colors: colors[scheme],
	}
	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	)
}

export function useTheme(): AppTheme {
	return useContext(ThemeContext)
}

/** Pure helper for tests / non-React callers. */
export function getThemeColors(scheme: ColorSchemeName = 'light'): ThemeColors {
	return colors[scheme]
}
