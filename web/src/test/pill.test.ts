import { describe, expect, it } from 'vitest'
import { missedPills, pillDay, pillStreak, type PillSettings } from '../lib/pill'
import { merge } from '../lib/sync'
import { useApp } from '../store/app'

const p21: PillSettings = { regimen: '21_7', packStart: '2026-11-01' }

describe('контрацепция', () => {
  it('21+7: 21 активная, неделя перерыва, новая пачка (как pill_active на сервере)', () => {
    expect(pillDay(p21, '2026-11-01')).toMatchObject({ index: 1, active: true })
    expect(pillDay(p21, '2026-11-21')).toMatchObject({ index: 21, active: true })
    expect(pillDay(p21, '2026-11-22')).toMatchObject({ index: 22, active: false, breakDay: true })
    expect(pillDay(p21, '2026-11-29')).toMatchObject({ index: 1, active: true })
    expect(pillDay(p21, '2026-10-31')).toBe(null)
    expect(pillDay(null, '2026-11-01')).toBe(null)
  })

  it('24+4 — плацебо тоже принимается, непрерывный — каждый день', () => {
    expect(pillDay({ regimen: '24_4', packStart: '2026-11-01' }, '2026-11-26')).toMatchObject({ active: true, placebo: true })
    expect(pillDay({ regimen: 'continuous', packStart: '2026-11-01' }, '2026-11-25')).toMatchObject({ active: true })
  })

  it('серия считает только активные дни и не обрывается, если сегодня ещё не отмечено', () => {
    const log = { '2026-11-19': 1, '2026-11-20': 1, '2026-11-21': 1 }
    expect(pillStreak(p21, log, '2026-11-21')).toBe(3)
    // в перерыв серия сохраняется
    expect(pillStreak(p21, log, '2026-11-25')).toBe(3)
    expect(pillStreak(p21, { '2026-11-20': 1 }, '2026-11-21')).toBe(1)
  })

  it('пропуски — только активные дни до вчера', () => {
    expect(missedPills(p21, { '2026-11-20': 1 }, '2026-11-24', 5)).toEqual(['2026-11-21', '2026-11-19'])
  })

  it('отметка «выпила» и снятие', () => {
    const s = useApp.getState()
    s.togglePillTaken('2026-11-23')
    expect(useApp.getState().pillLog['2026-11-23']).toBe(1)
    s.togglePillTaken('2026-11-23')
    expect(useApp.getState().pillLog['2026-11-23']).toBeUndefined()
  })
})

describe('синхронизация новых данных', () => {
  it('отметки таблеток объединяются (бот отметил одну, приложение — другую)', () => {
    expect(merge('pillLog', { '2026-11-22': 1 }, { '2026-11-23': 1 })).toEqual({ '2026-11-22': 1, '2026-11-23': 1 })
  })
  it('напоминания — побеждает сервер (/mute в боте свежее)', () => {
    expect(merge('reminders', { muted: true }, { muted: false })).toEqual({ muted: true })
  })
  it('расширенные отметки дня объединяются по полям', () => {
    expect(merge('dayLog', { d: { sleep: 7 } }, { d: { water: 5 }, e: { bbt: 36.6 } })).toEqual({ d: { sleep: 7, water: 5 }, e: { bbt: 36.6 } })
  })
  it('setDayExtra: undefined снимает отметку, пустой день удаляется', () => {
    const s = useApp.getState()
    s.setDayExtra('2026-11-23', { sleep: 8 })
    s.setDayExtra('2026-11-23', { sleep: undefined })
    expect(useApp.getState().dayLog['2026-11-23']).toBeUndefined()
  })
})

describe('начало отслеживания', () => {
  it('дни до начала отметок — не пропуски', () => {
    const p = { regimen: '21_7' as const, packStart: '2026-11-01', since: '2026-11-03' }
    expect(missedPills(p, {}, '2026-11-05', 7)).toEqual(['2026-11-04', '2026-11-03'])
    expect(missedPills(p, {}, '2026-11-03', 7)).toEqual([])
  })
})
