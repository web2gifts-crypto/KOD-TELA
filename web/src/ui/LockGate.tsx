import { useEffect, useRef, useState } from 'react'
import { useLock } from '../lib/lock'
import { biometricAuth, biometry, type Biometry } from '../lib/telegram'
import { apiFetch } from '../lib/api'
import { syncEnabled } from '../lib/sync'
import { Yuvi } from './Yuvi'
import { PinPad } from './PinPad'

/** Экран блокировки поверх приложения: при запуске и после возвращения из фона */
export function LockGate({ children }: { children: React.ReactNode }) {
  const { enabled, timeoutMin } = useLock()
  const [locked, setLocked] = useState(enabled)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return setLocked(false)
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current >= timeoutMin * 60_000) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [enabled, timeoutMin])

  return (
    <>
      {/* содержимое скрываем полностью, чтобы его не было видно даже в переключателе приложений */}
      <div style={locked ? { visibility: 'hidden' } : undefined} aria-hidden={locked}>
        {children}
      </div>
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </>
  )
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { check, biometric, blockedUntil, disable } = useLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [bio, setBio] = useState<Biometry | null>(null)
  const [now, setNow] = useState(Date.now())
  const blocked = now < blockedUntil

  const tryBio = async () => {
    if (await biometricAuth('Вход в «Код Тела»')) onUnlock()
  }

  useEffect(() => {
    if (!biometric) return
    void biometry().then((b) => {
      setBio(b)
      if (b.available) void tryBio()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometric])

  useEffect(() => {
    if (!blocked) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [blocked])

  // проверяем ровно один раз — в момент ввода 4-й цифры
  const enter = (v: string) => {
    setPin(v)
    if (v.length < 4) return
    void check(v).then((r) => {
      if (r === 'ok') return onUnlock()
      setError(true)
      setNow(Date.now())
      window.setTimeout(() => {
        setError(false)
        setPin('')
      }, 500)
    })
  }

  const forgot = async () => {
    if (!window.confirm('Сбросить код? Блокировка выключится, а бот пришлёт в чат уведомление о сбросе.')) return
    if (syncEnabled()) await apiFetch('/v1/security/pin-reset', { method: 'POST' }).catch(() => null)
    disable()
    onUnlock()
  }

  return (
    <div className="pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-6">
      <Yuvi mood="great" size={86} companion={false} />
      <h1 className="mt-3 text-[20px] font-bold">Введи код</h1>
      <p className="mb-8 mt-1 h-5 text-[13px] text-muted">{blocked ? `Слишком много попыток. Подожди ${Math.ceil((blockedUntil - now) / 1000)} с` : error ? 'Неверный код' : ' '}</p>
      {!blocked && <PinPad value={pin} onChange={(v) => !error && enter(v)} error={error} bio={bio?.available ? bio.type : null} onBio={() => void tryBio()} />}
      <button onClick={() => void forgot()} className="mt-8 text-[13px] font-semibold text-accent">
        Забыла код?
      </button>
    </div>
  )
}
