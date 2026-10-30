import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useApp } from '../store/app'
import { buildRecs, CATEGORY, type RecCategory } from '../lib/insights'
import { PHASES } from '../lib/cycle'
import { useCycleToday } from '../lib/useCycleToday'
import { haptic } from '../lib/telegram'
import { Card, Chip, Disclaimer, PageHeader } from '../ui/kit'

type Filter = RecCategory | 'all' | 'fav'

export function Recommendations() {
  const { labs, favorites, toggleFavorite } = useApp()
  const { info } = useCycleToday()
  const [filter, setFilter] = useState<Filter>('all')
  const recs = buildRecs(info?.phase ?? null, labs)

  const basis = [labs.length ? 'твоих анализов' : null, info ? PHASES[info.phase].gen : null].filter(Boolean).join(' и ')
  const shown = recs.filter((r) => (filter === 'all' ? true : filter === 'fav' ? favorites.includes(r.id) : r.category === filter))

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Все' },
    ...(Object.keys(CATEGORY) as RecCategory[]).map((c) => ({ id: c, label: `${CATEGORY[c].emoji} ${CATEGORY[c].name}` })),
    { id: 'fav', label: '♥ Избранное' },
  ]

  return (
    <div>
      <PageHeader title="Рекомендации" />
      <div className="px-4 pb-6">
        <div className="rounded-2xl bg-brand-soft px-4 py-3 text-[13px] text-ink/80">
          ✨ {basis ? `На основе ${basis}` : 'Добавь анализы и отметь цикл — советы станут персональными'}
        </div>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {filters.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} className="shrink-0 px-3.5! py-2! text-[13px]!">
              {f.label}
            </Chip>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {shown.map((r) => {
            const c = CATEGORY[r.category]
            const fav = favorites.includes(r.id)
            return (
              <Card key={r.id} className="flex gap-3.5">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl text-[24px]" style={{ background: c.tint }}>
                  {c.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-muted">{c.name}</div>
                  <div className="text-[15px] font-semibold">{r.title}</div>
                  <p className="mt-1 text-[13px] leading-snug text-ink/75">{r.text}</p>
                </div>
                <button
                  aria-label={fav ? 'Убрать из избранного' : 'В избранное'}
                  onClick={() => {
                    haptic.select()
                    toggleFavorite(r.id)
                  }}
                  className="self-start p-1"
                >
                  <Heart size={20} className={fav ? 'fill-accent text-accent' : 'text-muted/60'} />
                </button>
              </Card>
            )
          })}
          {shown.length === 0 && <p className="py-10 text-center text-[14px] text-muted">{filter === 'fav' ? 'Нажми ♥ на совете, чтобы сохранить его' : 'Пока пусто'}</p>}
        </div>
        <Disclaimer className="mt-6" />
      </div>
    </div>
  )
}
