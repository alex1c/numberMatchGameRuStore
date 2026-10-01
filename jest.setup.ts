/**
 * Jest mocks — AsyncStorage + native analytics/ads SDKs (no network in unit tests).
 */
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock'

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage)

jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
	},
}))

jest.mock('yandex-mobile-ads', () => {
	function MockBannerView() {
		return null
	}
	return {
		MobileAds: {
			initialize: jest.fn(() => Promise.resolve()),
		},
		BannerAdSize: {
			stickySize: jest.fn(async () => ({ width: 320, height: 50 })),
		},
		BannerView: MockBannerView,
		InterstitialAdLoader: {
			create: jest.fn(async () => ({
				loadAd: jest.fn(async () => ({
					show: jest.fn(async () => undefined),
				})),
			})),
		},
		RewardedAdLoader: {
			create: jest.fn(async () => ({
				loadAd: jest.fn(async () => ({
					show: jest.fn(async () => undefined),
					onRewarded: null,
					onAdDismissed: null,
					onAdFailedToShow: null,
				})),
			})),
		},
	}
})