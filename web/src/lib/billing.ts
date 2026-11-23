// «Код Тела+» — клиент API подписки (см. api/app/billing.py)

import { apiFetch } from './api'

export interface Plan {
  id: 'plus_month' | 'plus_year'
  title: string
  stars: number
  days: number
  recurring: boolean
}

export interface BillingInfo {
  plan: 'free' | 'plus'
  until: string | null
  recurring: boolean
  canceled: boolean
  plans: Plan[]
  features: string[]
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(String(r.status))
  return (await r.json()) as T
}

export const getBilling = () => apiFetch('/v1/billing').then((r) => json<BillingInfo>(r))
export const createInvoice = (plan: Plan['id']) => apiFetch('/v1/billing/invoice', { method: 'POST', body: JSON.stringify({ plan }) }).then((r) => json<{ link: string }>(r))
export const cancelSubscription = () => apiFetch('/v1/billing/cancel', { method: 'POST' }).then((r) => json<{ ok: boolean; until: string }>(r))
