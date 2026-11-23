// Советы и уведомления.
// Только общие советы по образу жизни с учётом фазы цикла (питание, движение, сон, забота о себе).
// Никаких советов по результатам анализов, лекарств, добавок и дозировок — это решает врач.

import { PHASES, type Phase } from './cycle'

export type RecCategory = 'food' | 'activity' | 'sleep' | 'selfcare'

export interface Rec {
  id: string
  category: RecCategory
  title: string
  text: string
}

export const CATEGORY: Record<RecCategory, { name: string; emoji: string; tint: string }> = {
  food: { name: 'Питание', emoji: '🥗', tint: '#dff3e6' },
  activity: { name: 'Движение', emoji: '🧘‍♀️', tint: '#e2eaff' },
  sleep: { name: 'Сон', emoji: '😴', tint: '#fff0d6' },
  selfcare: { name: 'Забота о себе', emoji: '💜', tint: '#f3e8ff' },
}

const PHASE_RECS: Record<Phase, Omit<Rec, 'id'>[]> = {
  menstrual: [
    { category: 'food', title: 'Тёплая и сытная еда', text: 'Супы, каши, тушёные овощи — в эти дни многим комфортнее тёплая пища.' },
    { category: 'activity', title: 'Мягкое движение', text: 'Прогулка, растяжка или йога — двигайся так, как приятно, без рекордов.' },
    { category: 'sleep', title: 'Больше отдыха', text: 'Если тянет поспать подольше — разреши себе. Ложись пораньше.' },
    { category: 'selfcare', title: 'Тепло и тишина', text: 'Грелка, плед, спокойный вечер. Запланируй день помягче, если можешь.' },
  ],
  follicular: [
    { category: 'food', title: 'Разнообразие на тарелке', text: 'Овощи, зелень, крупы, белок в каждом приёме пищи — хорошая база на каждый день.' },
    { category: 'activity', title: 'Время для активности', text: 'Многие чувствуют прилив сил — подходящее время попробовать новую тренировку.' },
    { category: 'sleep', title: 'Ровный режим', text: 'Ложиться и вставать в одно время — самый простой способ чувствовать себя бодрее.' },
    { category: 'selfcare', title: 'Новые начинания', text: 'Энергии больше — хороший момент для планов, которые давно откладывала.' },
  ],
  ovulation: [
    { category: 'food', title: 'Больше воды', text: 'Держи бутылку воды под рукой — особенно в активные дни.' },
    { category: 'activity', title: 'Пик энергии', text: 'Если чувствуешь силы — можно позаниматься интенсивнее. Слушай своё тело.' },
    { category: 'sleep', title: 'Экран — за час до сна', text: 'Энергии много, и уснуть бывает сложнее. Отложи телефон заранее.' },
    { category: 'selfcare', title: 'Время для общения', text: 'Встреча с друзьями или прогулка с близкими — отличная идея для этих дней.' },
  ],
  luteal: [
    { category: 'food', title: 'Регулярные приёмы пищи', text: 'Если тянет на сладкое — не пропускай обед и держи под рукой орехи или фрукты.' },
    { category: 'activity', title: 'Спокойный темп', text: 'Пилатес, плавание, ходьба — то, после чего хорошо, а не тяжело.' },
    { category: 'sleep', title: 'Прохладная спальня', text: 'Проветри комнату перед сном — многим так легче засыпать.' },
    { category: 'selfcare', title: 'Бережность к себе', text: 'Перепады настроения во второй половине цикла бывают у многих. Будь к себе мягче.' },
  ],
}

const GENERAL_RECS: Omit<Rec, 'id'>[] = [
  { category: 'food', title: 'Вода в течение дня', text: 'Стакан воды утром и бутылка под рукой — простая привычка на каждый день.' },
  { category: 'activity', title: '30 минут движения', text: 'Прогулка, лестница вместо лифта, танцы — всё считается.' },
  { category: 'sleep', title: '7–9 часов сна', text: 'Регулярный сон — основа хорошего самочувствия.' },
  { category: 'selfcare', title: 'Отмечай самочувствие', text: 'Записи в дневнике помогут заметить, как цикл влияет на твоё состояние.' },
]

export function buildRecs(phase: Phase | null): Rec[] {
  const list = phase ? PHASE_RECS[phase].map((r, i) => ({ id: `ph-${phase}-${i}`, ...r })) : []
  return [...list, ...GENERAL_RECS.map((r, i) => ({ id: `gen-${i}`, ...r }))]
}

export interface AppNotification {
  id: string
  icon: string
  title: string
  text: string
  ts: number
  to?: string
}

export function buildNotifications(opts: { phase: Phase | null; cycleDay: number | null; periodInDays: number | null }): AppNotification[] {
  const list: AppNotification[] = []
  if (opts.phase && opts.cycleDay) {
    list.push({
      id: `cycle-day-${opts.cycleDay}-${opts.phase}`,
      icon: '📅',
      title: `День ${opts.cycleDay} цикла`,
      text: PHASES[opts.phase].hint,
      ts: Date.now() - 2 * 3600_000,
      to: '/cycle',
    })
  }
  if (opts.periodInDays !== null && opts.periodInDays >= 0 && opts.periodInDays <= 3) {
    list.push({
      id: `period-soon-${opts.periodInDays}`,
      icon: '🌸',
      title: opts.periodInDays === 0 ? 'Сегодня ожидаются месячные' : `Месячные через ${opts.periodInDays} дн.`,
      text: 'Положи всё необходимое в сумку и запланируй день помягче.',
      ts: Date.now() - 3600_000,
      to: '/cycle',
    })
  }
  return list.sort((a, b) => b.ts - a.ts)
}
