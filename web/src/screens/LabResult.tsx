import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { ChevronDown, Info, Pencil, Stethoscope, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { formatRef, itemKey, itemName, LAB_BY_CODE, LAB_DISCLAIMER, seriesFor, type LabItem } from '../lib/labs'
import { formatDay } from '../lib/date'
import { haptic } from '../lib/telegram'
import { Card, PageHeader } from '../ui/kit'
import { Sparkline } from '../ui/Sparkline'

// Запись дневника анализов. Только данные человека, динамика и справка — без оценок.

export function LabResult() {
  const { id } = useParams()
  const nav = useNavigate()
  const { labs, removeLab } = useApp()
  const rec = labs.find((l) => l.id === id)
  if (!rec) return <Navigate to="/labs" replace />

  const remove = () => {
    if (!window.confirm('Удалить эту запись из дневника анализов?')) return
    removeLab(rec.id)
    haptic.warn()
    nav('/labs', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Анализ" />
      <div className="px-4 pb-6">
        <div className="flex items-baseline justify-between px-1">
          <p className="text-[15px] font-semibold">{formatDay(rec.date, true)}</p>
          {rec.lab && <p className="text-[13px] text-muted">{rec.lab}</p>}
        </div>

        <div className="mt-3 space-y-3">
          {rec.items.map((it) => (
            <LabCard key={itemKey(it)} item={it} series={seriesFor(labs, itemKey(it))} date={rec.date} />
          ))}
        </div>

        <Card className="mt-4 flex gap-3">
          <Stethoscope className="mt-0.5 shrink-0 text-accent" size={20} />
          <p className="text-[13px] leading-snug text-ink/75">{LAB_DISCLAIMER}</p>
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => nav(`/labs/${rec.id}/edit`)} className="glass flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-accent shadow-card">
            <Pencil size={16} /> Изменить
          </button>
          <button onClick={remove} className="glass flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-bad shadow-card">
            <Trash2 size={16} /> Удалить
          </button>
        </div>
      </div>
    </div>
  )
}

function LabCard({ item, series, date }: { item: LabItem; series: { date: string; value: number }[]; date: string }) {
  const [open, setOpen] = useState(false)
  const ref = formatRef(item)
  const about = LAB_BY_CODE[item.code]?.about
  const idx = series.findIndex((p) => p.date === date)
  const prev = idx > 0 ? series[idx - 1] : null

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[16px] font-semibold">{itemName(item)}</div>
          <div className="mt-0.5 text-[12px] text-muted">{ref ? `Интервал из бланка: ${ref} ${item.unit}` : 'Интервал из бланка не указан'}</div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[26px] font-bold text-ink">{item.value}</span> <span className="text-[12px] text-muted">{item.unit}</span>
          {prev && (
            <div className="text-[11px] text-muted">
              раньше {prev.value} · {formatDay(prev.date)}
            </div>
          )}
        </div>
      </div>

      {series.length >= 2 && (
        <div className="mt-3">
          <Sparkline points={series.map((p) => p.value)} />
          <div className="flex justify-between text-[10px] text-muted">
            <span>{formatDay(series[0].date)}</span>
            <span>{formatDay(series[series.length - 1].date)}</span>
          </div>
        </div>
      )}

      {about && (
        <>
          <button onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-accent" aria-expanded={open}>
            <Info size={15} /> Что это за показатель
            <ChevronDown size={15} className={`transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <p className="mt-1.5 rounded-xl bg-accent-soft/60 px-3 py-2.5 text-[13px] leading-snug text-ink/80">{about}</p>}
        </>
      )}
    </Card>
  )
}
