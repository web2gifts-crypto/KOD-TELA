import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store/app'
import { missedPills, pillDay, pillStreak, REGIMENS, type Regimen } from '../lib/pill'
import { addDays, formatDay, plural, today as todayISO } from '../lib/date'
import { haptic, requestWriteAccess } from '../lib/telegram'
import { defaultReminders } from '../lib/reminders'
import { Button, Chip, PageHeader, Toggle } from '../ui/kit'

/** Контрацепция: схема приёма, отметки «выпила» по дням пачки, напоминание */
export function Pill() {
  const nav = useNavigate()
  const { pill, pillLog, setPill, togglePillTaken, setReminders } = useApp()
  const reminders = useApp((s) => s.reminders) ?? defaultReminders()
  const today = todayISO()
  const pd = pillDay(pill, today)

  if (!pill) return <Setup onSave={(regimen, packStart) => setPill({ regimen, packStart, since: today })} />

  const packStart = addDays(today, -((pd?.index ?? 1) - 1))
  const streak = pillStreak(pill, pillLog, today)
  const missed = missedPills(pill, pillLog, today)
  const takenToday = !!pillLog[today]

  return (
    <div>
      <PageHeader title="Контрацепция" />
      <div className="space-y-3 px-4 pb-8">
        <div className="glass rounded-card p-5 text-center shadow-card">
          {pd?.active ? (
            <>
              <div className="text-[13px] text-muted">
                Таблетка {pd.index} из 28{pd.placebo ? ' · неактивная' : ''}
              </div>
              <button
                onClick={() => {
                  takenToday ? haptic.select() : haptic.success()
                  togglePillTaken(today)
                }}
                className={`mx-auto mt-3 grid size-28 place-items-center rounded-full text-[15px] font-bold shadow-btn transition active:scale-95 ${takenToday ? 'bg-ok text-white' : 'bg-brand text-white'}`}
              >
                {takenToday ? (
                  <span className="flex flex-col items-center gap-1">
                    <Check size={32} strokeWidth={3} /> Выпила
                  </span>
                ) : (
                  'Отметить'
                )}
              </button>
              {streak > 1 && <div className="mt-3 text-[13px] text-muted">🔥 {streak} {plural(streak, 'день', 'дня', 'дней')} подряд</div>}
            </>
          ) : (
            <>
              <div className="text-[34px]">🌙</div>
              <div className="mt-1 text-[15px] font-semibold">Неделя перерыва</div>
              <div className="text-[13px] text-muted">Новая пачка — {formatDay(addDays(packStart, 28))}</div>
            </>
          )}
        </div>

        {missed.length > 0 && (
          <div className="rounded-card bg-[#fff4e0] p-4 text-[13px] leading-snug text-[#8a5a00]">
            Не отмечено: {missed.map((d) => formatDay(d)).join(', ')}. Если таблетку пропустила — посмотри, что советует инструкция к препарату, или спроси врача.
          </div>
        )}

        <Pack pill={pill} log={pillLog} today={today} onToggle={togglePillTaken} packStart={packStart} since={pill.since} />

        <div className="glass flex items-center gap-3 rounded-card p-4 shadow-card">
          <span className="text-[22px]">💊</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Напоминание в Telegram</div>
            <div className="text-[12px] text-muted">{reminders.pill.on ? `каждый день в ${reminders.pill.time}` : 'выключено'}</div>
          </div>
          <Toggle
            label="Напоминание о таблетке"
            on={reminders.pill.on && !reminders.muted}
            onChange={async (on) => (!on || (await requestWriteAccess())) && setReminders({ pill: { ...reminders.pill, on }, muted: on ? false : reminders.muted })}
          />
        </div>
        <button onClick={() => nav('/reminders')} className="w-full text-center text-[13px] font-semibold text-accent">
          Время напоминаний →
        </button>

        <div className="glass rounded-card p-4 shadow-card">
          <div className="text-[13px] text-muted">Схема: {REGIMENS.find((r) => r.id === pill.regimen)?.label}</div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="h-11! text-[13px]!" onClick={() => setPill({ ...pill, packStart: today, since: pill.since ?? today })}>
              Начала новую пачку сегодня
            </Button>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Перестать отслеживать контрацепцию? Отметки сохранятся.')) {
                setPill(null)
                setReminders({ pill: { ...reminders.pill, on: false } })
              }
            }}
            className="mt-3 w-full text-center text-[13px] text-muted"
          >
            Больше не принимаю
          </button>
        </div>
        <p className="px-2 text-center text-[11px] text-muted">Приложение не подбирает и не оценивает препараты — по всем вопросам о контрацепции обратись к гинекологу.</p>
      </div>
    </div>
  )
}

function Pack({ pill, log, today, onToggle, packStart, since }: { pill: { regimen: Regimen; packStart: string }; log: Record<string, number>; today: string; onToggle: (d: string) => void; packStart: string; since?: string }) {
  return (
    <div className="glass rounded-card p-4 shadow-card">
      <div className="mb-3 text-[13px] font-semibold text-muted">Текущая пачка</div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 28 }, (_, i) => {
          const d = addDays(packStart, i)
          const pd = pillDay(pill, d)!
          const future = d > today
          const taken = !!log[d]
          return (
            <button
              key={d}
              disabled={future || !pd.active}
              onClick={() => onToggle(d)}
              aria-label={`${formatDay(d)}${taken ? ', выпита' : ''}`}
              className={`grid aspect-square place-items-center rounded-full text-[11px] font-semibold transition ${
                !pd.active
                  ? 'bg-transparent text-muted/40'
                  : taken
                    ? 'bg-ok text-white'
                    : future || (since && d < since)
                      ? 'border border-line text-muted'
                      : d === today
                        ? 'border-2 border-accent text-accent'
                        : 'bg-[#ffe9c7] text-[#8a5a00]'
              } ${pd.placebo && !taken ? 'opacity-60' : ''}`}
            >
              {taken ? <Check size={14} strokeWidth={3} /> : i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Setup({ onSave }: { onSave: (r: Regimen, packStart: string) => void }) {
  const today = todayISO()
  const [regimen, setRegimen] = useState<Regimen>('21_7')
  const [day, setDay] = useState(1)
  return (
    <div>
      <PageHeader title="Контрацепция" />
      <div className="space-y-4 px-4 pb-8">
        <p className="px-1 text-[14px] leading-snug text-ink/80">Отмечай таблетки и получай напоминание в Telegram в удобное время.</p>
        <div>
          <div className="mb-2 px-1 text-[13px] font-semibold text-muted">Схема приёма</div>
          <div className="space-y-2">
            {REGIMENS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRegimen(r.id)}
                className={`glass flex w-full items-center gap-3 rounded-2xl p-3.5 text-left shadow-card ${regimen === r.id ? 'ring-2 ring-accent' : ''}`}
              >
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">{r.label}</div>
                  <div className="text-[12px] text-muted">{r.hint}</div>
                </div>
                {regimen === r.id && <Check size={18} className="text-accent" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 px-1 text-[13px] font-semibold text-muted">Какая таблетка по счёту сегодня?</div>
          <div className="glass flex items-center justify-between rounded-2xl p-2 shadow-card">
            <button aria-label="Меньше" onClick={() => setDay(Math.max(1, day - 1))} className="grid size-10 place-items-center rounded-full bg-brand-soft text-accent">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <div className="text-[24px] font-bold">{day}</div>
              <div className="text-[12px] text-muted">{day > 21 && regimen === '21_7' ? 'день перерыва' : 'из 28'}</div>
            </div>
            <button aria-label="Больше" onClick={() => setDay(Math.min(28, day + 1))} className="grid size-10 place-items-center rounded-full bg-brand-soft text-accent">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="mt-2 flex gap-2 px-1">
            <Chip active={day === 1} onClick={() => setDay(1)}>
              Начинаю пачку сегодня
            </Chip>
          </div>
        </div>
        <Button onClick={() => onSave(regimen, addDays(today, -(day - 1)))}>Сохранить</Button>
      </div>
    </div>
  )
}
