import { describe, expect, it } from 'vitest'
import { buildCycleModel, fillPeriod, markForDay, periodRuns, phaseForDay, startsFromDays, type CycleSettings } from '../lib/cycle'
import { addDays, diffDays, type ISODate } from '../lib/date'

const SETTINGS: CycleSettings = { lastPeriodStart: null, cycleLength: 28, periodLength: 5 }

/** месячные по 5 дней от каждой даты начала */
function history(starts: ISODate[], len = 5): Record<ISODate, number> {
  let days: Record<ISODate, number> = {}
  for (const s of starts) days = fillPeriod(days, s, len)
  return days
}

/** даты начала через заданные интервалы */
function startsWith(first: ISODate, lengths: number[]): ISODate[] {
  const out = [first]
  for (const l of lengths) out.push(addDays(out[out.length - 1], l))
  return out
}

describe('даты', () => {
  it('считает разницу через границы месяцев, високосный год и переход на летнее время', () => {
    expect(diffDays('2026-03-01', '2026-02-28')).toBe(1)
    expect(diffDays('2028-03-01', '2028-02-28')).toBe(2)
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    // Европа переходит на летнее время 29.03.2026 — сутки всё равно сутки
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2)
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })
})

describe('дни месячных → начала', () => {
  it('разрыв до 2 дней — те же месячные, 3 и больше — новые', () => {
    const days = { '2026-01-01': 3, '2026-01-02': 3, '2026-01-04': 2, '2026-01-08': 1 }
    expect(periodRuns(days)).toEqual([['2026-01-01', '2026-01-02', '2026-01-04'], ['2026-01-08']])
    expect(startsFromDays(days)).toEqual(['2026-01-01', '2026-01-08'])
  })

  it('fillPeriod не затирает уже указанную интенсивность', () => {
    const days = fillPeriod({ '2026-01-02': 4 }, '2026-01-01', 3)
    expect(days).toEqual({ '2026-01-01': 0, '2026-01-02': 4, '2026-01-03': 0 })
  })

  it('удаление дня в середине не дробит месячные на две', () => {
    const days = history(['2026-01-01'])
    delete days['2026-01-03']
    expect(startsFromDays(days)).toEqual(['2026-01-01'])
  })
})

describe('разметка дня цикла', () => {
  it('овуляция за 14 дней до следующих месячных, фертильное окно вокруг неё', () => {
    const s = { cycleLength: 28, periodLength: 5 }
    expect(markForDay(1, s)).toBe('period')
    expect(markForDay(14, s)).toBe('ovulation')
    expect(markForDay(9, s)).toBe('fertile')
    expect(markForDay(15, s)).toBe('fertile')
    expect(markForDay(16, s)).toBe(null)
    expect(markForDay(25, s)).toBe('pms')
    expect(phaseForDay(3, s)).toBe('menstrual')
    expect(phaseForDay(14, s)).toBe('ovulation')
    expect(phaseForDay(20, s)).toBe('luteal')
  })
})

describe('модель цикла', () => {
  it('новый пользователь без отметок — прогноза нет, ничего не падает', () => {
    const m = buildCycleModel({}, SETTINGS, '2026-05-10')
    expect(m.lastStart).toBe(null)
    expect(m.status('2026-05-10')).toBe(null)
    expect(m.nextPeriod).toBe(null)
    expect(m.nextOvulation).toBe(null)
    expect(m.late).toBe(false)
    expect(m.fromHistory).toBe(false)
  })

  it('одни месячные — прогноз по настройкам', () => {
    const m = buildCycleModel(history(['2026-05-01']), { ...SETTINGS, cycleLength: 30 }, '2026-05-10')
    expect(m.fromHistory).toBe(false)
    expect(m.cycleLength).toBe(30)
    expect(m.status('2026-05-10')).toMatchObject({ day: 10, predicted: false })
    expect(m.status('2026-04-30')).toBe(null) // до первой отметки данных нет
    expect(m.nextPeriod).toEqual({ date: '2026-05-31', inDays: 21 })
    expect(m.status('2026-05-31')).toMatchObject({ day: 1, mark: 'period', predicted: true })
    expect(m.status('2026-05-16')).toMatchObject({ mark: 'ovulation' }) // день 16 = 30 − 14
  })

  it('регулярный цикл — длина из истории, без разброса', () => {
    const starts = startsWith('2026-01-01', [28, 28, 28])
    const m = buildCycleModel(history(starts), { ...SETTINGS, cycleLength: 35 }, addDays(starts[3], 3))
    expect(m.fromHistory).toBe(true)
    expect(m.cycleLength).toBe(28)
    expect(m.spread).toBe(0)
    expect(m.periodLength).toBe(5)
  })

  it('нерегулярный цикл — средняя длина и окно «возможное начало»', () => {
    const starts = startsWith('2026-01-01', [26, 32, 29])
    const today = addDays(starts[3], 2)
    const m = buildCycleModel(history(starts), SETTINGS, today)
    expect(m.cycleLength).toBe(29)
    expect(m.spread).toBe(3)
    const expected = addDays(starts[3], 29)
    expect(m.nextPeriod?.date).toBe(expected)
    for (let d = -3; d <= 3; d++) expect(m.status(addDays(expected, d))?.possibleStart).toBe(true)
    expect(m.status(addDays(expected, -4))?.possibleStart).toBe(false)
    expect(m.status(addDays(expected, 4))?.possibleStart).toBe(false)
    // прошедшие дни не бывают «возможным началом»
    expect(m.status(today)?.possibleStart).toBe(false)
  })

  it('выбросы (пропущенные отметки, ошибки ввода) не портят среднюю длину', () => {
    const starts = startsWith('2026-01-01', [28, 90, 28, 10, 28])
    const m = buildCycleModel(history(starts), SETTINGS, addDays(starts[5], 1))
    expect(m.cycleLength).toBe(28)
  })

  it('прогноз по последним 6 циклам', () => {
    const starts = startsWith('2025-01-01', [40, 40, 40, 30, 30, 30, 30, 30, 30])
    const m = buildCycleModel(history(starts), SETTINGS, addDays(starts[9], 1))
    expect(m.cycleLength).toBe(30)
  })

  it('задержка: показывает «−N дней», прогноз переносится на завтра, дни задержки без разметки', () => {
    const start = '2026-04-01'
    const today = addDays(start, 31) // ожидали на 29-й день, сейчас 32-й
    const m = buildCycleModel(history([start]), SETTINGS, today)
    expect(m.late).toBe(true)
    expect(m.nextPeriod).toEqual({ date: addDays(start, 28), inDays: -3 })
    expect(m.status(today)).toMatchObject({ day: 32, mark: null, predicted: false })
    expect(m.status(addDays(start, 29))?.mark).toBe(null)
    // завтра — первый день прогноза, а не «5-й день» сдвинутого цикла
    expect(m.status(addDays(today, 1))).toMatchObject({ day: 1, mark: 'period', predicted: true })
    expect(m.status(addDays(today, 6))).toMatchObject({ day: 6, mark: null })
    // следующая овуляция — в будущем и в прогнозном цикле
    expect(m.nextOvulation!.inDays).toBeGreaterThan(0)
    expect(m.status(m.nextOvulation!.date)?.mark).toBe('ovulation')
  })

  it('ожидаемый день наступил сегодня — это ещё не задержка в днях, но прогноз на завтра', () => {
    const start = '2026-04-01'
    const today = addDays(start, 28)
    const m = buildCycleModel(history([start]), SETTINGS, today)
    expect(m.nextPeriod?.inDays).toBe(0)
    expect(m.status(addDays(today, 1))).toMatchObject({ day: 1, mark: 'period' })
  })

  it('отметили месячные после задержки — задержка уходит, начинается новый цикл', () => {
    const start = '2026-04-01'
    const today = addDays(start, 33)
    const days = { ...history([start]), [today]: 3 }
    const m = buildCycleModel(days, SETTINGS, today)
    expect(m.late).toBe(false)
    expect(m.lastStart).toBe(today)
    expect(m.status(today)).toMatchObject({ day: 1, mark: 'period', flow: 3 })
    // прошлый цикл посчитан по фактической длине (33 дня)
    expect(m.status(addDays(today, -1))).toMatchObject({ day: 33 })
  })

  it('идущие сейчас месячные: прошедшие дни без отметки не рисуются как прогноз', () => {
    const m = buildCycleModel({ '2026-06-01': 3 }, SETTINGS, '2026-06-03')
    expect(m.status('2026-06-01')).toMatchObject({ mark: 'period', flow: 3 })
    expect(m.status('2026-06-02')).toMatchObject({ mark: null, predicted: false })
    expect(m.status('2026-06-04')).toMatchObject({ mark: 'period', predicted: true })
  })

  it('длина месячных — по завершённым отметкам, текущие не учитываются', () => {
    const starts = startsWith('2026-01-01', [28, 28])
    const days = { ...history(starts.slice(0, 2), 4), [starts[2]]: 2 }
    const m = buildCycleModel(days, { ...SETTINGS, periodLength: 6 }, starts[2])
    expect(m.periodLength).toBe(4)
  })

  it('каждый день на год вперёд: корректный день цикла и одна «овуляция» на цикл', () => {
    const starts = startsWith('2026-01-03', [27, 31, 29])
    const today = addDays(starts[3], 10)
    const m = buildCycleModel(history(starts), SETTINGS, today)
    let ovulations = 0
    let cycles = 0
    for (let i = 0; i < 365; i++) {
      const st = m.status(addDays(today, i))!
      expect(st).not.toBe(null)
      expect(st.day).toBeGreaterThanOrEqual(1)
      expect(st.day).toBeLessThanOrEqual(m.cycleLength)
      if (st.day === 1) cycles++
      if (st.mark === 'ovulation') ovulations++
    }
    expect(Math.abs(ovulations - cycles)).toBeLessThanOrEqual(1)
  })
})
