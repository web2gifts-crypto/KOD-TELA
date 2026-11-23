import { describe, expect, it } from 'vitest'
import { parseField, series } from '../lib/dayLog'

describe('расширенные отметки дня', () => {
  it.each([
    ['bbt', '36,65', 36.65],
    ['bbt', '366', null], // опечатка — не сохраняем
    ['bbt', '', undefined],
    ['weight', '58.4', 58.4],
    ['weight', '5', null],
    ['sleep', '7,5', 7.5],
  ] as const)('%s «%s» → %s', (f, s, v) => expect(parseField(f, s)).toBe(v))

  it('ряд значений с пропусками', () => {
    expect(series({ '2026-11-02': { bbt: 36.6 } }, 'bbt', '2026-11-01', '2026-11-03').map((p) => p.value)).toEqual([null, 36.6, null])
  })
})
