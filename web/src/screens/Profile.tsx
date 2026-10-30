import { useNavigate } from 'react-router'
import { Bell, ChevronRight, CircleHelp, FlaskConical, MessageCircle, ShieldCheck, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { Avatar } from '../ui/Avatar'
import { Card } from '../ui/kit'
import { PHASES } from '../lib/cycle'
import { plural } from '../lib/date'
import { useCycleToday } from '../lib/useCycleToday'
import { haptic } from '../lib/telegram'

export function Profile() {
  const nav = useNavigate()
  const { profile, labs, chats, resetAll } = useApp()
  const { info } = useCycleToday()
  if (!profile) return null

  const sub = [profile.age && `${profile.age} ${plural(profile.age, 'год', 'года', 'лет')}`, info && PHASES[info.phase].name].filter(Boolean).join(' · ')

  const items = [
    { icon: FlaskConical, label: 'История анализов', badge: labs.length, to: '/labs' },
    { icon: MessageCircle, label: 'История диалогов', badge: chats.length, to: '/history' },
    { icon: Bell, label: 'Уведомления', to: '/notifications' },
    { icon: ShieldCheck, label: 'Конфиденциальность', to: undefined },
    { icon: CircleHelp, label: 'Помощь', to: undefined },
  ]

  const wipe = () => {
    if (!window.confirm('Удалить все твои данные? Это действие нельзя отменить.')) return
    haptic.warn()
    resetAll()
    nav('/welcome', { replace: true })
  }

  return (
    <div className="pt-safe">
      <div className="flex flex-col items-center px-4 pb-6 pt-8 text-center">
        <span className="rounded-full bg-brand p-1">
          <span className="block rounded-full bg-white p-1">
            <Avatar id={profile.avatarId} size={104} />
          </span>
        </span>
        <h1 className="mt-3 font-display text-[22px] font-bold">{profile.name}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
        <div className="mt-5 grid w-full grid-cols-3 rounded-card bg-white py-4 shadow-card">
          <Stat value={labs.length} label="Анализов" />
          <Stat value={chats.length} label="Диалогов" />
          <Stat value={info?.day ?? '—'} label="День цикла" />
        </div>
      </div>

      <div className="px-4">
        <Card className="p-0! overflow-hidden">
          {items.map(({ icon: Icon, label, badge, to }, i) => (
            <button
              key={label}
              onClick={() => to && nav(to)}
              className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-bg ${i ? 'border-t border-line' : ''} ${to ? '' : 'opacity-60'}`}
            >
              <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-rose">
                <Icon size={18} />
              </span>
              <span className="flex-1 text-[15px]">{label}</span>
              {!!badge && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
              {to ? <ChevronRight size={18} className="text-muted" /> : <span className="text-[11px] text-muted">скоро</span>}
            </button>
          ))}
        </Card>

        <button onClick={wipe} className="mt-4 flex w-full items-center justify-center gap-2 rounded-card bg-white py-4 text-[14px] font-medium text-bad shadow-card">
          <Trash2 size={17} /> Удалить мои данные
        </button>
        <p className="mt-4 text-center text-[11px] text-muted">Код Тела · MVP 0.1</p>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="font-display text-[22px] font-bold text-rose">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}
