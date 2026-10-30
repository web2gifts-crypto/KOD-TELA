import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Check, ChevronLeft, ShieldCheck } from 'lucide-react'
import { Button, Chip, Dots, IconButton } from '../ui/kit'
import { LogoMark } from '../ui/Logo'
import { Avatar, AVATARS } from '../ui/Avatar'
import { useApp, type Goal } from '../store/app'
import { getUser, haptic } from '../lib/telegram'
import { today } from '../lib/date'

const GOALS: { id: Goal; label: string }[] = [
  { id: 'cycle', label: '📅 Цикл' },
  { id: 'labs', label: '🔬 Анализы' },
  { id: 'symptoms', label: '💊 Симптомы' },
  { id: 'wellbeing', label: '✨ Здоровье' },
]

export function Onboarding() {
  const profile = useApp((s) => s.profile)
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  if (profile) return <Navigate to="/" replace />

  const back = step > 0 ? () => setStep(step - 1) : undefined
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[480px] flex-col px-6">
      <div className="flex h-14 items-center">
        {back && (
          <IconButton label="Назад" onClick={back}>
            <ChevronLeft size={20} />
          </IconButton>
        )}
      </div>
      <div key={step} className="anim-rise flex flex-1 flex-col">
        {step === 0 && <Welcome onNext={() => setStep(1)} />}
        {step === 1 && <About onNext={() => setStep(2)} />}
        {step === 2 && <Consent checked={consent} onToggle={() => setConsent(!consent)} onNext={() => setStep(3)} />}
        {step === 3 && <Register />}
      </div>
      {step < 3 && <Dots count={3} active={step} />}
      <div className="h-5" />
    </div>
  )
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-7 grid size-28 place-items-center rounded-[2rem] bg-white shadow-card">
          <LogoMark size={76} />
        </div>
        <h1 className="font-display text-[34px] font-bold leading-none tracking-tight">код тела</h1>
        <p className="mt-2 text-[13px] tracking-[0.2em] text-muted">всё о твоём здоровье</p>
        <p className="mt-8 max-w-[18rem] text-[16px] leading-relaxed text-ink/85">
          Понимай своё тело.
          <br />
          Без тревоги, без медицинского жаргона.
        </p>
      </div>
      <Button onClick={onNext} className="mb-6">
        Начать
      </Button>
    </>
  )
}

function About({ onNext }: { onNext: () => void }) {
  const features = [
    { e: '🔬', t: 'Анализы простым языком' },
    { e: '💬', t: 'AI-чат 24/7' },
    { e: '📅', t: 'Дневник цикла' },
  ]
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <OrbitIllustration />
        <h1 className="mt-8 text-[24px] font-bold leading-tight">
          За 2 минуты поймёшь,
          <br />
          что происходит с телом
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Загружай анализы, описывай симптомы, отслеживай цикл — объясним всё просто и по-человечески.
        </p>
        <div className="mt-7 grid w-full grid-cols-3 gap-2.5">
          {features.map((f) => (
            <div key={f.t} className="rounded-2xl bg-white px-2 py-4 shadow-card">
              <div className="text-[22px]">{f.e}</div>
              <div className="mt-1.5 text-[12px] leading-tight text-ink/75">{f.t}</div>
            </div>
          ))}
        </div>
      </div>
      <Button onClick={onNext} className="mb-6 mt-6">
        Далее
      </Button>
    </>
  )
}

function OrbitIllustration() {
  return (
    <div className="relative size-52 rounded-full bg-gradient-to-br from-[#f7e3f3] to-[#e6e6fb]">
      <div className="absolute inset-8 rounded-full border-2 border-dashed border-rose/40" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid size-16 place-items-center rounded-full bg-white/70 shadow-card">
          <LogoMark size={40} />
        </div>
      </div>
      {['🔬', '💬', '📅', '✨'].map((e, i) => {
        const pos = ['left-1/2 top-3 -translate-x-1/2', 'right-3 top-1/2 -translate-y-1/2', 'left-1/2 bottom-3 -translate-x-1/2', 'left-3 top-1/2 -translate-y-1/2'][i]
        return (
          <div key={e} className={`absolute grid size-12 place-items-center rounded-full bg-white text-[20px] shadow-card ${pos}`}>
            {e}
          </div>
        )
      })}
    </div>
  )
}

function Consent({ checked, onToggle, onNext }: { checked: boolean; onToggle: () => void; onNext: () => void }) {
  const points = [
    { e: '🔒', t: 'Шифрование при передаче и хранении' },
    { e: '🇷🇺', t: 'Данные хранятся на серверах в России' },
    { e: '🚫', t: 'Без рекламы и передачи третьим лицам' },
    { e: '🗑️', t: 'Удали все данные в любой момент' },
  ]
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="grid size-20 place-items-center rounded-[1.6rem] bg-brand text-white shadow-btn">
          <ShieldCheck size={36} />
        </div>
        <h1 className="mt-6 text-[24px] font-bold">Данные в безопасности</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Используем твои данные только для персональных рекомендаций. Личные данные хранятся отдельно от медицинских.
        </p>
        <ul className="mt-6 w-full space-y-3 rounded-card bg-white p-5 text-left shadow-card">
          {points.map((p) => (
            <li key={p.t} className="flex items-center gap-3 text-[14px]">
              <span className="text-[18px]">{p.e}</span>
              {p.t}
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            haptic.select()
            onToggle()
          }}
          className="mt-4 flex w-full items-start gap-3 rounded-card border border-line bg-white p-4 text-left"
          role="checkbox"
          aria-checked={checked}
        >
          <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${checked ? 'border-rose bg-rose text-white' : 'border-muted/50'}`}>
            {checked && <Check size={14} strokeWidth={3} />}
          </span>
          <span className="text-[13px] leading-snug text-ink/85">
            Я согласна на обработку персональных данных, включая данные о здоровье, в соответствии с{' '}
            <span className="text-rose underline decoration-rose/40">152-ФЗ «О персональных данных»</span>
          </span>
        </button>
      </div>
      <Button onClick={onNext} disabled={!checked} className="mb-6 mt-6">
        Продолжить
      </Button>
    </>
  )
}

function Register() {
  const nav = useNavigate()
  const complete = useApp((s) => s.completeOnboarding)
  const user = getUser()
  const [age, setAge] = useState('')
  const [goal, setGoal] = useState<Goal>('cycle')
  const [avatarId, setAvatarId] = useState(AVATARS[0].id)
  const [periodStart, setPeriodStart] = useState('')
  const [unknownPeriod, setUnknownPeriod] = useState(false)

  const ageNum = Number(age)
  const ageValid = age === '' || (ageNum >= 12 && ageNum <= 80)

  const submit = () => {
    haptic.success()
    complete(
      { name: user.first_name, age: age ? ageNum : null, goal, avatarId, consentAt: Date.now() },
      periodStart && !unknownPeriod ? { lastPeriodStart: periodStart } : undefined,
    )
    nav('/', { replace: true })
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar id={avatarId} size={56} />
        <div>
          <h1 className="font-display text-[20px] font-bold">Привет, {user.first_name}!</h1>
          <p className="text-[13px] text-muted">Аккаунт подключён через Telegram</p>
        </div>
      </div>

      <Label>Возраст</Label>
      <input
        inputMode="numeric"
        value={age}
        onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
        placeholder="Например, 24"
        className={`h-14 w-full rounded-2xl border bg-white px-4 text-[16px] outline-none focus:ring-2 focus:ring-rose/50 ${ageValid ? 'border-line' : 'border-bad'}`}
      />

      <Label>Твоя цель</Label>
      <div className="grid grid-cols-2 gap-2.5">
        {GOALS.map((g) => (
          <Chip key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>
            {g.label}
          </Chip>
        ))}
      </div>

      <Label>Начало последних месячных</Label>
      <div className="flex gap-2.5">
        <input
          type="date"
          value={periodStart}
          max={today()}
          disabled={unknownPeriod}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-rose/50 disabled:opacity-40"
        />
        <Chip active={unknownPeriod} onClick={() => setUnknownPeriod(!unknownPeriod)} className="shrink-0">
          Не помню
        </Chip>
      </div>

      <Label>Выбери своего аватара</Label>
      <div className="grid grid-cols-4 gap-2.5">
        {AVATARS.map((a) => (
          <button
            key={a.id}
            aria-label={`Аватар ${a.name}`}
            aria-pressed={avatarId === a.id}
            onClick={() => {
              haptic.select()
              setAvatarId(a.id)
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span className={`rounded-full p-0.5 transition ${avatarId === a.id ? 'bg-brand' : ''}`}>
              <span className="block rounded-full bg-white p-0.5">
                <Avatar id={a.id} size={60} />
              </span>
            </span>
            <span className={`text-[12px] ${avatarId === a.id ? 'font-semibold text-rose' : 'text-muted'}`}>{a.name}</span>
          </button>
        ))}
      </div>

      <div className="min-h-6 flex-1" />
      <Button onClick={submit} disabled={!ageValid} className="mb-2">
        Создать профиль
      </Button>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</div>
}
