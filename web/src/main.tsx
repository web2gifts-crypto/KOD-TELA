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

initTelegram()

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useApp((s) => s.profile)
  return profile ? children : <Navigate to="/welcome" replace />
}

const routes: RouteObject[] = [
  { path: '/welcome', element: <Onboarding /> },
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
      { path: '/cycle', element: <Cycle /> },
      { path: '/recommendations', element: <Recommendations /> },
      { path: '/profile', element: <Profile /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/history', element: <History /> },
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
