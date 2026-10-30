import { useState } from 'react'
import { useApp } from '../store/app'
import { VERDICT_STYLE } from '../lib/triage'
import { relativeTime } from '../lib/date'
import { Card, PageHeader } from '../ui/kit'

export function History() {
  const chats = useApp((s) => s.chats)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <PageHeader title="История диалогов" />
      <div className="space-y-3 px-4 pb-6">
        {chats.length === 0 && <p className="py-16 text-center text-[14px] text-muted">Здесь появятся твои разговоры с AI-ассистентом</p>}
        {chats.map((c) => {
          const first = c.messages.find((m) => m.role === 'user')
          const verdicts = c.messages.filter((m) => m.verdict).map((m) => m.verdict!)
          const expanded = open === c.id
          return (
            <Card key={c.id} onClick={() => setOpen(expanded ? null : c.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15px] font-semibold">{first?.text ?? 'Диалог'}</div>
                <span className="shrink-0 text-[11px] text-muted">{relativeTime(c.startedAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {verdicts.map((v, i) => (
                  <span key={i} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: VERDICT_STYLE[v.level].bg, color: VERDICT_STYLE[v.level].fg }}>
                    {VERDICT_STYLE[v.level].label}
                  </span>
                ))}
                <span className="text-[12px] text-muted">{c.messages.length} сообщ.</span>
              </div>
              {expanded && (
                <div className="mt-3 space-y-2 border-t border-line pt-3 text-[13px]">
                  {c.messages.map((m) => (
                    <p key={m.id} className={m.role === 'user' ? 'text-right text-accent' : 'text-ink/80'}>
                      {m.verdict ? `${m.verdict.title}. ${m.verdict.plan.join('; ')}` : m.text}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
