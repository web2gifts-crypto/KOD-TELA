import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { CONSENT_TEXT, CONSENT_VERSION, POLICY } from '../lib/legal'
import { bindBackButton } from '../lib/telegram'
import { PageHeader } from '../ui/kit'

function useBack() {
  const nav = useNavigate()
  useEffect(() => bindBackButton(true, () => nav(-1)), [nav])
}

/** Политика конфиденциальности — открывается и до регистрации */
export function PrivacyPolicy() {
  useBack()
  return (
    <div className="min-h-dvh pt-safe">
      <PageHeader title="Политика конфиденциальности" />
      <article className="space-y-5 px-5 pb-10 text-[14px] leading-relaxed text-ink/85">
        <p className="text-[12px] text-muted">Редакция от {CONSENT_VERSION}</p>
        {POLICY.map((s) => (
          <section key={s.title}>
            <h2 className="mb-1.5 text-[15px] font-bold text-ink">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mb-2">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  )
}

/** Текст согласия на обработку данных, в том числе о здоровье */
export function ConsentText() {
  useBack()
  return (
    <div className="min-h-dvh pt-safe">
      <PageHeader title="Согласие на обработку данных" />
      <article className="space-y-3 px-5 pb-10 text-[14px] leading-relaxed text-ink/85">
        <p className="text-[12px] text-muted">Редакция от {CONSENT_VERSION}</p>
        {CONSENT_TEXT.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
    </div>
  )
}
