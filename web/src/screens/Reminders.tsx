import { useNavigate } from 'react-router'
import { Minus, Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { defaultReminders, REMINDER_INFO, type ReminderKind } from '../lib/reminders'
import { syncEnabled } from '../lib/sync'
import { requestWriteAccess } from '../lib/telegram'
import { PageHeader, Toggle } from '../ui/kit'

const ORDER: ReminderKind[] = ['period', 'pill', 'mood', 'fertile']

/** Настройки напоминаний: приходят сообщением от бота @kodtela_app */
export function Reminders() {
  const nav = useNavigate()
  const r = useApp((s) => s.reminders) ?? defaultReminders()
  const pill = useApp((s) => s.pill)
  const setReminders = useApp((s) => s.setReminders)

  const toggle = async (k: ReminderKind, on: boolean) => {
    if (on && !(await requestWriteAccess())) return
    setReminders({ [k]: { ...r[k], on }, muted: false })
  }
  const setTime = (k: ReminderKind, time: string) => time && setReminders({ [k]: { ...r[k], time } })

  return (
    <div>
      <PageHeader title="Напоминания" />
      <div className="space-y-3 px-4 pb-8">
        <p className="px-1 text-[13px] leading-snug text-muted">
          Напоминания приходят сообщением от бота «Код Тела» в Telegram. Выключить все сразу можно здесь или командой /mute в чате с ботом.
        </p>
        {!syncEnabled() && (
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13px] text-muted">Напоминания работают, когда приложение открыто в Telegram.</p>
        )}

        <div className="glass flex items-center justify-between rounded-card p-4 shadow-card">
          <div>
            <div className="text-[15px] font-semibold">Все напоминания</div>
            <div className="text-[12px] text-muted">{r.muted ? 'Выключены' : 'Включены'}</div>
          </div>
          <Toggle label="Все напоминания" on={!r.muted} onChange={async (on) => (!on || (await requestWriteAccess())) && setReminders({ muted: !on })} />
        </div>

        <div className={`glass overflow-hidden rounded-card shadow-card transition ${r.muted ? 'opacity-50' : ''}`}>
          {ORDER.map((k, i) => {
            const info = REMINDER_INFO[k]
            const cfg = r[k]
            return (
              <div key={k} className={`px-4 py-3.5 ${i ? 'border-t border-line' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-[22px]">{info.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{info.title}</div>
                    <div className="text-[12px] leading-snug text-muted">{info.hint}</div>
                  </div>
                  <Toggle label={info.title} on={cfg.on} onChange={(on) => void toggle(k, on)} />
                </div>
                {cfg.on && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-9 text-[13px]">
                    <span className="text-muted">в</span>
                    <input
                      type="time"
                      value={cfg.time}
                      onChange={(e) => setTime(k, e.target.value)}
                      className="h-9 rounded-xl border border-line bg-white px-2 text-[14px] outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    {k === 'period' && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-muted">за</span>
                        <Step onClick={() => setReminders({ period: { ...r.period, daysBefore: Math.max(0, r.period.daysBefore - 1) } })} label="Меньше дней">
                          <Minus size={14} />
                        </Step>
                        <b className="w-4 text-center">{r.period.daysBefore}</b>
                        <Step onClick={() => setReminders({ period: { ...r.period, daysBefore: Math.min(7, r.period.daysBefore + 1) } })} label="Больше дней">
                          <Plus size={14} />
                        </Step>
                        <span className="text-muted">дн.</span>
                      </span>
                    )}
                    {k === 'pill' && !pill && (
                      <button onClick={() => nav('/pill')} className="font-semibold text-accent">
                        Указать схему приёма →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="px-1 text-[12px] text-muted">Часовой пояс: {r.tz}</p>
      </div>
    </div>
  )
}

function Step({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-7 place-items-center rounded-full bg-brand-soft text-accent">
      {children}
    </button>
  )
}
