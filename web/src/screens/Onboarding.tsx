import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { CalendarHeart, Check, ChevronLeft, FlaskConical, HeartPulse, ShieldCheck, Smile, Sparkles } from 'lucide-react'
import { Button, Chip, Dots, GlassIcon, IconButton, SpeechBubble } from '../ui/kit'
import { LogoMark } from '../ui/Logo'
import { Yuvi, type YuviMood } from '../ui/Yuvi'
import { useApp, type Goal } from '../store/app'
import { getUser, haptic } from '../lib/telegram'
import { today } from '../lib/date'

const GOALS: { id: Goal; label: string }[] = [
  { id: 'cycle', label: 'Цикл' },
  { id: 'labs', label: 'Анализы' },
  { id: 'symptoms', label: 'Симптомы' },
  { id: 'wellbeing', label: 'Самочувствие' },
]

export function Onboarding() {
  const profile = useApp((s) => s.profile)
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  if (profile) return <Navigate to="/" replace />

  const next = () => setStep((s) => s + 1)
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[480px] flex-col px-6">
      <div className="flex h-14 items-center justify-between">
        {step > 0 ? (
          <IconButton label="Назад" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={20} />
          </IconButton>
        ) : (
          <span />
        )}
        {step < 4 && <Dots count={5} active={step} />}
      </div>
      <div key={step} className="anim-rise flex flex-1 flex-col">
        {step === 0 && <Brand onNext={next} />}
        {step === 1 && <Welcome onNext={next} />}
        {step === 2 && <Skills onNext={next} />}
        {step === 3 && <Consent checked={consent} onToggle={() => setConsent(!consent)} onNext={next} />}
        {step === 4 && <Register />}
      </div>
      <div className="h-4" />
    </div>
  )
}

function YuviSays({ mood, children, size = 150 }: { mood?: YuviMood; children: React.ReactNode; size?: number }) {
  return (
    <div className="flex flex-col items-center">
      <Yuvi mood={mood} size={size} />
      <SpeechBubble tail="top" className="anim-pop mt-3 w-full [animation-delay:250ms]">
        {children}
      </SpeechBubble>
    </div>
  )
}

/** Первый слайд: о проекте «Код Тела», до знакомства с Юви */
function Brand({ onNext }: { onNext: () => void }) {
  const pillars = [
    { icon: CalendarHeart, tone: 'pink' as const, t: 'Цикл', d: 'фазы, прогноз и фертильные дни' },
    { icon: FlaskConical, tone: 'violet' as const, t: 'Анализы', d: 'расшифровка простым языком' },
    { icon: Smile, tone: 'blue' as const, t: 'Самочувствие', d: 'настроение, симптомы и советы' },
  ]
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative">
          {/* мягкое свечение в цветах логотипа */}
          <span className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,#fcd3ef_0%,#dfe3ff_45%,transparent_70%)] opacity-90 blur-xl" />
          <div className="relative grid size-32 place-items-center rounded-[2.2rem] bg-white shadow-card">
            <LogoMark size={88} />
          </div>
        </div>
        <h1 className="mt-7 font-display text-[40px] font-bold leading-none tracking-tight">код тела</h1>
        <p className="mt-2 font-display text-[14px] tracking-[0.18em] text-muted">всё о твоём здоровье</p>
        <p className="mt-6 max-w-[19rem] text-[15px] leading-relaxed text-ink/80">
          Помогаем понимать своё тело — без тревоги и медицинского жаргона. Всё важное о женском здоровье в одном месте.
        </p>
        <ul className="mt-6 w-full space-y-2.5">
          {pillars.map((p, i) => (
            <li key={p.t} className="anim-pop glass flex items-center gap-3.5 rounded-card p-3.5 text-left shadow-card" style={{ animationDelay: `${200 + i * 120}ms` }}>
              <GlassIcon icon={p.icon} tone={p.tone} size={42} />
              <div>
                <div className="text-[15px] font-bold">{p.t}</div>
                <div className="text-[13px] text-muted">{p.d}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Button onClick={onNext} className="mb-2 mt-6">
        Дальше
      </Button>
    </>
  )
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-brand text-center text-[56px] font-bold leading-none tracking-tight">Юви</h1>
        <p className="mt-2 text-center text-[17px] font-medium text-ink/70">твой AI-помощник по здоровью</p>
        <div className="mt-6">
          <YuviSays size={190}>
            <div className="font-bold text-accent">Привет! Я Юви 💙</div>
            <div className="mt-1 text-ink/80">Я здесь, чтобы помогать тебе понимать своё тело и заботиться о себе каждый день ✨</div>
          </YuviSays>
        </div>
      </div>
      <Button onClick={onNext} className="mb-2 mt-6">
        Привет, Юви!
      </Button>
    </>
  )
}

function Skills({ onNext }: { onNext: () => void }) {
  const skills = [
    { icon: Sparkles, t: 'Понимаю тебя и твои данные', d: 'цикл, настроение, симптомы — в одной картине' },
    { icon: HeartPulse, t: 'Анализирую показатели', d: 'и объясняю результаты анализов простыми словами' },
    { icon: ShieldCheck, t: 'Забочусь и поддерживаю', d: 'напомню, подскажу и скажу, когда пора к врачу' },
  ]
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-end gap-3">
          <Yuvi mood="good" size={96} companion={false} />
          <SpeechBubble tail="left" className="anim-pop mb-6 flex-1">
            Вот что я умею. За 2 минуты разберёмся, что происходит с телом!
          </SpeechBubble>
        </div>
        <ul className="mt-6 space-y-3">
          {skills.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="anim-pop glass flex items-center gap-4 rounded-card p-4 shadow-card" style={{ animationDelay: `${150 + i * 120}ms` }}>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-accent">
                <Icon size={22} />
              </span>
              <div>
                <div className="text-[15px] font-bold text-accent">{t}</div>
                <div className="text-[13px] text-muted">{d}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Button onClick={onNext} className="mb-2 mt-6">
        Далее
      </Button>
    </>
  )
}

function Consent({ checked, onToggle, onNext }: { checked: boolean; onToggle: () => void; onNext: () => void }) {
  const points = ['Шифрование при передаче и хранении', 'Серверы в России, по 152-ФЗ', 'Без рекламы и передачи третьим лицам', 'Удали все данные в любой момент']
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-end gap-3">
          <Yuvi mood="great" size={96} companion={false} />
          <SpeechBubble tail="left" className="anim-pop mb-6 flex-1">
            Твои данные — только твои. Я храню их бережно 🔒
          </SpeechBubble>
        </div>
        <ul className="glass mt-6 space-y-3 rounded-card p-5 shadow-card">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-[14px]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Check size={14} strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            haptic.select()
            onToggle()
          }}
          className="glass mt-3 flex w-full items-start gap-3 rounded-card p-4 text-left shadow-card"
          role="checkbox"
          aria-checked={checked}
        >
          <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${checked ? 'border-accent bg-accent text-white' : 'border-muted/50'}`}>
            {checked && <Check size={14} strokeWidth={3} />}
          </span>
          <span className="text-[13px] leading-snug text-ink/85">
            Я согласна на обработку персональных данных, включая данные о здоровье, в соответствии с{' '}
            <span className="text-accent underline decoration-accent/40">152-ФЗ «О персональных данных»</span>
          </span>
        </button>
      </div>
      <Button onClick={onNext} disabled={!checked} className="mb-2 mt-6">
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
  const [periodStart, setPeriodStart] = useState('')
  const [unknownPeriod, setUnknownPeriod] = useState(false)

  const ageNum = Number(age)
  const ageValid = age === '' || (ageNum >= 12 && ageNum <= 80)

  const submit = () => {
    haptic.success()
    complete(
      { name: user.first_name, age: age ? ageNum : null, goal, avatarId: 'anya', consentAt: Date.now() },
      periodStart && !unknownPeriod ? { lastPeriodStart: periodStart } : undefined,
    )
    nav('/', { replace: true })
  }

  return (
    <>
      <div className="flex items-end gap-3">
        <Yuvi mood="great" size={84} companion={false} />
        <SpeechBubble tail="left" className="anim-pop mb-4 flex-1">
          Давай познакомимся, <b>{user.first_name}</b>! Аккаунт уже подключён через Telegram.
        </SpeechBubble>
      </div>

      <Label>Возраст</Label>
      <input
        inputMode="numeric"
        value={age}
        onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
        placeholder="Например, 24"
        className={`glass h-14 w-full rounded-2xl px-4 text-[16px] shadow-card outline-none focus:ring-2 focus:ring-accent/40 ${ageValid ? '' : 'ring-2 ring-bad'}`}
      />

      <Label>Что для тебя важнее всего?</Label>
      <div className="flex flex-wrap gap-2">
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
          className="glass h-14 min-w-0 flex-1 rounded-2xl px-4 text-[15px] shadow-card outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40"
        />
        <Chip active={unknownPeriod} onClick={() => setUnknownPeriod(!unknownPeriod)} className="shrink-0">
          Не помню
        </Chip>
      </div>

      <div className="min-h-6 flex-1" />
      <Button onClick={submit} disabled={!ageValid} className="mb-2">
        Начать
      </Button>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-6 px-1 text-[13px] font-semibold text-muted">{children}</div>
}
