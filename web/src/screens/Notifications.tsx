import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../store/app'
import { buildNotifications } from '../lib/insights'
import { relativeTime } from '../lib/date'
import { useCycleToday } from '../lib/useCycleToday'
import { Card, PageHeader } from '../ui/kit'

export function Notifications() {
  const nav = useNavigate()
  const { labs, readNotifications, markRead } = useApp()
  const { info, next } = useCycleToday()
  const list = useMemo(
    () => buildNotifications({ phase: info?.phase ?? null, cycleDay: info?.day ?? null, periodInDays: next?.inDays ?? null, labs }),
    [info, next, labs],
  )
  // непрочитанные запоминаем на момент открытия, чтобы точки не пропали сразу
  const unread = useMemo(() => new Set(list.filter((n) => !readNotifications.includes(n.id)).map((n) => n.id)), [list])

  useEffect(() => {
    if (unread.size) markRead([...unread])
  }, [unread, markRead])

  return (
    <div>
      <PageHeader title="Уведомления" />
      <div className="space-y-3 px-4 pb-6">
        {list.length === 0 && (
          <div className="py-16 text-center text-[14px] text-muted">
            <div className="mb-2 text-[40px]">🔔</div>
            Пока тихо. Уведомления появятся, когда отметишь цикл или загрузишь анализы.
          </div>
        )}
        {list.map((n) => (
          <Card key={n.id} onClick={n.to ? () => nav(n.to!) : undefined} className={`flex gap-3.5 ${unread.has(n.id) ? '' : 'opacity-80'}`}>
            <div className={`grid size-12 shrink-0 place-items-center rounded-2xl text-[22px] ${unread.has(n.id) ? 'bg-brand-soft' : 'bg-bg'}`}>{n.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15px] font-semibold">{n.title}</div>
                {unread.has(n.id) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-ink/75">{n.text}</p>
              <div className="mt-1 text-[11px] text-muted">{relativeTime(n.ts)}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
