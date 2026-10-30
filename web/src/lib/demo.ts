// Демо-данные за ~3 месяца — для показа приложения (защита ВКР, презентации).
// Правдоподобный паттерн: ниже настроение и ПМС-симптомы в лютеиновой фазе, спазмы в месячные.

import { phaseOnDate } from './stats'
import { addDays, today as todayISO, type ISODate } from './date'
import type { AppData, LabRecord, Profile } from '../store/app'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function demoData(profile: Profile): AppData {
  const r = rng(42)
  const today = todayISO()
  // 4 начала месячных: циклы 27–30 дней, последнее — 11 дней назад
  const starts: ISODate[] = [addDays(today, -11)]
  for (const len of [29, 27, 30]) starts.unshift(addDays(starts[0], -len))
  const cycle = { lastPeriodStart: starts[starts.length - 1], cycleLength: 28, periodLength: 5 }
  // дни месячных с интенсивностью: средние → обильные → … → мажущие
  const periodDays: Record<ISODate, number> = {}
  for (const st of starts) [3, 4, 3, 2, 1].forEach((flow, i) => (periodDays[addDays(st, i)] = flow))

  const moods: Record<ISODate, number> = {}
  const moodNotes: AppData['moodNotes'] = {}
  const symptoms: Record<ISODate, string[]> = {}
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]

  for (let i = 85; i >= 1; i--) {
    const d = addDays(today, -i)
    const ph = phaseOnDate(d, starts, cycle)
    if (!ph) continue
    // настроение отмечено не каждый день; последние 6 дней подряд — для серии
    if (i <= 6 || r() < 0.75) {
      const base = { menstrual: 3, follicular: 4.3, ovulation: 4.6, luteal: 3.1 }[ph]
      const v = Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * 2)))
      moods[d] = v
      if (r() < 0.5)
        moodNotes[d] = {
          factors: [pick(v >= 4 ? ['Сон', 'Активность', 'Отношения'] : ['Стресс', 'Работа', 'Цикл', 'Сон'])],
          note: '',
        }
    }
    const pool = { menstrual: ['Спазмы', 'Усталость'], follicular: [], ovulation: ['Вздутие'], luteal: ['Головная боль', 'Тяга к сладкому', 'Акне', 'Чувствительность груди'] }[ph]
    if (pool.length && r() < 0.45) symptoms[d] = [pick(pool)]
  }

  const labs: LabRecord[] = [
    { id: 'demo-2', date: addDays(today, -6), source: 'photo', items: [{ code: 'hgb', value: 115 }, { code: 'ferritin', value: 8 }, { code: 'vitd', value: 38 }, { code: 'tsh', value: 2.1 }] },
    { id: 'demo-1', date: addDays(today, -80), source: 'manual', items: [{ code: 'hgb', value: 121 }, { code: 'ferritin', value: 14 }, { code: 'vitd', value: 22 }] },
  ]

  // «с нами» ~3 месяца
  return { profile: { ...profile, consentAt: Date.now() - 86 * 86_400_000 }, cycle, periodDays, periodStarts: starts, moods, moodNotes, symptoms, labs, chats: [] }
}
