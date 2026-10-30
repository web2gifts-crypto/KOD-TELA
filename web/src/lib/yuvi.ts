// «Мозг» Юви: какое у него настроение и что он говорит.
// Настроение = отметка пользователя за сегодня, иначе — по данным (анализы, цикл).

import type { YuviMood } from '../ui/Yuvi'
import { MOOD_SCALE } from '../ui/Yuvi'
import type { DayInfo } from './cycle'
import { latestLabs } from './insights'
import { addDays, type ISODate } from './date'
import type { LabRecord } from '../store/app'

export function yuviState(opts: { moods: Record<ISODate, number>; labs: LabRecord[]; today: ISODate; info: DayInfo | null }): {
  mood: YuviMood
  message: string
} {
  const logged = opts.moods[opts.today]
  const evals = latestLabs(opts.labs)
  const bad = evals.filter((e) => e.status === 'bad')
  const warn = evals.filter((e) => e.status === 'warn')

  let mood: YuviMood = 'great'
  if (logged) mood = MOOD_SCALE[logged - 1]
  else if (bad.length) mood = 'anxious'
  else if (warn.length) mood = 'neutral'
  else if (opts.info?.phase === 'menstrual') mood = 'good'

  // что сказать: пока настроение не отмечено — зовёт открыть предсказание дня
  // (про отклонения в анализах говорит карточка «Юви советует»)
  if (!logged) return { mood, message: 'У меня для тебя предсказание на сегодня. Откроешь?' }
  const byMood: Record<YuviMood, string> = {
    great: 'У тебя отличный уровень энергии сегодня!',
    good: 'Хороший день! Не забудь про воду и прогулку 🌿',
    neutral: 'Обычный день — это тоже нормально. Я рядом.',
    anxious: 'Чувствую тревогу. Хочешь, поговорим?',
    bad: 'Мне жаль, что тебе тяжело. Давай позаботимся о тебе 💙',
  }
  if (opts.info?.phase === 'luteal' && (mood === 'neutral' || mood === 'bad'))
    return { mood, message: 'В лютеиновой фазе так бывает. Магний, тёплый чай и ранний сон помогут.' }
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
