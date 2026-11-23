import { useEffect, useState } from 'react'
import { useLock } from '../lib/lock'
import { biometry, haptic, type Biometry } from '../lib/telegram'
import { Chip, PageHeader, Toggle } from '../ui/kit'
import { PinPad } from '../ui/PinPad'

const TIMEOUTS = [
  { v: 0, label: 'Сразу' },
  { v: 1, label: 'Через 1 мин' },
  { v: 5, label: 'Через 5 мин' },
]

/** Код-пароль и биометрия */
export function Security() {
  const { enabled, biometric, timeoutMin, setPin, disable, update } = useLock()
  const [bio, setBio] = useState<Biometry | null>(null)
  const [step, setStep] = useState<'idle' | 'new' | 'repeat'>('idle')
  const [first, setFirst] = useState('')
  const [pin, setPinValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => void biometry().then(setBio), [])

  useEffect(() => {
    if (pin.length < 4) return
    if (step === 'new') {
      setFirst(pin)
      setPinValue('')
      setStep('repeat')
    } else if (step === 'repeat') {
      if (pin === first) {
        void setPin(pin).then(() => {
          haptic.success()
          setStep('idle')
          setPinValue('')
        })
      } else {
        setError('Коды не совпали, попробуй ещё раз')
        setPinValue('')
        setStep('new')
      }
    }
  }, [pin, step, first, setPin])

  if (step !== 'idle')
    return (
      <div>
        <PageHeader title="Код-пароль" />
        <div className="flex flex-col items-center px-6 pt-6">
          <h2 className="text-[18px] font-bold">{step === 'new' ? 'Придумай код из 4 цифр' : 'Повтори код'}</h2>
          <p className="mb-8 mt-1 h-5 text-[13px] text-bad">{error ?? ''}</p>
          <PinPad value={pin} onChange={(v) => (setError(null), setPinValue(v))} />
          <button onClick={() => setStep('idle')} className="mt-8 text-[14px] text-muted">
            Отмена
          </button>
        </div>
      </div>
    )

  const bioLabel = bio?.type === 'face' ? 'Face ID' : bio?.type === 'finger' ? 'отпечаток пальца' : 'биометрию'
  return (
    <div>
      <PageHeader title="Код-пароль" />
      <div className="space-y-3 px-4 pb-8">
        <div className="glass flex items-center justify-between rounded-card p-4 shadow-card">
          <div>
            <div className="text-[15px] font-semibold">Вход по коду</div>
            <div className="text-[12px] text-muted">{enabled ? 'Включён на этом устройстве' : 'Выключен'}</div>
          </div>
          <Toggle label="Вход по коду" on={enabled} onChange={(on) => (on ? setStep('new') : window.confirm('Выключить код-пароль?') && disable())} />
        </div>

        {enabled && (
          <>
            {bio?.available && (
              <div className="glass flex items-center justify-between rounded-card p-4 shadow-card">
                <div className="text-[15px] font-semibold">Входить через {bioLabel}</div>
                <Toggle label={`Входить через ${bioLabel}`} on={biometric} onChange={(v) => update({ biometric: v })} />
              </div>
            )}
            <div className="glass rounded-card p-4 shadow-card">
              <div className="mb-2 text-[13px] font-semibold text-muted">Спрашивать код после выхода из приложения</div>
              <div className="flex flex-wrap gap-2">
                {TIMEOUTS.map((t) => (
                  <Chip key={t.v} active={timeoutMin === t.v} onClick={() => update({ timeoutMin: t.v })}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <button onClick={() => setStep('new')} className="w-full text-center text-[14px] font-semibold text-accent">
              Сменить код
            </button>
          </>
        )}
        <p className="px-2 text-[12px] leading-snug text-muted">
          Код защищает от случайного просмотра, если кто-то возьмёт твой разблокированный телефон. Он действует только на этом устройстве. Если код сбросят, бот пришлёт уведомление в чат.
        </p>
      </div>
    </div>
  )
}
