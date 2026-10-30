import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { CalendarDays, FlaskConical, House } from 'lucide-react'
import { LogoMark } from './Logo'
import { bindBackButton, haptic } from '../lib/telegram'
import { FloatingYuvi } from './FloatingYuvi'

const TABS = [
  { to: '/', label: 'Главная', icon: House },
  { to: '/cycle', label: 'Календарь', icon: CalendarDays },
  { to: '/labs', label: 'Анализы', icon: FlaskConical },
  { to: '/code', label: 'Код тела', icon: CodeIcon },
]

/** иконка вкладки «Код тела» — знак логотипа в цвете вкладки */
function CodeIcon({ size = 22 }: { size?: number; strokeWidth?: number }) {
  return <LogoMark size={size} mono="currentColor" />
}
const ROOTS = new Set(TABS.map((t) => t.to))
/** экраны, где Юви уже есть на экране — плавающего не показываем (на главной он в карточке) */
const NO_FAB = new Set(['/', '/chat', '/mood'])

/** Нативная кнопка «Назад» Telegram на всех экранах, кроме корневых вкладок */
export function useTelegramBack(visible: boolean) {
  const nav = useNavigate()
  useEffect(() => bindBackButton(visible, () => nav(-1)), [visible, nav])
}

export function AppLayout() {
  const { pathname } = useLocation()
  useTelegramBack(!ROOTS.has(pathname))
  const hideTabs = pathname === '/chat'

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <main key={pathname} className={`anim-rise flex-1 ${hideTabs ? '' : 'pb-32'}`}>
        <Outlet />
      </main>
      {!NO_FAB.has(pathname) && <FloatingYuvi />}
      {!hideTabs && <TabBar />}
    </div>
  )
}

function TabBar() {
  return (
    <nav className="pb-safe glass fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] rounded-t-[1.75rem] shadow-[0_-8px_30px_-12px_rgba(98,86,214,0.25)]">
      <ul className="grid h-[68px] grid-cols-4">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={() => haptic.select()}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
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
