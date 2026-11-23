import { describe, expect, it } from 'vitest'
import { fromStarts, mergeImported, parseImport, toDate } from '../lib/importHistory'
import { startsFromDays } from '../lib/cycle'

describe('перенос истории', () => {
  it('даты в разных форматах', () => {
    expect(toDate('2024-03-05T00:00:00Z')).toBe('2024-03-05')
    expect(toDate('05.03.2024')).toBe('2024-03-05')
    expect(toDate(1709596800)).toBe('2024-03-05')
    expect(toDate('2024-02-30')).toBe(null)
    expect(toDate('пятница')).toBe(null)
  })

  it('Clue-подобный JSON: записи дней с интенсивностью', () => {
    const clue = JSON.stringify({
      data: [
        { day: '2024-03-05T00:00:00Z', period: 'medium', tags: ['cramps'] },
        { day: '2024-03-06T00:00:00Z', period: 'heavy' },
        { day: '2024-03-07T00:00:00Z', period: 'spotting' },
        { day: '2024-03-20T00:00:00Z', mood: 'happy' },
      ],
    })
    const r = parseImport('export.cluedata', clue)
    expect(r.source).toBe('clue')
    expect(r.days).toEqual({ '2024-03-05': 3, '2024-03-06': 4, '2024-03-07': 1 })
  })

  it('Flo-подобный JSON: интервалы начала и конца', () => {
    const flo = JSON.stringify({ operationalData: { cycles: [{ period_start_date: '2024-01-10', period_end_date: '2024-01-14' }, { period_start_date: '2024-02-08' }] } })
    const r = parseImport('flo_data.json', flo)
    expect(r.source).toBe('flo')
    expect(startsFromDays(r.days)).toEqual(['2024-01-10', '2024-02-08'])
    expect(Object.keys(r.days)).toHaveLength(6)
  })

  it('CSV: даты и интенсивность, строки без месячных пропускаются', () => {
    const csv = 'date;flow\n2024-04-01;medium\n2024-04-02;heavy\n2024-04-03;none\n03.04.2024;light\nмусор'
    const r = parseImport('history.csv', csv)
    expect(r.source).toBe('csv')
    expect(r.days).toEqual({ '2024-04-01': 3, '2024-04-02': 4, '2024-04-03': 2 })
  })

  it('непонятный файл — ничего не найдено', () => {
    expect(parseImport('x.txt', 'привет').source).toBe('unknown')
    expect(parseImport('x.json', '{"a": 1}').days).toEqual({})
  })

  it('ручной ввод дат начала', () => {
    expect(Object.keys(fromStarts(['2024-05-01'], 3))).toEqual(['2024-05-01', '2024-05-02', '2024-05-03'])
  })

  it('свои отметки не затираются, будущие даты отбрасываются', () => {
    expect(mergeImported({ '2024-05-01': 4 }, { '2024-05-01': 1, '2024-05-02': 2, '2030-01-01': 3 }, '2026-11-23')).toEqual({ '2024-05-01': 4, '2024-05-02': 2 })
  })
})
