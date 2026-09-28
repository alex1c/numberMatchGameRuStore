/**
 * Single Number Match cell — coherent grid tile (active or subtle empty slot).
 * Geometry from linear index; React key uses stable cell id upstream.
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
	/** DEV-only tiny coordinate overlay. */
	readonly showDevCoords?: boolean
}

function NumberCellComponent({
	cell,
	index,
	boardWidth,
	size,
	visual,
	onPress,
	disabled = false,
	showDevCoords = false,
}: NumberCellProps) {
	const theme = useTheme()
	const coord = indexToCoordinate(index, boardWidth)
	const row = coord.row + 1
	const col = coord.col + 1
	const radius = Math.max(4, Math.floor(size * 0.12))

	if (cell.removed || visual === 'removed') {
		return (
			<View
				style={[
					styles.slot,
					{
						width: size,
						height: size,
						borderRadius: radius,
						backgroundColor: theme.colors.cellSlotFill,
						borderColor: theme.colors.cellSlotBorder,
					},
				]}
				accessible={false}
				importantForAccessibility="no-hide-descendants"
				testID={`cell-removed-${cell.id}`}
			>
				{showDevCoords ? (
					<Text style={[styles.devCoord, { color: theme.colors.textMuted }]}>
						{coord.row},{coord.col}
					</Text>
				) : null}
			</View>
		)
	}

	let backgroundColor = theme.colors.cell
	let digitColor = theme.colors.cellDigit
	let borderColor = theme.colors.border
	let borderWidth = StyleSheet.hairlineWidth * 2

	if (visual === 'selected') {
		backgroundColor = theme.colors.cellSelected
		digitColor = theme.colors.cellDigitSelected
		borderColor = theme.colors.cellSelected
		borderWidth = 2
	} else if (visual === 'hint') {
		backgroundColor = theme.colors.cellHint
		borderColor = theme.colors.accent
		borderWidth = 2
	} else if (visual === 'invalid') {
		backgroundColor = theme.colors.cellInvalid
		borderColor = theme.colors.danger
		borderWidth = 2
	}

	const fontSize = Math.max(16, Math.min(28, Math.floor(size * 0.5)))

	return (
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
					borderRadius: radius,
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
			{showDevCoords ? (
				<Text style={[styles.devCoord, { color: theme.colors.textMuted }]}>
					{coord.row},{coord.col}
				</Text>
			) : null}
		</Pressable>
	)
}

export const NumberCell = memo(NumberCellComponent)

const styles = StyleSheet.create({
	slot: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth * 2,
	},
	cell: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	digit: {
		fontWeight: '700',
		fontVariant: ['tabular-nums'],
	},
	devCoord: {
		position: 'absolute',
		bottom: 1,
		right: 2,
		fontSize: 8,
		opacity: 0.7,
	},
})
