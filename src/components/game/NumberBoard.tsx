/**
 * Number Match board grid — explicit rows (no careless flexWrap).
 * Removed cells keep physical slots; partial last row aligns to column 0.
 */

import {
	useCallback,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import {
	LayoutChangeEvent,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'

import type { BoardState } from '../../game/core'
import { spacing, useTheme } from '../../theme'
import { boardRowCount, computeBoardLayout } from './boardLayout'
import { NumberCell, type CellVisualState } from './NumberCell'

interface NumberBoardProps {
	readonly board: BoardState
	readonly selectedIndex: number | null
	readonly invalidIndices: readonly number[]
	readonly hintIndices: readonly number[]
	readonly onCellPress: (index: number) => void
	readonly interactionLocked?: boolean
	/** When true, scroll toward end after content grows (append). */
	readonly scrollToEndToken?: number
	/** DEV-only coordinate overlay on cells. */
	readonly showDevCoords?: boolean
}

export function NumberBoard({
	board,
	selectedIndex,
	invalidIndices,
	hintIndices,
	onCellPress,
	interactionLocked = false,
	scrollToEndToken = 0,
	showDevCoords = false,
}: NumberBoardProps) {
	const theme = useTheme()
	const scrollRef = useRef<ScrollView>(null)
	const [viewportWidth, setViewportWidth] = useState(0)
	const pendingScrollToken = useRef(0)

	const layout = useMemo(
		() => computeBoardLayout(Math.max(0, viewportWidth - spacing.md * 2), board.width),
		[viewportWidth, board.width],
	)

	const rowCount = boardRowCount(board.cells.length, board.width)

	const visualFor = useCallback(
		(index: number): CellVisualState => {
			const cell = board.cells[index]
			if (!cell || cell.removed) {
				return 'removed'
			}
			if (hintIndices.includes(index)) {
				return 'hint'
			}
			if (invalidIndices.includes(index)) {
				return 'invalid'
			}
			if (selectedIndex === index) {
				return 'selected'
			}
			return 'normal'
		},
		[board.cells, hintIndices, invalidIndices, selectedIndex],
	)

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		const w = event.nativeEvent.layout.width
		setViewportWidth((prev) => (prev === w ? prev : w))
	}, [])

	const handleContentSizeChange = useCallback(
		(_w: number, _h: number) => {
			if (
				scrollToEndToken > 0 &&
				scrollToEndToken !== pendingScrollToken.current
			) {
				pendingScrollToken.current = scrollToEndToken
				scrollRef.current?.scrollToEnd({ animated: true })
			}
		},
		[scrollToEndToken],
	)

	const rows: ReactNode[] = []
	for (let r = 0; r < rowCount; r += 1) {
		const cellsInRow: ReactNode[] = []
		for (let c = 0; c < board.width; c += 1) {
			const index = r * board.width + c
			const cell = board.cells[index]
			if (!cell) {
				// Unused trailing slots in partial last row — empty spacer, not a fake cell.
				cellsInRow.push(
					<View
						key={`empty-${r}-${c}`}
						style={{ width: layout.cellSize, height: layout.cellSize }}
						accessible={false}
					/>,
				)
				continue
			}
			cellsInRow.push(
				<NumberCell
					key={cell.id}
					cell={cell}
					index={index}
					boardWidth={board.width}
					size={layout.cellSize}
					visual={visualFor(index)}
					onPress={onCellPress}
					disabled={interactionLocked}
					showDevCoords={showDevCoords}
				/>,
			)
		}
		rows.push(
			<View
				key={`row-${r}`}
				style={[styles.row, { gap: layout.gap, marginBottom: layout.gap }]}
			>
				{cellsInRow}
			</View>,
		)
	}

	return (
		<View
			style={[styles.viewport, { backgroundColor: theme.colors.background }]}
			onLayout={handleLayout}
			testID="number-board"
		>
			{viewportWidth > 0 ? (
				<ScrollView
					ref={scrollRef}
					style={styles.scroll}
					contentContainerStyle={[
						styles.scrollContent,
						{
							paddingHorizontal: layout.sideMargin + spacing.md,
							minWidth: layout.contentWidth + spacing.md * 2,
						},
					]}
					showsVerticalScrollIndicator
					onContentSizeChange={handleContentSizeChange}
					keyboardShouldPersistTaps="handled"
				>
					{rows}
				</ScrollView>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	viewport: {
		flex: 1,
		minHeight: 120,
	},
	scroll: {
		flex: 1,
	},
	scrollContent: {
		paddingVertical: spacing.sm,
		alignItems: 'flex-start',
		justifyContent: 'flex-start',
		flexGrow: 0,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		flexGrow: 0,
	},
})
