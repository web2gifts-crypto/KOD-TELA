import { useNavigate } from 'react-router'
import { Bell, CalendarHeart, MessageCircle, Sparkles, Upload } from 'lucide-react'
import { useApp } from '../store/app'
import { Avatar } from '../ui/Avatar'
import { Card, SectionTitle } from '../ui/kit'
import { Wordmark } from '../ui/Logo'
import { PHASES, type Phase } from '../lib/cycle'
import { formatDay, plural } from '../lib/date'
import { evaluate, STATUS_COLOR } from '../lib/labs'
import { buildNotifications } from '../lib/insights'
import { useCycleToday } from '../lib/useCycleToday'

const ENERGY: Record<Phase, number> = { menstrual: 45, follicular: 75, ovulation: 90, luteal: 60 }

export function Home() {
  const nav = useNavigate()
  const { profile, labs, moods, readNotifications } = useApp()
  const { today, info, next } = useCycleToday()
  const unread = buildNotifications({ phase: info?.phase ?? null, cycleDay: info?.day ?? null, periodInDays: next?.inDays ?? null, labs }).filter(
    (n) => !readNotifications.includes(n.id),
  ).length

  const energy = info ? ENERGY[info.phase] : 65
  const mood = moods[today] ? moods[today] * 20 : info ? ENERGY[info.phase] + 5 : 70
  const lastLab = labs[0]

  const actions = [
    { label: 'Спросить AI', icon: MessageCircle, to: '/chat', bg: 'linear-gradient(140deg,#a9c6ff,#8fb0f5)' },
    { label: 'Загрузить анализ', icon: Upload, to: '/labs/new', bg: 'linear-gradient(140deg,#f6b5e2,#e08ccc)' },
    { label: 'Дневник цикла', icon: CalendarHeart, to: '/cycle', bg: 'linear-gradient(140deg,#ffe2b8,#f7b7cf)' },
    { label: 'Рекомендации', icon: Sparkles, to: '/recommendations', bg: 'linear-gradient(140deg,#c9b8f5,#a8bdf7)' },
  ]

  return (
    <div className="pt-safe px-4">
      <div className="flex h-14 items-center justify-between">
        <Wordmark />
        <button aria-label="Уведомления" onClick={() => nav('/notifications')} className="relative grid size-10 place-items-center rounded-full bg-white text-rose shadow-card">
          <Bell size={19} />
          {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-bad ring-2 ring-white" />}
        </button>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold">Привет, {profile?.name}! 👋</h1>
          <p className="mt-0.5 text-[13px] text-muted">Сегодня {formatDay(today)}</p>
        </div>
        {info && (
          <span className="mt-1 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: PHASES[info.phase].color, color: PHASES[info.phase].text }}>
            {PHASES[info.phase].short}
          </span>
        )}
      </div>

      <Card className="mt-4 flex items-center gap-4 bg-brand-soft">
        <Avatar id={profile?.avatarId ?? 'anya'} size={84} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] font-bold">Твой аватар</div>
          <Meter label="Энергия" value={energy} color="linear-gradient(90deg,#e8a0d6,#c49be6)" />
          <Meter label="Настроение" value={Math.min(100, mood)} color="linear-gradient(90deg,#a9c6ff,#8fb0f5)" />
        </div>
      </Card>

      {info ? (
        <Card className="mt-3 flex items-center justify-between" onClick={() => nav('/cycle')}>
          <div>
            <div className="text-[13px] text-muted">День цикла</div>
            <div className="font-display text-[22px] font-bold">{info.day}</div>
          </div>
          {next && (
            <div className="text-right">
              <div className="text-[13px] text-muted">Следующие месячные</div>
              <div className="text-[15px] font-semibold">
                {next.inDays === 0 ? 'сегодня' : `через ${next.inDays} ${plural(next.inDays, 'день', 'дня', 'дней')}`}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="mt-3" onClick={() => nav('/cycle')}>
          <div className="text-[14px] font-semibold">Отметь начало месячных</div>
          <div className="mt-0.5 text-[13px] text-muted">И я буду учитывать фазу цикла в советах</div>
        </Card>
      )}

      <SectionTitle>Быстрые действия</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ label, icon: Icon, to, bg }) => (
          <button
            key={to}
            onClick={() => nav(to)}
            style={{ background: bg }}
            className="flex h-[104px] flex-col items-center justify-center gap-2.5 rounded-card text-white shadow-card transition active:scale-[0.97]"
          >
            <Icon size={24} strokeWidth={2} />
            <span className="text-[14px] font-semibold">{label}</span>
          </button>
        ))}
      </div>

      <SectionTitle
        action={
          lastLab && (
            <button onClick={() => nav(`/labs/${lastLab.id}`)} className="text-[13px] font-medium text-rose">
              Подробнее
            </button>
          )
        }
      >
        Последний анализ
      </SectionTitle>
      {lastLab ? (
        <Card>
          <div className="grid grid-cols-3 gap-2">
            {lastLab.items.slice(0, 3).map((it) => {
              const ev = evaluate(it.code, it.value)
              if (!ev) return null
              return (
                <div key={it.code} className="rounded-2xl px-2 py-3 text-center" style={{ background: `color-mix(in srgb, ${STATUS_COLOR[ev.status]} 12%, white)` }}>
                  <div className="font-display text-[22px] font-bold" style={{ color: STATUS_COLOR[ev.status] }}>
                    {it.value}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-muted">
                    {ev.def.name}
                    <br />
                    {ev.def.unit}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-[12px] text-muted">📅 Загружен {formatDay(lastLab.date, true)}</div>
        </Card>
      ) : (
        <Card onClick={() => nav('/labs/new')}>
          <div className="text-[14px] font-semibold">Пока нет анализов</div>
          <div className="mt-0.5 text-[13px] text-muted">Загрузи фото бланка или введи показатели — объясню простыми словами</div>
        </Card>
      )}
    </div>
  )
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}
