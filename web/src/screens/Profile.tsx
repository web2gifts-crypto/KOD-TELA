import { useNavigate } from 'react-router'
import { Bell, CalendarHeart, ChevronRight, CircleHelp, FlaskConical, MessageCircle, ShieldCheck, Smile, Trash2, Wand2 } from 'lucide-react'
import { useApp } from '../store/app'
import { Yuvi } from '../ui/Yuvi'
import { GlassIcon, PageHeader, type Tone } from '../ui/kit'
import { LogoMark } from '../ui/Logo'
import { PHASES } from '../lib/cycle'
import { plural } from '../lib/date'
import { useCycleToday } from '../lib/useCycleToday'
import { getUser, haptic, inTelegram } from '../lib/telegram'
import { demoData } from '../lib/demo'

// Профиль открывается по аватарке на главной. Статистика — во вкладке «Код тела».

export function Profile() {
  const nav = useNavigate()
  const { profile, labs, chats, resetAll, loadData } = useApp()
  const user = getUser()
  const { info } = useCycleToday()
  if (!profile) return null

  const sub = [profile.age && `${profile.age} ${plural(profile.age, 'год', 'года', 'лет')}`, info && PHASES[info.phase].name].filter(Boolean).join(' · ')

  const items: { icon: typeof Bell; tone: Tone; label: string; badge?: number; to?: string }[] = [
    { icon: CalendarHeart, tone: 'pink', label: 'Мой цикл и календарь', to: '/cycle' },
    { icon: FlaskConical, tone: 'violet', label: 'История анализов', badge: labs.length, to: '/labs' },
    { icon: MessageCircle, tone: 'blue', label: 'История диалогов с Юви', badge: chats.length, to: '/history' },
    { icon: Smile, tone: 'mint', label: 'Индикатор настроения Юви', to: '/yuvi' },
    { icon: Bell, tone: 'peach', label: 'Уведомления', to: '/notifications' },
    { icon: ShieldCheck, tone: 'violet', label: 'Конфиденциальность' },
    { icon: CircleHelp, tone: 'blue', label: 'Помощь' },
  ]

  const wipe = () => {
    if (!window.confirm('Удалить все твои данные? Это действие нельзя отменить.')) return
    haptic.warn()
    resetAll()
    nav('/welcome', { replace: true })
  }

  // демо-данные для показа (защита ВКР) — только вне Telegram или в режиме разработки
  const showDemo = import.meta.env.DEV || !inTelegram
  const loadDemo = () => {
    if (!window.confirm('Заменить твои данные демо-данными за 3 месяца?')) return
    loadData(demoData(profile))
    haptic.success()
    nav('/code')
  }

  return (
    <div>
      <PageHeader title="Профиль" />
      <div className="px-4 pb-6">
        <div className="flex flex-col items-center pb-5 pt-2 text-center">
          <div className="relative">
            <span className="block rounded-full bg-brand p-1">
              {user.photo_url ? (
                <img src={user.photo_url} alt="" className="size-24 rounded-full border-4 border-white object-cover" />
              ) : (
                <span className="grid size-24 place-items-center rounded-full border-4 border-white bg-brand text-[36px] font-bold text-white">{profile.name[0]}</span>
              )}
            </span>
            <span className="absolute -bottom-2 -right-6">
              <Yuvi size={52} companion={false} />
            </span>
          </div>
          <h1 className="mt-3 text-[22px] font-bold">{profile.name}</h1>
          {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
          {user.username && <p className="text-[12px] text-muted">@{user.username}</p>}
        </div>

        {/* переход к статистике */}
        <button
          onClick={() => nav('/code')}
          className="relative flex w-full items-center gap-3 overflow-hidden rounded-card p-4 text-left text-white shadow-card transition active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, #f59ccc 0%, #a98cff 50%, #5d86f8 100%)' }}
        >
          <span className="absolute -bottom-8 -right-4 opacity-20">
            <LogoMark size={100} mono="#fff" />
          </span>
          <div className="relative flex-1">
            <div className="text-[16px] font-bold">Мой код тела</div>
            <div className="text-[13px] text-white/85">Цикл, настроение и анализы за всё время</div>
          </div>
          <ChevronRight className="relative" size={20} />
        </button>

        <div className="glass mt-3 overflow-hidden rounded-card shadow-card">
          {items.map(({ icon, tone, label, badge, to }, i) => (
            <button
              key={label}
              onClick={() => to && nav(to)}
              disabled={!to}
              className={`flex w-full items-center gap-3.5 px-4 py-3 text-left transition active:bg-white/60 ${i ? 'border-t border-line' : ''}`}
            >
              <GlassIcon icon={icon} tone={tone} size={36} />
              <span className={`flex-1 text-[15px] ${to ? '' : 'text-ink/50'}`}>{label}</span>
              {!!badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
              {to ? <ChevronRight size={18} className="text-muted" /> : <span className="text-[11px] text-muted">скоро</span>}
            </button>
          ))}
        </div>

        {showDemo && (
          <button onClick={loadDemo} className="glass mt-3 flex w-full items-center justify-center gap-2 rounded-card py-3.5 text-[14px] font-semibold text-accent shadow-card">
            <Wand2 size={17} /> Заполнить демо-данными
          </button>
        )}
        <button onClick={wipe} className="glass mt-3 flex w-full items-center justify-center gap-2 rounded-card py-3.5 text-[14px] font-medium text-bad shadow-card">
          <Trash2 size={17} /> Удалить мои данные
        </button>
        <p className="mt-4 text-center text-[11px] text-muted">Код Тела · MVP 0.1</p>
      </div>
    </div>
  )
}
