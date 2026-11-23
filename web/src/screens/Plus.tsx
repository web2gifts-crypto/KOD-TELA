import { useCallback, useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { cancelSubscription, createInvoice, getBilling, type BillingInfo, type Plan } from '../lib/billing'
import { syncEnabled } from '../lib/sync'
import { haptic, openInvoice } from '../lib/telegram'
import { Button, PageHeader } from '../ui/kit'
import { Yuvi } from '../ui/Yuvi'
import { PLUS_TERMS } from '../lib/legal'

/** «Код Тела+»: что даёт, оплата звёздами Telegram, управление подпиской */
export function Plus() {
  const [b, setB] = useState<BillingInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const online = syncEnabled()

  const load = useCallback(() => {
    if (online) getBilling().then(setB).catch(() => setNote('Не получилось загрузить. Проверь интернет.'))
  }, [online])
  useEffect(load, [load])

  const buy = async (plan: Plan) => {
    haptic.tap()
    setBusy(true)
    setNote(null)
    try {
      const { link } = await createInvoice(plan.id)
      const st = await openInvoice(link)
      if (st === 'paid') {
        haptic.success()
        setNote('Спасибо! Подписка активируется через несколько секунд.')
        window.setTimeout(load, 2500)
      } else if (st === 'failed') setNote('Оплата не прошла. Попробуй ещё раз.')
    } catch {
      setNote('Не получилось открыть оплату. Попробуй позже.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Отменить автопродление? Код Тела+ останется до конца оплаченного периода.')) return
    setBusy(true)
    try {
      await cancelSubscription()
      load()
    } finally {
      setBusy(false)
    }
  }

  const until = b?.until ? new Date(b.until).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <div>
      <PageHeader title="Код Тела+" />
      <div className="space-y-3 px-4 pb-8">
        <div className="relative overflow-hidden rounded-card p-5 text-white shadow-card" style={{ background: 'linear-gradient(135deg, #f59ccc 0%, #a98cff 50%, #5d86f8 100%)' }}>
          <div className="flex items-center gap-3">
            <Yuvi mood="great" size={64} companion={false} />
            <div>
              <div className="flex items-center gap-1.5 text-[20px] font-bold">
                <Sparkles size={18} /> Код Тела+
              </div>
              <div className="text-[13px] text-white/90">{b?.plan === 'plus' ? `Активен до ${until}` : 'Больше возможностей для заботы о себе'}</div>
            </div>
          </div>
        </div>

        {!online && <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13px] text-muted">Оформить подписку можно, когда приложение открыто в Telegram.</p>}

        {b && (
          <ul className="glass space-y-2.5 rounded-card p-4 shadow-card">
            {b.features.map((f) => (
              <li key={f} className="flex gap-2.5 text-[14px] leading-snug">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        )}

        {b?.plan === 'free' &&
          b.plans.map((p) => (
            <Button key={p.id} disabled={busy} variant={p.recurring ? 'primary' : 'secondary'} onClick={() => void buy(p)}>
              {p.recurring ? `${p.stars} ⭐ в месяц` : `${p.stars} ⭐ на год`}
              {!p.recurring && <span className="ml-1.5 text-[12px] opacity-75">выгоднее на {Math.round((1 - p.stars / (b.plans[0].stars * 12)) * 100)}%</span>}
            </Button>
          ))}

        {b?.plan === 'plus' && (
          <div className="glass rounded-card p-4 text-[14px] shadow-card">
            {b.recurring && !b.canceled ? (
              <>
                <div>Продлится автоматически {until}.</div>
                <button disabled={busy} onClick={() => void cancel()} className="mt-2 text-[13px] font-semibold text-muted underline">
                  Отменить автопродление
                </button>
              </>
            ) : (
              <div>Действует до {until}. Автопродления нет.</div>
            )}
          </div>
        )}

        {note && <p className="px-2 text-center text-[13px] text-muted">{note}</p>}
        <details className="px-2 text-[12px] text-muted">
          <summary className="cursor-pointer text-center font-semibold">Условия подписки</summary>
          <div className="mt-2 space-y-1.5 leading-snug">
            {PLUS_TERMS.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </details>
        <p className="px-2 text-center text-[11px] leading-snug text-muted">
          Оплата — звёздами Telegram. Месячная подписка продлевается автоматически, отменить можно здесь или в настройках Telegram. Календарь, напоминания, дневник и другие основные функции остаются бесплатными.
        </p>
      </div>
    </div>
  )
}
