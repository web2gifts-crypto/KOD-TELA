// Персональные рекомендации и уведомления из данных пользователя (цикл + анализы).
// Правила — заготовка; на этапе ИИ сюда подключится генерация с бэкенда.

import { PHASES, type Phase } from './cycle'
import { evaluate, type LabEval } from './labs'
import type { LabRecord } from '../store/app'

export type RecCategory = 'food' | 'activity' | 'supplements' | 'sleep'

export interface Rec {
  id: string
  category: RecCategory
  title: string
  text: string
}

export const CATEGORY: Record<RecCategory, { name: string; emoji: string; tint: string }> = {
  food: { name: 'Питание', emoji: '🥗', tint: '#dff3e6' },
  activity: { name: 'Активность', emoji: '🧘‍♀️', tint: '#e2eaff' },
  supplements: { name: 'Добавки', emoji: '💊', tint: '#f9def2' },
  sleep: { name: 'Сон', emoji: '😴', tint: '#fff0d6' },
}

/** Последнее значение каждого показателя по всем анализам */
export function latestLabs(labs: LabRecord[]): LabEval[] {
  const seen = new Map<string, LabEval>()
  for (const rec of [...labs].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    for (const it of rec.items) {
      if (seen.has(it.code)) continue
      const ev = evaluate(it.code, it.value)
      if (ev) seen.set(it.code, ev)
    }
  }
  return [...seen.values()]
}

const PHASE_RECS: Record<Phase, Omit<Rec, 'id'>[]> = {
  menstrual: [
    { category: 'food', title: 'Восполняй железо', text: 'Говядина, печень, гречка, чечевица + витамин C для усвоения.' },
    { category: 'activity', title: 'Мягкое движение', text: 'Прогулки, растяжка, йога — без рекордов.' },
    { category: 'sleep', title: 'Сон 8–9 часов', text: 'Организму сейчас нужно больше восстановления.' },
  ],
  follicular: [
    { category: 'food', title: 'Больше белка и зелени', text: 'Поддержи рост энергии: рыба, яйца, листовые овощи.' },
    { category: 'activity', title: 'Силовые и интервалы', text: 'Лучшее время для прогресса в тренировках.' },
    { category: 'sleep', title: 'Режим 7–8 часов', text: 'Ложись до 23:00 — энергия будет ровнее.' },
  ],
  ovulation: [
    { category: 'food', title: 'Клетчатка и антиоксиданты', text: 'Ягоды, овощи, цельные злаки — помогают выводу эстрогена.' },
    { category: 'activity', title: 'Пик формы', text: 'Можно интенсивнее: бег, HIIT, командный спорт.' },
    { category: 'sleep', title: 'Не засиживайся', text: 'Высокая энергия может мешать уснуть — убери экран за час до сна.' },
  ],
  luteal: [
    { category: 'food', title: 'Магний и сложные углеводы', text: 'Гречка, овсянка, орехи, тёмный шоколад — меньше тяги к сладкому.' },
    { category: 'activity', title: 'Умеренная нагрузка', text: 'Пилатес, плавание, ходьба. Восстановление дольше.' },
    { category: 'sleep', title: 'Прохладная спальня', text: 'Температура тела выше — проветривай перед сном.' },
  ],
}

const LAB_RECS: Record<string, Omit<Rec, 'id'>> = {
  'ferritin:low': { category: 'supplements', title: 'Железо 30–60 мг/сут', text: 'Только после консультации врача. Принимай отдельно от кофе и молочного.' },
  'hgb:low': { category: 'food', title: 'Увеличь железосодержащие продукты', text: 'Красное мясо 2–3 раза в неделю, печень, бобовые.' },
  'vitd:low': { category: 'supplements', title: 'Витамин D', text: 'Дозировку подберёт врач — обычно 2000–4000 МЕ в день.' },
  'b12:low': { category: 'supplements', title: 'Витамин B12', text: 'Обсуди с врачом форму и дозировку.' },
  'vitd:ok': { category: 'supplements', title: 'Поддерживай витамин D', text: 'Профилактическая доза 1000–2000 МЕ в осенне-зимний период.' },
  'glucose:high': { category: 'food', title: 'Меньше быстрых углеводов', text: 'Сладкое — после основного приёма пищи, а не на голодный желудок.' },
  'tsh:high': { category: 'sleep', title: 'Береги энергию', text: 'При повышенном ТТГ быстрее устаёшь — не жертвуй сном.' },
}

export function buildRecs(phase: Phase | null, labs: LabRecord[]): Rec[] {
  const out: Rec[] = []
  for (const ev of latestLabs(labs)) {
    const r = LAB_RECS[`${ev.def.code}:${ev.direction}`]
    if (r) out.push({ id: `lab-${ev.def.code}-${ev.direction}`, ...r })
  }
  if (phase) PHASE_RECS[phase].forEach((r, i) => out.push({ id: `ph-${phase}-${i}`, ...r }))
  if (!out.some((r) => r.category === 'supplements')) {
    out.push({ id: 'base-supp', category: 'supplements', title: 'Сначала анализы', text: 'Добавки подбираем по анализам — загрузи их, и я подскажу.' })
  }
  return out
}

export interface AppNotification {
  id: string
  icon: string
  title: string
  text: string
  ts: number
  to?: string
}

export function buildNotifications(opts: {
  phase: Phase | null
  cycleDay: number | null
  periodInDays: number | null
  labs: LabRecord[]
}): AppNotification[] {
  const list: AppNotification[] = []
  const latest = opts.labs[0]
  if (latest) {
    const ts = new Date(latest.date).getTime() + 12 * 3600_000
    for (const ev of latestLabs(opts.labs).filter((e) => e.status !== 'ok')) {
      list.push({
        id: `lab-${latest.id}-${ev.def.code}`,
        icon: ev.status === 'bad' ? '🔴' : '🟡',
        title: `${ev.def.name}: ${ev.direction === 'low' ? 'ниже' : 'выше'} нормы`,
        text: `${ev.note} ${ev.advice}.`,
        ts,
        to: `/labs/${latest.id}`,
      })
    }
    list.push({ id: `recs-${latest.id}`, icon: '✨', title: 'Новые рекомендации', text: 'Обновили советы по питанию на основе твоих анализов.', ts: ts - 1, to: '/recommendations' })
  }
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
      text: 'Возьми с собой всё необходимое и запланируй день помягче.',
      ts: Date.now() - 3600_000,
      to: '/cycle',
    })
  }
  return list.sort((a, b) => b.ts - a.ts)
}
