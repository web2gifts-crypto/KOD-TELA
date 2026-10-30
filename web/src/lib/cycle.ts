import { addDays, diffDays, type ISODate } from './date'

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

export interface CycleSettings {
  /** дата начала последней менструации */
  lastPeriodStart: ISODate | null
  cycleLength: number
  periodLength: number
}

export const PHASES: Record<Phase, { name: string; gen: string; short: string; color: string; text: string; hint: string }> = {
  menstrual: {
    name: 'Менструация',
    gen: 'менструации',
    short: 'Менструальная',
    color: 'var(--color-ph-menstrual)',
    text: '#a2427f',
    hint: 'Время замедлиться. Больше сна, тепла и продуктов с железом.',
  },
  follicular: {
    name: 'Фолликулярная фаза',
    gen: 'фолликулярной фазы',
    short: 'Фолликулярная',
    color: 'var(--color-ph-follicular)',
    text: '#9a6a12',
    hint: 'Хорошее время для активных тренировок и новых начинаний. Энергия растёт 🌱',
  },
  ovulation: {
    name: 'Овуляция',
    gen: 'овуляции',
    short: 'Овуляция',
    color: 'var(--color-ph-ovulation)',
    text: '#ffffff',
    hint: 'Пик энергии и либидо. Отличное время для интенсивных нагрузок и общения.',
  },
  luteal: {
    name: 'Лютеиновая фаза',
    gen: 'лютеиновой фазы',
    short: 'Лютеиновая',
    color: 'var(--color-ph-luteal)',
    text: '#3e5ea8',
    hint: 'Энергия снижается, может тянуть на сладкое. Магний, сон и мягкие тренировки.',
  },
}

export interface DayInfo {
  /** день цикла, начиная с 1 */
  day: number
  phase: Phase
  /** день в будущем — значит это прогноз */
  predicted: boolean
}

/** Фаза для конкретного дня цикла. Овуляция ≈ за 14 дней до следующей менструации. */
export function phaseForDay(day: number, s: Pick<CycleSettings, 'cycleLength' | 'periodLength'>): Phase {
  const ovulationDay = s.cycleLength - 14
  if (day <= s.periodLength) return 'menstrual'
  if (day >= ovulationDay - 1 && day <= ovulationDay + 1) return 'ovulation'
  if (day < ovulationDay) return 'follicular'
  return 'luteal'
}

export function dayInfo(date: ISODate, s: CycleSettings, todayISO: ISODate): DayInfo | null {
  if (!s.lastPeriodStart) return null
  const offset = diffDays(date, s.lastPeriodStart)
  // до последней известной менструации данных нет
  if (offset < 0) return null
  const day = (offset % s.cycleLength) + 1
  return { day, phase: phaseForDay(day, s), predicted: date > todayISO }
}

export function nextPeriod(s: CycleSettings, todayISO: ISODate): { date: ISODate; inDays: number } | null {
  if (!s.lastPeriodStart) return null
  const passed = diffDays(todayISO, s.lastPeriodStart)
  const cycles = Math.floor(passed / s.cycleLength) + 1
  const date = addDays(s.lastPeriodStart, cycles * s.cycleLength)
  return { date, inDays: diffDays(date, todayISO) }
}
