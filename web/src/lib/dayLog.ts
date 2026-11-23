// Расширенные отметки дня: выделения, близость, сон, вода, вес, базальная температура, тесты.
// Тексты нейтральные: приложение записывает, но не оценивает.

import type { DayExtra } from '../store/app'
import { addDays, type ISODate } from './date'
import { parseNum } from './labs'

export const DISCHARGE: { v: NonNullable<DayExtra['discharge']>; label: string }[] = [
  { v: 'dry', label: 'Сухо' },
  { v: 'sticky', label: 'Липкие' },
  { v: 'creamy', label: 'Кремообразные' },
  { v: 'watery', label: 'Водянистые' },
  { v: 'eggwhite', label: 'Как яичный белок' },
  { v: 'unusual', label: 'Необычные' },
]

export const UNUSUAL_HINT = 'Если выделения непривычного цвета или запаха, есть зуд или жжение — стоит показаться гинекологу.'

export const SEX: { v: NonNullable<DayExtra['sex']>; label: string }[] = [
  { v: 'none', label: 'Не было' },
  { v: 'protected', label: 'С защитой' },
  { v: 'unprotected', label: 'Без защиты' },
]

export const TEST: { v: 'neg' | 'pos'; label: string }[] = [
  { v: 'neg', label: 'Отрицательный' },
  { v: 'pos', label: 'Положительный' },
]

/** Допустимые диапазоны числовых отметок (защита от опечаток) */
export const RANGES = {
  sleep: { min: 0, max: 24, step: 0.5, unit: 'ч' },
  water: { min: 0, max: 30, step: 1, unit: 'стак.' },
  weight: { min: 25, max: 300, step: 0.1, unit: 'кг' },
  bbt: { min: 34, max: 42, step: 0.01, unit: '°C' },
} as const

export type NumField = keyof typeof RANGES

/** «36,65» → 36.65, если в диапазоне; пусто → undefined; ошибка → null */
export function parseField(field: NumField, s: string): number | undefined | null {
  if (!s.trim()) return undefined
  const n = parseNum(s)
  const r = RANGES[field]
  if (n === null || n < r.min || n > r.max) return null
  return n
}

/** Ряд значений для графика (например, БТТ за цикл) */
export function series(log: Record<ISODate, DayExtra>, field: NumField, from: ISODate, to: ISODate): { date: ISODate; value: number | null }[] {
  const out: { date: ISODate; value: number | null }[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, value: (log[d]?.[field] as number | undefined) ?? null })
  return out
}
