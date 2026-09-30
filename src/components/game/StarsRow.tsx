/**
 * Compact ★ rendering for Levels tiles / completion / Home totals.
 */

import { StyleSheet, Text, View } from 'react-native'

import type { StarCount } from '../../game/stars'
import { typography, useTheme } from '../../theme'

/** Render up to 3 stars: filled ★ / empty ☆. */
export function StarsRow({
	stars,
	size = 'md',
	testID,
}: {
	readonly stars: StarCount
	readonly size?: 'sm' | 'md' | 'lg'
	readonly testID?: string
}) {
	const theme = useTheme()
	const fontSize = size === 'sm' ? 10 : size === 'lg' ? 22 : 14
	const chars = [1, 2, 3].map((i) => (i <= stars ? '★' : '☆')).join('')
	return (
		<Text
			style={{ color: theme.colors.text, fontSize, letterSpacing: 1 }}
			testID={testID}
			accessibilityLabel={`${stars} из 3 звёзд`}
		>
			{chars}
		</Text>
	)
}

/** Completion checklist for the three star criteria. */
export function StarChecklist({
	usedHint,
	usedUndo,
}: {
	readonly usedHint: boolean
	readonly usedUndo: boolean
}) {
	const theme = useTheme()
	const rows: { ok: boolean; label: string }[] = [
		{ ok: true, label: 'уровень пройден' },
		{ ok: !usedHint, label: 'без подсказки' },
		{ ok: !usedUndo, label: 'без отмены' },
	]
	return (
		<View style={styles.checklist} testID="star-checklist">
			{rows.map((row) => (
				<Text
					key={row.label}
					style={[
						styles.checkRow,
						{ color: theme.colors.textMuted },
					]}
				>
					{row.ok ? '✓' : '○'} {row.label}
				</Text>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	checklist: {
		gap: 2,
		alignItems: 'center',
		marginBottom: 4,
	},
	checkRow: {
		...typography.caption,
		textAlign: 'center',
	},
})
