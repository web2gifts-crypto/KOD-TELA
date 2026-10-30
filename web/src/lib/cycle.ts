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

/** Разметка календаря как в макете: месячные, фертильное окно, овуляция, ПМС */
export type DayMark = 'period' | 'fertile' | 'ovulation' | 'pms' | null

export const MARKS: Record<Exclude<DayMark, null>, { label: string; color: string }> = {
  period: { label: 'Менструация', color: 'var(--color-cal-period)' },
  fertile: { label: 'Фертильные дни', color: 'var(--color-cal-fertile)' },
  ovulation: { label: 'Овуляция', color: 'var(--color-cal-ovulation)' },
  pms: { label: 'ПМС', color: 'var(--color-cal-pms)' },
}

export function markForDay(day: number, s: Pick<CycleSettings, 'cycleLength' | 'periodLength'>): DayMark {
  const ov = s.cycleLength - 14
  if (day <= s.periodLength) return 'period'
  if (day === ov) return 'ovulation'
  if (day >= ov - 5 && day <= ov + 1) return 'fertile'
  if (day > s.cycleLength - 5) return 'pms'
  return null
}

/* ---------- дни месячных и интенсивность ---------- */

/** 0 — не указано, 1..4 — мажущие, слабые, средние, обильные */
export const FLOWS = [
  { v: 1, label: 'Мажущие' },
  { v: 2, label: 'Слабые' },
  { v: 3, label: 'Средние' },
  { v: 4, label: 'Обильные' },
]

/** Отмеченные дни месячных → группы подряд (разрыв до 2 дней считается одними месячными) */
export function periodRuns(days: Record<ISODate, number>): ISODate[][] {
  const runs: ISODate[][] = []
  for (const d of Object.keys(days).sort()) {
    const run = runs[runs.length - 1]
    if (run && diffDays(d, run[run.length - 1]) <= 2) run.push(d)
    else runs.push([d])
  }
  return runs
}

export function startsFromDays(days: Record<ISODate, number>): ISODate[] {
  return periodRuns(days).map((r) => r[0])
}

/** Заполнить дни месячных от даты начала (когда известна только дата начала) */
export function fillPeriod(days: Record<ISODate, number>, start: ISODate, length: number): Record<ISODate, number> {
  const next = { ...days }
  for (let i = 0; i < length; i++) {
    const d = addDays(start, i)
    if (next[d] === undefined) next[d] = 0
  }
  return next
}

/* ---------- модель цикла: прогноз по истории ---------- */

export interface DayStatus {
  /** день цикла */
  day: number
  phase: Phase
  mark: DayMark
  /** день в будущем — прогноз */
  predicted: boolean
  /** отмеченный день месячных и его интенсивность (0 — не указана) */
  flow: number | null
  /** возможное начало месячных (окно прогноза при нерегулярном цикле) */
  possibleStart: boolean
}

export interface CycleModel {
  starts: ISODate[]
  lastStart: ISODate | null
  /** длина цикла для прогноза: средняя по последним циклам или из настроек */
  cycleLength: number
  periodLength: number
  /** прогноз построен по истории (≥ 1 завершённого цикла), а не по настройкам */
  fromHistory: boolean
  /** ± дней к прогнозу начала месячных (разброс прошлых циклов) */
  spread: number
  status: (date: ISODate) => DayStatus | null
  nextPeriod: { date: ISODate; inDays: number } | null
  nextOvulation: { date: ISODate; inDays: number } | null
}

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

export function buildCycleModel(periodDays: Record<ISODate, number>, settings: CycleSettings, todayISO: ISODate): CycleModel {
  const runs = periodRuns(periodDays)
  const starts = runs.map((r) => r[0])
  const lengths: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i], starts[i - 1])
    if (len >= 15 && len <= 60) lengths.push(len)
  }
  const recent = lengths.slice(-6)
  const cycleLength = recent.length ? avg(recent) : settings.cycleLength
  // длина месячных — по завершённым отметкам, где отмечено больше одного дня
  const runLens = runs.filter((r) => r.length > 1 && r[r.length - 1] < todayISO).map((r) => diffDays(r[r.length - 1], r[0]) + 1)
  const periodLength = runLens.length ? avg(runLens.slice(-6)) : settings.periodLength
  const spread = recent.length >= 2 ? Math.min(5, Math.ceil((Math.max(...recent) - Math.min(...recent)) / 2)) : 0
  const lastStart = starts[starts.length - 1] ?? null

  const status = (date: ISODate): DayStatus | null => {
    const flow = periodDays[date] ?? null
    let idx = -1
    for (let i = 0; i < starts.length; i++) if (starts[i] <= date) idx = i
    if (idx < 0) return null
    const start = starts[idx]
    const nextStart = starts[idx + 1]
    const off = diffDays(date, start)
    const predicted = date > todayISO
    let day: number
    let cycLen: number
    let possibleStart = false
    if (nextStart) {
      // завершённый цикл — его реальная длина
      day = off + 1
      cycLen = diffDays(nextStart, start)
    } else if (off < cycleLength || !predicted) {
      // текущий цикл (в том числе задержка)
      day = off + 1
      cycLen = Math.max(cycleLength, day)
    } else {
      // будущие циклы — по средней длине
      day = (off % cycleLength) + 1
      cycLen = cycleLength
    }
    if (predicted && spread > 0) {
      const k = Math.round(off / cycleLength)
      if (k >= 1 && Math.abs(off - k * cycleLength) <= spread) possibleStart = true
    }
    let mark: DayMark
    if (flow !== null) mark = 'period'
    else if (day <= periodLength) mark = predicted ? 'period' : null
    else mark = markForDay(day, { cycleLength: cycLen, periodLength })
    return { day, phase: phaseForDay(day, { cycleLength: cycLen, periodLength }), mark, predicted, flow, possibleStart }
  }

  let nextPeriod: CycleModel['nextPeriod'] = null
  let nextOvulation: CycleModel['nextOvulation'] = null
  if (lastStart) {
    const np = addDays(lastStart, cycleLength)
    nextPeriod = { date: np, inDays: diffDays(np, todayISO) }
    let ov = addDays(lastStart, cycleLength - 15)
    if (ov < todayISO) ov = addDays(ov, cycleLength)
    nextOvulation = { date: ov, inDays: diffDays(ov, todayISO) }
  }

  return { starts, lastStart, cycleLength, periodLength, fromHistory: recent.length > 0, spread, status, nextPeriod, nextOvulation }
}
