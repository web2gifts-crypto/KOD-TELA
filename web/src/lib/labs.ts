// Дневник анализов.
// Приложение НЕ оценивает результаты: не пишет «норма / выше / ниже нормы» и не советует лечение.
// Храним значения и референсный интервал из бланка лаборатории (его вносит сам человек),
// показываем динамику и нейтральную справку о показателе. Тексты справки согласует врач проекта.

import type { ISODate } from './date'
import type { LabRecord } from '../store/app'

export interface LabInfo {
  code: string
  name: string
  /** единица по умолчанию — человек может указать свою, как в бланке */
  unit: string
  /** что это за показатель (без оценок и рекомендаций) */
  about: string
}

export const LAB_INFO: LabInfo[] = [
  { code: 'hgb', name: 'Гемоглобин', unit: 'г/л', about: 'Белок эритроцитов, который переносит кислород от лёгких к тканям.' },
  { code: 'ferritin', name: 'Ферритин', unit: 'мкг/л', about: 'Белок, в котором организм хранит железо. По нему судят о запасах железа.' },
  { code: 'iron', name: 'Железо сывороточное', unit: 'мкмоль/л', about: 'Количество железа, которое циркулирует в крови в момент забора.' },
  { code: 'vitd', name: 'Витамин D (25-OH)', unit: 'нг/мл', about: 'Отражает запасы витамина D — из пищи, добавок и выработанного кожей на солнце.' },
  { code: 'b12', name: 'Витамин B12', unit: 'пг/мл', about: 'Витамин, который участвует в образовании клеток крови и работе нервной системы.' },
  { code: 'tsh', name: 'ТТГ', unit: 'мМЕ/л', about: 'Гормон гипофиза, который управляет работой щитовидной железы.' },
  { code: 'ft4', name: 'Т4 свободный', unit: 'пмоль/л', about: 'Гормон щитовидной железы, который влияет на обмен веществ и энергию.' },
  { code: 'glucose', name: 'Глюкоза', unit: 'ммоль/л', about: 'Уровень сахара в крови — основного источника энергии для клеток.' },
  { code: 'prolactin', name: 'Пролактин', unit: 'мЕд/л', about: 'Гормон гипофиза, который участвует в регуляции менструального цикла.' },
  { code: 'estradiol', name: 'Эстрадиол', unit: 'пмоль/л', about: 'Основной женский половой гормон; его уровень меняется в течение цикла.' },
  { code: 'progesterone', name: 'Прогестерон', unit: 'нмоль/л', about: 'Гормон второй половины цикла; его уровень зависит от дня цикла.' },
  { code: 'testosterone', name: 'Тестостерон', unit: 'нмоль/л', about: 'Гормон, который в небольшом количестве вырабатывается и у женщин.' },
]

export const LAB_BY_CODE = Object.fromEntries(LAB_INFO.map((l) => [l.code, l])) as Record<string, LabInfo>

/** Код для показателя, которого нет в справочнике (вводится вручную) */
export const CUSTOM = 'custom'

export interface LabItem {
  code: string
  /** название — для своих показателей (code = custom) */
  name?: string
  value: number
  unit: string
  /** референсный интервал из бланка лаборатории (если указан) */
  refMin?: number | null
  refMax?: number | null
}

export const itemName = (it: Pick<LabItem, 'code' | 'name'>) => (it.code === CUSTOM ? it.name || 'Показатель' : LAB_BY_CODE[it.code]?.name ?? it.name ?? it.code)

/** ключ для группировки одинаковых показателей (свои — по названию) */
export const itemKey = (it: Pick<LabItem, 'code' | 'name'>) => (it.code === CUSTOM ? `custom:${(it.name ?? '').trim().toLowerCase()}` : it.code)

export function formatRef(it: Pick<LabItem, 'refMin' | 'refMax'>): string | null {
  const lo = it.refMin ?? null
  const hi = it.refMax ?? null
  if (lo === null && hi === null) return null
  if (lo !== null && hi !== null) return `${lo}–${hi}`
  return lo !== null ? `от ${lo}` : `до ${hi}`
}

export interface LabValue {
  key: string
  item: LabItem
  date: ISODate
  recordId: string
  /** предыдущее значение того же показателя */
  prev: { value: number; date: ISODate } | null
}

/** Последнее значение каждого показателя по всем анализам (+ предыдущее для динамики) */
export function latestValues(labs: LabRecord[]): LabValue[] {
  const sorted = [...labs].sort((a, b) => (a.date < b.date ? 1 : -1))
  const out = new Map<string, LabValue>()
  for (const rec of sorted) {
    for (const it of rec.items) {
      const key = itemKey(it)
      const cur = out.get(key)
      if (!cur) out.set(key, { key, item: it, date: rec.date, recordId: rec.id, prev: null })
      else if (!cur.prev && rec.date < cur.date) cur.prev = { value: it.value, date: rec.date }
    }
  }
  return [...out.values()]
}

/** Все значения показателя по времени (для графика) */
export function seriesFor(labs: LabRecord[], key: string): { date: ISODate; value: number; item: LabItem }[] {
  return labs
    .flatMap((r) => r.items.filter((i) => itemKey(i) === key).map((item) => ({ date: r.date, value: item.value, item })))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

export const LAB_DISCLAIMER = 'Приложение не оценивает результаты анализов. Если есть вопросы по результату — обсудите его с врачом.'

/* ---------- форма внесения ---------- */

export interface LabRow {
  key: string
  code: string
  name: string
  value: string
  unit: string
  refMin: string
  refMax: string
}

/** «12,5» → 12.5; пусто или не число (в т.ч. «0x10», «1e3») → null */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** Ошибка в строке формы или null. Пустая строка (не выбран показатель или нет значения) — не ошибка. */
export function rowError(r: LabRow): string | null {
  if (!r.code) return null
  if (r.code === CUSTOM && !r.name.trim()) return 'Укажи название показателя'
  const v = parseNum(r.value)
  if (v === null) return r.value.trim() ? 'Значение должно быть числом' : null
  if (v < 0) return 'Значение не может быть отрицательным'
  const lo = parseNum(r.refMin)
  const hi = parseNum(r.refMax)
  if ((r.refMin.trim() && lo === null) || (r.refMax.trim() && hi === null)) return 'Интервал — только числа'
  if (lo !== null && hi !== null && lo > hi) return 'Нижняя граница больше верхней'
  return null
}
