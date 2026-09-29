/**
 * Interactive Training boards — validated by production core (gv2 rules).
 * Each step requires a real tap / append; wrong taps are safe no-ops with feedback.
 */

import {
	appendRemainingNumbers,
	boardFromFixture,
	canMatch,
	getConnectionKinds,
	hasAvailableMoves,
	type BoardState,
	type ConnectionKind,
} from '../../game/core'

export type TrainingRequiredAction =
	| {
			readonly type: 'match'
			readonly aIndex: number
			readonly bIndex: number
			/** Expected connection kinds that must all be present (subset check). */
			readonly expectKinds?: readonly ConnectionKind[]
			/** When set, connection kinds must equal this set exactly. */
			readonly exactKinds?: readonly ConnectionKind[]
	  }
	| { readonly type: 'append' }

export interface TrainingStepDef {
	readonly id: string
	readonly title: string
	readonly instruction: string
	readonly buildBoard: () => BoardState
	readonly required: TrainingRequiredAction
	/** Optional a11y hint for the target cells. */
	readonly targetA11y?: string
}

/** Step 1 — equal values. */
export function buildEqualPairBoard(): BoardState {
	return boardFromFixture('7 7')
}

/** Step 2 — sum to 10. */
export function buildSum10Board(): BoardState {
	return boardFromFixture('1 9')
}

/** Step 3 — empty gap horizontal. */
export function buildEmptyGapBoard(): BoardState {
	return boardFromFixture('1 . 9')
}

/** Step 4 — vertical. */
export function buildVerticalBoard(): BoardState {
	return boardFromFixture(`
		5 2
		5 3
	`, 2)
}

/**
 * Step 5 — diagonal-only (not H/V/linear).
 * 1 at (0,0) and 1 at (1,1).
 */
export function buildDiagonalOnlyBoard(): BoardState {
	return boardFromFixture(`
		1 2
		3 1
	`, 2)
}

/**
 * Step 6 — linear / row-boundary only (not H/V/diagonal).
 * 3 at end of row 0 and 7 at start of row 1 → sum 10.
 */
export function buildLinearOnlyBoard(): BoardState {
	return boardFromFixture(`
		1 2 3
		7 5 6
	`, 3)
}

/**
 * Step 7 — stuck board; append unlocks a move.
 * 1 ↔ 1 blocked by 3; after append, adjacent 1s appear.
 */
export function buildAppendUnlockBoard(): BoardState {
	return boardFromFixture('1 3 1')
}

export const TRAINING_STEPS: readonly TrainingStepDef[] = [
	{
		id: 'equal',
		title: 'Равные числа',
		instruction: 'Соедините две одинаковые семёрки. Нажмите на одну, затем на другую.',
		buildBoard: buildEqualPairBoard,
		required: { type: 'match', aIndex: 0, bIndex: 1 },
		targetA11y: 'Пара равных чисел 7 и 7',
	},
	{
		id: 'sum10',
		title: 'Сумма 10',
		instruction: 'Числа можно соединить, если в сумме они дают 10. Соедините 1 и 9.',
		buildBoard: buildSum10Board,
		required: { type: 'match', aIndex: 0, bIndex: 1 },
		targetA11y: 'Пара 1 и 9',
	},
	{
		id: 'gap',
		title: 'Пустая клетка',
		instruction: 'Между числами могут быть пустые клетки. Соедините 1 и 9 через пустую клетку.',
		buildBoard: buildEmptyGapBoard,
		required: { type: 'match', aIndex: 0, bIndex: 2 },
		targetA11y: 'Пара 1 и 9 через пустую клетку',
	},
	{
		id: 'vertical',
		title: 'Вертикаль',
		instruction: 'Пары работают и по вертикали. Соедините две пятёрки в одном столбце.',
		buildBoard: buildVerticalBoard,
		required: { type: 'match', aIndex: 0, bIndex: 2 },
		targetA11y: 'Вертикальная пара пятёрок',
	},
	{
		id: 'diagonal',
		title: 'Диагональ',
		instruction: 'Можно соединять по диагонали. Соедините две единицы по диагонали.',
		buildBoard: buildDiagonalOnlyBoard,
		required: {
			type: 'match',
			aIndex: 0,
			bIndex: 3,
			exactKinds: ['diagonal'],
		},
		targetA11y: 'Диагональная пара единиц',
	},
	{
		id: 'linear',
		title: 'Через край строки',
		instruction:
			'Конец строки соединяется с началом следующей. Соедините 3 и 7 (сумма 10).',
		buildBoard: buildLinearOnlyBoard,
		required: {
			type: 'match',
			aIndex: 2,
			bIndex: 3,
			exactKinds: ['linear'],
		},
		targetA11y: 'Пара через край строки: 3 и 7',
	},
	{
		id: 'append',
		title: 'Добавить числа',
		instruction:
			'Когда ходов нет — нажмите «Добавить». Числа в конце поля повторятся, и появится ход.',
		buildBoard: buildAppendUnlockBoard,
		required: { type: 'append' },
		targetA11y: 'Кнопка Добавить',
	},
] as const

export const TRAINING_STEP_COUNT = TRAINING_STEPS.length

/** Assert a training match step is legal under production core. */
export function assertTrainingMatchValid(step: TrainingStepDef): {
	readonly ok: boolean
	readonly kinds: readonly ConnectionKind[]
	readonly reason?: string
} {
	if (step.required.type !== 'match') {
		return { ok: false, kinds: [], reason: 'not_a_match_step' }
	}
	const board = step.buildBoard()
	const { aIndex, bIndex, exactKinds, expectKinds } = step.required
	if (!canMatch(board, aIndex, bIndex)) {
		return { ok: false, kinds: [], reason: 'canMatch_false' }
	}
	const kinds = getConnectionKinds(board, aIndex, bIndex)
	if (exactKinds) {
		const sorted = [...kinds].sort()
		const expected = [...exactKinds].sort()
		if (
			sorted.length !== expected.length ||
			sorted.some((k, i) => k !== expected[i])
		) {
			return {
				ok: false,
				kinds,
				reason: `kinds ${sorted.join(',')} !== ${expected.join(',')}`,
			}
		}
	}
	if (expectKinds) {
		for (const kind of expectKinds) {
			if (!kinds.includes(kind)) {
				return { ok: false, kinds, reason: `missing_kind_${kind}` }
			}
		}
	}
	return { ok: true, kinds }
}

/** Assert append step starts stuck and unlocks a move after append. */
export function assertTrainingAppendUnlocks(step: TrainingStepDef): {
	readonly ok: boolean
	readonly reason?: string
} {
	if (step.required.type !== 'append') {
		return { ok: false, reason: 'not_an_append_step' }
	}
	const board = step.buildBoard()
	if (hasAvailableMoves(board)) {
		return { ok: false, reason: 'board_not_stuck' }
	}
	const next = appendRemainingNumbers(board)
	if (next === board) {
		return { ok: false, reason: 'append_noop' }
	}
	if (!hasAvailableMoves(next)) {
		return { ok: false, reason: 'append_did_not_unlock' }
	}
	return { ok: true }
}

/** True when indices match required pair (order-independent). */
export function isRequiredPair(
	required: Extract<TrainingRequiredAction, { type: 'match' }>,
	a: number,
	b: number,
): boolean {
	return (
		(a === required.aIndex && b === required.bIndex) ||
		(a === required.bIndex && b === required.aIndex)
	)
}
