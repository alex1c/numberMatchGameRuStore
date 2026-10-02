/**
 * Achievement catalog — stable ids used in persistence notify list + analytics.
 */

export type AchievementCategory =
	| 'campaign'
	| 'stars'
	| 'mastery'
	| 'pairs'
	| 'daily'

export interface AchievementDefinition {
	readonly id: string
	readonly category: AchievementCategory
	readonly titleRu: string
	readonly descriptionRu: string
	/** Shown on locked rows in the achievements screen. */
	readonly requirementRu: string
	readonly threshold: number
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
	{
		id: 'campaign_10',
		category: 'campaign',
		titleRu: 'Первые шаги',
		descriptionRu: 'Пройдите 10 уровней кампании.',
		requirementRu: '10 уровней',
		threshold: 10,
	},
	{
		id: 'campaign_50',
		category: 'campaign',
		titleRu: 'В пути',
		descriptionRu: 'Пройдите 50 уровней кампании.',
		requirementRu: '50 уровней',
		threshold: 50,
	},
	{
		id: 'campaign_100',
		category: 'campaign',
		titleRu: 'Сотня',
		descriptionRu: 'Пройдите 100 уровней кампании.',
		requirementRu: '100 уровней',
		threshold: 100,
	},
	{
		id: 'campaign_250',
		category: 'campaign',
		titleRu: 'Четверть пути',
		descriptionRu: 'Пройдите 250 уровней кампании.',
		requirementRu: '250 уровней',
		threshold: 250,
	},
	{
		id: 'campaign_500',
		category: 'campaign',
		titleRu: 'Полтысячи',
		descriptionRu: 'Пройдите 500 уровней кампании.',
		requirementRu: '500 уровней',
		threshold: 500,
	},
	{
		id: 'campaign_1000',
		category: 'campaign',
		titleRu: 'Легенда кампании',
		descriptionRu: 'Пройдите все 1000 уровней.',
		requirementRu: '1000 уровней',
		threshold: 1000,
	},
	{
		id: 'stars_100',
		category: 'stars',
		titleRu: 'Звёздный сбор',
		descriptionRu: 'Соберите 100 звёзд мастерства.',
		requirementRu: '100 ★',
		threshold: 100,
	},
	{
		id: 'stars_500',
		category: 'stars',
		titleRu: 'Созвездие',
		descriptionRu: 'Соберите 500 звёзд мастерства.',
		requirementRu: '500 ★',
		threshold: 500,
	},
	{
		id: 'stars_1000',
		category: 'stars',
		titleRu: 'Млечный путь',
		descriptionRu: 'Соберите 1000 звёзд мастерства.',
		requirementRu: '1000 ★',
		threshold: 1000,
	},
	{
		id: 'stars_2000',
		category: 'stars',
		titleRu: 'Галактика',
		descriptionRu: 'Соберите 2000 звёзд мастерства.',
		requirementRu: '2000 ★',
		threshold: 2000,
	},
	{
		id: 'stars_3000',
		category: 'stars',
		titleRu: 'Вселенная звёзд',
		descriptionRu: 'Соберите 3000 звёзд мастерства.',
		requirementRu: '3000 ★',
		threshold: 3000,
	},
	{
		id: 'clean_1',
		category: 'mastery',
		titleRu: 'Безупречно',
		descriptionRu: 'Пройдите уровень на 3 звезды.',
		requirementRu: '1 уровень на 3 ★',
		threshold: 1,
	},
	{
		id: 'clean_10',
		category: 'mastery',
		titleRu: 'Чистая десятка',
		descriptionRu: 'Пройдите 10 уровней на 3 звезды.',
		requirementRu: '10 уровней на 3 ★',
		threshold: 10,
	},
	{
		id: 'clean_50',
		category: 'mastery',
		titleRu: 'Мастер точности',
		descriptionRu: 'Пройдите 50 уровней на 3 звезды.',
		requirementRu: '50 уровней на 3 ★',
		threshold: 50,
	},
	{
		id: 'clean_100',
		category: 'mastery',
		titleRu: 'Сотня без ошибок',
		descriptionRu: 'Пройдите 100 уровней на 3 звезды.',
		requirementRu: '100 уровней на 3 ★',
		threshold: 100,
	},
	{
		id: 'pairs_100',
		category: 'pairs',
		titleRu: 'Счётчик пар',
		descriptionRu: 'Соберите 100 пар за всё время.',
		requirementRu: '100 пар',
		threshold: 100,
	},
	{
		id: 'pairs_500',
		category: 'pairs',
		titleRu: 'Паровоз',
		descriptionRu: 'Соберите 500 пар за всё время.',
		requirementRu: '500 пар',
		threshold: 500,
	},
	{
		id: 'pairs_1000',
		category: 'pairs',
		titleRu: 'Тысяча пар',
		descriptionRu: 'Соберите 1000 пар за всё время.',
		requirementRu: '1000 пар',
		threshold: 1000,
	},
	{
		id: 'pairs_5000',
		category: 'pairs',
		titleRu: 'Непрерывный поток',
		descriptionRu: 'Соберите 5000 пар за всё время.',
		requirementRu: '5000 пар',
		threshold: 5000,
	},
	{
		id: 'daily_first',
		category: 'daily',
		titleRu: 'Первый день',
		descriptionRu: 'Завершите головоломку дня.',
		requirementRu: '1 день',
		threshold: 1,
	},
	{
		id: 'daily_streak_3',
		category: 'daily',
		titleRu: 'Три дня подряд',
		descriptionRu: 'Серия ежедневных головоломок — 3 дня.',
		requirementRu: 'Серия 3',
		threshold: 3,
	},
	{
		id: 'daily_streak_7',
		category: 'daily',
		titleRu: 'Неделя привычки',
		descriptionRu: 'Серия ежедневных головоломок — 7 дней.',
		requirementRu: 'Серия 7',
		threshold: 7,
	},
	{
		id: 'daily_streak_30',
		category: 'daily',
		titleRu: 'Месяц дисциплины',
		descriptionRu: 'Серия ежедневных головоломок — 30 дней.',
		requirementRu: 'Серия 30',
		threshold: 30,
	},
] as const

const BY_ID = new Map(
	ACHIEVEMENT_DEFINITIONS.map((def) => [def.id, def] as const),
)

export function getAchievementDefinition(
	id: string,
): AchievementDefinition | undefined {
	return BY_ID.get(id)
}
