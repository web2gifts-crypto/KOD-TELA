// Синхронизация с сервером (api.kodtela.tech).
//
// Офлайн-первый подход: приложение работает с локальной копией (zustand + localStorage),
// изменения в фоне отправляются на сервер, при запуске подтягиваются с сервера.
// Сервер — источник правды между устройствами. У каждой части данных (ключа) есть версия:
// если на сервере версия новее (правка с другого устройства), данные объединяются, а не затираются.
//
// Работает только внутри Telegram и при заданном VITE_API_URL. Без согласия на обработку
// данных на сервер ничего не отправляется.

import { useApp, type AppState } from '../store/app'
import { apiFetch, hasBackend } from './api'
import { CONSENT_VERSION } from './legal'
import { getUser, inTelegram } from './telegram'

export const SYNC_KEYS = ['profile', 'cycle', 'periodDays', 'moods', 'moodNotes', 'symptoms', 'labs', 'chats', 'prefs'] as const
export type SyncKey = (typeof SYNC_KEYS)[number]

const PREFS = ['introSeen', 'predictionSeen', 'favorites', 'readNotifications', 'talkSeen'] as const

/* ---------- данные ⇄ ключи ---------- */

export function pick(st: AppState, k: SyncKey): unknown {
  if (k === 'prefs') return Object.fromEntries(PREFS.map((p) => [p, st[p]]))
  return st[k]
}

function changed(a: AppState, b: AppState, k: SyncKey): boolean {
  if (k === 'prefs') return PREFS.some((p) => a[p] !== b[p])
  return a[k] !== b[k]
}

export function toState(k: SyncKey, data: unknown): Partial<AppState> {
  if (k === 'prefs') return { ...(data as Partial<AppState>) }
  return { [k]: data } as Partial<AppState>
}

type Rec = Record<string, unknown>
const byId = <T extends { id: string }>(server: T[], local: T[]): T[] => {
  const ids = new Set(local.map((x) => x.id))
  return [...local, ...server.filter((x) => !ids.has(x.id))]
}

/** Объединить версию с сервера и локальную (локальные правки важнее) */
export function merge(k: SyncKey, server: unknown, local: unknown): unknown {
  if (server == null) return local
  if (local == null) return server
  switch (k) {
    case 'periodDays':
    case 'moods':
    case 'moodNotes':
    case 'symptoms':
      return { ...(server as Rec), ...(local as Rec) }
    case 'labs':
      return byId(server as { id: string; date: string }[], local as { id: string; date: string }[]).sort((a, b) => b.date.localeCompare(a.date))
    case 'chats':
      return byId(server as { id: string; startedAt: number }[], local as { id: string; startedAt: number }[]).sort((a, b) => b.startedAt - a.startedAt)
    case 'prefs': {
      const s = server as Rec
      const l = local as Rec
      return {
        ...s,
        ...l,
        favorites: [...new Set([...((s.favorites as string[]) ?? []), ...((l.favorites as string[]) ?? [])])],
        readNotifications: [...new Set([...((s.readNotifications as string[]) ?? []), ...((l.readNotifications as string[]) ?? [])])],
        talkSeen: { ...((s.talkSeen as Rec) ?? {}), ...((l.talkSeen as Rec) ?? {}) },
      }
    }
    default:
      return local
  }
}

const isEmpty = (v: unknown) => v == null || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v as object).length)

/* ---------- состояние синхронизации (на устройстве) ---------- */

interface Meta {
  uid: number | null
  v: Partial<Record<SyncKey, number>>
  dirty: SyncKey[]
}

const META_KEY = 'kodtela-sync'

function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as Meta | null
    if (m && typeof m === 'object') return { uid: m.uid ?? null, v: m.v ?? {}, dirty: m.dirty ?? [] }
  } catch {
    /* нет хранилища */
  }
  return { uid: null, v: {}, dirty: [] }
}

let meta: Meta = loadMeta()
const saveMeta = () => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    /* нет хранилища */
  }
}

export type SyncStatus = 'off' | 'waiting-consent' | 'syncing' | 'ok' | 'offline'
let status: SyncStatus = 'off'
const listeners = new Set<(s: SyncStatus) => void>()
const setStatus = (s: SyncStatus) => {
  status = s
  listeners.forEach((l) => l(s))
}
export const getSyncStatus = () => status
export function onSyncStatus(cb: (s: SyncStatus) => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const syncEnabled = () => hasBackend && inTelegram

/* ---------- обмен с сервером ---------- */

let applying = false
function apply(patch: Partial<AppState>) {
  applying = true
  try {
    useApp.getState().applyRemote(patch)
  } finally {
    applying = false
  }
}

async function pull(): Promise<void> {
  const res = await apiFetch('/v1/data')
  if (!res.ok) throw new Error(`pull ${res.status}`)
  const { entries } = (await res.json()) as { entries: Partial<Record<SyncKey, { data: unknown; version: number }>> }
  const st = useApp.getState()
  const patch: Partial<AppState> = {}
  for (const k of SYNC_KEYS) {
    const e = entries[k]
    if (!e) {
      if (!isEmpty(pick(st, k)) && !meta.dirty.includes(k)) meta.dirty.push(k)
      continue
    }
    if (e.version <= (meta.v[k] ?? 0)) continue
    const local = pick(st, k)
    const dirty = meta.dirty.includes(k)
    Object.assign(patch, toState(k, dirty ? merge(k, e.data, local) : e.data))
    meta.v[k] = e.version
  }
  if (Object.keys(patch).length) apply(patch)
  saveMeta()
}

let flushing: Promise<void> | null = null
let retryTimer = 0

async function flushOnce(): Promise<void> {
  for (const k of [...meta.dirty]) {
    const data = pick(useApp.getState(), k)
    if (data == null) {
      meta.dirty = meta.dirty.filter((x) => x !== k)
      continue
    }
    const res = await apiFetch(`/v1/data/${k}`, { method: 'PUT', body: JSON.stringify({ data, baseVersion: meta.v[k] ?? null }) })
    if (res.ok) {
      const { version } = (await res.json()) as { version: number }
      meta.v[k] = version
      // если пока шёл запрос данные снова поменялись — ключ останется «грязным»
      if (pick(useApp.getState(), k) === data || k === 'prefs') meta.dirty = meta.dirty.filter((x) => x !== k)
    } else if (res.status === 409) {
      const { current } = (await res.json()) as { current: { data: unknown; version: number } | null }
      if (current) {
        apply(toState(k, merge(k, current.data, pick(useApp.getState(), k))))
        meta.v[k] = current.version
      } else delete meta.v[k]
      // остаётся в dirty — отправим объединённое на следующем проходе
    } else if (res.status === 403) {
      throw new Error('consent')
    } else {
      throw new Error(`push ${k} ${res.status}`)
    }
    saveMeta()
  }
}

export function flush(): Promise<void> {
  if (!syncEnabled() || status === 'off' || status === 'waiting-consent') return Promise.resolve()
  if (flushing) return flushing
  flushing = (async () => {
    try {
      for (let i = 0; i < 3 && meta.dirty.length; i++) await flushOnce()
      setStatus('ok')
    } catch {
      setStatus('offline')
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => void flush(), 30_000)
    } finally {
      flushing = null
    }
  })()
  return flushing
}

let flushTimer = 0
const scheduleFlush = () => {
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => void flush(), 1500)
}

async function ensureConsent(): Promise<boolean> {
  const res = await apiFetch('/v1/me')
  if (!res.ok) throw new Error(`me ${res.status}`)
  const me = (await res.json()) as { needs_consent: boolean; current_consent_version: string }
  const local = useApp.getState().consent
  if (!me.needs_consent) {
    // согласие уже дано (например, на другом устройстве) — отмечаем локально
    if (local?.version !== me.current_consent_version) apply({ consent: { version: me.current_consent_version, at: Date.now() } })
    return true
  }
  if (local?.version === CONSENT_VERSION && CONSENT_VERSION === me.current_consent_version) {
    const r = await apiFetch('/v1/consent', { method: 'POST', body: JSON.stringify({ version: CONSENT_VERSION, health_data: true }) })
    return r.ok
  }
  return false
}

let started = false

/** Запуск синхронизации — один раз при старте приложения */
export function startSync(): void {
  if (started || !syncEnabled()) return
  started = true

  const uid = getUser().id
  if (meta.uid !== null && meta.uid !== uid) {
    // на устройстве данные другого аккаунта Telegram — не смешиваем
    useApp.getState().resetAll()
    meta = { uid, v: {}, dirty: [] }
  }
  meta.uid = uid
  saveMeta()

  useApp.subscribe((st, prev) => {
    if (applying) return
    let any = false
    for (const k of SYNC_KEYS)
      if (changed(st, prev, k)) {
        if (!meta.dirty.includes(k)) meta.dirty.push(k)
        any = true
      }
    if (any) {
      saveMeta()
      scheduleFlush()
    }
    // согласие дали, пока ждали, — подключаемся
    if (status === 'waiting-consent' && st.consent?.version === CONSENT_VERSION && prev.consent !== st.consent) void connect()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })

  void connect()
}

async function connect(): Promise<void> {
  setStatus('syncing')
  try {
    if (!(await ensureConsent())) {
      setStatus('waiting-consent')
      return
    }
    await pull()
    setStatus('ok')
    await flush()
  } catch {
    setStatus('offline')
    window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(() => void connect(), 30_000)
  }
}

/* ---------- права пользователя (152-ФЗ) ---------- */

/** Отозвать согласие и удалить все данные — на сервере и на устройстве */
export async function deleteAccount(): Promise<void> {
  if (syncEnabled()) {
    const res = await apiFetch('/v1/me', { method: 'DELETE' })
    // 403 — аккаунта на сервере нет (согласие не передавалось), удалять там нечего
    if (!res.ok && res.status !== 403) throw new Error(`delete ${res.status}`)
  }
  window.clearTimeout(flushTimer)
  window.clearTimeout(retryTimer)
  meta = { uid: meta.uid, v: {}, dirty: [] }
  saveMeta()
  applying = true
  try {
    useApp.getState().resetAll()
  } finally {
    applying = false
  }
  setStatus(syncEnabled() ? 'waiting-consent' : 'off')
}

/** Все мои данные одним JSON-файлом */
export function exportJSON(): { filename: string; content: string } {
  const st = useApp.getState()
  const data = Object.fromEntries(SYNC_KEYS.map((k) => [k, pick(st, k)]))
  return {
    filename: `kod-tela-data-${new Date().toISOString().slice(0, 10)}.json`,
    content: JSON.stringify({ exportedAt: new Date().toISOString(), consent: st.consent, ...data }, null, 2),
  }
}
