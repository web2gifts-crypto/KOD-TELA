// «Мозг» Юви: какое у него настроение и что он говорит.
// Настроение = отметка пользователя за сегодня, иначе — по фазе цикла.
// Результаты анализов на настроение Юви не влияют: приложение их не оценивает.

import type { YuviMood } from '../ui/Yuvi'
import { MOOD_SCALE } from '../ui/Yuvi'
import type { DayInfo } from './cycle'
import { addDays, type ISODate } from './date'

export function yuviState(opts: { moods: Record<ISODate, number>; today: ISODate; info: DayInfo | null }): {
  mood: YuviMood
  message: string
} {
  const logged = opts.moods[opts.today]

  let mood: YuviMood = 'great'
  if (logged) mood = MOOD_SCALE[logged - 1]
  else if (opts.info?.phase === 'menstrual') mood = 'good'

  // что сказать: пока настроение не отмечено — зовёт открыть предсказание дня
  if (!logged) return { mood, message: 'У меня для тебя предсказание на сегодня. Откроешь?' }
  const byMood: Record<YuviMood, string> = {
    great: 'У тебя отличный уровень энергии сегодня!',
    good: 'Хороший день! Не забудь про воду и прогулку 🌿',
    neutral: 'Обычный день — это тоже нормально. Я рядом.',
    anxious: 'Чувствую тревогу. Хочешь, поговорим?',
    bad: 'Мне жаль, что тебе тяжело. Давай позаботимся о тебе 💙',
  }
  if (opts.info?.phase === 'luteal' && (mood === 'neutral' || mood === 'bad'))
    return { mood, message: 'Во второй половине цикла так бывает. Тёплый чай и ранний сон — хорошая идея.' }
  return { mood, message: byMood[mood] }
}

/** Серия: сколько дней подряд отмечено настроение (сегодня или со вчера) */
export function moodStreak(moods: Record<ISODate, number>, today: ISODate): number {
  let d = moods[today] ? today : addDays(today, -1)
  let n = 0
  while (moods[d]) {
    n++
    d = addDays(d, -1)
  }
  return n
}
