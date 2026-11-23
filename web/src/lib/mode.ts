// Режимы под цель: отслеживание цикла, планирование беременности, беременность.
// Базовый функционал без медицинских подробностей: приложение считает недели и даты,
// но не ведёт беременность — по всем вопросам к врачу.

import type { AppMode } from '../store/app'
import { addDays, diffDays, type ISODate } from './date'

export const MODES: { kind: AppMode['kind']; title: string; hint: string; emoji: string }[] = [
  { kind: 'cycle', title: 'Отслеживать цикл', hint: 'Календарь, прогноз месячных, настроение и самочувствие', emoji: '🌸' },
  { kind: 'conceive', title: 'Хочу забеременеть', hint: 'Фертильные дни, базальная температура, тесты на овуляцию', emoji: '🌱' },
  { kind: 'pregnancy', title: 'Беременность', hint: 'Недели, триместр и предполагаемая дата родов', emoji: '🤍' },
]

export const FORECAST_DISCLAIMER =
  'Прогноз строится по календарю и не является методом контрацепции или гарантией зачатия. Точнее определить овуляцию помогут тесты и врач.'

export interface PregnancyInfo {
  /** полных недель (акушерский срок от первого дня последних месячных) */
  week: number
  day: number
  trimester: 1 | 2 | 3
  /** предполагаемая дата родов: +280 дней (правило Негеле) */
  due: ISODate
  daysLeft: number
}

export function pregnancyInfo(lmp: ISODate | undefined, today: ISODate): PregnancyInfo | null {
  if (!lmp) return null
  const days = diffDays(today, lmp)
  if (days < 0 || days > 44 * 7) return null
  const week = Math.floor(days / 7)
  const due = addDays(lmp, 280)
  return { week, day: days % 7, trimester: week < 13 ? 1 : week < 27 ? 2 : 3, due, daysLeft: diffDays(due, today) }
}
