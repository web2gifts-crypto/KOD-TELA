// Напоминания в Telegram. Настройки синхронизируются с сервером (запись `reminders`),
// воркер на сервере присылает сообщения от бота. Формат совпадает с api/app/reminders.py.

export interface ReminderSettings {
  /** часовой пояс устройства — чтобы «в 21:00» значило 21:00 у пользователя */
  tz: string
  muted: boolean
  period: { on: boolean; daysBefore: number; time: string }
  fertile: { on: boolean; time: string }
  mood: { on: boolean; time: string }
  pill: { on: boolean; time: string }
}

export const deviceTz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'
  } catch {
    return 'Europe/Moscow'
  }
}

export const defaultReminders = (): ReminderSettings => ({
  tz: deviceTz(),
  muted: false,
  period: { on: true, daysBefore: 2, time: '10:00' },
  fertile: { on: false, time: '10:00' },
  mood: { on: false, time: '21:00' },
  pill: { on: false, time: '09:00' },
})

export type ReminderKind = 'period' | 'fertile' | 'mood' | 'pill'

export const REMINDER_INFO: Record<ReminderKind, { title: string; hint: string; emoji: string }> = {
  period: { title: 'Скоро месячные', hint: 'За несколько дней до начала по прогнозу', emoji: '🌸' },
  pill: { title: 'Таблетка', hint: 'Каждый день, кроме недели перерыва. Отметить «выпила» можно прямо в чате', emoji: '💊' },
  mood: { title: 'Отметить настроение', hint: 'Если за день ещё не отмечено', emoji: '😊' },
  fertile: { title: 'Фертильные дни', hint: 'Когда по прогнозу начинается фертильное окно', emoji: '📅' },
}
