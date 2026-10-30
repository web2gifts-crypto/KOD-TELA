// «Мой код тела»: всё, что приложение узнало о пользователе за всё время.

import { phaseForDay, type CycleSettings, type Phase } from './cycle'
import { addDays, diffDays, type ISODate } from './date'
import { latestLabs } from './insights'
import type { LabEval } from './labs'
import type { LabRecord } from '../store/app'

/* ---------- цикл ---------- */

export interface CycleStats {
  /** длины завершённых циклов (между соседними началами месячных) */
  lengths: number[]
  avg: number | null
  min: number | null
  max: number | null
  /** регулярный: разброс длины не больше 7 дней */
  regular: boolean | null
  tracked: number
}

export function cycleStats(starts: ISODate[]): CycleStats {
  const lengths: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i], starts[i - 1])
    // явные пропуски отметок (меньше 15 или больше 60 дней) в статистику не берём
    if (len >= 15 && len <= 60) lengths.push(len)
  }
  if (!lengths.length) return { lengths, avg: null, min: null, max: null, regular: null, tracked: starts.length }
  const min = Math.min(...lengths)
  const max = Math.max(...lengths)
  return {
    lengths,
    avg: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    min,
    max,
    regular: lengths.length >= 2 ? max - min <= 7 : null,
    tracked: starts.length,
  }
}

/** Фаза в любой день истории — по ближайшему предыдущему началу месячных */
export function phaseOnDate(date: ISODate, starts: ISODate[], s: Pick<CycleSettings, 'cycleLength' | 'periodLength'>): Phase | null {
  let start: ISODate | null = null
  for (const st of starts) if (st <= date) start = st
  if (!start) return null
  const day = (diffDays(date, start) % s.cycleLength) + 1
  return phaseForDay(day, s)
}

/* ---------- настроение ---------- */

export interface MoodStats {
  total: number
  /** количество отметок по шкале 1..5 (индекс 0 — «плохо») */
  counts: number[]
  top: number | null
  avg: number | null
  bestStreak: number
  factors: { name: string; count: number }[]
}

export function moodStats(moods: Record<ISODate, number>, notes: Record<ISODate, { factors: string[] }>): MoodStats {
  const days = Object.keys(moods).sort()
  const counts = [0, 0, 0, 0, 0]
  for (const d of days) counts[moods[d] - 1]++
  const total = days.length
  let bestStreak = 0
  let run = 0
  days.forEach((d, i) => {
    run = i > 0 && diffDays(d, days[i - 1]) === 1 ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
  })
  const f = new Map<string, number>()
  for (const n of Object.values(notes)) for (const x of n.factors) f.set(x, (f.get(x) ?? 0) + 1)
  return {
    total,
    counts,
    top: total ? counts.indexOf(Math.max(...counts)) + 1 : null,
    avg: total ? Math.round((days.reduce((a, d) => a + moods[d], 0) / total) * 10) / 10 : null,
    bestStreak,
    factors: [...f.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  }
}

/** Последние n дней: значение настроения или null */
export function moodStrip(moods: Record<ISODate, number>, today: ISODate, n = 30): { date: ISODate; value: number | null }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    return { date, value: moods[date] ?? null }
  })
}

/* ---------- симптомы ---------- */

export interface SymptomStat {
  name: string
  count: number
  /** фаза, в которую симптом бывает чаще всего (если данных хватает) */
  phase: Phase | null
}

export function symptomStats(symptoms: Record<ISODate, string[]>, starts: ISODate[], s: CycleSettings): SymptomStat[] {
  const map = new Map<string, { count: number; phases: Map<Phase, number> }>()
  for (const [date, list] of Object.entries(symptoms)) {
    const ph = phaseOnDate(date, starts, s)
    for (const name of list) {
      const e = map.get(name) ?? { count: 0, phases: new Map() }
      e.count++
      if (ph) e.phases.set(ph, (e.phases.get(ph) ?? 0) + 1)
      map.set(name, e)
    }
  }
  return [...map.entries()]
    .map(([name, e]) => {
      const best = [...e.phases.entries()].sort((a, b) => b[1] - a[1])[0]
      // фазу называем, только если в ней больше половины случаев и случаев хотя бы 3
      const phase = best && e.count >= 3 && best[1] / e.count > 0.5 ? best[0] : null
      return { name, count: e.count, phase }
    })
    .sort((a, b) => b.count - a.count)
}

/* ---------- анализы ---------- */

export interface LabTrend {
  ev: LabEval
  prev: number | null
}

export function labTrends(labs: LabRecord[]): LabTrend[] {
  const sorted = [...labs].sort((a, b) => (a.date < b.date ? 1 : -1))
  return latestLabs(labs).map((ev) => {
    const vals = sorted.flatMap((l) => l.items.filter((i) => i.code === ev.def.code).map((i) => i.value))
    return { ev, prev: vals[1] ?? null }
  })
}
