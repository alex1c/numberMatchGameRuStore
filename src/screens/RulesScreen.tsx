/**
 * Static game rules — opened from Settings.
 */

import { StyleSheet, Text } from 'react-native'

import { HubScreenShell } from '../components/HubScreenShell'
import { strings } from '../i18n/strings.ru'
import { typography, useTheme } from '../theme'

interface RulesScreenProps {
	readonly onBack: () => void
}

export function RulesScreen({ onBack }: RulesScreenProps) {
	const theme = useTheme()

	return (
		<HubScreenShell
			title={strings.rulesTitle}
			onBack={onBack}
			testID="screen-rules"
		>
			{strings.rulesParagraphs.map((paragraph, index) => (
				<Text
					key={String(index)}
					style={[styles.paragraph, { color: theme.colors.text }]}
				>
					{paragraph}
				</Text>
			))}
		</HubScreenShell>
	)
}

const styles = StyleSheet.create({
	paragraph: {
		...typography.body,
		lineHeight: 22,
	},
})
