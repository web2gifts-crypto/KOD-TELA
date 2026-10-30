import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fillPeriod, startsFromDays, type CycleSettings } from '../lib/cycle'
import { today, type ISODate } from '../lib/date'

// Локальное состояние MVP. На этапе бэкенда эти данные переезжают в API,
// а стор останется кэшем UI.

export type Goal = 'cycle' | 'labs' | 'symptoms' | 'wellbeing'

export interface Profile {
  name: string
  age: number | null
  goal: Goal
  avatarId: string
  consentAt: number
}

export interface LabRecord {
  id: string
  date: ISODate
  source: 'photo' | 'manual'
  items: { code: string; value: number }[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  /** структурированный ответ ассистента */
  verdict?: Verdict
}

export interface Verdict {
  level: 'norm' | 'doctor' | 'urgent' | 'emergency'
  title: string
  explanation: string
  plan: string[]
}

export interface ChatSession {
  id: string
  startedAt: number
  messages: ChatMessage[]
  /** опасная тема — уйдёт в очередь админки на проверку врачом */
  flagged?: boolean
}

interface AppState {
  profile: Profile | null
  cycle: CycleSettings
  /** отмеченные дни месячных: 0 — интенсивность не указана, 1..4 — мажущие…обильные */
  periodDays: Record<ISODate, number>
  /** начала месячных (по возрастанию) — выводятся из periodDays */
  periodStarts: ISODate[]
  moods: Record<ISODate, number>
  /** что повлияло на настроение + заметка */
  moodNotes: Record<ISODate, { factors: string[]; note: string }>
  /** показывали ли знакомство с Юви на главной */
  introSeen: boolean
  /** день, когда открыто предсказание Юви */
  predictionSeen: ISODate | null
  /** только что сохранённое настроение — Юви на главной отреагирует и сбросит */
  pendingReaction: number | null
  symptoms: Record<ISODate, string[]>
  labs: LabRecord[]
  chats: ChatSession[]
  favorites: string[]
  readNotifications: string[]

  completeOnboarding: (p: Profile, cycle?: Partial<CycleSettings>) => void
  setCycle: (c: Partial<CycleSettings>) => void
  setMood: (d: ISODate, mood: number, extra?: { factors: string[]; note: string }) => void
  /** отметить день месячных (flow 0..4) или снять отметку (null) */
  setPeriodDay: (d: ISODate, flow: number | null) => void
  setDayNote: (d: ISODate, note: string) => void
  setIntroSeen: () => void
  setPredictionSeen: (d: ISODate) => void
  clearReaction: () => void
  toggleSymptom: (d: ISODate, s: string) => void
  addLab: (r: LabRecord) => void
  saveChat: (c: ChatSession) => void
  toggleFavorite: (id: string) => void
  markRead: (ids: string[]) => void
  resetAll: () => void
  /** заменить данные (демо для показа) */
  loadData: (data: Partial<AppData>) => void
}

export type AppData = Pick<AppState, 'profile' | 'cycle' | 'periodDays' | 'periodStarts' | 'moods' | 'moodNotes' | 'symptoms' | 'labs' | 'chats'>

/** пересчитать начала месячных и дату последних из отмеченных дней */
function syncPeriods(periodDays: Record<ISODate, number>, cycle: CycleSettings) {
  const periodStarts = startsFromDays(periodDays)
  return { periodDays, periodStarts, cycle: { ...cycle, lastPeriodStart: periodStarts[periodStarts.length - 1] ?? null } }
}

const initial = {
  profile: null,
  cycle: { lastPeriodStart: null, cycleLength: 28, periodLength: 5 },
  periodDays: {},
  periodStarts: [],
  moods: {},
  moodNotes: {},
  introSeen: false,
  predictionSeen: null,
  pendingReaction: null,
  symptoms: {},
  labs: [],
  chats: [],
  favorites: [],
  readNotifications: [],
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...initial,
      completeOnboarding: (profile, cycle) =>
        set((s) => {
          const c = { ...s.cycle, ...cycle }
          const days = cycle?.lastPeriodStart ? fillPeriod(s.periodDays, cycle.lastPeriodStart, c.periodLength) : s.periodDays
          return { profile, ...syncPeriods(days, c) }
        }),
      setCycle: (c) =>
        set((s) => {
          const cycle = { ...s.cycle, ...c }
          const days = c.lastPeriodStart ? fillPeriod(s.periodDays, c.lastPeriodStart, cycle.periodLength) : s.periodDays
          return syncPeriods(days, cycle)
        }),
      setPeriodDay: (d, flow) =>
        set((s) => {
          const days = { ...s.periodDays }
          if (flow === null) delete days[d]
          else days[d] = flow
          return syncPeriods(days, s.cycle)
        }),
      setDayNote: (d, note) =>
        set((s) => ({ moodNotes: { ...s.moodNotes, [d]: { factors: s.moodNotes[d]?.factors ?? [], note } } })),
      setMood: (d, mood, extra) =>
        set((s) => ({
          moods: { ...s.moods, [d]: mood },
          moodNotes: extra ? { ...s.moodNotes, [d]: extra } : s.moodNotes,
          // реакция Юви на главной — только на сегодняшнее настроение
          pendingReaction: d === today() ? mood : s.pendingReaction,
        })),
      setIntroSeen: () => set({ introSeen: true }),
      setPredictionSeen: (d) => set({ predictionSeen: d }),
      clearReaction: () => set({ pendingReaction: null }),
      toggleSymptom: (d, sym) =>
        set((s) => {
          const cur = s.symptoms[d] ?? []
          const next = cur.includes(sym) ? cur.filter((x) => x !== sym) : [...cur, sym]
          return { symptoms: { ...s.symptoms, [d]: next } }
        }),
      addLab: (r) => set((s) => ({ labs: [r, ...s.labs] })),
      saveChat: (c) =>
        set((s) => ({ chats: [c, ...s.chats.filter((x) => x.id !== c.id)] })),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id],
        })),
      markRead: (ids) => set((s) => ({ readNotifications: [...new Set([...s.readNotifications, ...ids])] })),
      resetAll: () => set(initial),
      loadData: (data) => set({ ...data, introSeen: true }),
    }),
    {
      name: 'kodtela',
      version: 4,
      migrate: (old) => {
        const st = { ...initial, ...(old as object) } as unknown as AppState
        // v4: дни месячных. Раньше знали только даты начала — заполняем длиной из настроек
        if (!Object.keys(st.periodDays ?? {}).length) {
          let days: Record<ISODate, number> = {}
          const starts = st.periodStarts?.length ? st.periodStarts : st.cycle?.lastPeriodStart ? [st.cycle.lastPeriodStart] : []
          for (const start of starts) days = fillPeriod(days, start, st.cycle.periodLength)
          Object.assign(st, syncPeriods(days, st.cycle))
        }
        return st
      },
    },
  ),
)

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
