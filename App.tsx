/**
 * Application shell.
 * Layout contract: CONTENT → BANNER (when reserved) → SAFE AREA inset.
 * No magic bottom offsets; no device-specific translate hacks.
 */

import { type ReactElement } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { BannerSlot } from './src/components/BannerSlot'
import { useAppNavigation } from './src/navigation'
import { GameSessionProvider } from './src/game/session/GameSessionContext'
import { GameScreen } from './src/screens/GameScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { PlaceholderScreen } from './src/screens/PlaceholderScreen'
import { ThemeProvider, useTheme } from './src/theme'
import type { AppRouteName } from './src/navigation'

const PLACEHOLDER_COPY: Partial<
	Record<AppRouteName, { title: string; note?: string }>
> = {
	levels: { title: 'Levels', note: 'Campaign levels arrive later.' },
	daily: { title: 'Daily', note: 'Daily mode arrives later.' },
	statistics: { title: 'Statistics' },
	achievements: { title: 'Achievements' },
	settings: { title: 'Settings' },
	training: {
		title: 'Правила',
		note:
			'Интерактивное обучение — Phase 5. Сейчас: числа совпадают если равны или в сумме дают 10; путь по горизонтали/вертикали/диагонали или через конец строки; пустые клетки между допустимы; Добавить — когда нет ходов.',
	},
	about: {
		title: 'About',
		note: 'Other our apps link will be configured before release.',
	},
}

/**
 * Single navigation owner so banner policy and screens share one stack.
 * Training and Game do not reserve banner geometry (gameplay decision: no sticky banner).
 */
function AppShell() {
	const theme = useTheme()
	const nav = useAppNavigation('home')
	const showBanner = nav.current !== 'training' && nav.current !== 'game'

	let screen: ReactElement = <HomeScreen onNavigate={nav.navigate} />
	if (nav.current === 'game') {
		screen = (
			<GameScreen
				onHome={nav.goHome}
				onTraining={() => nav.navigate('training')}
			/>
		)
	} else if (nav.current !== 'home') {
		const copy = PLACEHOLDER_COPY[nav.current]
		screen = (
			<PlaceholderScreen
				routeName={nav.current}
				title={copy?.title ?? nav.current}
				note={copy?.note}
				onClose={() => {
					if (nav.current === 'about') {
						nav.goBack()
						return
					}
					nav.goHome()
				}}
			/>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: theme.colors.background }]}
			edges={['top', 'left', 'right']}
		>
			<View style={styles.content}>{screen}</View>
			<BannerSlot visible={showBanner} />
			<SafeAreaView
				edges={['bottom']}
				style={[
					styles.bottomInset,
					{ backgroundColor: theme.colors.background },
				]}
			/>
			<StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
		</SafeAreaView>
	)
}

export default function App() {
	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<GameSessionProvider>
					<AppShell />
				</GameSessionProvider>
			</ThemeProvider>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
	},
	content: {
		flex: 1,
	},
	bottomInset: {
		width: '100%',
	},
})
