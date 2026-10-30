import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Activity, House, MessageCircle, UserRound } from 'lucide-react'
import { bindBackButton, haptic } from '../lib/telegram'

const TABS = [
  { to: '/', label: 'Главная', icon: House },
  { to: '/chat', label: 'Чат', icon: MessageCircle },
  { to: '/labs', label: 'Анализы', icon: Activity },
  { to: '/profile', label: 'Профиль', icon: UserRound },
]
const ROOTS = new Set(TABS.map((t) => t.to))

/** Нативная кнопка «Назад» Telegram на всех экранах, кроме корневых вкладок */
export function useTelegramBack(visible: boolean) {
  const nav = useNavigate()
  useEffect(() => bindBackButton(visible, () => nav(-1)), [visible, nav])
}

export function AppLayout() {
  const { pathname } = useLocation()
  const isRoot = ROOTS.has(pathname)
  useTelegramBack(!isRoot)
  const hideTabs = pathname === '/chat'

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <main key={pathname} className={`anim-rise flex-1 ${hideTabs ? '' : 'pb-28'}`}>
        <Outlet />
      </main>
      {!hideTabs && <TabBar />}
    </div>
  )
}

function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-white/90 backdrop-blur-md">
      <ul className="grid h-16 grid-cols-4">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={() => haptic.select()}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-rose' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-brand-soft' : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
