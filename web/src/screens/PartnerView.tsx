import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { viewAsPartner, type PartnerViewData } from '../lib/partner'
import { syncEnabled } from '../lib/sync'
import { formatDay, plural } from '../lib/date'
import { PHASES } from '../lib/cycle'
import { useApp } from '../store/app'
import { Button } from '../ui/kit'
import { Yuvi, MOOD_SCALE } from '../ui/Yuvi'
import { LogoMark } from '../ui/Logo'

/** Экран партнёра: открывается по персональной ссылке t.me/kodtela_app?startapp=p_… */
export function PartnerView() {
  const { token = '' } = useParams()
  const nav = useNavigate()
  const hasProfile = useApp((s) => !!s.profile)
  const [data, setData] = useState<PartnerViewData | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'offline'>('loading')

  useEffect(() => {
    if (!syncEnabled()) return setState('offline')
    viewAsPartner(token)
      .then((d) => {
        setData(d)
        setState('ok')
      })
      .catch((e: Error) => setState(e.message === '404' ? 'denied' : 'offline'))
  }, [token])

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-6">
      <div className="flex items-center gap-2 text-[15px] font-bold text-accent">
        <LogoMark size={26} /> Код Тела
      </div>

      {state === 'loading' && <p className="mt-20 text-center text-muted">Загружаю…</p>}
      {state === 'offline' && <p className="mt-20 text-center text-muted">Не получилось загрузить. Проверь интернет и открой ссылку ещё раз.</p>}
      {state === 'denied' && (
        <div className="mt-16 text-center">
          <Yuvi mood="neutral" size={110} companion={false} />
          <h1 className="mt-4 text-[20px] font-bold">Ссылка не для этого аккаунта</h1>
          <p className="mt-2 text-[14px] text-muted">Её могли отозвать, или она предназначена другому человеку. Попроси прислать новую.</p>
        </div>
      )}

      {state === 'ok' && data && <View d={data} />}

      <div className="flex-1" />
      <Button variant="secondary" className="mb-3 mt-8" onClick={() => nav(hasProfile ? '/' : '/welcome', { replace: true })}>
        {hasProfile ? 'Открыть моё приложение' : 'Завести свой дневник'}
      </Button>
      <p className="mb-2 text-center text-[11px] text-muted">Чтобы открыть доступ, сохраняется только твой Telegram ID.</p>
    </div>
  )
}

function View({ d }: { d: PartnerViewData }) {
  const c = d.cycle
  return (
    <div className="mt-6">
      <h1 className="text-[24px] font-bold leading-tight">{d.owner} поделилась с тобой 💜</h1>

      {d.pregnancy && (
        <Card>
          <div className="text-[13px] text-muted">Беременность</div>
          <div className="mt-1 text-[26px] font-bold">
            {d.pregnancy.week} {plural(d.pregnancy.week, 'неделя', 'недели', 'недель')}
            {d.pregnancy.day > 0 && <span className="text-[17px] font-semibold"> и {d.pregnancy.day} дн.</span>}
          </div>
        </Card>
      )}

      {c && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-muted">Сегодня</div>
              <div className="text-[28px] font-bold leading-tight">День {c.day}</div>
            </div>
            <span className="rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: PHASES[c.phase].color, color: PHASES[c.phase].text }}>
              {c.phaseName}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            {c.period && <li>🌸 Сейчас идут месячные</li>}
            {c.lateDays > 0 && <li>Месячные позже прогноза на {c.lateDays} {plural(c.lateDays, 'день', 'дня', 'дней')}</li>}
            {c.nextPeriod && c.periodInDays !== null && c.periodInDays > 0 && (
              <li>
                Месячные по прогнозу через <b>{c.periodInDays} {plural(c.periodInDays, 'день', 'дня', 'дней')}</b> ({formatDay(c.nextPeriod)})
              </li>
            )}
            {c.fertile !== undefined && <li>{c.fertile ? '🌱 По прогнозу — фертильные дни' : 'Вне фертильного окна по прогнозу'}</li>}
          </ul>
          <p className="mt-3 text-[13px] leading-snug text-ink/70">{PHASES[c.phase].hint}</p>
        </Card>
      )}

      {d.mood !== undefined && (
        <Card>
          <div className="text-[13px] text-muted">Настроение сегодня</div>
          {d.mood ? (
            <div className="mt-2 flex items-center gap-3">
              <Yuvi mood={MOOD_SCALE[d.mood.value - 1]} size={56} companion={false} still />
              <div className="text-[18px] font-semibold">{d.mood.label}</div>
            </div>
          ) : (
            <div className="mt-1 text-[14px]">Ещё не отмечено</div>
          )}
        </Card>
      )}

      {!c && !d.pregnancy && d.mood === undefined && <p className="mt-6 text-[14px] text-muted">Пока нечего показать — данных о цикле ещё нет.</p>}
      <p className="mt-4 text-[12px] leading-snug text-muted">Это прогноз приложения по календарю — не медицинское заключение.</p>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="glass mt-4 rounded-card p-5 shadow-card">{children}</section>
}
