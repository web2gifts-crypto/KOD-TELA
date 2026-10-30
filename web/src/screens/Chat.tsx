import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Camera, ChevronLeft, SendHorizontal } from 'lucide-react'
import { uid, useApp, type ChatMessage, type ChatSession, type Verdict } from '../store/app'
import { buildVerdict, emergencyVerdict, isEmergency, QUESTIONS, VERDICT_STYLE, type Answers } from '../lib/triage'
import { PHASES } from '../lib/cycle'
import { useCycleToday } from '../lib/useCycleToday'
import { haptic, inTelegram } from '../lib/telegram'
import { LogoMark } from '../ui/Logo'
import { Disclaimer, IconButton } from '../ui/kit'

const STARTERS = ['Болит живот', 'Нерегулярный цикл', 'Усталость', 'Высыпания на коже']
const GREETING = 'Привет! Я твой AI-помощник. Опиши симптом или загрузи анализ — объясню всё просто 💜'

type Stage = { kind: 'symptom' } | { kind: 'question'; index: number; symptom: string; answers: Answers } | { kind: 'done' }

const msg = (role: ChatMessage['role'], text: string, verdict?: Verdict): ChatMessage => ({ id: uid(), role, text, ts: Date.now(), verdict })

export function Chat() {
  const nav = useNavigate()
  const saveChat = useApp((s) => s.saveChat)
  const { info } = useCycleToday()
  const [session, setSession] = useState<ChatSession>(() => ({ id: uid(), startedAt: Date.now(), messages: [msg('assistant', GREETING)] }))
  const [stage, setStage] = useState<Stage>({ kind: 'symptom' })
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    // пустые сессии (только приветствие) не сохраняем
    if (session.messages.length > 1) saveChat(session)
  }, [session, typing, saveChat])

  const push = (...m: ChatMessage[]) => setSession((s) => ({ ...s, messages: [...s.messages, ...m] }))

  const reply = (m: ChatMessage, then?: () => void) => {
    setTyping(true)
    window.setTimeout(() => {
      setTyping(false)
      push(m)
      then?.()
    }, 750)
  }

  const send = (text: string) => {
    const t = text.trim()
    if (!t || typing) return
    haptic.tap()
    setInput('')
    push(msg('user', t))

    if (isEmergency(t)) {
      setSession((s) => ({ ...s, flagged: true }))
      haptic.warn()
      reply(msg('assistant', 'Это важно — не откладывай.', emergencyVerdict(t)), () => setStage({ kind: 'done' }))
      return
    }

    if (stage.kind === 'question') {
      const q = QUESTIONS[stage.index]
      const answers = { ...stage.answers, [q.id]: t }
      const nextIndex = stage.index + 1
      if (nextIndex < QUESTIONS.length) {
        setStage({ ...stage, index: nextIndex, answers })
        reply(msg('assistant', QUESTIONS[nextIndex].text))
      } else {
        setStage({ kind: 'done' })
        const v = buildVerdict(stage.symptom, answers, info?.phase ?? null)
        reply(msg('assistant', 'Спасибо, картина ясна. Вот что я думаю:', v), () => (v.level === 'norm' ? haptic.success() : haptic.warn()))
      }
      return
    }

    // новый симптом
    const ctx = info ? `Вижу, у тебя ${info.day} день цикла — ${PHASES[info.phase].name.toLowerCase()}. ` : ''
    setStage({ kind: 'question', index: 0, symptom: t, answers: {} })
    reply(msg('assistant', `Понимаю, это неприятно. ${ctx}Задам пару уточняющих вопросов.\n\n${QUESTIONS[0].text}`))
  }

  const quick = stage.kind === 'question' ? QUESTIONS[stage.index].options : stage.kind === 'done' ? ['Другой симптом', ...STARTERS.slice(0, 2)] : STARTERS

  const onQuick = (q: string) => {
    if (q === 'Другой симптом') {
      push(msg('user', q))
      setStage({ kind: 'symptom' })
      reply(msg('assistant', 'Конечно. Опиши, что беспокоит?'))
      return
    }
    if (stage.kind === 'done') setStage({ kind: 'symptom' })
    send(q)
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="pt-safe border-b border-line bg-white/85 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4">
          {!inTelegram && (
            <IconButton label="Назад" onClick={() => nav(-1)}>
              <ChevronLeft size={20} />
            </IconButton>
          )}
          <div className="grid size-10 place-items-center rounded-full bg-brand-soft">
            <LogoMark size={26} />
          </div>
          <div>
            <div className="font-display text-[16px] font-bold">AI-ассистент</div>
            <div className="text-[12px] text-ok">● онлайн</div>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {session.messages.map((m) => (
          <Bubble key={m.id} m={m} onLab={() => nav('/labs/new')} />
        ))}
        {typing && (
          <div className="flex w-fit gap-1 rounded-3xl rounded-bl-md bg-white px-4 py-3.5 shadow-card">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-rose" style={{ animation: `typing 1.2s ${i * 0.15}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="pb-safe border-t border-line bg-white/90 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
          {quick.map((q) => (
            <button key={q} disabled={typing} onClick={() => onQuick(q)} className="shrink-0 rounded-full border border-rose/30 bg-white px-3.5 py-2 text-[13px] text-rose transition active:scale-95 disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <button type="button" aria-label="Загрузить анализ" onClick={() => nav('/labs/new')} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-rose">
            <Camera size={20} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={stage.kind === 'question' ? 'Или ответь своими словами…' : 'Опиши свой симптом…'}
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[15px] outline-none focus:ring-2 focus:ring-rose/40"
          />
          <button type="submit" aria-label="Отправить" disabled={!input.trim() || typing} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-btn disabled:opacity-40">
            <SendHorizontal size={19} />
          </button>
        </form>
        <Disclaimer className="pb-2" />
      </div>
    </div>
  )
}

function Bubble({ m, onLab }: { m: ChatMessage; onLab: () => void }) {
  const time = new Date(m.ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  if (m.role === 'user') {
    return (
      <div className="ml-auto max-w-[80%]">
        <div className="whitespace-pre-line rounded-3xl rounded-br-md bg-brand px-4 py-3 text-[15px] leading-snug text-white shadow-btn">{m.text}</div>
        <div className="mt-1 text-right text-[11px] text-muted">{time}</div>
      </div>
    )
  }
  return (
    <div className="max-w-[88%]">
      <div className="whitespace-pre-line rounded-3xl rounded-bl-md bg-white px-4 py-3 text-[15px] leading-snug shadow-card">
        {m.text}
        {m.verdict && <VerdictCard v={m.verdict} onLab={onLab} />}
      </div>
      <div className="mt-1 text-[11px] text-muted">{time}</div>
    </div>
  )
}

function VerdictCard({ v, onLab }: { v: Verdict; onLab: () => void }) {
  const st = VERDICT_STYLE[v.level]
  return (
    <div className="mt-3 border-t border-line pt-3">
      <span className="inline-block rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: st.bg, color: st.fg }}>
        {st.label}
      </span>
      <div className="mt-2 font-semibold">{v.title}</div>
      <p className="mt-1 text-[14px] text-ink/80">{v.explanation}</p>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wider text-muted">План действий</div>
      <ol className="mt-1.5 space-y-1.5">
        {v.plan.map((p, i) => (
          <li key={i} className="flex gap-2 text-[14px]">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-rose">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
      {/анализ|сдай/i.test(v.plan.join(' ')) && v.level !== 'emergency' && (
        <button onClick={onLab} className="mt-3 text-[13px] font-semibold text-rose">
          Загрузить анализ →
        </button>
      )}
      <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-[12px] text-muted">⚕️ Это не диагноз и не заменяет консультацию врача.</p>
    </div>
  )
}
