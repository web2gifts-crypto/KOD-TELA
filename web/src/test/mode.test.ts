import { describe, expect, it } from 'vitest'
import { pregnancyInfo } from '../lib/mode'

describe('режим беременности', () => {
  it('срок от первого дня последних месячных и ПДР +280 дней', () => {
    expect(pregnancyInfo('2026-09-01', '2026-11-23')).toEqual({ week: 11, day: 6, trimester: 1, due: '2027-06-08', daysLeft: 197 })
    expect(pregnancyInfo('2026-05-01', '2026-11-23')?.trimester).toBe(3)
  })
  it('без даты или с невозможной датой — null', () => {
    expect(pregnancyInfo(undefined, '2026-11-23')).toBe(null)
    expect(pregnancyInfo('2026-12-01', '2026-11-23')).toBe(null)
    expect(pregnancyInfo('2025-01-01', '2026-11-23')).toBe(null)
  })
})
