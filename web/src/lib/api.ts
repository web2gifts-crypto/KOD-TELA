// Связь с бэкендом. Пока бэкенда нет (VITE_API_URL пуст) — работаем локально.

import { getInitData, inTelegram } from './telegram'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const hasBackend = Boolean(API_URL)

/** Запрос к API с подписью Telegram initData (бэкенд проверяет HMAC) */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!API_URL) return Promise.reject(new Error('no backend'))
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `tma ${getInitData()}`, ...init.headers },
  })
}

/**
 * Отправить файл в чат с ботом: бэкенд проверяет подпись initData и шлёт документ через Bot API.
 * Без бэкенда, вне Telegram или если сервер недоступен — файл скачивается на устройство.
 */
export async function sendFileToBot(file: { filename: string; content: string; mime: string }): Promise<'bot' | 'download'> {
  if (API_URL && inTelegram) {
    try {
      const res = await apiFetch('/v1/export', { method: 'POST', body: JSON.stringify({ filename: file.filename, content: file.content }) })
      if (res.ok) return 'bot'
    } catch {
      /* сеть — скачаем */
    }
  }
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: file.filename })
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'download'
}
