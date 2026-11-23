import { useNavigate } from 'react-router'
import { ChevronRight, FlaskConical, Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { itemName, latestValues, LAB_DISCLAIMER, seriesFor } from '../lib/labs'
import { formatDay } from '../lib/date'
import { Button, Card, GlassIcon, SectionTitle } from '../ui/kit'
import { Sparkline } from '../ui/Sparkline'

// Дневник анализов: мои показатели (последние значения и динамика) и история записей.

export function Labs() {
  const nav = useNavigate()
  const labs = useApp((s) => s.labs)
  const values = latestValues(labs)
  const sorted = [...labs].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="pt-safe px-4">
      <header className="flex items-center justify-between pb-1 pt-4">
        <h1 className="text-[26px] font-bold">Анализы</h1>
        <button aria-label="Добавить анализ" onClick={() => nav('/labs/new')} className="grid size-11 place-items-center rounded-full bg-brand text-white shadow-btn">
          <Plus size={20} />
        </button>
      </header>
      <p className="text-[13px] text-muted">Дневник твоих результатов и их динамика</p>

      {labs.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <GlassIcon icon={FlaskConical} tone="violet" size={64} />
          <h2 className="mt-4 text-[20px] font-bold">Здесь будут твои анализы</h2>
          <p className="mx-auto mt-2 max-w-[18rem] text-[14px] text-muted">Сохраняй результаты из бланков — будет видно, как меняются показатели со временем.</p>
          <Button className="mt-6" onClick={() => nav('/labs/new')}>
            Добавить анализ
          </Button>
        </div>
      ) : (
        <>
          <SectionTitle>Мои показатели</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {values.map((v) => {
              const s = seriesFor(labs, v.key)
              return (
                <Card key={v.key} onClick={() => nav(`/labs/${v.recordId}`)} className="p-3.5!">
                  <div className="truncate text-[13px] font-semibold">{itemName(v.item)}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-[22px] font-bold">{v.item.value}</span>
                    <span className="text-[11px] text-muted">{v.item.unit}</span>
                  </div>
                  {s.length >= 2 ? <Sparkline points={s.map((p) => p.value)} height={32} className="my-1" /> : <div className="h-[36px]" />}
                  <div className="text-[11px] text-muted">{formatDay(v.date)}</div>
                </Card>
              )
            })}
          </div>

          <SectionTitle>История</SectionTitle>
          <div className="space-y-2.5">
            {sorted.map((l) => (
              <Card key={l.id} onClick={() => nav(`/labs/${l.id}`)} className="flex items-center gap-3">
                <GlassIcon icon={FlaskConical} tone="violet" size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{formatDay(l.date, true)}</div>
                  <div className="truncate text-[12px] text-muted">{[l.lab, l.items.map(itemName).join(', ')].filter(Boolean).join(' · ')}</div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            ))}
          </div>
          <p className="mt-5 px-2 text-center text-[11px] leading-snug text-muted">{LAB_DISCLAIMER}</p>
        </>
      )}
    </div>
  )
}
