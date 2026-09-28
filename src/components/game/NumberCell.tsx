/**
 * Single Number Match cell — geometry from linear index; key by stable cell id.
 * Visual feedback uses theme tokens (no Animated ref during render).
 */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { indexToCoordinate, type Cell } from '../../game/core'
import { useTheme } from '../../theme'

export type CellVisualState =
	| 'normal'
	| 'selected'
	| 'hint'
	| 'invalid'
	| 'removed'

interface NumberCellProps {
	readonly cell: Cell
	readonly index: number
	readonly boardWidth: number
	readonly size: number
	readonly visual: CellVisualState
	readonly onPress: (index: number) => void
	readonly disabled?: boolean
}

function NumberCellComponent({
	cell,
	index,
	boardWidth,
	size,
	visual,
	onPress,
	disabled = false,
}: NumberCellProps) {
	const theme = useTheme()
	const coord = indexToCoordinate(index, boardWidth)
	const row = coord.row + 1
	const col = coord.col + 1

	if (cell.removed || visual === 'removed') {
		return (
			<View
				style={[styles.slot, { width: size, height: size }]}
				accessible={false}
				importantForAccessibility="no-hide-descendants"
				testID={`cell-removed-${cell.id}`}
			/>
		)
	}

	let backgroundColor = theme.colors.cell
	let digitColor = theme.colors.cellDigit
	let borderColor = theme.colors.border
	let borderWidth = 1.5
	let scaleStyle = styles.scaleNormal

	if (visual === 'selected') {
		backgroundColor = theme.colors.cellSelected
		digitColor = theme.colors.cellDigitSelected
		borderColor = theme.colors.cellSelected
		borderWidth = 2.5
		scaleStyle = styles.scaleSelected
	} else if (visual === 'hint') {
		backgroundColor = theme.colors.cellHint
		borderColor = theme.colors.accent
		borderWidth = 2.5
	} else if (visual === 'invalid') {
		backgroundColor = theme.colors.cellInvalid
		borderColor = theme.colors.danger
		borderWidth = 2
	}

	const fontSize = Math.max(16, Math.min(28, Math.floor(size * 0.48)))

	return (
		<View style={scaleStyle}>
			<Pressable
				onPress={() => onPress(index)}
				disabled={disabled}
				accessibilityRole="button"
				accessibilityState={{ selected: visual === 'selected', disabled }}
				accessibilityLabel={`Число ${cell.value}, строка ${row}, столбец ${col}`}
				style={[
					styles.cell,
					{
						width: size,
						height: size,
						backgroundColor,
						borderColor,
						borderWidth,
						borderRadius: Math.max(6, Math.floor(size * 0.16)),
					},
				]}
				testID={`cell-${cell.id}`}
			>
				<Text
					style={[styles.digit, { color: digitColor, fontSize }]}
					allowFontScaling
					maxFontSizeMultiplier={1.35}
				>
					{cell.value}
				</Text>
			</Pressable>
		</View>
	)
}

export const NumberCell = memo(NumberCellComponent)

const styles = StyleSheet.create({
	slot: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	cell: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	digit: {
		fontWeight: '700',
		fontVariant: ['tabular-nums'],
	},
	scaleNormal: {
		transform: [{ scale: 1 }],
	},
	scaleSelected: {
		transform: [{ scale: 1.05 }],
	},
})
