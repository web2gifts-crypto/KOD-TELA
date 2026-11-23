import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { useApp } from '../store/app'
import { FORECAST_DISCLAIMER, MODES, pregnancyInfo } from '../lib/mode'
import { formatDay, today as todayISO } from '../lib/date'
import { haptic } from '../lib/telegram'
import { Button, PageHeader } from '../ui/kit'

/** Выбор режима под цель */
export function Mode() {
  const nav = useNavigate()
  const { mode, setMode, cycle, reminders, setReminders } = useApp()
  const [kind, setKind] = useState(mode.kind)
  const [lmp, setLmp] = useState(mode.pregnancyLmp ?? cycle.lastPeriodStart ?? '')
  const today = todayISO()
  const preg = kind === 'pregnancy' ? pregnancyInfo(lmp || undefined, today) : null

  const save = () => {
    haptic.success()
    setMode(kind === 'pregnancy' ? { kind, pregnancyLmp: lmp } : { kind })
    // в режиме «хочу забеременеть» полезно напоминание о фертильных днях
    if (kind === 'conceive' && reminders && !reminders.fertile.on) setReminders({ fertile: { ...reminders.fertile, on: true } })
    nav('/', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Моя цель" />
      <div className="space-y-3 px-4 pb-8">
        {MODES.map((m) => (
          <button
            key={m.kind}
            onClick={() => {
              haptic.select()
              setKind(m.kind)
            }}
            className={`glass flex w-full items-center gap-3 rounded-card p-4 text-left shadow-card ${kind === m.kind ? 'ring-2 ring-accent' : ''}`}
          >
            <span className="text-[28px]">{m.emoji}</span>
            <span className="flex-1">
              <span className="block text-[16px] font-semibold">{m.title}</span>
              <span className="block text-[13px] leading-snug text-muted">{m.hint}</span>
            </span>
            {kind === m.kind && <Check size={20} className="text-accent" />}
          </button>
        ))}

        {kind === 'pregnancy' && (
          <div className="glass rounded-card p-4 shadow-card">
            <label className="text-[13px] font-semibold text-muted" htmlFor="lmp">
              Первый день последних месячных
            </label>
            <input
              id="lmp"
              type="date"
              value={lmp}
              max={today}
              onChange={(e) => setLmp(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-line bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-accent/40"
            />
            {preg ? (
              <p className="mt-2 text-[13px] text-muted">
                Срок: {preg.week} нед. {preg.day} дн. · предполагаемая дата родов — {formatDay(preg.due, true)}
              </p>
            ) : (
              lmp && <p className="mt-2 text-[13px] text-bad">Проверь дату — срок не получается посчитать</p>
            )}
            <p className="mt-2 text-[12px] leading-snug text-muted">Срок считается от первого дня последних месячных. Точный срок определит врач по УЗИ.</p>
          </div>
        )}

        {kind !== 'cycle' && <p className="px-2 text-[12px] leading-snug text-muted">{kind === 'conceive' ? FORECAST_DISCLAIMER : 'Прогноз цикла и напоминания о месячных на время беременности приостановятся.'}</p>}

        <Button onClick={save} disabled={kind === 'pregnancy' && !preg}>
          Сохранить
        </Button>
      </div>
    </div>
  )
}
