import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Camera, FileText, Plus, Trash2 } from 'lucide-react'
import { PageHeader, Button, Card } from '../ui/kit'
import { CUSTOM, LAB_BY_CODE, LAB_INFO, parseNum, rowError, type LabItem, type LabRow as Row } from '../lib/labs'
import { uid, useApp } from '../store/app'
import { today } from '../lib/date'
import { haptic } from '../lib/telegram'

// Добавление (и правка) записи в дневник анализов.
// Человек вносит значение, единицу и референсный интервал из своего бланка — приложение их не оценивает.

const newRow = (code = ''): Row => ({ key: uid(), code, name: '', value: '', unit: LAB_BY_CODE[code]?.unit ?? '', refMin: '', refMax: '' })
const fromItem = (it: LabItem): Row => ({
  key: uid(),
  code: it.code,
  name: it.name ?? '',
  value: String(it.value),
  unit: it.unit,
  refMin: it.refMin != null ? String(it.refMin) : '',
  refMax: it.refMax != null ? String(it.refMax) : '',
})

export function LabUpload() {
  const nav = useNavigate()
  const { id: editId } = useParams()
  const { labs, addLab } = useApp()
  const editing = editId ? labs.find((l) => l.id === editId) : undefined
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [manual, setManual] = useState(!!editing)
  const [date, setDate] = useState(editing?.date ?? today())
  const [lab, setLab] = useState(editing?.lab ?? '')
  const [rows, setRows] = useState<Row[]>(editing ? editing.items.map(fromItem) : [newRow('hgb'), newRow('ferritin'), newRow('vitd')])
  const [touched, setTouched] = useState(false)

  const errors = rows.map(rowError)
  const items: LabItem[] = rows
    .filter((r, i) => r.code && !errors[i] && parseNum(r.value) !== null)
    .map((r) => ({
      code: r.code,
      ...(r.code === CUSTOM ? { name: r.name.trim() } : {}),
      value: parseNum(r.value)!,
      unit: r.unit.trim(),
      refMin: parseNum(r.refMin),
      refMax: parseNum(r.refMax),
    }))
  const canSave = items.length > 0 && errors.every((e) => !e)

  const onFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return alert('Файл больше 20 МБ')
    setPhoto(URL.createObjectURL(f))
    setManual(true)
  }

  const save = () => {
    setTouched(true)
    if (!canSave) return
    const id = editing?.id ?? uid()
    addLab({ id, date, source: editing?.source ?? (photo ? 'photo' : 'manual'), ...(lab.trim() ? { lab: lab.trim() } : {}), items })
    haptic.success()
    nav(`/labs/${id}`, { replace: true })
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const used = new Set(rows.map((r) => r.code).filter((c) => c !== CUSTOM))
  const field = 'h-11 rounded-xl bg-bg px-3 text-[15px] outline-none focus:ring-2 focus:ring-accent/40'

  return (
    <div>
      <PageHeader title={editing ? 'Правка анализа' : 'Новый анализ'} />
      <div className="px-4 pb-6">
        {!manual ? (
          <>
            <div className="mt-4 text-center">
              <h2 className="text-[22px] font-bold">Дневник анализов</h2>
              <p className="mt-1 text-[14px] text-muted">Сохраняй результаты и следи за динамикой</p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-5 flex h-56 w-full flex-col items-center justify-center rounded-card border-2 border-dashed border-accent/40 bg-brand-soft/60 transition active:scale-[0.99]"
            >
              <span className="grid size-16 place-items-center rounded-2xl bg-brand text-white shadow-btn">
                <Camera size={28} />
              </span>
              <span className="mt-4 text-[15px] font-semibold">Прикрепить фото бланка</span>
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
            <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">Распознавание фото появится позже — пока значения вносятся вручную.</p>
          </>
        ) : (
          <>
            {photo && (
              <Card className="mt-3 flex items-center gap-3">
                <img src={photo} alt="Фото бланка" className="size-16 rounded-xl object-cover" />
                <div className="text-[13px] leading-snug text-muted">Фото прикреплено. Перенеси значения и интервалы из бланка в поля ниже.</div>
              </Card>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1.5 block px-1 text-[12px] font-semibold text-muted">Дата сдачи</span>
                <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={`${field} w-full bg-white shadow-card`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block px-1 text-[12px] font-semibold text-muted">Лаборатория</span>
                <input value={lab} onChange={(e) => setLab(e.target.value)} maxLength={60} placeholder="необязательно" className={`${field} w-full bg-white shadow-card`} />
              </label>
            </div>

            <div className="mt-5 px-1 text-[12px] font-semibold text-muted">Показатели</div>
            <div className="mt-2 space-y-2.5">
              {rows.map((r, i) => (
                <div key={r.key} className="rounded-2xl bg-white p-3 shadow-card">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Показатель"
                      value={r.code}
                      onChange={(e) => update(r.key, { code: e.target.value, unit: LAB_BY_CODE[e.target.value]?.unit ?? r.unit })}
                      className={`${field} min-w-0 flex-1 px-2 text-[14px]`}
                    >
                      <option value="">Показатель…</option>
                      {LAB_INFO.map((l) => (
                        <option key={l.code} value={l.code} disabled={used.has(l.code) && l.code !== r.code}>
                          {l.name}
                        </option>
                      ))}
                      <option value={CUSTOM}>Другой показатель…</option>
                    </select>
                    <button aria-label="Удалить показатель" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="p-1.5 text-muted">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {r.code === CUSTOM && (
                    <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} maxLength={60} placeholder="Название, как в бланке" className={`${field} mt-2 w-full`} />
                  )}
                  {r.code && (
                    <>
                      <div className="mt-2 flex gap-2">
                        <input aria-label="Значение" inputMode="decimal" value={r.value} onChange={(e) => update(r.key, { value: e.target.value })} placeholder="Значение" className={`${field} min-w-0 flex-1 font-semibold`} />
                        <input aria-label="Единица" value={r.unit} onChange={(e) => update(r.key, { unit: e.target.value })} maxLength={20} placeholder="ед." className={`${field} w-28`} />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                        <span className="shrink-0">Интервал из бланка</span>
                        <input aria-label="Нижняя граница" inputMode="decimal" value={r.refMin} onChange={(e) => update(r.key, { refMin: e.target.value })} placeholder="от" className={`${field} h-9 min-w-0 flex-1 text-[14px]`} />
                        <span>—</span>
                        <input aria-label="Верхняя граница" inputMode="decimal" value={r.refMax} onChange={(e) => update(r.key, { refMax: e.target.value })} placeholder="до" className={`${field} h-9 min-w-0 flex-1 text-[14px]`} />
                      </div>
                      {(touched || r.value) && errors[i] && <p className="mt-1.5 text-[12px] text-bad">{errors[i]}</p>}
                    </>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setRows((rs) => [...rs, newRow()])} className="mt-3 flex items-center gap-1.5 px-1 text-[14px] font-semibold text-accent">
              <Plus size={16} /> Добавить показатель
            </button>

            <p className="mt-5 px-1 text-[12px] leading-snug text-muted">
              Интервал указывай как в бланке: у разных лабораторий он отличается. Приложение не оценивает результаты — обсуди их с врачом.
            </p>
            <Button onClick={save} disabled={touched && !canSave} className="mt-4">
              Сохранить в дневник
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
