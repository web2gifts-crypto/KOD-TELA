// Точка подключения ИИ (GigaChat) для чата с Юви.
//
// Сейчас работает ScriptedAssistant — правила из lib/triage.ts, полностью на клиенте.
// Когда на бэкенде включат ИИ (/v1/config → ai_enabled: true), чат пойдёт через
// RemoteAssistant → POST /v1/chat. Ключи GigaChat живут ТОЛЬКО на сервере
// (api/app/ai/), во фронт они не попадают. Подробности — docs/AI.md.
//
// Правила безопасности действуют для любого провайдера:
//  1) красные флаги проверяются на клиенте ДО отправки (isEmergency) и на сервере;
//  2) ответ ИИ проходит фильтр FORBIDDEN — если он сказал «это норма» или
//     назвал лекарство с дозой, показываем безопасный ответ по правилам.

import type { Phase } from './cycle'
import type { ChatMessage, Verdict } from '../store/app'
import { buildVerdict, FORBIDDEN, type Answers } from './triage'
import { apiFetch, hasBackend } from './api'

export interface AssistantRequest {
  /** исходная жалоба */
  symptom: string
  /** ответы на уточняющие вопросы */
  answers: Answers
  /** контекст цикла — только то, что нужно для ответа (минимизация данных) */
  phase: Phase | null
  cycleDay: number | null
  /** последние сообщения диалога (без имени и других персональных данных) */
  history: Pick<ChatMessage, 'role' | 'text'>[]
}

export interface AssistantReply {
  text: string
  verdict?: Verdict
}

export interface Assistant {
  readonly name: string
  reply(req: AssistantRequest): Promise<AssistantReply>
}

export const ScriptedAssistant: Assistant = {
  name: 'scripted',
  async reply(req) {
    return { text: 'Спасибо, что рассказала. Вот что могу подсказать:', verdict: buildVerdict(req.symptom, req.answers, req.phase) }
  },
}

/** Нарушает ли текст правила (диагноз, «норма», дозировки) */
export function violatesPolicy(text: string): boolean {
  return FORBIDDEN.some((r) => r.test(text))
}

export const RemoteAssistant: Assistant = {
  name: 'remote',
  async reply(req) {
    const fallback = () => ScriptedAssistant.reply(req)
    try {
      const res = await apiFetch('/v1/chat', { method: 'POST', body: JSON.stringify(req) })
      if (!res.ok) return fallback()
      const data = (await res.json()) as AssistantReply
      const all = [data.text, data.verdict?.title, data.verdict?.explanation, ...(data.verdict?.plan ?? []), ...(data.verdict?.whenDoctor ?? [])].join('\n')
      if (!data.text || violatesPolicy(all)) return fallback()
      return data
    } catch {
      return fallback()
    }
  },
}

let aiEnabled: boolean | null = null

/** Какой ассистент использовать. Флаг берётся с сервера один раз за сессию. */
export async function getAssistant(): Promise<Assistant> {
  if (!hasBackend) return ScriptedAssistant
  if (aiEnabled === null) {
    try {
      const res = await apiFetch('/v1/config')
      aiEnabled = res.ok ? Boolean(((await res.json()) as { ai_enabled?: boolean }).ai_enabled) : false
    } catch {
      aiEnabled = false
    }
  }
  return aiEnabled ? RemoteAssistant : ScriptedAssistant
}
