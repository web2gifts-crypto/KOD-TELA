import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, Navigate, RouterProvider, type RouteObject } from 'react-router'
import './styles.css'
import { getStartParam, initTelegram } from './lib/telegram'
import { useApp } from './store/app'
import { AppLayout } from './ui/Layout'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Chat } from './screens/Chat'
import { Labs } from './screens/Labs'
import { LabUpload } from './screens/LabUpload'
import { LabResult } from './screens/LabResult'
import { Cycle } from './screens/Cycle'
import { Recommendations } from './screens/Recommendations'
import { Profile } from './screens/Profile'
import { Notifications } from './screens/Notifications'
import { History } from './screens/History'
import { YuviGuide } from './screens/YuviGuide'
import { Mood } from './screens/Mood'
import { BodyCode } from './screens/BodyCode'
import { ConsentText, PrivacyPolicy } from './screens/Legal'
import { MyData } from './screens/MyData'
import { Reminders } from './screens/Reminders'
import { Pill } from './screens/Pill'
import { Mode } from './screens/Mode'
import { ImportHistory } from './screens/ImportHistory'
import { Security } from './screens/Security'
import { ArticlePage, Articles } from './screens/Articles'
import { Plus } from './screens/Plus'
import { LockGate } from './ui/LockGate'
import { Partner } from './screens/Partner'
import { PartnerView } from './screens/PartnerView'
import { PARTNER_START } from './lib/partner'
import { ConsentForm } from './screens/Onboarding'
import { CONSENT_VERSION } from './lib/legal'
import { startSync } from './lib/sync'

initTelegram()
startSync()

// ссылка партнёра t.me/<bot>?startapp=p_<token> — сразу на экран партнёра
const start = getStartParam()
if (start?.startsWith(PARTNER_START) && !location.hash.startsWith('#/partner/')) location.hash = `#/partner/${start.slice(PARTNER_START.length)}`

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useApp((s) => s.profile)
  const consent = useApp((s) => s.consent)
  if (!profile) return <Navigate to="/welcome" replace />
  // нет согласия актуальной редакции (старые пользователи или тексты обновились) — спрашиваем заново
  if (consent?.version !== CONSENT_VERSION)
    return (
      <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 pt-6">
        <h1 className="text-center text-[20px] font-bold">Обновили правила работы с данными</h1>
        <ConsentForm onAccept={() => {}} button="Принять и продолжить" />
      </div>
    )
  return children
}

const routes: RouteObject[] = [
  { path: '/welcome', element: <Onboarding /> },
  { path: '/privacy', element: <PrivacyPolicy /> },
  { path: '/consent-text', element: <ConsentText /> },
  { path: '/partner/:token', element: <PartnerView /> },
  {
    element: (
      <RequireProfile>
        <AppLayout />
      </RequireProfile>
    ),
    children: [
      { path: '/', element: <Home /> },
      { path: '/chat', element: <Chat /> },
      { path: '/labs', element: <Labs /> },
      { path: '/labs/new', element: <LabUpload /> },
      { path: '/labs/:id', element: <LabResult /> },
      { path: '/labs/:id/edit', element: <LabUpload /> },
      { path: '/cycle', element: <Cycle /> },
      { path: '/recommendations', element: <Recommendations /> },
      { path: '/profile', element: <Profile /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/history', element: <History /> },
      { path: '/yuvi', element: <YuviGuide /> },
      { path: '/mood', element: <Mood /> },
      { path: '/code', element: <BodyCode /> },
      { path: '/data', element: <MyData /> },
      { path: '/reminders', element: <Reminders /> },
      { path: '/pill', element: <Pill /> },
      { path: '/mode', element: <Mode /> },
      { path: '/import', element: <ImportHistory /> },
      { path: '/security', element: <Security /> },
      { path: '/articles', element: <Articles /> },
      { path: '/articles/:id', element: <ArticlePage /> },
      { path: '/plus', element: <Plus /> },
      { path: '/partner', element: <Partner /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

// hash-роутинг: mini app открывается по одному URL, сервер не нужно настраивать под SPA
const router = createHashRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="app-backdrop" />
    <LockGate>
      <RouterProvider router={router} />
    </LockGate>
  </StrictMode>,
)
