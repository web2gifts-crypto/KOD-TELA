import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, CloudCheck, CloudOff, Download, FileText, ShieldCheck, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { sendFileToBot } from '../lib/api'
import { deleteAccount, exportJSON, getSyncStatus, onSyncStatus, syncEnabled, type SyncStatus } from '../lib/sync'
import { haptic } from '../lib/telegram'
import { GlassIcon, PageHeader } from '../ui/kit'

const STATUS: Record<SyncStatus, string> = {
  off: 'Данные хранятся только на этом устройстве',
  'waiting-consent': 'Ждём согласия, чтобы сохранять на сервере',
  syncing: 'Синхронизация…',
  ok: 'Сохранено на сервере в России, в зашифрованном виде',
  offline: 'Нет связи с сервером — сохраним, когда появится',
}

/** «Мои данные»: права пользователя по 152-ФЗ — посмотреть документы, скачать, отозвать согласие */
export function MyData() {
  const nav = useNavigate()
  const consent = useApp((s) => s.consent)
  const [status, setStatus] = useState(getSyncStatus())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    const off = onSyncStatus(setStatus)
    return () => void off()
  }, [])

  const download = async () => {
    haptic.tap()
    setBusy(true)
    try {
      const f = exportJSON()
      const how = await sendFileToBot({ ...f, mime: 'application/json' })
      setNote(how === 'bot' ? 'Файл отправлен в чат с ботом' : 'Файл сохранён на устройство')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Отозвать согласие и удалить все данные — на сервере и на этом устройстве? Восстановить их будет нельзя.')) return
    haptic.warn()
    setBusy(true)
    try {
      await deleteAccount()
      nav('/welcome', { replace: true })
    } catch {
      setNote('Не получилось связаться с сервером. Проверь интернет и попробуй ещё раз — без этого данные на сервере не удалятся.')
      setBusy(false)
    }
  }

  const ok = status === 'ok'
  return (
    <div>
      <PageHeader title="Мои данные" />
      <div className="space-y-3 px-4 pb-8">
        <div className="glass flex items-center gap-3 rounded-card p-4 shadow-card">
          <GlassIcon icon={ok || !syncEnabled() ? CloudCheck : CloudOff} tone={ok ? 'mint' : 'violet'} size={40} />
          <div className="text-[14px] leading-snug">{STATUS[status]}</div>
        </div>

        <div className="glass overflow-hidden rounded-card shadow-card">
          <Row icon={ShieldCheck} label="Политика конфиденциальности" onClick={() => nav('/privacy')} />
          <Row icon={FileText} label="Согласие на обработку данных" onClick={() => nav('/consent-text')} border />
        </div>
        {consent && (
          <p className="px-2 text-[12px] text-muted">
            Согласие дано {new Date(consent.at).toLocaleDateString('ru')} (редакция {consent.version})
          </p>
        )}

        <button disabled={busy} onClick={download} className="glass flex w-full items-center justify-center gap-2 rounded-card py-3.5 text-[14px] font-semibold text-accent shadow-card disabled:opacity-50">
          <Download size={17} /> Скачать мои данные
        </button>
        <button disabled={busy} onClick={remove} className="glass flex w-full items-center justify-center gap-2 rounded-card py-3.5 text-[14px] font-medium text-bad shadow-card disabled:opacity-50">
          <Trash2 size={17} /> Отозвать согласие и удалить данные
        </button>
        {note && <p className="px-2 text-center text-[13px] text-muted">{note}</p>}
      </div>
    </div>
  )
}

function Row({ icon, label, onClick, border }: { icon: typeof ShieldCheck; label: string; onClick: () => void; border?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3.5 px-4 py-3 text-left transition active:bg-white/60 ${border ? 'border-t border-line' : ''}`}>
      <GlassIcon icon={icon} tone="violet" size={36} />
      <span className="flex-1 text-[15px]">{label}</span>
      <ChevronRight size={18} className="text-muted" />
    </button>
  )
}
