/**
 * Light/dark theme provider — system default or user preference override.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import type { ThemePreference } from '../storage/types'
import { colors, type ColorSchemeName, type ThemeColors } from './tokens'

export interface AppTheme {
	readonly scheme: ColorSchemeName
	readonly colors: ThemeColors
	readonly preference: ThemePreference
}

const ThemeContext = createContext<AppTheme>({
	scheme: 'light',
	colors: colors.light,
	preference: 'system',
})

function resolveScheme(
	preference: ThemePreference,
	system: string | null | undefined,
): ColorSchemeName {
	if (preference === 'light') {
		return 'light'
	}
	if (preference === 'dark') {
		return 'dark'
	}
	return system === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({
	children,
	preference = 'system',
}: {
	readonly children: ReactNode
	/** User setting from persistence — defaults to system before hydrate. */
	readonly preference?: ThemePreference
}) {
	const system = useColorScheme()
	const scheme = resolveScheme(preference, system)
	const value = useMemo<AppTheme>(
		() => ({
			scheme,
			colors: colors[scheme],
			preference,
		}),
		[scheme, preference],
	)
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
