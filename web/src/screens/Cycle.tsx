import { useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { dayInfo, PHASES, type Phase } from '../lib/cycle'
import { formatDay, MONTHS, toISO, type ISODate } from '../lib/date'
import { useCycleToday } from '../lib/useCycleToday'
import { haptic } from '../lib/telegram'
import { Button, Card, Chip, IconButton, PageHeader, SectionTitle } from '../ui/kit'

const MOODS = ['😣', '😕', '😐', '🙂', '🤩']
const SYMPTOMS = ['Спазмы', 'Головная боль', 'Вздутие', 'Акне', 'Усталость', 'Тяга к сладкому', 'Чувствительность груди', 'Бессонница']
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function Cycle() {
  const { cycle, moods, symptoms, setCycle, setMood, toggleSymptom } = useApp()
  const { today, info: todayInfo } = useCycleToday()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState<ISODate>(today)

  const sel = dayInfo(selected, cycle, today)
  const isPast = selected <= today

  // сетка месяца, неделя с понедельника
  const first = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (ISODate | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ]
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div>
      <PageHeader title="Дневник цикла" />
      <div className="px-4 pb-6">
        <Card>
          <div className="flex items-center justify-between">
            <IconButton label="Предыдущий месяц" onClick={() => shift(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <div className="font-display text-[17px] font-bold">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </div>
            <IconButton label="Следующий месяц" onClick={() => shift(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-y-1.5 text-center">
            {WEEK.map((w) => (
              <div key={w} className="pb-1 text-[11px] font-medium text-muted">
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              const di = dayInfo(d, cycle, today)
              const isToday = d === today
              const isSel = d === selected
              return (
                <button
                  key={d}
                  onClick={() => {
                    haptic.select()
                    setSelected(d)
                  }}
                  className="grid place-items-center"
                >
                  <span
                    className={`relative grid size-10 place-items-center rounded-full text-[14px] font-medium transition ${isSel ? 'ring-2 ring-rose ring-offset-2' : ''} ${isToday ? 'font-bold' : ''}`}
                    style={
                      di
                        ? di.predicted
                          ? { border: `2px dashed ${PHASES[di.phase].color}`, color: 'var(--color-ink)' }
                          : { background: PHASES[di.phase].color, color: PHASES[di.phase].text }
                        : { color: 'var(--color-muted)' }
                    }
                  >
                    {Number(d.slice(8))}
                    {moods[d] && <span className="absolute -bottom-0.5 size-1.5 rounded-full bg-ink/50" />}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
            {(Object.keys(PHASES) as Phase[]).map((p) => (
              <span key={p} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="size-2.5 rounded-full" style={{ background: PHASES[p].color }} />
                {PHASES[p].short}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="size-2.5 rounded-full border border-dashed border-muted" /> прогноз
            </span>
          </div>
        </Card>

        {sel ? (
          <div className="mt-3 rounded-card p-4" style={{ background: `color-mix(in srgb, ${PHASES[sel.phase].color} 45%, white)` }}>
            <div className="text-[13px] font-semibold text-ink/70">
              {formatDay(selected)} · день {sel.day} цикла{sel.predicted ? ' (прогноз)' : ''}
            </div>
            <div className="mt-1 font-display text-[18px] font-bold">{PHASES[sel.phase].name}</div>
            <p className="mt-1.5 text-[14px] text-ink/80">{PHASES[sel.phase].hint}</p>
          </div>
        ) : (
          <Card className="mt-3">
            <div className="text-[15px] font-semibold">{cycle.lastPeriodStart ? 'Нет данных за этот день' : 'Начнём с отметки месячных'}</div>
            <p className="mt-1 text-[13px] text-muted">Выбери в календаре день начала последних месячных и нажми кнопку ниже — я рассчитаю фазы и прогноз.</p>
          </Card>
        )}

        {isPast && (
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              haptic.success()
              setCycle({ lastPeriodStart: selected })
            }}
            disabled={cycle.lastPeriodStart === selected}
          >
            {cycle.lastPeriodStart === selected ? 'Отмечено начало месячных 🌸' : `Месячные начались ${selected === today ? 'сегодня' : formatDay(selected)}`}
          </Button>
        )}

        {isPast && (
          <>
            <SectionTitle>Как ты {selected === today ? 'сегодня' : 'себя чувствовала'}?</SectionTitle>
            <Card className="flex justify-between">
              {MOODS.map((m, i) => (
                <button
                  key={m}
                  aria-label={`Настроение ${i + 1} из 5`}
                  onClick={() => {
                    haptic.select()
                    setMood(selected, i + 1)
                  }}
                  className={`grid size-12 place-items-center rounded-full text-[26px] transition ${moods[selected] === i + 1 ? 'scale-110 bg-brand-soft ring-2 ring-rose/50' : 'opacity-70'}`}
                >
                  {m}
                </button>
              ))}
            </Card>

            <SectionTitle>Симптомы</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => (
                <Chip key={s} active={symptoms[selected]?.includes(s)} onClick={() => toggleSymptom(selected, s)} className="px-3.5! py-2! text-[13px]!">
                  {s}
                </Chip>
              ))}
            </div>
          </>
        )}

        <SectionTitle>Мой цикл</SectionTitle>
        <Card className="space-y-3">
          <Stepper label="Длина цикла" value={cycle.cycleLength} min={21} max={40} onChange={(v) => setCycle({ cycleLength: v })} />
          <div className="h-px bg-line" />
          <Stepper label="Длина месячных" value={cycle.periodLength} min={2} max={10} onChange={(v) => setCycle({ periodLength: v })} />
        </Card>
        {todayInfo && <p className="mt-3 px-1 text-[12px] text-muted">Прогноз уточняется по мере того, как ты отмечаешь месячные.</p>}
      </div>
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
