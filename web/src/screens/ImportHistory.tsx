import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FileUp, Plus, X } from 'lucide-react'
import { useApp } from '../store/app'
import { fromStarts, mergeImported, parseImport } from '../lib/importHistory'
import { periodRuns } from '../lib/cycle'
import { formatDay, today as todayISO, type ISODate } from '../lib/date'
import { haptic } from '../lib/telegram'
import { Button, PageHeader } from '../ui/kit'

/** Перенос истории месячных: файл экспорта Flo / Clue / CSV или даты вручную */
export function ImportHistory() {
  const nav = useNavigate()
  const { periodDays, mergePeriodDays, cycle } = useApp()
  const today = todayISO()
  const file = useRef<HTMLInputElement>(null)
  const [found, setFound] = useState<Record<ISODate, number> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [starts, setStarts] = useState<ISODate[]>([])
  const [date, setDate] = useState('')

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    if (f.size > 20_000_000) return setErr('Файл слишком большой (больше 20 МБ)')
    const r = parseImport(f.name, await f.text())
    const days = mergeImported({}, r.days, today)
    if (!Object.keys(days).length) return setErr('Не нашли в файле дат месячных. Попробуй другой файл или введи даты вручную ниже.')
    setFound(days)
  }

  const candidate = found ?? (starts.length ? fromStarts(starts, cycle.periodLength) : null)
  const added = candidate ? mergeImported(periodDays, candidate, today) : null
  const newDays = added ? Object.keys(added).length - Object.keys(periodDays).length : 0
  const runs = candidate ? periodRuns(candidate) : []

  const save = () => {
    if (!candidate) return
    haptic.success()
    mergePeriodDays(mergeImported({}, candidate, today))
    nav('/cycle', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Перенести историю" />
      <div className="space-y-4 px-4 pb-8">
        <p className="px-1 text-[14px] leading-snug text-ink/80">Чем больше прошлых циклов, тем точнее прогноз. Перенеси историю из другого приложения или введи даты сама.</p>

        <section className="glass rounded-card p-4 shadow-card">
          <h2 className="text-[16px] font-bold">Из файла</h2>
          <ul className="mt-2 space-y-1 text-[13px] leading-snug text-muted">
            <li>
              <b className="text-ink/80">Clue:</b> Профиль → Настройки → Экспорт данных
            </li>
            <li>
              <b className="text-ink/80">Flo:</b> запроси копию своих данных в поддержке Flo
            </li>
            <li>
              <b className="text-ink/80">Другое:</b> CSV-файл с датами месячных
            </li>
          </ul>
          <input ref={file} type="file" accept=".json,.cluedata,.csv,.txt,application/json,text/csv,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="secondary" className="mt-3 flex items-center justify-center gap-2" onClick={() => file.current?.click()}>
            <FileUp size={18} /> Выбрать файл
          </Button>
          {err && <p className="mt-2 text-[13px] text-bad">{err}</p>}
        </section>

        <section className="glass rounded-card p-4 shadow-card">
          <h2 className="text-[16px] font-bold">Вручную</h2>
          <p className="mt-1 text-[13px] text-muted">Даты начала прошлых месячных — каждые добавятся на {cycle.periodLength} дн.</p>
          <div className="mt-3 flex gap-2">
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 text-[15px] outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              aria-label="Добавить дату"
              disabled={!date || starts.includes(date)}
              onClick={() => {
                setFound(null)
                setStarts([...starts, date].sort())
                setDate('')
              }}
              className="grid size-11 place-items-center rounded-full bg-brand text-white disabled:opacity-40"
            >
              <Plus size={20} />
            </button>
          </div>
          {starts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {starts.map((d) => (
                <span key={d} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] shadow-sm">
                  {formatDay(d, true)}
                  <button aria-label={`Убрать ${formatDay(d)}`} onClick={() => setStarts(starts.filter((x) => x !== d))} className="text-muted">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {candidate && (
          <section className="rounded-card bg-white/80 p-4 shadow-card">
            <div className="text-[15px] font-semibold">
              Найдено: {runs.length} {runs.length === 1 ? 'месячные' : 'месячных'}
              {runs.length > 0 && ` с ${formatDay(runs[0][0], true)} по ${formatDay(runs[runs.length - 1][0], true)}`}
            </div>
            <div className="mt-1 text-[13px] text-muted">{newDays > 0 ? `Добавится новых дней: ${newDays}. Твои отметки не изменятся.` : 'Все эти дни уже есть в календаре.'}</div>
            <Button className="mt-3" disabled={newDays <= 0} onClick={save}>
              Добавить в календарь
            </Button>
          </section>
        )}
        <p className="px-2 text-center text-[11px] text-muted">Файл обрабатывается прямо на телефоне — на сервер попадают только найденные даты.</p>
      </div>
    </div>
  )
}
