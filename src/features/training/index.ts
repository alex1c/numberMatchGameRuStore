/**
 * Training feature public API.
 */

export {
	TRAINING_STEPS,
	TRAINING_STEP_COUNT,
	buildEqualPairBoard,
	buildSum10Board,
	buildEmptyGapBoard,
	buildVerticalBoard,
	buildDiagonalOnlyBoard,
	buildLinearOnlyBoard,
	buildAppendUnlockBoard,
	assertTrainingMatchValid,
	assertTrainingAppendUnlocks,
	isRequiredPair,
} from './steps'
export type { TrainingStepDef, TrainingRequiredAction } from './steps'

export { TrainingScreen } from './TrainingScreen'
