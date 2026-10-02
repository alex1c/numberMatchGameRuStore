/**
 * Centralized Russian user-facing strings (PHASE 5).
 * Not a full i18n framework — simple constant map + helpers.
 */

export const strings = {
	appName: 'Пары чисел',
	homeBrandEn: 'Number Match',
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
	/** Rewarded help prompts (Campaign monetization). */
	rewardedHintTitle: 'Бесплатная подсказка уже использована',
	rewardedHintBody:
		'Посмотреть короткую рекламу и получить ещё одну?',
	rewardedUndoTitle: 'Бесплатная отмена уже использована',
	rewardedUndoBody:
		'Посмотреть короткую рекламу и отменить ещё один ход?',
	rewardedWatch: 'Смотреть',
	adLoading: 'Загрузка рекламы…',
	adUnavailable: 'Реклама сейчас недоступна. Попробуйте позже.',
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
	dailyHubTitle: 'Головоломка дня',
	dailyPuzzleHeader: 'Головоломка дня',
	dailyToday: (dateLabel: string) => `Сегодня: ${dateLabel}`,
	dailyStatusCompleted: 'Сегодняшняя головоломка уже пройдена.',
	dailyStatusInProgress: 'Есть незавершённая попытка.',
	dailyStatusOpen: 'Новая головоломка ждёт вас.',
	dailyPlay: 'Играть',
	dailyContinue: 'Продолжить',
	dailyReplay: 'Сыграть снова',
	dailyStreakActive: (days: number) => `Серия: ${days} ${pluralDays(days)}`,
	dailyStreakBest: (days: number) => `Лучшая серия: ${days}`,
	dailyStreakActiveLabel: 'Текущая серия',
	dailyStreakBestLabel: 'Лучшая серия',
	dailyRecentTitle: 'Последние дни',
	dailyCardTitle: 'Головоломка дня',
	dailyCardOpen: 'Сегодня ещё не решена',
	dailyCardDone: (stars: number) =>
		`Сегодня: ${'★'.repeat(Math.max(0, Math.min(3, stars)))}${'☆'.repeat(Math.max(0, 3 - stars))}`,
	dailyCardContinue: 'Продолжить сегодняшнюю',
	dailyCompletionStreak: (days: number) =>
		`Серия: ${days} ${pluralDays(days)}`,
	statisticsTitle: 'Статистика',
	statsGroupCampaign: 'Кампания',
	statsGroupGameplay: 'Игра',
	statsGroupDaily: 'Ежедневная',
	statsLevelsCleared: 'Уровни',
	statsStarsTotal: 'Звёзды',
	statsThreeStarLevels: 'На 3★',
	statsPairsRemoved: 'Найдено пар',
	statsAppendActions: 'Добавлений чисел',
	statsHintsDelivered: 'Подсказок',
	statsUndoActions: 'Отмен',
	statsDailyCompleted: 'Решено',
	achievementsTitle: 'Достижения',
	achievementsProgress: (unlocked: number, total: number) =>
		`Открыто: ${unlocked} из ${total}`,
	achievementRequirement: (text: string) => `Нужно: ${text}`,
	achievementProgressLine: (current: number, target: number) =>
		`${current} / ${target}`,
	achievementUnlockedKicker: 'Достижение',
	achievementUnlockedA11y: (title: string) => `Достижение: ${title}`,
	settingsTitle: 'Настройки',
	settingsThemeSection: 'Тема',
	settingsTrainingNote: 'Повторить обучение',
	themeOptionLabel: (pref: string): string => {
		switch (pref) {
			case 'system':
				return 'Как в системе'
			case 'light':
				return 'Светлая'
			case 'dark':
				return 'Тёмная'
			default:
				return pref
		}
	},
	aboutTitle: 'О приложении',
	aboutVersion: (version: string) => `Версия ${version}`,
	aboutDeveloper: (name: string) => `Разработчик: ${name}`,
	aboutWebsite: 'Сайт ForestMusic',
	aboutOtherApps: 'Другие приложения',
	aboutPrivacy: 'Политика конфиденциальности',
	aboutLinkFailed: (label: string) =>
		`Не удалось открыть «${label}». Проверьте браузер или ссылку.`,
	rulesTitle: 'Правила',
	rulesParagraphs: [
		'Соединяйте пары чисел на поле: одинаковые цифры или две цифры в сумме дают 10.',
		'Пары можно брать по горизонтали, вертикали и диагонали, если между ними нет других чисел.',
		'После хода числа сдвигаются — пустые клетки исчезают.',
		'Если ходов не осталось, нажмите «Добавить», чтобы дописать числа с поля.',
		'Цель — очистить поле. В кампании за уровень можно получить до трёх звёзд: без подсказки и без отмены — три звезды.',
	],
	navStatistics: 'Статистика',
	navAchievements: 'Достижения',
	navSettings: 'Настройки',
} as const

function pluralDays(count: number): string {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) {
		return 'день'
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
		return 'дня'
	}
	return 'дней'
}
