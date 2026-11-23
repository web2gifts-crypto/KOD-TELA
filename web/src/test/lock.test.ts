import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin, isValidPin, MAX_FAILS, useLock } from '../lib/lock'

describe('код-пароль', () => {
  beforeEach(() => useLock.getState().disable())

  it('хранится только хеш, проверка работает', async () => {
    await useLock.getState().setPin('1234')
    const s = useLock.getState()
    expect(s.enabled).toBe(true)
    expect(s.pinHash).not.toContain('1234')
    expect(await s.check('1234')).toBe('ok')
    expect(await s.check('0000')).toBe('wrong')
  })

  it('соль разная — одинаковые коды дают разные хеши', async () => {
    expect(await hashPin('1234', btoa('a'.repeat(16)))).not.toBe(await hashPin('1234', btoa('b'.repeat(16))))
  })

  it(`после ${MAX_FAILS} ошибок — пауза, даже правильный код не принимается`, async () => {
    await useLock.getState().setPin('1234')
    for (let i = 0; i < MAX_FAILS - 1; i++) expect(await useLock.getState().check('9999')).toBe('wrong')
    expect(await useLock.getState().check('9999')).toBe('blocked')
    expect(await useLock.getState().check('1234')).toBe('blocked')
  })

  it('только 4 цифры', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
  })
})
