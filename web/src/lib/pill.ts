// Контрацепция: схема приёма и отметки «выпила». Логика активных дней совпадает с api/app/reminders.py (pill_active).
// Приложение не советует препараты и не оценивает пропуски — только напоминает и ведёт отметки;
// что делать при пропуске, написано в инструкции к препарату или скажет врач.

import { addDays, diffDays, type ISODate } from './date'

export type Regimen = '21_7' | '24_4' | '28' | 'continuous'

export interface PillSettings {
  regimen: Regimen
  /** первый день текущей (или любой прошлой) пачки */
  packStart: ISODate
  /** с какого дня ведём отметки — раньше пропусков не считаем */
  since?: ISODate
}

export const REGIMENS: { id: Regimen; label: string; hint: string }[] = [
  { id: '21_7', label: '21 + 7', hint: '21 таблетка, затем 7 дней перерыв' },
  { id: '24_4', label: '24 + 4', hint: '28 таблеток в пачке, 4 из них неактивные' },
  { id: '28', label: '28 без перерыва', hint: 'по таблетке каждый день' },
  { id: 'continuous', label: 'Непрерывно', hint: 'без перерывов, мини-пили и др.' },
]

export interface PillDay {
  /** номер таблетки в пачке 1..28 */
  index: number
  /** нужно ли сегодня принимать таблетку (в перерыв — нет) */
  active: boolean
  /** неделя перерыва 21+7 */
  breakDay: boolean
  /** неактивная таблетка (плацебо) 24+4 */
  placebo: boolean
}

export function pillDay(p: PillSettings | null, d: ISODate): PillDay | null {
  if (!p) return null
  const off = diffDays(d, p.packStart)
  if (off < 0) return null
  const idx = (off % 28) + 1
  const breakDay = p.regimen === '21_7' && idx > 21
  const placebo = p.regimen === '24_4' && idx > 24
  return { index: idx, active: !breakDay, breakDay, placebo }
}

/** Сколько таблеток подряд отмечено до сегодняшнего дня включительно (только активные дни) */
export function pillStreak(p: PillSettings | null, log: Record<ISODate, number>, today: ISODate): number {
  if (!p) return 0
  let n = 0
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, -i)
    const pd = pillDay(p, d)
    if (!pd || (p.since && d < p.since && !log[d])) break
    if (!pd.active) continue
    if (log[d]) n++
    else if (i > 0) break // сегодня ещё можно успеть
  }
  return n
}

/** Пропущенные активные дни за последние N дней (до вчера) */
export function missedPills(p: PillSettings | null, log: Record<ISODate, number>, today: ISODate, n = 7): ISODate[] {
  const out: ISODate[] = []
  for (let i = 1; i <= n; i++) {
    const d = addDays(today, -i)
    if (p?.since && d < p.since) break
    const pd = pillDay(p, d)
    if (pd?.active && !log[d]) out.push(d)
  }
  return out
}
