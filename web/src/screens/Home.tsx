import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Bell, ChevronRight, Droplet, FlaskConical, MessageCircleHeart, Moon, Pill, Plus, Salad, Footprints, Smile } from 'lucide-react'
import { useApp } from '../store/app'
import { Button, GlassIcon, SectionTitle, SpeechBubble, TONES, type Tone } from '../ui/kit'
import { LogoMark } from '../ui/Logo'
import { MoodScene, SCENES } from '../ui/MoodScene'
import { MOOD_SCALE, Yuvi, YUVI_MOODS } from '../ui/Yuvi'
import { PredictionOverlay } from '../ui/PredictionOverlay'
import { predictionFor } from '../lib/predictions'
import { MOOD_REACTIONS, yuviTalk } from '../lib/yuviTalk'
import { useTypewriter } from '../lib/useTypewriter'
import { MARKS, PHASES, type CycleModel, type DayInfo, type Phase, type CycleSettings } from '../lib/cycle'
import { addDays, formatDay, fromISO, plural, type ISODate } from '../lib/date'
import { STATUS_COLOR, LAB_BY_CODE } from '../lib/labs'
import { buildNotifications, buildRecs, latestLabs, type RecCategory } from '../lib/insights'
import { useCycleToday } from '../lib/useCycleToday'
import { moodStreak, yuviState } from '../lib/yuvi'
import { getUser, haptic } from '../lib/telegram'

// Главная: Юви рядом → «Сегодня» (цикл: фаза, кольцо, неделя) → настроение | чат,
// ниже — мои показатели и в самом низу совет дня. Плавающего Юви на главной нет — он в карточке.

export function Home() {
  const nav = useNavigate()
  const { profile, labs, readNotifications, introSeen } = useApp()
  const { today, info, next, settings, model } = useCycleToday()
  const unread = buildNotifications({ phase: info?.phase ?? null, cycleDay: info?.day ?? null, periodInDays: next?.inDays ?? null, labs }).some(
    (n) => !readNotifications.includes(n.id),
  )

  return (
    <div className="pt-safe px-4">
      <header className="flex items-center gap-3 py-3">
        <UserPhoto />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold">Привет, {profile?.name}! 👋</h1>
          <p className="text-[13px] text-muted first-letter:uppercase">{fromISO(today).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button aria-label="Уведомления" onClick={() => nav('/notifications')} className="relative grid size-11 place-items-center rounded-full text-accent">
          <Bell size={24} />
          {unread && <span className="absolute right-2 top-1.5 size-2.5 rounded-full bg-cal-period ring-2 ring-white" />}
        </button>
      </header>

      <YuviCard info={info} today={today} />
      <TodayHero info={info} settings={settings} model={model} today={today} nextInDays={next?.inDays ?? null} />
      <ActionTiles today={today} />
      <Metrics />
      <Insight phase={info?.phase ?? null} />

      {!introSeen && <IntroTour />}
    </div>
  )
}

/** аватарка — вход в профиль */
function UserPhoto() {
  const nav = useNavigate()
  const user = getUser()
  return (
    <button aria-label="Профиль" onClick={() => nav('/profile')} className="shrink-0 rounded-full transition active:scale-95">
      {user.photo_url ? (
        <img src={user.photo_url} alt="" className="size-12 rounded-full object-cover ring-2 ring-white" />
      ) : (
        <span className="grid size-12 place-items-center rounded-full bg-brand text-[18px] font-bold text-white ring-2 ring-white">{user.first_name[0]}</span>
      )}
    </button>
  )
}

/* ---------- Юви рядом ---------- */

/** сколько реплика висит после того, как допечаталась */
const HOLD_MS = 12000
/** длительность «пружинки» Юви (анимация yuvi-boing — 0.6 с) */
const POKE_MS = 650

function YuviCard({ info, today }: { info: DayInfo | null; today: ISODate }) {
  const { moods, labs, predictionSeen, setPredictionSeen } = useApp()
  const state = yuviState({ moods, labs, today, info })
  const prediction = predictionFor(today, getUser().id)
  const seenToday = predictionSeen === today
  const [showPrediction, setShowPrediction] = useState(false)
  const streak = moodStreak(moods, today)
  const { next, model } = useCycleToday()
  const [poke, setPoke] = useState(0)
  const busy = useRef(false)

  // лента реплик на день: факты, пожелания, шутки и комментарии к данным
  const talk = useMemo(
    () =>
      yuviTalk({
        today,
        info,
        mood: moods[today],
        streak,
        periodInDays: next?.inDays ?? null,
        fertile: model.status(today)?.mark === 'fertile',
        badLabs: latestLabs(labs).filter((e) => e.status === 'bad'),
        hasLabs: labs.length > 0,
      }),
    [today, info, moods, streak, next, model, labs],
  )
  const [line, setLine] = useState(0)

  // только что сохранила настроение — Юви первым делом реагирует на него.
  // Значение берём при открытии главной (чистая функция), а «записку» стираем эффектом.
  const { pendingReaction, clearReaction } = useApp()
  const [reaction] = useState(() => (pendingReaction ? MOOD_REACTIONS[pendingReaction] : null))
  useEffect(() => {
    if (pendingReaction) clearReaction()
  }, [pendingReaction, clearReaction])

  // тап: анимация + вибрация (реплики не трогает); следующий тап — когда анимация доиграла
  const onPoke = () => {
    if (busy.current) return
    busy.current = true
    haptic.poke()
    setPoke((p) => p + 1)
    window.setTimeout(() => (busy.current = false), POKE_MS)
  }
  // начало ленты: реакция на настроение, затем (если не открыто) приглашение к предсказанию
  const intro = [reaction, seenToday ? null : 'У меня для тебя предсказание на сегодня. Откроешь?'].filter((x): x is string => !!x)
  const message = line < intro.length ? intro[line] : talk[(line - intro.length) % talk.length]
  const dark = !!SCENES[state.mood].dark
  const typed = useTypewriter(message)

  // следующая реплика — через HOLD_MS после того, как текущая допечаталась (в фоне ждём)
  useEffect(() => {
    if (!typed.done) return
    let id = 0
    const tick = () => {
      if (document.hidden) id = window.setTimeout(tick, 2000)
      else setLine((l) => l + 1)
    }
    id = window.setTimeout(tick, HOLD_MS)
    return () => window.clearTimeout(id)
  }, [typed.done, line])

  const openPrediction = () => {
    haptic.success()
    setShowPrediction(true)
  }
  const closePrediction = () => {
    setShowPrediction(false)
    setPredictionSeen(today)
  }

  return (
    <section className="relative overflow-hidden rounded-[1.9rem] p-3 pr-4 shadow-card">
      {/* фон — «погода» настроения Юви, как на экране настроения */}
      <MoodScene mood={state.mood} />

      <div className="relative flex items-center gap-1">
        <button type="button" aria-label="Погладить Юви" onClick={onPoke} className="shrink-0 touch-manipulation">
          <Yuvi mood={state.mood} size={124} poke={poke} talking={!typed.done} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[16px] font-bold transition-colors duration-500 ${dark ? 'text-white' : 'text-accent'}`}>Юви рядом 💙</span>
            {streak > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: TONES.peach.soft, color: TONES.peach.text }} title="Дней подряд с отметкой настроения">
                🔥 {streak}
              </span>
            )}
          </div>
          <div className="mt-2 flex min-h-[124px] items-center">
            <SpeechBubble tail="left" className="w-full bg-white/90! px-3.5! py-3! text-[14px]!">
              {/* полный текст невидимо держит размер облачка, поверх печатается видимый */}
              <span className="grid">
                <span className="invisible col-start-1 row-start-1" aria-hidden>
                  {message}
                </span>
                <span className="col-start-1 row-start-1">
                  {typed.shown}
                  {!typed.done && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse rounded-full bg-accent" />}
                </span>
              </span>
            </SpeechBubble>
          </div>
        </div>
      </div>
      <button
        onClick={openPrediction}
        className={`relative mt-2 h-11 w-full rounded-full text-[14px] font-bold transition active:scale-[0.98] ${
          seenToday ? 'bg-white/85 text-accent shadow-card' : 'bg-brand text-white shadow-btn'
        }`}
      >
        {seenToday ? 'Перечитать предсказание на сегодня' : 'Открыть предсказание на сегодня'}
      </button>
      {showPrediction && <PredictionOverlay text={prediction} onClose={closePrediction} />}
    </section>
  )
}

/* ---------- Сегодня: цикл ---------- */

const HERO: Record<Phase, [string, string, string]> = {
  menstrual: ['#ff93c6', '#f06aae', '#b07cf6'],
  follicular: ['#ab9dff', '#7b6cf6', '#5d86f8'],
  ovulation: ['#ffc287', '#ff8d8d', '#d96fd2'],
  luteal: ['#bba7ff', '#8a6cf2', '#6260e6'],
}

function TodayHero({ info, settings, model, today, nextInDays }: { info: DayInfo | null; settings: CycleSettings; model: CycleModel; today: ISODate; nextInDays: number | null }) {
  const nav = useNavigate()
  const [a, b, c] = HERO[info?.phase ?? 'follicular']
  const mark = model.status(today)?.mark ?? null

  return (
    <button
      onClick={() => nav('/cycle')}
      className="relative mt-3 block w-full overflow-hidden rounded-[1.9rem] p-5 text-left text-white transition active:scale-[0.99]"
      style={{ background: `linear-gradient(135deg, ${a} 0%, ${b} 55%, ${c} 100%)`, boxShadow: `0 18px 36px -18px ${b}` }}
    >
      {/* декор: пузыри как у Юви и лепестки логотипа */}
      <span className="deco-bubble -right-10 -top-12 size-44" />
      <span className="deco-bubble bottom-16 left-[46%] size-7" />
      <span className="absolute -bottom-10 -left-8 opacity-[0.13]">
        <LogoMark size={150} mono="#fff" />
      </span>

      {info ? (
        <>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white/80">Сегодня · фаза</div>
              <div className="mt-1 text-[24px] font-bold leading-tight">{PHASES[info.phase].short}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nextInDays !== null && (
                  <HeroChip>{nextInDays === 0 ? 'Месячные сегодня' : `Месячные через ${nextInDays} ${plural(nextInDays, 'день', 'дня', 'дней')}`}</HeroChip>
                )}
                {mark && mark !== 'period' && <HeroChip dot={MARKS[mark].color}>{MARKS[mark].label}</HeroChip>}
              </div>
            </div>
            <DayRing day={info.day} total={Math.max(settings.cycleLength, info.day)} />
          </div>
          <WeekStrip model={model} today={today} />
        </>
      ) : (
        <div className="relative py-3">
          <div className="text-[13px] font-medium text-white/80">Цикл</div>
          <div className="mt-1 text-[22px] font-bold leading-tight">Отметь начало месячных</div>
          <p className="mt-2 max-w-[16rem] text-[14px] text-white/85">Покажу фазу, фертильные дни и прогноз — и учту это в советах</p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[13px] font-bold" style={{ color: b }}>
            Отметить <ChevronRight size={16} />
          </span>
        </div>
      )}
    </button>
  )
}

function HeroChip({ children, dot }: { children: React.ReactNode; dot?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-semibold backdrop-blur-sm">
      {dot && <span className="size-2 rounded-full ring-1 ring-white" style={{ background: dot }} />}
      {children}
    </span>
  )
}

function DayRing({ day, total }: { day: number; total: number }) {
  const r = 38
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-[96px] shrink-0">
      <svg viewBox="0 0 96 96" className="size-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="rgb(255 255 255 / 0.12)" stroke="rgb(255 255 255 / 0.28)" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(c * day) / total} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[30px] font-bold">{day}</span>
        <span className="mt-1 text-[11px] font-medium text-white/80">из {total}</span>
      </div>
    </div>
  )
}

function WeekStrip({ model, today }: { model: CycleModel; today: ISODate }) {
  return (
    <div className="relative mt-5 grid grid-cols-7 gap-1 rounded-2xl bg-white/15 p-2 backdrop-blur-sm">
      {Array.from({ length: 7 }, (_, i) => {
        const offset = i - 3
        const d = addDays(today, offset)
        const mark = model.status(d)?.mark ?? null
        const isToday = offset === 0
        return (
          <div key={d} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${isToday ? 'bg-white text-accent shadow-sm' : ''}`}>
            <span className={`text-[10px] font-medium uppercase ${isToday ? 'text-accent/70' : 'text-white/70'}`}>{fromISO(d).toLocaleDateString('ru', { weekday: 'short' })}</span>
            <span className="text-[15px] font-bold">{fromISO(d).getDate()}</span>
            <span className="size-1.5 rounded-full" style={{ background: mark ? MARKS[mark].color : 'transparent', boxShadow: mark && !isToday ? '0 0 0 1.5px #fff' : undefined }} />
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Две большие кнопки: настроение и чат ---------- */

function ActionTiles({ today }: { today: ISODate }) {
  const nav = useNavigate()
  const moods = useApp((s) => s.moods)
  const logged = moods[today]

  return (
    // одна плашка, ровно пополам: каждая кнопка занимает свою половину целиком
    <section className="mt-3 grid grid-cols-2 gap-[3px] overflow-hidden rounded-[1.9rem] bg-white/70 shadow-card">
      <ActionTile
        title="Настроение"
        text="Отметь, как ты себя чувствуешь, веди дневник настроения и делись с друзьями"
        icon={Smile}
        gradient="linear-gradient(150deg, #ffb3d6 0%, #f27fbd 45%, #b98cff 100%)"
        badge={logged ? YUVI_MOODS[MOOD_SCALE[logged - 1]].label : undefined}
        onClick={() => nav('/mood')}
      />
      <ActionTile
        title="Чат с Юви"
        text="Обсуди анализы, настроение, цикл и многое другое"
        icon={MessageCircleHeart}
        gradient="linear-gradient(150deg, #b3a6ff 0%, #7b6cf6 50%, #5d86f8 100%)"
        onClick={() => nav('/chat')}
      />
    </section>
  )
}

function ActionTile({
  title,
  text,
  icon: Icon,
  gradient,
  badge,
  onClick,
}: {
  title: string
  text: string
  icon: typeof Smile
  gradient: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="relative flex flex-col overflow-hidden px-4 pb-4 pt-3.5 text-left text-white transition active:brightness-95" style={{ background: gradient }}>
      {/* крупный символ под углом в углу — вместо пузырей и иконки над заголовком */}
      <Icon className="pointer-events-none absolute -right-6 -top-6 rotate-[18deg] text-white/25" size={92} strokeWidth={1.7} aria-hidden />

      {/* верхняя строка: плашка (настроение за сегодня) или пустое место той же высоты */}
      <span className="relative flex h-6 items-center">
        {badge && <span className="truncate rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold">{badge}</span>}
      </span>
      <span className="relative mt-1.5 flex items-center gap-0.5 text-[17px] font-bold leading-tight">
        {title}
        <ChevronRight size={18} strokeWidth={2.6} className="opacity-80" />
      </span>
      <span className="relative mt-1 text-[12px] leading-snug text-white/85">{text}</span>
    </button>
  )
}

/* ---------- Совет дня ---------- */

const CAT_ICON: Record<RecCategory, { icon: typeof Salad; tone: Tone }> = {
  food: { icon: Salad, tone: 'mint' },
  activity: { icon: Footprints, tone: 'blue' },
  supplements: { icon: Pill, tone: 'pink' },
  sleep: { icon: Moon, tone: 'violet' },
}

function Insight({ phase }: { phase: Phase | null }) {
  const nav = useNavigate()
  const labs = useApp((s) => s.labs)
  const alert = latestLabs(labs).find((e) => e.status === 'bad')

  if (alert) {
    const t = TONES.red
    return (
      <section className="relative mt-3 overflow-hidden rounded-card p-4 shadow-card" style={{ background: `linear-gradient(135deg, #fff 35%, ${t.soft})` }}>
        <span className="deco-bubble -right-6 -top-6 size-24 opacity-70" style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${t.g1}55 60%)` }} />
        <div className="relative flex items-start gap-3">
          <GlassIcon icon={Droplet} tone="red" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: t.text }}>
              Юви советует
            </div>
            <div className="mt-0.5 text-[16px] font-bold">
              {alert.def.name}: {alert.value} {alert.def.unit} — {alert.direction === 'low' ? 'ниже' : 'выше'} нормы
            </div>
            <p className="mt-1 text-[13px] leading-snug text-ink/75">{alert.advice}</p>
          </div>
        </div>
        <div className="relative mt-3 flex gap-2">
          <button onClick={() => nav('/chat')} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13px] font-bold shadow-card" style={{ color: t.text }}>
            <MessageCircleHeart size={16} /> Спросить Юви
          </button>
          <button onClick={() => nav('/recommendations')} className="flex-1 rounded-full py-2.5 text-[13px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${t.g1}, ${t.g2})` }}>
            Что делать
          </button>
        </div>
      </section>
    )
  }

  const tip = buildRecs(phase, labs)[0]
  if (!tip) return null
  const ci = CAT_ICON[tip.category]
  const t = TONES[ci.tone]
  return (
    <button onClick={() => nav('/recommendations')} className="relative mt-3 block w-full overflow-hidden rounded-card p-4 text-left shadow-card transition active:scale-[0.99]" style={{ background: `linear-gradient(135deg, #fff 35%, ${t.soft})` }}>
      <span className="deco-bubble -right-6 -top-6 size-24 opacity-70" style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${t.g1}55 60%)` }} />
      <div className="relative flex items-start gap-3">
        <GlassIcon icon={ci.icon} tone={ci.tone} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: t.text }}>
            Юви советует
          </div>
          <div className="mt-0.5 text-[16px] font-bold">{tip.title}</div>
          <p className="mt-1 text-[13px] leading-snug text-ink/75">{tip.text}</p>
          <span className="mt-2 inline-flex items-center gap-0.5 text-[13px] font-bold" style={{ color: t.text }}>
            Все советы <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </button>
  )
}

/* ---------- Мои показатели ---------- */

function Metrics() {
  const nav = useNavigate()
  const labs = useApp((s) => s.labs)
  const latest = latestLabs(labs)
  // предыдущее значение для стрелки динамики
  const prevValue = (code: string) => {
    const vals = [...labs].sort((a, b) => (a.date < b.date ? 1 : -1)).flatMap((l) => l.items.filter((i) => i.code === code).map((i) => i.value))
    return vals[1]
  }

  return (
    <>
      <SectionTitle
        action={
          labs.length > 0 && (
            <button onClick={() => nav('/labs')} className="flex items-center text-[13px] font-semibold text-accent">
              Все анализы <ChevronRight size={15} />
            </button>
          )
        }
      >
        Мои показатели
      </SectionTitle>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {latest.map((e) => {
          const prev = prevValue(e.def.code)
          const color = STATUS_COLOR[e.status]
          const label = { ok: 'норма', warn: 'внимание', bad: e.direction === 'low' ? 'низкий' : 'высокий' }[e.status]
          return (
            <button key={e.def.code} onClick={() => nav('/labs')} className="glass w-[138px] shrink-0 snap-start rounded-card p-3.5 text-left shadow-card">
              <div className="truncate text-[13px] font-semibold text-ink/80">{e.def.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[26px] font-bold leading-none" style={{ color }}>
                  {e.value}
                </span>
                {prev !== undefined && prev !== e.value && <span className="text-[13px] font-bold text-muted">{prev < e.value ? '↑' : '↓'}</span>}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">{LAB_BY_CODE[e.def.code].unit}</div>
              <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}>
                {label}
              </span>
            </button>
          )
        })}
        <button onClick={() => nav('/labs/new')} className="flex w-[138px] shrink-0 snap-start flex-col items-start justify-between rounded-card border-2 border-dashed border-accent/30 bg-white/50 p-3.5 text-left">
          <GlassIcon icon={latest.length ? Plus : FlaskConical} tone="violet" size={40} />
          <span className="mt-3 text-[13px] font-bold text-accent">{latest.length ? 'Добавить анализ' : 'Загрузить первый анализ'}</span>
          <span className="text-[11px] text-muted">фото или вручную</span>
        </button>
      </div>
      {labs[0] && <p className="mt-2 text-center text-[11px] text-muted">Обновлено {formatDay(labs[0].date, true)}</p>}
    </>
  )
}

/* ---------- знакомство при первом входе ---------- */

function IntroTour() {
  const setIntroSeen = useApp((s) => s.setIntroSeen)
  const [step, setStep] = useState(0)
  const steps = [
    { mood: 'great' as const, text: 'Я живу здесь, на главной. Погладь меня — я отвечу 😊 Ниже твой цикл: фаза, прогноз и неделя.' },
    { mood: 'good' as const, text: 'Каждый день отмечай настроение — я буду меняться вместе с тобой. А за серию дней будет 🔥' },
    { mood: 'great' as const, text: 'На других экранах я летаю рядом — перетащи меня, куда удобно, а нажмёшь — спросишь что угодно о здоровье 💙' },
  ]
  const s = steps[step]
  const last = step === steps.length - 1
  // портал: внутри анимированного <main> fixed позиционируется относительно него
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-[2px]">
      <div key={step} className="anim-rise pb-safe mx-auto w-full max-w-[480px] px-4 pb-6">
        <div className="flex items-end gap-2">
          <Yuvi mood={s.mood} size={110} />
          <SpeechBubble tail="left" className="mb-8 flex-1 bg-white!">
            {s.text}
          </SpeechBubble>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={setIntroSeen}>
            Пропустить
          </Button>
          <Button className="flex-1" onClick={() => (last ? setIntroSeen() : setStep(step + 1))}>
            {last ? 'Понятно!' : `Дальше · ${step + 1}/${steps.length}`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
