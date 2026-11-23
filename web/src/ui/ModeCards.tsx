import { useNavigate } from 'react-router'
import { useApp, type DayExtra } from '../store/app'
import { FORECAST_DISCLAIMER, pregnancyInfo } from '../lib/mode'
import { MARKS, type CycleModel } from '../lib/cycle'
import { addDays, diffDays, formatDay, plural, type ISODate } from '../lib/date'
import { series } from '../lib/dayLog'
import { LogoMark } from './Logo'

/** Главная в режиме беременности: неделя, триместр, дата родов */
export function PregnancyHero({ today }: { today: ISODate }) {
  const nav = useNavigate()
  const lmp = useApp((s) => s.mode.pregnancyLmp)
  const p = pregnancyInfo(lmp, today)
  return (
    <button
      onClick={() => nav('/mode')}
      className="relative mt-3 block w-full overflow-hidden rounded-[1.9rem] p-5 text-left text-white transition active:scale-[0.99]"
      style={{ background: 'linear-gradient(135deg, #f7b7d2 0%, #b59cff 55%, #7f9cf5 100%)', boxShadow: '0 18px 36px -18px #b59cff' }}
    >
      <span className="deco-bubble -right-10 -top-12 size-44" />
      <span className="absolute -bottom-10 -left-8 opacity-[0.13]">
        <LogoMark size={150} mono="#fff" />
      </span>
      {p ? (
        <div className="relative">
          <div className="text-[13px] font-medium text-white/80">Беременность · {p.trimester}-й триместр</div>
          <div className="mt-1 text-[28px] font-bold leading-tight">
            {p.week} {plural(p.week, 'неделя', 'недели', 'недель')}
            {p.day > 0 && <span className="text-[18px] font-semibold"> и {p.day} {plural(p.day, 'день', 'дня', 'дней')}</span>}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/30">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, ((p.week * 7 + p.day) / 280) * 100)}%` }} />
          </div>
          <div className="mt-2 text-[13px] text-white/90">
            Предполагаемая дата родов — {formatDay(p.due, true)}
            {p.daysLeft > 0 && ` · через ${p.daysLeft} ${plural(p.daysLeft, 'день', 'дня', 'дней')}`}
          </div>
          <div className="mt-3 text-[12px] text-white/80">Все вопросы о беременности — к врачу, который её ведёт 🤍</div>
        </div>
      ) : (
        <div className="relative py-2">
          <div className="text-[20px] font-bold">Укажи дату последних месячных</div>
          <div className="mt-1 text-[14px] text-white/85">Посчитаю срок и предполагаемую дату родов</div>
        </div>
      )}
    </button>
  )
}

/** Карточка «планирую беременность»: фертильное окно по прогнозу + отметки тестов */
export function ConceiveCard({ model, today }: { model: CycleModel; today: ISODate }) {
  const nav = useNavigate()
  const dayLog = useApp((s) => s.dayLog)
  const st = model.status(today)
  const ov = model.nextOvulation
  const fertileNow = st?.mark === 'fertile' || st?.mark === 'ovulation'
  const lhPos = Object.entries(dayLog).filter(([d, v]) => v.lh === 'pos' && model.lastStart && d >= model.lastStart).length
  return (
    <button onClick={() => nav('/cycle')} className="glass mt-3 block w-full rounded-card p-4 text-left shadow-card">
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <span className="size-2.5 rounded-full" style={{ background: fertileNow ? MARKS.fertile.color : 'var(--color-muted)' }} />
        {fertileNow ? (st?.mark === 'ovulation' ? 'По прогнозу — день овуляции' : 'По прогнозу — фертильные дни') : 'Вне фертильного окна по прогнозу'}
      </div>
      <div className="mt-1 text-[13px] text-muted">
        {ov && !fertileNow && <>Овуляция по прогнозу через {ov.inDays} {plural(ov.inDays, 'день', 'дня', 'дней')}. </>}
        {lhPos > 0 ? `Положительных тестов на овуляцию в этом цикле: ${lhPos}.` : 'Отмечай базальную температуру и тесты — так прогноз будет понятнее.'}
      </div>
      <div className="mt-2 text-[11px] leading-snug text-muted/80">{FORECAST_DISCLAIMER}</div>
    </button>
  )
}

/** График базальной температуры за текущий цикл */
export function BbtChart({ model, today }: { model: CycleModel; today: ISODate }) {
  const dayLog = useApp((s) => s.dayLog)
  const from = model.lastStart ?? addDays(today, -27)
  const pts = series(dayLog, 'bbt', from, today)
  const vals = pts.map((p) => p.value).filter((v): v is number => v !== null)
  if (vals.length < 2)
    return (
      <section className="glass rounded-card p-5 shadow-card">
        <h2 className="text-[16px] font-bold">Базальная температура</h2>
        <p className="mt-1 text-[13px] text-muted">Отмечай температуру утром, до подъёма с кровати, — здесь появится график за цикл.</p>
      </section>
    )
  const lo = Math.min(...vals) - 0.1
  const hi = Math.max(...vals) + 0.1
  const W = 300
  const H = 110
  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * (W - 20) + 10)
  const y = (v: number) => H - 18 - ((v - lo) / (hi - lo)) * (H - 36)
  const line = pts
    .map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(' ')
  const ovIdx = model.nextOvulation ? diffDays(model.nextOvulation.date, from) : -1
  const lh = (d: ISODate): DayExtra['lh'] => dayLog[d]?.lh
  return (
    <section className="glass rounded-card p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold">Базальная температура</h2>
        <span className="text-[12px] text-muted">с {formatDay(from)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="График базальной температуры">
        {ovIdx >= 0 && ovIdx < pts.length && <line x1={x(ovIdx)} x2={x(ovIdx)} y1={6} y2={H - 14} stroke={MARKS.ovulation.color} strokeDasharray="3 3" />}
        <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) =>
          p.value === null ? null : <circle key={p.date} cx={x(i)} cy={y(p.value)} r={lh(p.date) === 'pos' ? 4.5 : 3} fill={lh(p.date) === 'pos' ? MARKS.fertile.color : 'var(--color-accent)'} stroke="#fff" strokeWidth="1.5" />,
        )}
        <text x={4} y={12} fontSize="10" fill="var(--color-muted)">
          {hi.toFixed(1)}°
        </text>
        <text x={4} y={H - 4} fontSize="10" fill="var(--color-muted)">
          {lo.toFixed(1)}°
        </text>
      </svg>
      <p className="mt-2 text-[12px] text-muted">Крупные зелёные точки — положительный тест на овуляцию, пунктир — овуляция по прогнозу.</p>
    </section>
  )
}
