import { describe, expect, it } from 'vitest'
import { CUSTOM, formatRef, itemKey, latestValues, parseNum, rowError, seriesFor, type LabRow } from '../lib/labs'
import type { LabRecord } from '../store/app'

const row = (r: Partial<LabRow>): LabRow => ({ key: 'k', code: 'hgb', name: '', value: '', unit: 'г/л', refMin: '', refMax: '', ...r })

describe('ввод чисел', () => {
  it.each([
    ['12,5', 12.5],
    [' 7 ', 7],
    ['0.04', 0.04],
    ['-3', -3],
    ['', null],
    ['abc', null],
    ['12,5,3', null],
    ['0x10', null],
    ['1e3', null],
    ['Infinity', null],
    ['12.', null],
  ])('«%s» → %s', (s, v) => expect(parseNum(s)).toBe(v))
})

describe('проверка строки формы', () => {
  it('пустая строка — не ошибка (её просто не сохраним)', () => {
    expect(rowError(row({ code: '' }))).toBe(null)
    expect(rowError(row({ value: '' }))).toBe(null)
  })
  it('ошибки', () => {
    expect(rowError(row({ value: 'много' }))).toMatch(/числом/)
    expect(rowError(row({ value: '-1' }))).toMatch(/отрицательн/)
    expect(rowError(row({ value: '120', refMin: 'abc' }))).toMatch(/только числа/)
    expect(rowError(row({ value: '120', refMin: '160', refMax: '120' }))).toMatch(/больше верхней/)
    expect(rowError(row({ code: CUSTOM, value: '5' }))).toMatch(/название/)
  })
  it('корректные строки', () => {
    expect(rowError(row({ value: '128', refMin: '117', refMax: '160' }))).toBe(null)
    expect(rowError(row({ value: '128', refMax: '160' }))).toBe(null)
    expect(rowError(row({ code: CUSTOM, name: 'АМГ', value: '2,1' }))).toBe(null)
  })
})

describe('дневник анализов', () => {
  const labs: LabRecord[] = [
    { id: 'b', date: '2026-03-01', source: 'manual', items: [{ code: 'ferritin', value: 14, unit: 'мкг/л', refMin: 10, refMax: 120 }] },
    {
      id: 'a',
      date: '2026-01-10',
      source: 'manual',
      items: [
        { code: 'ferritin', value: 8, unit: 'мкг/л', refMin: 10, refMax: 120 },
        { code: CUSTOM, name: 'АМГ', value: 2, unit: 'нг/мл' },
      ],
    },
  ]

  it('последнее значение и предыдущее для сравнения — независимо от порядка записей', () => {
    const lv = latestValues(labs)
    const fer = lv.find((v) => v.key === 'ferritin')!
    expect(fer.item.value).toBe(14)
    expect(fer.prev).toEqual({ value: 8, date: '2026-01-10' })
    const amg = lv.find((v) => v.key === itemKey({ code: CUSTOM, name: 'АМГ' }))!
    expect(amg.prev).toBe(null)
  })

  it('ряд значений — по возрастанию даты', () => {
    expect(seriesFor(labs, 'ferritin').map((p) => p.value)).toEqual([8, 14])
  })

  it('интервал из бланка', () => {
    expect(formatRef({ refMin: 1, refMax: 2 })).toBe('1–2')
    expect(formatRef({ refMin: 1 })).toBe('от 1')
    expect(formatRef({ refMax: 2 })).toBe('до 2')
    expect(formatRef({})).toBe(null)
  })
})
