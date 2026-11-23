import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useApp, type DayExtra } from '../store/app'
import { DISCHARGE, parseField, RANGES, SEX, TEST, UNUSUAL_HINT, type NumField } from '../lib/dayLog'
import { FLOWS, MARKS, PHASES } from '../lib/cycle'
import { fromISO, type ISODate } from '../lib/date'
import { useCycleToday } from '../lib/useCycleToday'
import { haptic } from '../lib/telegram'
import { MOOD_SCALE, Yuvi, YUVI_MOODS } from './Yuvi'
import { TONES } from './kit'

// Шторка дня: всё про выбранный день в одном месте — месячные, настроение, симптомы, заметка.

export const SYMPTOMS: { name: string; emoji: string }[] = [
  { name: 'Спазмы', emoji: '⚡' },
  { name: 'Головная боль', emoji: '🤕' },
  { name: 'Усталость', emoji: '😴' },
  { name: 'Вздутие', emoji: '🎈' },
  { name: 'Тяга к сладкому', emoji: '🍫' },
  { name: 'Акне', emoji: '🌋' },
  { name: 'Чувствительность груди', emoji: '💗' },
  { name: 'Боль в спине', emoji: '🦴' },
  { name: 'Тошнота', emoji: '🤢' },
  { name: 'Бессонница', emoji: '🌙' },
]

export function DaySheet({ date, onClose }: { date: ISODate; onClose: () => void }) {
  const { periodDays, setPeriodDay, moods, setMood, symptoms, toggleSymptom, moodNotes, setDayNote, dayLog, setDayExtra, mode } = useApp()
  const extra = dayLog[date] ?? {}
  const conceive = mode.kind === 'conceive'
  const [more, setMore] = useState(conceive || ['sleep', 'water', 'weight', 'bbt', 'lh', 'preg'].some((k) => k in extra))
  const pick = <K extends keyof DayExtra>(k: K, v: DayExtra[K]) => setDayExtra(date, { [k]: extra[k] === v ? undefined : v } as Partial<DayExtra>)
  const { model, today } = useCycleToday()
  const st = model.status(date)
  const future = date > today
  const [note, setNote] = useState(moodNotes[date]?.note ?? '')

  const close = () => {
    if (note !== (moodNotes[date]?.note ?? '')) setDayNote(date, note.trim())
    onClose()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const title = fromISO(date).toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'long' })
  const flow = periodDays[date]
  const daySymptoms = symptoms[date] ?? []

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-[2px]" onClick={close} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-up pb-safe mx-auto max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[2rem] bg-bg px-5 pt-3 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold first-letter:uppercase">{title}</h2>
            {st ? (
              <p className="mt-0.5 text-[13px] text-muted">
                День {st.day} цикла · {PHASES[st.phase].name}
                {future && ' · прогноз'}
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-muted">До начала отметок цикла</p>
            )}
          </div>
          <button onClick={close} aria-label="Закрыть" className="glass grid size-9 place-items-center rounded-full text-muted shadow-card">
            <X size={18} />
          </button>
        </div>

        {st?.mark && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold shadow-sm">
            <span className="size-2 rounded-full" style={{ background: MARKS[st.mark].color }} />
            {MARKS[st.mark].label}
            {st.possibleStart && ' · возможное начало'}
          </span>
        )}
        {st && <p className="mt-3 rounded-2xl bg-white/70 px-3.5 py-3 text-[13px] leading-snug text-ink/75">{PHASES[st.phase].hint}</p>}

        {future ? (
          <p className="mt-4 pb-6 text-center text-[13px] text-muted">Это прогноз. Отмечать можно сегодняшний и прошедшие дни.</p>
        ) : (
          <>
            <Block title="Месячные">
              <div className="flex flex-wrap gap-2">
                <Pill active={flow === undefined} onClick={() => setPeriodDay(date, null)}>
                  Нет
                </Pill>
                {FLOWS.map((f) => (
                  <Pill key={f.v} active={flow === f.v} tone="pink" onClick={() => setPeriodDay(date, f.v)}>
                    <span className="mr-1 tracking-[-2px] text-cal-period">{'●'.repeat(f.v)}</span> {f.label}
                  </Pill>
                ))}
              </div>
              {flow === 0 && <p className="mt-2 text-[12px] text-muted">День отмечен — укажи интенсивность, если хочешь.</p>}
            </Block>

            <Block title="Настроение">
              <div className="flex justify-between">
                {MOOD_SCALE.map((m, i) => (
                  <button
                    key={m}
                    aria-label={YUVI_MOODS[m].label}
                    aria-pressed={moods[date] === i + 1}
                    onClick={() => {
                      haptic.select()
                      setMood(date, i + 1)
                    }}
                    className={`rounded-full p-1 transition ${moods[date] === i + 1 ? 'scale-110 bg-white shadow-card' : moods[date] ? 'opacity-45' : ''}`}
                  >
                    <Yuvi mood={m} size={46} still companion={false} />
                  </button>
                ))}
              </div>
            </Block>

            <Block title="Симптомы">
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => (
                  <Pill key={s.name} active={daySymptoms.includes(s.name)} tone="peach" onClick={() => toggleSymptom(date, s.name)}>
                    <span className="mr-1">{s.emoji}</span>
                    {s.name}
                  </Pill>
                ))}
              </div>
            </Block>

            <Block title="Выделения">
              <div className="flex flex-wrap gap-2">
                {DISCHARGE.map((o) => (
                  <Pill key={o.v} active={extra.discharge === o.v} onClick={() => pick('discharge', o.v)}>
                    {o.label}
                  </Pill>
                ))}
              </div>
              {extra.discharge === 'unusual' && <p className="mt-2 text-[12px] leading-snug text-muted">{UNUSUAL_HINT}</p>}
            </Block>

            <Block title="Близость">
              <div className="flex flex-wrap gap-2">
                {SEX.map((o) => (
                  <Pill key={o.v} active={extra.sex === o.v} tone="pink" onClick={() => pick('sex', o.v)}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </Block>

            {!more ? (
              <button onClick={() => setMore(true)} className="mt-5 w-full rounded-2xl bg-white/70 py-3 text-[14px] font-semibold text-accent">
                Ещё: сон, вода, вес, температура, тесты
              </button>
            ) : (
              <>
                {conceive && (
                  <>
                    <Block title="Базальная температура">
                      <NumInput field="bbt" value={extra.bbt} onChange={(v) => setDayExtra(date, { bbt: v })} placeholder="36,60" />
                    </Block>
                    <TestBlock title="Тест на овуляцию" value={extra.lh} onPick={(v) => pick('lh', v)} />
                  </>
                )}
                <Block title="Сон и вода">
                  <div className="grid grid-cols-2 gap-2">
                    <Counter label="Сон, ч" value={extra.sleep} step={0.5} max={24} onChange={(v) => setDayExtra(date, { sleep: v })} />
                    <Counter label="Вода, стаканов" value={extra.water} step={1} max={30} onChange={(v) => setDayExtra(date, { water: v })} />
                  </div>
                </Block>
                <Block title="Вес">
                  <NumInput field="weight" value={extra.weight} onChange={(v) => setDayExtra(date, { weight: v })} placeholder="58,5" />
                </Block>
                {!conceive && (
                  <Block title="Базальная температура">
                    <NumInput field="bbt" value={extra.bbt} onChange={(v) => setDayExtra(date, { bbt: v })} placeholder="36,60" />
                  </Block>
                )}
                {!conceive && <TestBlock title="Тест на овуляцию" value={extra.lh} onPick={(v) => pick('lh', v)} />}
                <TestBlock title="Тест на беременность" value={extra.preg} onPick={(v) => pick('preg', v)} />
                {extra.preg === 'pos' && mode.kind !== 'pregnancy' && (
                  <p className="mt-2 text-[12px] leading-snug text-muted">
                    Если беременность подтвердится, можно включить режим «Беременность» в Профиль → Моя цель. Подтвердить её и определить срок поможет врач.
                  </p>
                )}
              </>
            )}

            <Block title="Заметка">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => setDayNote(date, note.trim())}
                rows={2}
                maxLength={300}
                placeholder="Как прошёл день?"
                className="w-full resize-none rounded-2xl bg-white px-4 py-3 text-[15px] shadow-card outline-none focus:ring-2 focus:ring-accent/40"
              />
            </Block>
            <button onClick={close} className="bg-brand mb-5 mt-5 h-12 w-full rounded-full text-[15px] font-bold text-white shadow-btn">
              Готово
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2.5 text-[15px] font-bold">{title}</h3>
      {children}
    </div>
  )
}

function TestBlock({ title, value, onPick }: { title: string; value: 'neg' | 'pos' | undefined; onPick: (v: 'neg' | 'pos') => void }) {
  return (
    <Block title={title}>
      <div className="flex flex-wrap gap-2">
        {TEST.map((o) => (
          <Pill key={o.v} active={value === o.v} onClick={() => onPick(o.v)}>
            {o.label}
          </Pill>
        ))}
      </div>
    </Block>
  )
}

function Counter({ label, value, step, max, onChange }: { label: string; value: number | undefined; step: number; max: number; onChange: (v: number | undefined) => void }) {
  const v = value ?? 0
  const set = (n: number) => {
    haptic.select()
    const x = Math.round(Math.min(max, Math.max(0, n)) * 10) / 10
    onChange(x === 0 ? undefined : x)
  }
  return (
    <div className="rounded-2xl bg-white p-3 shadow-card">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <button aria-label={`${label}: меньше`} onClick={() => set(v - step)} className="grid size-8 place-items-center rounded-full bg-brand-soft text-[18px] text-accent">
          −
        </button>
        <span className="text-[18px] font-bold">{value === undefined ? '—' : String(v).replace('.', ',')}</span>
        <button aria-label={`${label}: больше`} onClick={() => set(v + step)} className="grid size-8 place-items-center rounded-full bg-brand-soft text-[18px] text-accent">
          +
        </button>
      </div>
    </div>
  )
}

function NumInput({ field, value, onChange, placeholder }: { field: NumField; value: number | undefined; onChange: (v: number | undefined) => void; placeholder: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','))
  const parsed = parseField(field, text)
  const r = RANGES[field]
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => parsed !== null && onChange(parsed)}
          placeholder={placeholder}
          className={`h-12 w-36 rounded-2xl bg-white px-4 text-[16px] shadow-card outline-none focus:ring-2 focus:ring-accent/40 ${parsed === null ? 'ring-2 ring-bad' : ''}`}
        />
        <span className="text-[14px] text-muted">{r.unit}</span>
      </div>
      {parsed === null && (
        <p className="mt-1 text-[12px] text-bad">
          Введи число от {r.min} до {r.max}
        </p>
      )}
    </div>
  )
}

function Pill({ active, children, onClick, tone = 'violet' }: { active: boolean; children: React.ReactNode; onClick: () => void; tone?: 'violet' | 'pink' | 'peach' }) {
  const t = TONES[tone]
  return (
    <button
      onClick={() => {
        haptic.select()
        onClick()
      }}
      className="rounded-full px-3.5 py-2 text-[13px] font-semibold transition active:scale-95"
      style={active ? { background: t.g2, color: '#fff', boxShadow: `0 8px 16px -10px ${t.g2}` } : { background: '#fff', color: 'var(--color-ink)' }}
    >
      {children}
    </button>
  )
}
