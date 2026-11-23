// Доступ для партнёра — клиент API (см. api/app/partner.py).

import { apiFetch } from './api'

export interface PartnerScope {
  cycle: boolean
  fertile: boolean
  mood: boolean
}

export interface PartnerGrant {
  id: number
  name: string
  scope: PartnerScope
  createdAt: string
  lastViewedAt: string | null
}

export interface PartnerViewData {
  owner: string
  scope: PartnerScope
  cycle?: {
    day: number
    phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
    phaseName: string
    period: boolean
    lateDays: number
    nextPeriod: string | null
    periodInDays: number | null
    fertile?: boolean
    ovulationInDays?: number | null
  }
  pregnancy?: { week: number; day: number }
  mood?: { value: number; label: string } | null
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(String(r.status))
  return (await r.json()) as T
}

export const listPartners = () => apiFetch('/v1/partners').then((r) => json<{ partners: PartnerGrant[]; max: number }>(r))
export const updateScope = (id: number, scope: PartnerScope) => apiFetch(`/v1/partners/${id}`, { method: 'PUT', body: JSON.stringify(scope) }).then((r) => json<PartnerGrant>(r))
export const rotateLink = (id: number) => apiFetch(`/v1/partners/${id}/link`, { method: 'POST' }).then((r) => json<{ link: string }>(r))
export const revokePartner = (id: number) => apiFetch(`/v1/partners/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r))
export const viewAsPartner = (token: string) => apiFetch(`/v1/partner/${encodeURIComponent(token)}`).then((r) => json<PartnerViewData>(r))

export const PARTNER_START = 'p_'
