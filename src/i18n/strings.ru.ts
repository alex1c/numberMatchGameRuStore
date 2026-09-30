/**
 * Centralized Russian user-facing strings (PHASE 5).
 * Not a full i18n framework — simple constant map + helpers.
 */

export const strings = {
	appName: 'Number Match',
	back: 'Назад',
	home: 'На главную',
	continue: 'Продолжить',
	play: 'Играть',
	levels: 'Уровни',
	levelsTitle: 'Уровни',
	training: 'Обучение',
	loading: 'Загрузка…',
	undo: 'Отменить',
	addNumbers: 'Добавить',
	addNumbersA11y: 'Добавить числа',
	hint: 'Подсказка',
	restart: 'Перезапустить',
	rules: 'Правила',
	cancel: 'Отмена',
	nextLevel: 'Следующий уровень',
	repeatLevel: 'Повторить',
	campaignComplete: 'Кампания пройдена',
	errorTitle: 'Ошибка',
	errorGeneric: 'Не удалось начать уровень',
	restartConfirmTitle: 'Начать заново?',
	restartConfirmBody:
		'Начать эту головоломку заново? Текущий прогресс будет потерян.',
	restartConfirmOk: 'Начать заново',
	/** §451 — replace unfinished dirty session. */
	replaceConfirmTitle: 'Заменить текущую игру?',
	replaceConfirmBody:
		'У вас есть незавершённый уровень. Начать другой? Прогресс текущей игры будет потерян.',
	replaceConfirmOk: 'Начать',
	completedTitle: 'Готово!',
	completedBody: 'Поле очищено',
	levelCompletedTitle: (level: number) => `Уровень ${level} пройден`,
	matches: 'Пары',
	appends: 'Добавления',
	undos: 'Отмены',
	hintBusy: 'Ищу…',
	hintAppend: 'Добавьте числа',
	hintUnavailable: 'Подсказка пока недоступна',
	hintReady: 'Подсказка',
	difficultyEasy: 'Легко',
	difficultyMedium: 'Средне',
	difficultyHard: 'Сложно',
	difficultyExpert: 'Эксперт',
	profileLabel: (profile: string): string => {
		switch (profile) {
			case 'EASY':
				return 'Легко'
			case 'MEDIUM':
				return 'Средне'
			case 'HARD':
				return 'Сложно'
			case 'EXPERT':
				return 'Эксперт'
			default:
				return profile
		}
	},
	statusSelect: 'Выберите число',
	statusSelectSecond: 'Выберите пару',
	statusStuck: 'Нет ходов — добавьте числа',
	statusCleared: 'Поле очищено',
	devFixtures: 'DEV fixtures',
	devResetProgress: 'DEV сброс прогресса',
	devSection: 'DEV',
	homeSubtitle: 'Соединяйте числа — равные или в сумме 10',
	trainingNote: 'Короткое интерактивное обучение',
	progressCleared: (cleared: number, total: number) =>
		`Пройдено: ${cleared} из ${total}`,
	starsMastery: (earned: number, max: number) => `★ ${earned} / ${max}`,
	progressLevel: (level: number, total: number) =>
		`Уровень ${level} из ${total}`,
	continueLevel: (level: number) => `Продолжить уровень ${level}`,
	nextLevelCta: (level: number) => `Следующий уровень ${level}`,
	startLevel: (level: number) => `Начать уровень ${level}`,
	levelHeader: (level: number) => `Уровень ${level}`,
	levelA11yLocked: (level: number) => `Уровень ${level}, заблокирован`,
	levelA11yCompleted: (level: number) => `Уровень ${level}, пройден`,
	levelA11yUnlocked: (level: number) => `Уровень ${level}, доступен`,
	levelA11yActive: (level: number) => `Уровень ${level}, в процессе`,
	levelA11yReplay: (level: number) => `Уровень ${level}, повтор`,
	trainingProgress: (current: number, total: number) =>
		`Шаг ${current} из ${total}`,
	trainingWrongTap: 'Так не получится — попробуйте другую пару',
	trainingWrongPair: 'Сейчас нужна другая пара — смотрите подсказку выше',
	trainingNeedAppend: 'Сначала нажмите «Добавить»',
	trainingStepDone: 'Отлично!',
	trainingDoneTitle: 'Обучение пройдено',
	trainingDoneBody: 'Вы готовы к кампании из 1000 уровней.',
	trainingStartGame: 'Начать игру',
	completionStats: (matches: number, appends: number) =>
		`Пар: ${matches} · Добавлений: ${appends}`,
	densityLabTitle: 'Density Lab',
	densityLabNote:
		'Сравнение плотности поля. Не кампания — прогресс не меняется.',
	densityLabEntry: 'Density Lab',
	densityLabBack: 'В Density Lab',
	densityLabV2Section: '8 columns — vertical fill',
	densityLabV2Note:
		'Ширина 8 уже удобна на OPPO. Сравните высоту: 6→10 рядов.',
	densityLabV1Section: 'V1 reference (width survey)',
} as const
