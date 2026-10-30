import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CycleSettings } from '../lib/cycle'
import type { ISODate } from '../lib/date'

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
  moods: Record<ISODate, number>
  symptoms: Record<ISODate, string[]>
  labs: LabRecord[]
  chats: ChatSession[]
  favorites: string[]
  readNotifications: string[]

  completeOnboarding: (p: Profile, cycle?: Partial<CycleSettings>) => void
  setCycle: (c: Partial<CycleSettings>) => void
  setMood: (d: ISODate, mood: number) => void
  toggleSymptom: (d: ISODate, s: string) => void
  addLab: (r: LabRecord) => void
  saveChat: (c: ChatSession) => void
  toggleFavorite: (id: string) => void
  markRead: (ids: string[]) => void
  resetAll: () => void
}

const initial = {
  profile: null,
  cycle: { lastPeriodStart: null, cycleLength: 28, periodLength: 5 },
  moods: {},
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
      completeOnboarding: (profile, cycle) => set((s) => ({ profile, cycle: { ...s.cycle, ...cycle } })),
      setCycle: (c) => set((s) => ({ cycle: { ...s.cycle, ...c } })),
      setMood: (d, mood) => set((s) => ({ moods: { ...s.moods, [d]: mood } })),
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
    }),
    { name: 'kodtela', version: 1 },
  ),
)

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
