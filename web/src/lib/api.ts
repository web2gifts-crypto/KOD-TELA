// Связь с бэкендом. Пока бэкенда нет (VITE_API_URL пуст) — работаем локально.

import { getInitData, inTelegram } from './telegram'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const hasBackend = Boolean(API_URL)

/**
 * Отправить файл в чат с ботом. Бэкенд проверяет подпись initData и шлёт документ через Bot API (sendDocument).
 * Без бэкенда (или вне Telegram) — файл скачивается на устройство.
 */
export async function sendFileToBot(file: { filename: string; content: string; mime: string }): Promise<'bot' | 'download'> {
  if (API_URL && inTelegram) {
    const res = await fetch(`${API_URL}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `tma ${getInitData()}` },
      body: JSON.stringify({ filename: file.filename, content: file.content }),
    })
    if (!res.ok) throw new Error(`export failed: ${res.status}`)
    return 'bot'
  }
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: file.filename })
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'download'
}
