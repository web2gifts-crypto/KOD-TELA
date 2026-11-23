import { useNavigate, useParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { ARTICLE_BY_ID, articlesFor, type Article } from '../lib/articles'
import { PHASES } from '../lib/cycle'
import { useApp } from '../store/app'
import { useCycleToday } from '../lib/useCycleToday'
import { PageHeader } from '../ui/kit'

/** Список статей: сначала для текущей фазы */
export function Articles() {
  const { info } = useCycleToday()
  const mode = useApp((s) => s.mode.kind)
  const phase = mode === 'pregnancy' ? null : (info?.phase ?? null)
  const list = articlesFor(phase, mode)
  const forPhase = phase ? list.filter((a) => a.phase === phase) : []
  const rest = list.filter((a) => !forPhase.includes(a))
  return (
    <div>
      <PageHeader title="Почитать" />
      <div className="space-y-3 px-4 pb-8">
        {forPhase.length > 0 && (
          <>
            <h2 className="px-1 text-[13px] font-semibold text-muted">Сейчас у тебя {PHASES[phase!].name.toLowerCase()}</h2>
            {forPhase.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
            <h2 className="px-1 pt-2 text-[13px] font-semibold text-muted">Ещё статьи</h2>
          </>
        )}
        {rest.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  )
}

export function ArticleCard({ a }: { a: Article }) {
  const nav = useNavigate()
  return (
    <button onClick={() => nav(`/articles/${a.id}`)} className="glass flex w-full items-center gap-3 rounded-card p-4 text-left shadow-card transition active:scale-[0.99]">
      <span className="text-[28px]">{a.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">{a.title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{a.lead}</span>
        <span className="mt-1 block text-[11px] text-muted">{a.readMin} мин чтения</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  )
}

export function ArticlePage() {
  const { id = '' } = useParams()
  const a = ARTICLE_BY_ID[id]
  if (!a) return <PageHeader title="Статья не найдена" />
  return (
    <div>
      <PageHeader title="" />
      <article className="px-5 pb-10">
        <div className="text-[40px]">{a.emoji}</div>
        <h1 className="mt-2 text-[24px] font-bold leading-tight">{a.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span>{a.readMin} мин чтения</span>
          {a.reviewed ? <span className="rounded-full bg-ok/15 px-2 py-0.5 font-semibold text-ok">✓ Проверено врачом{a.reviewer ? `: ${a.reviewer}` : ''}</span> : <span className="rounded-full bg-[#fff1d9] px-2 py-0.5 font-semibold text-[#a8740f]">Проверяется врачом</span>}
        </div>
        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink/90">
          {a.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <p className="mt-8 rounded-2xl bg-white/70 px-4 py-3 text-[12px] leading-snug text-muted">Это общая информация, а не медицинская рекомендация. С вопросами о своём здоровье обратись к врачу.</p>
      </article>
    </div>
  )
}
