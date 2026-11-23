import { describe, expect, it } from 'vitest'
import { migrateState } from '../store/app'
import { cycleStats } from '../lib/stats'

describe('миграция сохранённых данных', () => {
  it('старая версия: только даты начала → дни месячных', () => {
    const st = migrateState({ cycle: { lastPeriodStart: '2026-01-29', cycleLength: 28, periodLength: 3 }, periodStarts: ['2026-01-01', '2026-01-29'] })
    expect(Object.keys(st.periodDays).sort()).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-29', '2026-01-30', '2026-01-31'])
    expect(st.periodStarts).toEqual(['2026-01-01', '2026-01-29'])
    expect(st.cycle.lastPeriodStart).toBe('2026-01-29')
  })

  it('анализы без единиц и интервалов получают значения по умолчанию', () => {
    const st = migrateState({ labs: [{ id: 'a', date: '2026-01-01', source: 'manual', items: [{ code: 'ferritin', value: 8 }] }] })
    expect(st.labs[0].items[0]).toMatchObject({ unit: 'мкг/л', refMin: null, refMax: null })
  })

  it('вердикт «норма» из старых чатов превращается в информационный ответ', () => {
    const verdict = (level: string) => ({ level, title: 'Похоже на вариант нормы', explanation: '', plan: [] })
    const st = migrateState({
      chats: [{ id: 'c', startedAt: 0, messages: ['norm', 'doctor', 'urgent', 'emergency', 'info'].map((level, i) => ({ id: String(i), role: 'assistant', text: '', ts: 0, verdict: verdict(level) })) }],
    })
    const levels = st.chats[0].messages.map((m) => m.verdict!.level)
    expect(levels).toEqual(['info', 'doctor', 'doctor', 'emergency', 'info'])
    expect(st.chats[0].messages[0].verdict!.title).not.toMatch(/норм/)
  })

  it('пустое хранилище — начальное состояние', () => {
    const st = migrateState(undefined)
    expect(st.labs).toEqual([])
    expect(st.talkSeen).toEqual({})
  })
})

describe('статистика цикла', () => {
  it('нет истории', () => expect(cycleStats(['2026-01-01'])).toMatchObject({ avg: null, regular: null, tracked: 1 }))
  it('регулярность: разброс до 7 дней', () => {
    expect(cycleStats(['2026-01-01', '2026-01-29', '2026-02-28', '2026-03-28'])).toMatchObject({ avg: 29, min: 28, max: 30, regular: true })
    expect(cycleStats(['2026-01-01', '2026-01-24', '2026-03-01'])).toMatchObject({ regular: false })
  })
  it('пропуски отметок не считаются циклом', () => expect(cycleStats(['2026-01-01', '2026-05-01']).lengths).toEqual([]))
})
