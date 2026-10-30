import { useNavigate } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { evaluate, LAB_BY_CODE, STATUS_COLOR } from '../lib/labs'
import { formatDay, plural } from '../lib/date'
import { Button, Card, SectionTitle } from '../ui/kit'

export function Labs() {
  const nav = useNavigate()
  const labs = useApp((s) => s.labs)

  // динамика: показатели, сданные 2+ раз
  const series = new Map<string, { date: string; value: number }[]>()
  for (const l of [...labs].sort((a, b) => (a.date < b.date ? -1 : 1)))
    for (const it of l.items) series.set(it.code, [...(series.get(it.code) ?? []), { date: l.date, value: it.value }])
  const trends = [...series.entries()].filter(([, s]) => s.length > 1)

  return (
    <div className="pt-safe px-4">
      <div className="flex h-14 items-center justify-between">
        <h1 className="font-display text-[22px] font-bold">Анализы</h1>
        <button aria-label="Добавить анализ" onClick={() => nav('/labs/new')} className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-btn">
          <Plus size={20} />
        </button>
      </div>

      {labs.length === 0 ? (
        <div className="mt-10 text-center">
          <div className="text-[48px]">🔬</div>
          <h2 className="mt-3 font-display text-[20px] font-bold">Здесь будут твои анализы</h2>
          <p className="mx-auto mt-2 max-w-[18rem] text-[14px] text-muted">Загрузи первый — объясню каждый показатель простыми словами и покажу динамику</p>
          <Button className="mt-6" onClick={() => nav('/labs/new')}>
            Загрузить анализ
          </Button>
        </div>
      ) : (
        <>
          {trends.length > 0 && (
            <>
              <SectionTitle>Динамика</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                {trends.map(([code, s]) => (
                  <Card key={code} className="p-3!">
                    <div className="text-[13px] font-semibold">{LAB_BY_CODE[code]?.name}</div>
                    <Sparkline points={s.map((p) => p.value)} min={LAB_BY_CODE[code]?.min} max={LAB_BY_CODE[code]?.max} />
                    <div className="text-[11px] text-muted">
                      {s[0].value} → <b className="text-ink">{s[s.length - 1].value}</b> {LAB_BY_CODE[code]?.unit}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <SectionTitle>История</SectionTitle>
          <div className="space-y-2.5">
            {labs.map((l) => {
              const evals = l.items.map((i) => evaluate(i.code, i.value)).filter((e) => e !== null)
              const bad = evals.filter((e) => e.status !== 'ok').length
              return (
                <Card key={l.id} onClick={() => nav(`/labs/${l.id}`)} className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-[20px]">{l.source === 'photo' ? '📷' : '📝'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{formatDay(l.date, true)}</div>
                    <div className="truncate text-[12px] text-muted">{evals.map((e) => e.def.name).join(', ')}</div>
                  </div>
                  <div className="flex gap-1">
                    {evals.map((e) => (
                      <span key={e.def.code} className="size-2 rounded-full" style={{ background: STATUS_COLOR[e.status] }} />
                    ))}
                  </div>
                  {bad > 0 && <span className="text-[12px] font-semibold text-bad">{bad} {plural(bad, 'отклонение', 'отклонения', 'отклонений')}</span>}
                  <ChevronRight size={18} className="text-muted" />
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Sparkline({ points, min, max }: { points: number[]; min?: number; max?: number }) {
  const w = 120
  const h = 40
  const lo = Math.min(...points, min ?? Infinity)
  const hi = Math.max(...points, max ?? -Infinity)
  const y = (v: number) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8)
  const x = (i: number) => (i / (points.length - 1)) * (w - 8) + 4
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="my-1.5 h-10 w-full" preserveAspectRatio="none">
      {min !== undefined && max !== undefined && <rect x="0" y={y(max)} width={w} height={Math.max(1, y(min) - y(max))} fill="var(--color-ok)" opacity=".1" />}
      <polyline points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--color-rose)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
