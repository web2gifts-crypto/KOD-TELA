// Блокировка приложения код-паролем и биометрией.
// Настройка — только на этом устройстве (на сервер не уходит): отдельное хранилище `kodtela-lock`.
// Код хранится как PBKDF2-хеш с солью. Защищает от случайного просмотра на разблокированном телефоне.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LockState {
  enabled: boolean
  /** base64(PBKDF2-SHA256(pin, salt)) */
  pinHash: string | null
  salt: string | null
  biometric: boolean
  /** через сколько минут в фоне снова спрашивать код (0 — сразу) */
  timeoutMin: number
  /** неудачные попытки подряд и до какого времени пауза */
  fails: number
  blockedUntil: number
  setPin: (pin: string) => Promise<void>
  disable: () => void
  update: (p: Partial<Pick<LockState, 'biometric' | 'timeoutMin'>>) => void
  /** проверить код; учитывает паузу после 5 ошибок */
  check: (pin: string) => Promise<'ok' | 'wrong' | 'blocked'>
}

const ITER = 120_000
export const MAX_FAILS = 5
export const BLOCK_MS = 30_000

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: ITER }, key, 256)
  return b64(bits)
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin)

export const useLock = create<LockState>()(
  persist(
    (set, get) => ({
      enabled: false,
      pinHash: null,
      salt: null,
      biometric: false,
      timeoutMin: 1,
      fails: 0,
      blockedUntil: 0,
      setPin: async (pin) => {
        if (!isValidPin(pin)) throw new Error('pin must be 4 digits')
        const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
        set({ enabled: true, salt, pinHash: await hashPin(pin, salt), fails: 0, blockedUntil: 0 })
      },
      disable: () => set({ enabled: false, pinHash: null, salt: null, biometric: false, fails: 0, blockedUntil: 0 }),
      update: (p) => set(p),
      check: async (pin) => {
        const s = get()
        if (Date.now() < s.blockedUntil) return 'blocked'
        if (!s.salt || !s.pinHash) return 'ok'
        if ((await hashPin(pin, s.salt)) === s.pinHash) {
          set({ fails: 0, blockedUntil: 0 })
          return 'ok'
        }
        const fails = s.fails + 1
        set(fails >= MAX_FAILS ? { fails: 0, blockedUntil: Date.now() + BLOCK_MS } : { fails })
        return fails >= MAX_FAILS ? 'blocked' : 'wrong'
      },
    }),
    { name: 'kodtela-lock', version: 1 },
  ),
)
