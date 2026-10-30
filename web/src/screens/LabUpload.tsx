import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Camera, FileText, Plus, Trash2 } from 'lucide-react'
import { PageHeader, Button, Card } from '../ui/kit'
import { LABS, LAB_BY_CODE } from '../lib/labs'
import { uid, useApp } from '../store/app'
import { today } from '../lib/date'
import { haptic } from '../lib/telegram'

interface Row {
  key: string
  code: string
  value: string
}

const newRow = (code = ''): Row => ({ key: uid(), code, value: '' })

export function LabUpload() {
  const nav = useNavigate()
  const addLab = useApp((s) => s.addLab)
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([newRow('hgb'), newRow('ferritin'), newRow('vitd')])

  const parsed = rows
    .map((r) => ({ code: r.code, value: Number(r.value.replace(',', '.')) }))
    .filter((r) => r.code && r.value > 0 && Number.isFinite(r.value))

  const onFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return alert('Файл больше 20 МБ')
    setPhoto(URL.createObjectURL(f))
    setManual(true)
  }

  const save = () => {
    const id = uid()
    addLab({ id, date, source: photo ? 'photo' : 'manual', items: parsed })
    haptic.success()
    nav(`/labs/${id}`, { replace: true })
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const used = new Set(rows.map((r) => r.code))

  return (
    <div>
      <PageHeader title="Загрузи анализ" />
      <div className="px-4 pb-6">
        {!manual ? (
          <>
            <div className="mt-4 text-center">
              <h2 className="text-[22px] font-bold">Фото анализа</h2>
              <p className="mt-1 text-[14px] text-muted">Сфотографируй или загрузи бланк из галереи</p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-5 flex h-64 w-full flex-col items-center justify-center rounded-card border-2 border-dashed border-accent/40 bg-brand-soft/60 transition active:scale-[0.99]"
            >
              <span className="grid size-16 place-items-center rounded-2xl bg-brand text-white shadow-btn">
                <Camera size={28} />
              </span>
              <span className="mt-4 text-[15px] font-semibold">Нажми для загрузки</span>
              <span className="mt-1 text-[12px] text-muted">JPG, PNG — до 20 МБ</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />

            <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
              <span className="h-px flex-1 bg-line" />
              или
              <span className="h-px flex-1 bg-line" />
            </div>
            <Button variant="secondary" onClick={() => setManual(true)} className="flex items-center justify-center gap-2">
              <FileText size={18} /> Ввести показатели вручную
            </Button>
            <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">Поддерживаем бланки лабораторий: Инвитро, Гемотест, KDL, CMD, Хеликс и другие</p>
          </>
        ) : (
          <>
            {photo && (
              <Card className="mt-3 flex items-center gap-3">
                <img src={photo} alt="Фото бланка" className="size-16 rounded-xl object-cover" />
                <div className="text-[13px] leading-snug text-muted">
                  Фото прикреплено. Автораспознавание бланка подключаем — пока сверь и внеси значения ниже.
                </div>
              </Card>
            )}

            <label className="mt-5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Дата сдачи</label>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-line bg-white px-4 outline-none focus:ring-2 focus:ring-accent/40" />

            <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Показатели</div>
            <div className="mt-2 space-y-2.5">
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-card">
                  <select
                    value={r.code}
                    onChange={(e) => update(r.key, { code: e.target.value })}
                    className="h-11 min-w-0 flex-1 rounded-xl bg-bg px-2 text-[14px] outline-none"
                  >
                    <option value="">Показатель…</option>
                    {LABS.map((l) => (
                      <option key={l.code} value={l.code} disabled={used.has(l.code) && l.code !== r.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    value={r.value}
                    onChange={(e) => update(r.key, { value: e.target.value.replace(/[^\d.,]/g, '') })}
                    placeholder="0"
                    className="h-11 w-20 rounded-xl bg-bg px-3 text-right text-[15px] font-semibold outline-none"
                  />
                  <span className="w-14 text-[11px] leading-tight text-muted">{LAB_BY_CODE[r.code]?.unit ?? ''}</span>
                  <button aria-label="Удалить" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="p-1.5 text-muted">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {rows.length < LABS.length && (
              <button onClick={() => setRows((rs) => [...rs, newRow()])} className="mt-3 flex items-center gap-1.5 px-1 text-[14px] font-semibold text-accent">
                <Plus size={16} /> Добавить показатель
              </button>
            )}

            <Button onClick={save} disabled={parsed.length === 0} className="mt-8">
              Расшифровать
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
