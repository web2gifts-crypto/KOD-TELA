import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, ChevronLeft, ChevronRight, Droplet, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../store/app'
import { MARKS, PHASES, type CycleModel, type DayStatus } from '../lib/cycle'
import { MONTHS, fromISO, plural, toISO, type ISODate } from '../lib/date'
import { useCycleToday } from '../lib/useCycleToday'
import { haptic } from '../lib/telegram'
import { Button, IconButton, TONES } from '../ui/kit'
import { DaySheet } from '../ui/DaySheet'

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function Cycle() {
  const { model, info, today } = useCycleToday()
  const [editing, setEditing] = useState(false)
  const [openDay, setOpenDay] = useState<ISODate | null>(null)

  return (
    <div className="pt-safe px-4">
      <header className="pb-3 pt-4">
        <h1 className="text-[26px] font-bold leading-tight">Календарь цикла</h1>
      </header>

      <Summary model={model} info={info} onMark={() => setEditing(true)} />
      <MonthGrid model={model} today={today} editing={editing} onDone={() => setEditing(false)} onOpen={setOpenDay} />
      <MyCycle model={model} />

      {openDay && <DaySheet date={openDay} onClose={() => setOpenDay(null)} />}
    </div>
  )
}

/* ---------- сводка дня ---------- */

function Summary({ model, info, onMark }: { model: CycleModel; info: ReturnType<typeof useCycleToday>['info']; onMark: () => void }) {
  if (!info)
    return (
      <section className="glass rounded-card p-5 shadow-card">
        <div className="text-[18px] font-bold">Начнём с месячных</div>
        <p className="mt-1 text-[14px] text-muted">Отметь дни последних месячных — я построю прогноз и разметку цикла.</p>
        <Button className="mt-4" onClick={onMark}>
          Отметить месячные
        </Button>
      </section>
    )

  const ph = PHASES[info.phase]
  const np = model.nextPeriod
  const ov = model.nextOvulation
  const late = np && np.inDays < 0
  return (
    <section className="glass rounded-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] text-muted">Сегодня</div>
          <div className="text-[30px] font-bold leading-tight">День {info.day}</div>
        </div>
        <span className="mt-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: ph.color, color: ph.text }}>
          {ph.short}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5 text-[14px]">
        {np && (
          <Fact color={late ? 'var(--color-bad)' : MARKS.period.color}>
            {late ? (
              <>
                Задержка <b>{-np.inDays} {plural(-np.inDays, 'день', 'дня', 'дней')}</b>
              </>
            ) : np.inDays === 0 ? (
              <b>Месячные ожидаются сегодня</b>
            ) : (
              <>
                Месячные через <b>{np.inDays} {plural(np.inDays, 'день', 'дня', 'дней')}</b>
                {model.spread > 0 && <span className="text-muted"> (±{model.spread})</span>}
              </>
            )}
          </Fact>
        )}
        {ov && !late && (
          <Fact color={MARKS.ovulation.color}>
            {ov.inDays === 0 ? <b>Овуляция сегодня</b> : <>Овуляция через <b>{ov.inDays} {plural(ov.inDays, 'день', 'дня', 'дней')}</b></>}
          </Fact>
        )}
      </ul>
      <p className="mt-3 text-[13px] leading-snug text-ink/70">{ph.hint}</p>

      <Button className="mt-4 flex items-center justify-center gap-2" onClick={onMark}>
        <Droplet size={18} /> Отметить месячные
      </Button>
    </section>
  )
}

function Fact({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span>{children}</span>
    </li>
  )
}

/* ---------- месяц: ленты фаз, режим отметки, свайп ---------- */

function MonthGrid({ model, today, editing, onDone, onOpen }: { model: CycleModel; today: ISODate; editing: boolean; onDone: () => void; onOpen: (d: ISODate) => void }) {
  const { periodDays, setPeriodDay, moods, symptoms, moodNotes } = useApp()
  const [month, setMonth] = useState(() => {
    const d = fromISO(today)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const swipe = useRef<number | null>(null)

  const first = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (ISODate | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ]
  while (cells.length % 7) cells.push(null)
  const statuses = cells.map((d) => (d ? model.status(d) : null))

  const shift = (n: number) => {
    haptic.select()
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  }

  // соседние дни с той же отметкой в одной неделе сливаются в ленту
  const same = (a: DayStatus | null, b: DayStatus | null) => !!a?.mark && a.mark === b?.mark && a.predicted === b.predicted

  const tapDay = (d: ISODate) => {
    if (editing) {
      if (d > today) return
      haptic.select()
      setPeriodDay(d, periodDays[d] !== undefined ? null : 0)
    } else {
      haptic.tap()
      onOpen(d)
    }
  }

  return (
    <section className={`glass mt-3 rounded-card p-4 shadow-card transition ${editing ? 'ring-2 ring-cal-period/60' : ''}`}>
      {editing && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl px-3.5 py-2.5" style={{ background: TONES.pink.soft }}>
          <p className="flex-1 text-[13px] leading-snug" style={{ color: TONES.pink.text }}>
            Отмечай дни месячных. Интенсивность — в карточке дня.
          </p>
          <button onClick={onDone} className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold shadow-sm" style={{ color: TONES.pink.text }}>
            Готово
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <IconButton label="Предыдущий месяц" onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </IconButton>
        <div className="text-[17px] font-bold">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </div>
        <IconButton label="Следующий месяц" onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </IconButton>
      </div>

      <div
        className="mt-3 grid touch-pan-y grid-cols-7 gap-y-1.5 text-center"
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1)
        }}
      >
        {WEEK.map((w) => (
          <span key={w} className="pb-1 text-[11px] font-medium text-muted">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const st = statuses[i]
          const isToday = d === today
          const future = d > today
          const left = i % 7 !== 0 && same(st, statuses[i - 1])
          const right = i % 7 !== 6 && same(st, statuses[i + 1])
          const color = st?.mark ? MARKS[st.mark].color : null
          const onRibbon = !!color && !editing
          const logged = periodDays[d] !== undefined
          // в дне есть записи: настроение, симптомы или заметка
          const hasLog = !!moods[d] || !!symptoms[d]?.length || !!moodNotes[d]?.note
          return (
            <button key={d} onClick={() => tapDay(d)} disabled={editing && future} className="relative grid h-10 place-items-center disabled:opacity-30" aria-label={`${fromISO(d).getDate()} ${MONTHS[month.getMonth()]}`}>
              {/* лента фазы */}
              {onRibbon && (
                <span
                  className={`absolute inset-y-[3px] ${left ? 'left-0' : 'left-[3px] rounded-l-full'} ${right ? 'right-0' : 'right-[3px] rounded-r-full'}`}
                  style={{ background: color, opacity: st?.predicted ? 0.42 : 1 }}
                />
              )}
              {/* возможное начало месячных — пунктир */}
              {!editing && st?.possibleStart && <span className="absolute inset-[3px] rounded-full border-2 border-dashed border-cal-period" />}
              {editing ? (
                <span
                  className={`relative grid size-9 place-items-center rounded-full text-[14px] font-semibold transition ${logged ? 'bg-cal-period text-white' : 'border-2 border-cal-period/40'}`}
                >
                  {logged ? <Check size={16} strokeWidth={3} /> : fromISO(d).getDate()}
                </span>
              ) : (
                <span
                  className={`relative grid size-9 place-items-center rounded-full text-[14px] font-semibold ${isToday ? 'bg-white text-accent ring-2 ring-accent' : ''}`}
                  style={!isToday ? { color: onRibbon && st?.mark !== 'pms' && !st?.predicted ? '#fff' : 'var(--color-ink)' } : undefined}
                >
                  {fromISO(d).getDate()}
                </span>
              )}
              {/* интенсивность месячных — точки */}
              {!editing && st?.flow ? (
                <span className="absolute bottom-[5px] flex gap-[2px]">
                  {Array.from({ length: st.flow }, (_, k) => (
                    <span key={k} className="size-[3px] rounded-full bg-white" />
                  ))}
                </span>
              ) : null}
              {/* есть записи за день — маленькая точка (если нет точек интенсивности) */}
              {!editing && hasLog && !st?.flow && (
                <span className="absolute bottom-[5px] size-1 rounded-full" style={{ background: onRibbon && !st?.predicted && st?.mark !== 'pms' ? '#fff' : 'var(--color-accent)' }} />
              )}
            </button>
          )
        })}
      </div>

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          {Object.values(MARKS).map((m) => (
            <span key={m.label} className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink/70">
              <span className="size-2.5 rounded-full" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink/70">
            <span className="size-2.5 rounded-full bg-cal-period/40" /> прогноз
          </span>
          {model.spread > 0 && (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink/70">
              <span className="size-2.5 rounded-full border border-dashed border-cal-period" /> возможное начало
            </span>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------- мой цикл: коротко + настройки прогноза ---------- */

function MyCycle({ model }: { model: CycleModel }) {
  const nav = useNavigate()
  const { cycle, setCycle } = useApp()
  const [open, setOpen] = useState(false)
  const lengths = model.starts.length - 1
  return (
    <section className="glass mt-3 rounded-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold">Мой цикл</h2>
        <button onClick={() => nav('/code')} className="flex items-center text-[13px] font-semibold text-accent">
          Подробнее <ChevronRight size={15} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric value={`${model.cycleLength} дн.`} label="цикл" />
        <Metric value={`${model.periodLength} дн.`} label="месячные" />
        <Metric value={model.spread ? `±${model.spread} дн.` : model.fromHistory ? 'ровный' : '—'} label="разброс" />
      </div>
      <p className="mt-2 text-center text-[12px] text-muted">
        {model.fromHistory
          ? `Прогноз по твоим ${lengths} ${plural(lengths, 'циклу', 'циклам', 'циклам')}`
          : 'Пока прогноз по настройкам — отметь пару циклов, и он станет точнее'}
      </p>

      <button onClick={() => setOpen(!open)} className="mt-3 flex w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-muted">
        <SlidersHorizontal size={14} /> Настройки прогноза
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <Stepper label="Обычная длина цикла" value={cycle.cycleLength} min={21} max={40} onChange={(v) => setCycle({ cycleLength: v })} />
          <Stepper label="Обычная длина месячных" value={cycle.periodLength} min={2} max={10} onChange={(v) => setCycle({ periodLength: v })} />
          <p className="text-[12px] text-muted">Используются, пока в истории мало циклов.</p>
        </div>
      )}
    </section>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/70 py-2.5">
      <div className="text-[17px] font-bold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px]">{label}</span>
      <div className="flex items-center gap-3">
        <IconButton label="Меньше" onClick={() => value > min && onChange(value - 1)}>
          <Minus size={16} />
        </IconButton>
        <span className="w-14 text-center text-[15px] font-semibold">{value} дн.</span>
        <IconButton label="Больше" onClick={() => value < max && onChange(value + 1)}>
          <Plus size={16} />
        </IconButton>
      </div>
    </div>
  )
}
