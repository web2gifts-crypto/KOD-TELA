import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Link2, Trash2, UserPlus } from 'lucide-react'
import { listPartners, revokePartner, rotateLink, updateScope, type PartnerGrant, type PartnerScope } from '../lib/partner'
import { syncEnabled } from '../lib/sync'
import { haptic, openTelegramLink } from '../lib/telegram'
import { relativeTime } from '../lib/date'
import { Button, PageHeader, Toggle } from '../ui/kit'
import { Yuvi } from '../ui/Yuvi'

const BOT = 'kodtela_app'

const SCOPE: { k: keyof PartnerScope; title: string; hint: string }[] = [
  { k: 'cycle', title: 'Фаза и прогноз', hint: 'день цикла, фаза, когда ждать месячные' },
  { k: 'fertile', title: 'Фертильные дни', hint: 'по прогнозу календаря' },
  { k: 'mood', title: 'Настроение', hint: 'только сегодняшняя отметка, без заметок' },
]

/** Владелец: кому дан доступ, что видно, пригласить / отозвать */
export function Partner() {
  const nav = useNavigate()
  const [list, setList] = useState<PartnerGrant[] | null>(null)
  const [max, setMax] = useState(3)
  const [error, setError] = useState(false)
  const online = syncEnabled()

  const load = useCallback(() => {
    if (!online) return
    listPartners()
      .then((r) => {
        setList(r.partners)
        setMax(r.max)
        setError(false)
      })
      .catch(() => setError(true))
  }, [online])

  useEffect(() => {
    load()
    // вернулись из чата с ботом — обновить список
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const invite = () => {
    haptic.tap()
    openTelegramLink(`https://t.me/${BOT}?start=partner`)
  }

  return (
    <div>
      <PageHeader title="Партнёр" />
      <div className="space-y-3 px-4 pb-8">
        <div className="glass flex items-center gap-3 rounded-card p-4 shadow-card">
          <Yuvi mood="good" size={64} companion={false} />
          <p className="text-[14px] leading-snug text-ink/85">
            Дай близкому человеку посмотреть фазу цикла и прогноз — без подробностей. Ссылка откроется <b>только у того, кого выберешь</b>.
          </p>
        </div>

        {!online && <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13px] text-muted">Доступно, когда приложение открыто в Telegram.</p>}
        {error && <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13px] text-muted">Не получилось загрузить. Проверь интернет.</p>}

        {list?.map((g) => <GrantCard key={g.id} g={g} onChange={load} />)}

        {online && (!list || list.length < max) && (
          <Button onClick={invite} className="flex items-center justify-center gap-2">
            <UserPlus size={18} /> Пригласить партнёра
          </Button>
        )}
        {online && <p className="px-2 text-center text-[12px] text-muted">Откроется чат с ботом — выбери контакт, и бот пришлёт ссылку для него.</p>}
        {online && list && list.length >= max && (
          <button onClick={() => nav('/plus')} className="w-full text-center text-[13px] font-semibold text-accent">
            Больше партнёров — в Код Тела+ →
          </button>
        )}
      </div>
    </div>
  )
}

function GrantCard({ g, onChange }: { g: PartnerGrant; onChange: () => void }) {
  const [scope, setScope] = useState(g.scope)
  const [busy, setBusy] = useState(false)

  const toggle = (k: keyof PartnerScope, v: boolean) => {
    const next = { ...scope, [k]: v }
    setScope(next)
    void updateScope(g.id, next).catch(() => setScope(scope))
  }
  const share = async () => {
    setBusy(true)
    try {
      const { link } = await rotateLink(g.id)
      openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Ссылка на мой «Код Тела» — откроется только у тебя')}`)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!window.confirm(`Отозвать доступ у ${g.name}? Ссылка перестанет работать.`)) return
    haptic.warn()
    await revokePartner(g.id)
    onChange()
  }

  return (
    <div className="glass rounded-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[16px] font-semibold">{g.name}</div>
          <div className="text-[12px] text-muted">{g.lastViewedAt ? `смотрел(а) ${relativeTime(Date.parse(g.lastViewedAt)).toLowerCase()}` : 'ещё не открывал(а) ссылку'}</div>
        </div>
        <button aria-label={`Отозвать доступ у ${g.name}`} onClick={() => void remove()} className="grid size-9 place-items-center rounded-full text-bad">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="mt-3 space-y-3 border-t border-line pt-3">
        {SCOPE.map((s) => (
          <div key={s.k} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[14px] font-medium">{s.title}</div>
              <div className="text-[12px] text-muted">{s.hint}</div>
            </div>
            <Toggle label={s.title} on={scope[s.k]} onChange={(v) => toggle(s.k, v)} />
          </div>
        ))}
      </div>
      <button disabled={busy} onClick={() => void share()} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-accent disabled:opacity-50">
        <Link2 size={15} /> Отправить ссылку заново
      </button>
      <p className="mt-1 text-[11px] text-muted">Старая ссылка при этом перестанет работать.</p>
    </div>
  )
}
