import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useApp } from '../store/app'
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
  const { periodDays, setPeriodDay, moods, setMood, symptoms, toggleSymptom, moodNotes, setDayNote } = useApp()
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
