/**
 * Application shell.
 * Layout contract: CONTENT → BANNER (when reserved) → SAFE AREA inset.
 * Provider order: SafeArea → Theme → AppState → GameSession → shell.
 *
 * Ads + AppMetrica initialize once on mount; failures never block gameplay.
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { AppStateProvider, useAppState } from './src/app'
import {
	initializeAds,
	preloadInterstitial,
	resolveBannerPlacement,
} from './src/ads'
import { initializeAnalytics, trackEvent } from './src/analytics'
import { AchievementToast } from './src/components/AchievementToast'
import { BannerSlot } from './src/components/BannerSlot'
import { isScreenshotQaMode } from './src/dev/screenshotQaMode'
import { TrainingScreen } from './src/features/training'
import { GameSessionProvider, useGameSession } from './src/game/session/GameSessionContext'
import { useAppNavigation, type AppRouteName } from './src/navigation'
import { AboutScreen } from './src/screens/AboutScreen'
import { AchievementsScreen } from './src/screens/AchievementsScreen'
import { DailyHubScreen } from './src/screens/DailyHubScreen'
import { GameScreen } from './src/screens/GameScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { LevelsScreen } from './src/screens/LevelsScreen'
import { DensityLabScreen } from './src/screens/DensityLabScreen'
import { RulesScreen } from './src/screens/RulesScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { StatisticsScreen } from './src/screens/StatisticsScreen'
import { ThemeProvider, useTheme } from './src/theme'

/** Map route → low-cardinality screen_view name (ForestMusic-style). */
function screenNameForRoute(route: AppRouteName): string | null {
	switch (route) {
		case 'home':
			return 'Home'
		case 'levels':
			return 'Levels'
		case 'game':
			return 'Game'
		case 'training':
			return 'Training'
		case 'daily':
			return 'Daily'
		case 'statistics':
			return 'Statistics'
		case 'achievements':
			return 'Achievements'
		case 'settings':
			return 'Settings'
		case 'about':
			return 'About'
		default:
			return null
	}
}

/**
 * Restores persisted campaign or daily session into GameSession once after hydrate.
 */
function SessionRestoreBridge({ children }: { readonly children: ReactElement }) {
	const {
		buildRestoredGameSession,
		buildRestoredDailySession,
		activeSession,
		daily,
		markCampaignSession,
		markDailySession,
	} = useAppState()
	const { restoreSession, hasSession } = useGameSession()
	const restored = useRef(false)

	useEffect(() => {
		if (restored.current || hasSession) {
			return
		}
		if (activeSession) {
			const state = buildRestoredGameSession()
			if (state) {
				restoreSession(state)
				markCampaignSession()
			}
		} else if (daily.activeDaily) {
			const state = buildRestoredDailySession()
			if (state) {
				restoreSession(state)
				markDailySession()
			}
		}
		restored.current = true
	}, [
		activeSession,
		buildRestoredDailySession,
		buildRestoredGameSession,
		daily.activeDaily,
		hasSession,
		markCampaignSession,
		markDailySession,
		restoreSession,
	])

	return children
}

/**
 * Single navigation owner so banner policy and screens share one stack.
 * Initial route is decided once by AppState after hydrate (training vs home).
 */
function AppShell() {
	const theme = useTheme()
	const {
		initialRoute,
		startCampaignLevel,
		trainingCompleted,
		achievementToastQueue,
		dismissAchievementToast,
	} = useAppState()
	const { startSession } = useGameSession()
	const nav = useAppNavigation(initialRoute)
	const bannerPlacement = isScreenshotQaMode()
		? null
		: resolveBannerPlacement(nav.current)

	useEffect(() => {
		const screen = screenNameForRoute(nav.current)
		if (screen) {
			trackEvent('screen_view', { screen })
		}
		// Intentionally keyed only on route — avoid re-firing on unrelated ticks.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nav object identity changes
	}, [nav.current])

	const startLevel1FromTraining = async () => {
		const result = await startCampaignLevel(1, 'progression')
		if (!result.ok || !result.identity || !result.board) {
			nav.goHome()
			return
		}
		startSession(result.identity, result.board, {
			undoAfterCompletion: false,
		})
		// Replace so Back from Game → Home (not Training).
		nav.replace('game')
	}

	let screen: ReactElement = <HomeScreen onNavigate={nav.navigate} />
	if (nav.current === 'game') {
		screen = (
			<GameScreen
				onHome={nav.goHome}
				onTraining={() => nav.navigate('training')}
				onReplaceGame={() => nav.replace('game')}
				onDensityLab={() => nav.replace('densityLab')}
			/>
		)
	} else if (nav.current === 'levels') {
		screen = (
			<LevelsScreen
				onHome={nav.goHome}
				onOpenGame={() => nav.navigate('game')}
			/>
		)
	} else if (nav.current === 'daily') {
		screen = (
			<DailyHubScreen
				onBack={nav.goBack}
				onOpenGame={() => nav.navigate('game')}
			/>
		)
	} else if (nav.current === 'statistics') {
		screen = <StatisticsScreen onBack={nav.goBack} />
	} else if (nav.current === 'achievements') {
		screen = <AchievementsScreen onBack={nav.goBack} />
	} else if (nav.current === 'settings') {
		screen = (
			<SettingsScreen
				onBack={nav.goBack}
				onTraining={() => nav.navigate('training')}
				onRules={() => nav.navigate('rules')}
				onAbout={() => nav.navigate('about')}
			/>
		)
	} else if (nav.current === 'about') {
		screen = <AboutScreen onBack={nav.goBack} />
	} else if (nav.current === 'rules') {
		screen = <RulesScreen onBack={nav.goBack} />
	} else if (nav.current === 'densityLab') {
		if (typeof __DEV__ === 'undefined' || !__DEV__) {
			screen = <HomeScreen onNavigate={nav.navigate} />
		} else {
			screen = (
				<DensityLabScreen
					onHome={nav.goHome}
					onOpenGame={() => nav.navigate('game')}
				/>
			)
		}
	} else if (nav.current === 'training') {
		screen = (
			<TrainingScreen
				onHome={nav.goHome}
				onStartCampaign={() => {
					void startLevel1FromTraining()
				}}
				isReplay={trainingCompleted}
			/>
		)
	}

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: theme.colors.background }]}
			edges={['top', 'left', 'right']}
		>
			<View style={styles.content}>{screen}</View>
			<AchievementToast
				queue={achievementToastQueue}
				onDismiss={(id) => {
					void dismissAchievementToast(id)
				}}
			/>
			<BannerSlot placement={bannerPlacement} />
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

/** Applies persisted theme preference after AppState hydrate. */
function ThemedAppTree({ children }: { readonly children: ReactElement }) {
	const { themePreference, hydrateStatus } = useAppState()
	const preference =
		hydrateStatus === 'ready' ? themePreference : ('system' as const)
	return <ThemeProvider preference={preference}>{children}</ThemeProvider>
}

export default function App() {
	useEffect(() => {
		initializeAnalytics()
		initializeAds()
		trackEvent('app_started')
		void preloadInterstitial()
	}, [])

	return (
		<SafeAreaProvider>
			<AppStateProvider>
				<ThemedAppTree>
					<GameSessionProvider>
						<SessionRestoreBridge>
							<AppShell />
						</SessionRestoreBridge>
					</GameSessionProvider>
				</ThemedAppTree>
			</AppStateProvider>
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
