import { Navigate, useNavigate, useParams } from 'react-router'
import { useApp } from '../store/app'
import { evaluate, STATUS_COLOR, type LabEval } from '../lib/labs'
import { formatDay, plural } from '../lib/date'
import { Button, Card, Disclaimer, PageHeader } from '../ui/kit'

export function LabResult() {
  const { id } = useParams()
  const nav = useNavigate()
  const labs = useApp((s) => s.labs)
  const rec = labs.find((l) => l.id === id)
  if (!rec) return <Navigate to="/labs" replace />

  const evals = rec.items.map((it) => evaluate(it.code, it.value)).filter((e): e is LabEval => e !== null)
  // предыдущее значение того же показателя — для динамики
  const prev = (code: string) => labs.filter((l) => l.date < rec.date).flatMap((l) => l.items.filter((i) => i.code === code))[0]?.value
  const attention = evals.filter((e) => e.status !== 'ok').length

  return (
    <div>
      <PageHeader title="Результаты анализа" />
      <div className="px-4 pb-6">
        <p className="mb-3 px-1 text-[13px] text-muted">Сдан {formatDay(rec.date, true)}</p>
        {attention > 0 ? (
          <div className="rounded-2xl border border-bad/25 bg-[#fdeeee] px-4 py-3 text-[14px] font-medium text-bad">
            🔴 {attention} {plural(attention, 'показатель требует', 'показателя требуют', 'показателей требуют')} внимания
          </div>
        ) : (
          <div className="rounded-2xl border border-ok/25 bg-[#e8f6ef] px-4 py-3 text-[14px] font-medium text-ok">✅ Все показатели в норме</div>
        )}

        <div className="mt-4 space-y-3">
          {evals
            .sort((a, b) => rank(b) - rank(a))
            .map((e) => (
              <LabCard key={e.def.code} e={e} prev={prev(e.def.code)} />
            ))}
        </div>

        <Button className="mt-6" onClick={() => nav('/recommendations')}>
          Смотреть рекомендации
        </Button>
        <Button variant="ghost" className="mt-1" onClick={() => nav('/chat')}>
          Задать вопрос AI
        </Button>
        <Disclaimer />
      </div>
    </div>
  )
}

const rank = (e: LabEval) => ({ ok: 0, warn: 1, bad: 2 })[e.status]

function LabCard({ e, prev }: { e: LabEval; prev?: number }) {
  const color = STATUS_COLOR[e.status]
  const icon = { ok: '✅', warn: '⚠️', bad: '🔴' }[e.status]
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold">{e.def.name}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            Норма: {e.def.min}–{e.def.max} {e.def.unit}
          </div>
        </div>
        <div className="text-right">
          <span className="font-display text-[26px] font-bold" style={{ color }}>
            {e.value}
          </span>{' '}
          <span className="text-[12px] text-muted">{e.def.unit}</span>
          {prev !== undefined && (
            <div className="text-[11px] text-muted">
              было {prev} {prev < e.value ? '↗' : prev > e.value ? '↘' : '→'}
            </div>
          )}
        </div>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-line">
        {/* зона нормы */}
        <div className="absolute inset-y-0 rounded-full bg-ok/20" style={{ left: `${(0.25 / 1.5) * 100}%`, width: `${(1 / 1.5) * 100}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${e.position * 100}%`, background: color }} />
      </div>
      <p className="mt-3 text-[14px]">
        {icon} {e.note}
      </p>
      <div className="mt-2 flex gap-2 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: `color-mix(in srgb, ${color} 10%, white)` }}>
        💡 <span>{e.advice}</span>
      </div>
    </Card>
  )
}
