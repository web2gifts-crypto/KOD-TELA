import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Activity, CalendarHeart, ChevronRight, FileDown, FlaskConical, Send, Smile, X } from 'lucide-react'
import { useApp } from '../store/app'
import { GlassIcon, TONES, type Tone } from '../ui/kit'
import { LogoMark } from '../ui/Logo'
import { MOOD_SCALE, Yuvi, YUVI_MOODS } from '../ui/Yuvi'
import { PHASES } from '../lib/cycle'
import { diffDays, plural, toISO, today as todayISO } from '../lib/date'
import { STATUS_COLOR } from '../lib/labs'
import { cycleStats, labTrends, moodStats, moodStrip, symptomStats } from '../lib/stats'
import { buildReport } from '../lib/report'
import { hasBackend, sendFileToBot } from '../lib/api'
import { haptic, inTelegram } from '../lib/telegram'
import { useCycleToday } from '../lib/useCycleToday'

// «Мой код тела»: всё, что приложение узнало о пользователе за всё время,
// и выгрузка этого в файл (в чат с ботом — когда подключён бэкенд).

export function BodyCode() {
  const data = useApp()
  const { model } = useCycleToday()
  const today = todayISO()
  const days = data.profile ? Math.max(1, diffDays(today, toISO(new Date(data.profile.consentAt))) + 1) : 1

  const cs = useMemo(() => cycleStats(data.periodStarts), [data.periodStarts])
  const ms = useMemo(() => moodStats(data.moods, data.moodNotes), [data.moods, data.moodNotes])
  const ss = useMemo(() => symptomStats(data.symptoms, data.periodStarts, data.cycle), [data.symptoms, data.periodStarts, data.cycle])
  const lt = useMemo(() => labTrends(data.labs), [data.labs])

  return (
    <div className="pt-safe px-4">
      <header className="pb-3 pt-4">
        <h1 className="text-[26px] font-bold leading-tight">Мой код тела</h1>
        <p className="mt-0.5 text-[14px] text-muted">Всё, что Юви узнал о тебе за всё время</p>
      </header>

      {/* герой: сводка */}
      <section className="relative overflow-hidden rounded-[1.9rem] p-5 text-white shadow-card" style={{ background: 'linear-gradient(135deg, #f59ccc 0%, #a98cff 50%, #5d86f8 100%)' }}>
        <span className="deco-bubble -right-10 -top-12 size-44" />
        <span className="absolute -bottom-12 -right-6 opacity-[0.16]">
          <LogoMark size={160} mono="#fff" />
        </span>
        <div className="relative text-[14px] font-medium text-white/85">С тобой уже</div>
        <div className="relative text-[34px] font-bold leading-tight">
          {days} {plural(days, 'день', 'дня', 'дней')}
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <HeroStat value={ms.total} label={plural(ms.total, 'отметка', 'отметки', 'отметок')} />
          <HeroStat value={cs.tracked} label={plural(cs.tracked, 'цикл', 'цикла', 'циклов')} />
          <HeroStat value={data.labs.length} label={plural(data.labs.length, 'анализ', 'анализа', 'анализов')} />
        </div>
      </section>

      <CycleSection cs={cs} periodLength={model.periodLength} />
      <MoodSection ms={ms} moods={data.moods} today={today} />
      <SymptomSection ss={ss} />
      <LabSection lt={lt} />
      <ExportCard />
    </div>
  )
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/20 px-2 py-2.5 text-center backdrop-blur-sm">
      <div className="text-[22px] font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-white/85">{label}</div>
    </div>
  )
}

function Section({ icon, tone, title, children, action }: { icon: typeof Smile; tone: Tone; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="glass mt-3 rounded-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-3">
        <GlassIcon icon={icon} tone={tone} size={36} />
        <h2 className="flex-1 text-[17px] font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-accent-soft/70 px-3.5 py-3 text-[13px] leading-snug text-ink/70">{children}</p>
}

function Metric({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-2 py-2.5 text-center">
      <div className="text-[18px] font-bold leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-muted">{label}</div>
    </div>
  )
}

/* ---------- цикл ---------- */

function CycleSection({ cs, periodLength }: { cs: ReturnType<typeof cycleStats>; periodLength: number }) {
  const nav = useNavigate()
  const last = cs.lengths.slice(-6)
  const max = Math.max(...last, 35)
  return (
    <Section
      icon={CalendarHeart}
      tone="pink"
      title="Цикл"
      action={
        <button onClick={() => nav('/cycle')} aria-label="Открыть календарь" className="text-muted">
          <ChevronRight size={20} />
        </button>
      }
    >
      {cs.avg ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric value={`${cs.avg} дн.`} label="средний цикл" color={TONES.pink.text} />
            <Metric value={`${periodLength} дн.`} label="месячные" />
            <Metric value={cs.regular === null ? '—' : cs.regular ? 'ровный' : 'скачет'} label="регулярность" color={cs.regular === false ? TONES.peach.text : TONES.mint.text} />
          </div>
          {/* длины последних циклов */}
          <div className="mt-4 flex h-28 items-end gap-2 px-1">
            {last.map((len, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-bold text-ink/70">{len}</span>
                <div className="w-full max-w-9 rounded-t-xl rounded-b-md" style={{ height: `${(len / max) * 76}px`, background: `linear-gradient(${TONES.pink.g1}, ${TONES.pink.g2})` }} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[12px] text-muted">
            Длина последних {last.length} {plural(last.length, 'цикла', 'циклов', 'циклов')} · от {cs.min} до {cs.max} дней
          </p>
        </>
      ) : (
        <Empty>Отметь начало месячных хотя бы два раза — посчитаю среднюю длину цикла и его регулярность.</Empty>
      )}
    </Section>
  )
}

/* ---------- настроение ---------- */

function MoodSection({ ms, moods, today }: { ms: ReturnType<typeof moodStats>; moods: Record<string, number>; today: string }) {
  if (!ms.total)
    return (
      <Section icon={Smile} tone="violet" title="Настроение">
        <Empty>Отмечай настроение каждый день — здесь появится твоя картина настроения и серии 🔥</Empty>
      </Section>
    )
  const strip = moodStrip(moods, today)
  const topMood = MOOD_SCALE[(ms.top ?? 5) - 1]
  return (
    <Section icon={Smile} tone="violet" title="Настроение">
      <div className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
        <Yuvi mood={topMood} size={54} still companion={false} />
        <div className="flex-1">
          <div className="text-[12px] text-muted">Чаще всего</div>
          <div className="text-[17px] font-bold" style={{ color: YUVI_MOODS[topMood].text }}>
            {YUVI_MOODS[topMood].label}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-muted">Лучшая серия</div>
          <div className="text-[17px] font-bold" style={{ color: TONES.peach.text }}>
            🔥 {ms.bestStreak} {plural(ms.bestStreak, 'день', 'дня', 'дней')}
          </div>
        </div>
      </div>

      {/* распределение */}
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-line">
        {[...MOOD_SCALE].reverse().map((m) => {
          const c = ms.counts[MOOD_SCALE.indexOf(m)]
          return c ? <div key={m} style={{ width: `${(c / ms.total) * 100}%`, background: YUVI_MOODS[m].c[2] }} /> : null
        })}
      </div>
      <div className="mt-2 grid grid-cols-5 text-center">
        {[...MOOD_SCALE].reverse().map((m) => {
          const c = ms.counts[MOOD_SCALE.indexOf(m)]
          return (
            <div key={m} className="flex flex-col items-center gap-0.5" title={YUVI_MOODS[m].label}>
              <Yuvi mood={m} size={26} still companion={false} />
              <div className="text-[13px] font-bold" style={{ color: YUVI_MOODS[m].text }}>
                {Math.round((c / ms.total) * 100)}%
              </div>
              <span className="sr-only">{YUVI_MOODS[m].label}</span>
            </div>
          )
        })}
      </div>

      {/* последние 30 дней */}
      <div className="mt-4 text-[12px] font-semibold text-muted">Последние 30 дней</div>
      <div className="mt-1.5 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
        {strip.map((d) => (
          <span
            key={d.date}
            title={d.date}
            className="aspect-square rounded-[5px]"
            style={{ background: d.value ? YUVI_MOODS[MOOD_SCALE[d.value - 1]].c[2] : 'var(--color-line)', opacity: d.value ? 1 : 0.6 }}
          />
        ))}
      </div>

      {ms.factors.length > 0 && (
        <>
          <div className="mt-4 text-[12px] font-semibold text-muted">Чаще всего влияет</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ms.factors.slice(0, 5).map((f) => (
              <span key={f.name} className="rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent">
                {f.name} · {f.count}
              </span>
            ))}
          </div>
        </>
      )}
    </Section>
  )
}

/* ---------- симптомы ---------- */

function SymptomSection({ ss }: { ss: ReturnType<typeof symptomStats> }) {
  const max = ss[0]?.count ?? 1
  return (
    <Section icon={Activity} tone="peach" title="Симптомы">
      {ss.length ? (
        <ul className="space-y-3">
          {ss.slice(0, 6).map((s) => (
            <li key={s.name}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">{s.name}</span>
                <span className="text-[12px] text-muted">
                  {s.count} {plural(s.count, 'раз', 'раза', 'раз')}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: `linear-gradient(90deg, ${TONES.peach.g1}, ${TONES.peach.g2})` }} />
              </div>
              {s.phase && <div className="mt-1 text-[12px] font-medium" style={{ color: TONES.peach.text }}>чаще: {PHASES[s.phase].name.toLowerCase()}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Отмечай симптомы в календаре — найду, в какие фазы цикла они бывают чаще.</Empty>
      )}
    </Section>
  )
}

/* ---------- анализы ---------- */

function LabSection({ lt }: { lt: ReturnType<typeof labTrends> }) {
  const nav = useNavigate()
  const bad = lt.filter((t) => t.ev.status !== 'ok').length
  return (
    <Section
      icon={FlaskConical}
      tone="blue"
      title="Анализы"
      action={
        <button onClick={() => nav('/labs')} aria-label="Все анализы" className="text-muted">
          <ChevronRight size={20} />
        </button>
      }
    >
      {lt.length ? (
        <>
          <p className="mb-2 text-[13px] text-muted">{bad ? `${bad} ${plural(bad, 'показатель', 'показателя', 'показателей')} вне нормы` : 'Все последние показатели в норме'}</p>
          <ul className="divide-y divide-line">
            {lt.map(({ ev, prev }) => (
              <li key={ev.def.code} className="flex items-center justify-between py-2.5">
                <span className="text-[14px]">{ev.def.name}</span>
                <span className="flex items-center gap-2 text-[14px]">
                  {prev !== null && (
                    <span className="text-[12px] text-muted">
                      {prev} →
                    </span>
                  )}
                  <b style={{ color: STATUS_COLOR[ev.status] }}>{ev.value}</b>
                  <span className="text-[11px] text-muted">{ev.def.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty>Загрузи анализы — здесь будет динамика твоих показателей.</Empty>
      )}
    </Section>
  )
}

/* ---------- выгрузка ---------- */

function ExportCard() {
  const data = useApp()
  const [state, setState] = useState<'idle' | 'busy' | 'bot' | 'download' | 'error'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  // в Telegram без сервера скачать файл нельзя (WebView не сохраняет blob) — показываем отчёт в приложении
  const mode = hasBackend && inTelegram ? 'bot' : inTelegram ? 'preview' : 'download'
  const toBot = mode === 'bot'

  const run = async () => {
    haptic.tap()
    const { filename, html } = buildReport(data)
    if (mode === 'preview') return setPreview(html)
    setState('busy')
    try {
      const res = await sendFileToBot({ filename, content: html, mime: 'text/html' })
      setState(res)
      haptic.success()
    } catch {
      setState('error')
      haptic.warn()
    }
  }

  const note = {
    idle: toBot
      ? 'Файл придёт в чат с ботом — удобно переслать врачу.'
      : mode === 'preview'
        ? 'Покажу отчёт здесь. Отправка файла в чат появится после подключения сервера.'
        : 'Соберу всё в один файл — его удобно показать врачу или распечатать.',
    busy: 'Собираю твой код тела…',
    bot: 'Готово! Файл отправлен в чат с ботом 💌',
    download: hasBackend ? 'Файл сохранён на устройство.' : 'Файл сохранён на устройство. Отправка в чат с ботом заработает после подключения сервера.',
    error: 'Не получилось отправить. Попробуй ещё раз чуть позже.',
  }[state]

  return (
    <section className="relative mt-3 overflow-hidden rounded-card p-4 shadow-card" style={{ background: 'linear-gradient(135deg, #fff 35%, #ecebff)' }}>
      <span className="deco-bubble -right-6 -top-6 size-24 opacity-70" style={{ background: 'radial-gradient(circle at 30% 30%, #fff, #cfc6ff66 60%)' }} />
      <div className="relative flex items-start gap-3">
        <GlassIcon icon={FileDown} tone="violet" />
        <div className="flex-1">
          <h2 className="text-[16px] font-bold">Выгрузить мой код тела</h2>
          <p className="mt-1 text-[13px] leading-snug text-ink/70">Цикл, настроение, симптомы и анализы за всё время — в одном файле.</p>
        </div>
      </div>
      <button
        onClick={run}
        disabled={state === 'busy'}
        className="bg-brand relative mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white shadow-btn transition active:scale-[0.98] disabled:opacity-60"
      >
        {toBot ? <Send size={18} /> : <FileDown size={18} />}
        {toBot ? 'Отправить в чат с ботом' : mode === 'preview' ? 'Открыть отчёт' : 'Скачать файл'}
      </button>
      <p className={`relative mt-2 text-center text-[12px] ${state === 'error' ? 'text-bad' : 'text-muted'}`} role="status">
        {note}
      </p>
      {preview && <ReportPreview html={preview} onClose={() => setPreview(null)} />}
    </section>
  )
}

/** Отчёт внутри приложения (Telegram без сервера) */
function ReportPreview({ html, onClose }: { html: string; onClose: () => void }) {
  return createPortal(
    <div className="sheet-up pt-safe pb-safe fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Отчёт «Мой код тела»">
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <span className="text-[16px] font-bold">Мой код тела</span>
        <button onClick={onClose} aria-label="Закрыть" className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
          <X size={18} />
        </button>
      </div>
      <iframe title="Отчёт" srcDoc={html} sandbox="" className="w-full flex-1 border-0" />
    </div>,
    document.body,
  )
}
