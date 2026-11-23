import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, Navigate, RouterProvider, type RouteObject } from 'react-router'
import './styles.css'
import { initTelegram } from './lib/telegram'
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
import { ConsentForm } from './screens/Onboarding'
import { CONSENT_VERSION } from './lib/legal'
import { startSync } from './lib/sync'

initTelegram()
startSync()

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
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

// hash-роутинг: mini app открывается по одному URL, сервер не нужно настраивать под SPA
const router = createHashRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="app-backdrop" />
    <RouterProvider router={router} />
  </StrictMode>,
)
