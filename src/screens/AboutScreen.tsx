/**
 * About — app name, version, developer links (graceful openURL failures).
 */

import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import {
	ABOUT_APP_NAME,
	ABOUT_DEVELOPER,
	ABOUT_OTHER_APPS_URL,
	ABOUT_PRIVACY_URL,
	ABOUT_WEBSITE_URL,
	APP_VERSION,
} from '../about/config'
import { HubScreenShell } from '../components/HubScreenShell'
import { strings } from '../i18n/strings.ru'
import { spacing, typography, useTheme } from '../theme'

interface AboutScreenProps {
	readonly onBack: () => void
}

async function openExternal(url: string, label: string): Promise<void> {
	try {
		const supported = await Linking.canOpenURL(url)
		if (!supported) {
			Alert.alert(strings.errorTitle, strings.aboutLinkFailed(label))
			return
		}
		await Linking.openURL(url)
	} catch {
		Alert.alert(strings.errorTitle, strings.aboutLinkFailed(label))
	}
}

export function AboutScreen({ onBack }: AboutScreenProps) {
	const theme = useTheme()

	return (
		<HubScreenShell
			title={strings.aboutTitle}
			onBack={onBack}
			testID="screen-about"
		>
			<Text style={[styles.appName, { color: theme.colors.text }]}>
				{ABOUT_APP_NAME}
			</Text>
			<Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
				{strings.aboutVersion(APP_VERSION)}
			</Text>
			<Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
				{strings.aboutDeveloper(ABOUT_DEVELOPER)}
			</Text>

			<View style={styles.links}>
				<LinkButton
					label={strings.aboutWebsite}
					onPress={() => void openExternal(ABOUT_WEBSITE_URL, strings.aboutWebsite)}
				/>
				<LinkButton
					label={strings.aboutOtherApps}
					onPress={() =>
						void openExternal(ABOUT_OTHER_APPS_URL, strings.aboutOtherApps)
					}
				/>
				<LinkButton
					label={strings.aboutPrivacy}
					onPress={() =>
						void openExternal(ABOUT_PRIVACY_URL, strings.aboutPrivacy)
					}
				/>
			</View>
		</HubScreenShell>
	)
}

function LinkButton({
	label,
	onPress,
}: {
	readonly label: string
	readonly onPress: () => void
}) {
	const theme = useTheme()
	return (
		<Pressable
			onPress={onPress}
			style={[styles.link, { borderColor: theme.colors.border }]}
			accessibilityRole="link"
			accessibilityLabel={label}
		>
			<Text style={{ color: theme.colors.accent, fontWeight: '600' }}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	appName: {
		...typography.title,
		textAlign: 'center',
	},
	links: {
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	link: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		alignItems: 'center',
	},
})
