/**
 * Centralized Russian user-facing strings (PHASE 4).
 * Not a full i18n framework — simple constant map.
 */

export const strings = {
	appName: 'Number Match',
	back: 'Назад',
	home: 'На главную',
	continue: 'Продолжить',
	playEasy: 'EASY',
	playMedium: 'MEDIUM',
	playHard: 'HARD',
	playExpert: 'EXPERT',
	undo: 'Отменить',
	addNumbers: 'Добавить',
	addNumbersA11y: 'Добавить числа',
	hint: 'Подсказка',
	restart: 'Перезапустить',
	rules: 'Правила',
	cancel: 'Отмена',
	restartConfirmTitle: 'Начать заново?',
	restartConfirmBody:
		'Начать эту головоломку заново? Текущий прогресс будет потерян.',
	restartConfirmOk: 'Начать заново',
	replaceConfirmTitle: 'Новая головоломка?',
	replaceConfirmBody:
		'Начать другую головоломку? Текущий прогресс будет потерян.',
	replaceConfirmOk: 'Начать',
	completedTitle: 'Готово!',
	completedBody: 'Поле очищено',
	matches: 'Пары',
	appends: 'Добавления',
	undos: 'Отмены',
	hintBusy: 'Ищем…',
	hintAppend: 'Добавьте числа',
	hintUnavailable: 'Подсказка пока недоступна',
	hintReady: 'Подсказка',
	statusSelect: 'Выберите число',
	statusSelectSecond: 'Выберите пару',
	statusStuck: 'Нет ходов — добавьте числа',
	statusCleared: 'Поле очищено',
	devFixtures: 'DEV fixtures',
	homeSubtitle: 'Playtest · Phase 4',
	sessionInMemory: 'Сессия в памяти (без сохранения)',
	trainingNote: 'Обучение появится в Phase 5',
} as const
