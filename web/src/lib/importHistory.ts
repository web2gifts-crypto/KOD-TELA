// Перенос истории месячных из других приложений (Flo, Clue и др.) и из CSV.
//
// Форматы экспорта у приложений меняются и официально не описаны, поэтому разбор «терпимый»:
// ищем в JSON любые записи с датой и признаком месячных, а в CSV — даты (и интенсивность, если есть).
// Перед сохранением человек видит, что найдено; существующие отметки не затираются.

import { addDays, diffDays, type ISODate } from './date'

export interface ImportResult {
  /** дни месячных: 0 — интенсивность не указана, 1..4 — мажущие…обильные */
  days: Record<ISODate, number>
  source: 'clue' | 'flo' | 'json' | 'csv' | 'unknown'
}

const FLOW_WORDS: [RegExp, number][] = [
  [/spot|мажущ|мазн/i, 1],
  [/light|low|слаб|скудн/i, 2],
  [/medium|moderate|normal|средн/i, 3],
  [/heavy|high|super|обильн|сильн/i, 4],
]

function flowOf(v: unknown): number | null {
  if (v === null || v === undefined || v === false || v === '' || v === 'none' || v === 0) return null
  if (typeof v === 'number') return Math.max(0, Math.min(4, Math.round(v)))
  if (typeof v === 'string') {
    for (const [r, n] of FLOW_WORDS) if (r.test(v)) return n
    return /^(true|yes|да|period|bleeding)$/i.test(v.trim()) ? 0 : null
  }
  if (v === true) return 0
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return flowOf(o.value ?? o.flow ?? o.intensity ?? o.level ?? o.name ?? true)
  }
  return null
}

/** '2024-03-05', '2024-03-05T00:00:00Z', '05.03.2024', 1709596800000 → '2024-03-05' */
export function toDate(v: unknown): ISODate | null {
  if (typeof v === 'number' && v > 946684800 && v < 4102444800000) {
    const ms = v < 1e12 ? v * 1000 : v
    return new Date(ms).toISOString().slice(0, 10)
  }
  if (typeof v !== 'string') return null
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = v.match(/^(\d{2})[./](\d{2})[./](\d{4})/)
  if (m) return valid(+m[3], +m[2], +m[1])
  return null
}

function valid(y: number, mo: number, d: number): ISODate | null {
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const DATE_KEYS = /^(day|date|datetime|timestamp)$/i
const PERIOD_KEYS = /^(period|flow|menstruation|bleeding|menstrual_flow|period_intensity)$/i
const START_KEYS = /(period_?start|start_?date|cycle_?start|menstruation_?start|startdate)/i
const END_KEYS = /(period_?end|end_?date|menstruation_?end|enddate)/i

/** Разбор JSON любого из известных форматов */
export function parseJson(raw: unknown): Record<ISODate, number> {
  const days: Record<ISODate, number> = {}
  const add = (d: ISODate, f: number) => (days[d] = Math.max(days[d] ?? 0, f))
  const walk = (node: unknown, depth: number) => {
    if (depth > 12 || node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const x of node) walk(x, depth + 1)
      return
    }
    const o = node as Record<string, unknown>
    const keys = Object.keys(o)
    // 1) запись дня: {day: '2024-03-05', period: 'medium'}
    const dk = keys.find((k) => DATE_KEYS.test(k))
    const pk = keys.find((k) => PERIOD_KEYS.test(k))
    if (dk && pk) {
      const d = toDate(o[dk])
      const f = flowOf(o[pk])
      if (d && f !== null) add(d, f)
    }
    // 2) интервал месячных: {period_start_date: '…', period_end_date: '…'}
    const sk = keys.find((k) => START_KEYS.test(k))
    if (sk) {
      const s = toDate(o[sk])
      const ek = keys.find((k) => END_KEYS.test(k))
      const e = ek ? toDate(o[ek]) : null
      if (s) {
        const len = e && e >= s ? Math.min(diffDays(e, s) + 1, 12) : 1
        for (let i = 0; i < len; i++) add(addDays(s, i), 0)
      }
    }
    for (const k of keys) walk(o[k], depth + 1)
  }
  walk(raw, 0)
  return days
}

/** CSV/текст: строки с датой; если в строке есть слово интенсивности — берём его */
export function parseCsv(text: string): Record<ISODate, number> {
  const days: Record<ISODate, number> = {}
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    const d = cells.map(toDate).find(Boolean)
    if (!d) continue
    // строка с явным «нет месячных» — пропускаем
    if (cells.some((c) => /^(none|no|нет|0)$/i.test(c)) && !cells.some((c) => flowOf(c))) continue
    const f = cells.map((c) => (toDate(c) ? null : flowOf(c))).find((x) => x !== null && x !== undefined)
    days[d] = Math.max(days[d] ?? 0, f ?? 0)
  }
  return days
}

export function parseImport(filename: string, text: string): ImportResult {
  const lower = filename.toLowerCase()
  const t = text.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const raw = JSON.parse(t) as unknown
      const source = lower.endsWith('.cluedata') || /"clue/i.test(t.slice(0, 2000)) ? 'clue' : /flo/i.test(lower) || /"flo/i.test(t.slice(0, 2000)) ? 'flo' : 'json'
      return { days: parseJson(raw), source }
    } catch {
      /* не JSON — попробуем как CSV */
    }
  }
  const days = parseCsv(t)
  return { days, source: Object.keys(days).length ? 'csv' : 'unknown' }
}

/** Дни месячных из списка дат начала (ручной ввод) */
export function fromStarts(starts: ISODate[], length: number): Record<ISODate, number> {
  const days: Record<ISODate, number> = {}
  for (const s of starts) for (let i = 0; i < length; i++) days[addDays(s, i)] = 0
  return days
}

/** Добавить найденное к своим отметкам: свои важнее, будущие даты отбрасываем */
export function mergeImported(own: Record<ISODate, number>, imported: Record<ISODate, number>, today: ISODate): Record<ISODate, number> {
  const out = { ...own }
  for (const [d, f] of Object.entries(imported)) if (d <= today && out[d] === undefined) out[d] = f
  return out
}
