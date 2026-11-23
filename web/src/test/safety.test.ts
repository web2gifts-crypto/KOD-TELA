// Тесты «медицинской безопасности»: приложение не ставит диагнозы, не говорит «норма»,
// не советует лекарства и дозировки, а при красных флагах отправляет в 103/112.

import { describe, expect, it } from 'vitest'
import { buildVerdict, emergencyVerdict, FORBIDDEN, isEmergency, QUESTIONS, type Answers } from '../lib/triage'
import { violatesPolicy } from '../lib/assistant'
import { buildRecs, buildNotifications } from '../lib/insights'
import { PHASES, type Phase } from '../lib/cycle'
import { LAB_DISCLAIMER, LAB_INFO } from '../lib/labs'
import { FUN_LINES, MOOD_REACTIONS } from '../lib/yuviTalk'
import type { Verdict } from '../store/app'

const PHASE_LIST = Object.keys(PHASES) as Phase[]
const SYMPTOMS = ['Болит живот', 'Нерегулярный цикл', 'Усталость', 'Высыпания на коже', 'Болит голова', 'Постоянно хочется сладкого', 'Плохое настроение', 'Чешется ухо']

const textOf = (v: Verdict) => [v.title, v.explanation, ...v.plan, ...(v.whenDoctor ?? [])].join('\n')

/** все комбинации ответов на уточняющие вопросы */
function allAnswers(): Answers[] {
  let acc: Answers[] = [{}]
  for (const q of QUESTIONS) acc = acc.flatMap((a) => q.options.map((o) => ({ ...a, [q.id]: o })))
  return acc
}

describe('фильтр запрещённых формулировок', () => {
  it.each([
    'Похоже на вариант нормы',
    'Не переживай, это норма',
    'Ваш результат в пределах нормы',
    'Ничего страшного, пройдёт',
    'Принимай ибупрофен',
    'Выпей таблетку обезболивающего',
    'Пей магний 300 мг на ночь',
    'Витамин D 2000 МЕ в день',
    'У тебя дефицит железа',
  ])('ловит «%s»', (t) => expect(violatesPolicy(t)).toBe(true))

  it.each(['Ровно — и это нормально', 'Обратиться можно к терапевту', 'Отмечай симптом в дневнике', 'Ферритин, мкг/л'])('не трогает «%s»', (t) =>
    expect(violatesPolicy(t)).toBe(false),
  )
})

describe('красные флаги → скорая', () => {
  it.each([
    'у меня сильное кровотечение',
    'Кровотечение не останавливается уже час',
    'острая боль внизу живота',
    'боль в груди и тяжело',
    'кажется теряю сознание',
    'не могу дышать',
    'я беременна и сильно болит живот',
    'не хочу жить',
  ])('«%s» — экстренно', (t) => {
    expect(isEmergency(t)).toBe(true)
    const v = emergencyVerdict(t)
    expect(v.level).toBe('emergency')
    expect(textOf(v)).toMatch(/112|103|8-800/)
    expect(violatesPolicy(textOf(v))).toBe(false)
  })

  it('мысли о суициде → телефон доверия', () => {
    expect(textOf(emergencyVerdict('не хочу жить'))).toContain('8-800-2000-122')
  })

  it.each(['болит живот', 'устала', 'нерегулярный цикл', 'высыпания', 'тянет внизу'])('«%s» — не экстренно', (t) => expect(isEmergency(t)).toBe(false))
})

describe('ответы чата', () => {
  const combos = allAnswers()

  it('ни один ответ не говорит «норма», не ставит диагноз и не называет лекарства', () => {
    for (const s of SYMPTOMS)
      for (const phase of [null, ...PHASE_LIST])
        for (const a of combos) {
          const v = buildVerdict(s, a, phase)
          expect(['info', 'doctor']).toContain(v.level)
          const t = textOf(v)
          for (const r of FORBIDDEN) expect(t, `${s} / ${JSON.stringify(a)}`).not.toMatch(r)
        }
  })

  it('спокойный ответ всегда объясняет, когда идти к врачу', () => {
    const v = buildVerdict('Болит живот', { duration: 'Сегодня', severity: 'Слегка', meds: 'Нет', extra: 'Ничего из этого' }, 'luteal')
    expect(v.level).toBe('info')
    expect(v.whenDoctor?.length).toBeGreaterThanOrEqual(3)
    expect(v.whenDoctor?.[0]).toContain('гинеколог')
  })

  it.each([
    [{ extra: 'Температура выше 38°' }],
    [{ extra: 'Кровь вне месячных' }],
    [{ severity: 'Очень сильно' }],
    [{ duration: 'Больше 2 недель' }],
  ])('%j → к врачу', (a) => {
    const v = buildVerdict('Усталость', a as Answers, null)
    expect(v.level).toBe('doctor')
    expect(v.plan.join(' ')).toMatch(/103|112/)
  })

  it('приём гормонов — подсказка рассказать врачу о лекарствах', () => {
    const v = buildVerdict('Усталость', { meds: 'Гормональные / ОК' }, null)
    expect(v.whenDoctor?.join(' ')).toContain('лекарств')
  })
})

describe('остальные тексты приложения', () => {
  it('советы и уведомления — без лекарств, дозировок и оценок', () => {
    const texts: string[] = []
    for (const p of [null, ...PHASE_LIST]) {
      for (const r of buildRecs(p)) texts.push(r.title, r.text ?? '')
      for (const n of buildNotifications({ phase: p, cycleDay: 3, periodInDays: 2 })) texts.push(n.title, n.text ?? '')
    }
    for (const p of PHASE_LIST) texts.push(PHASES[p].hint)
    for (const t of texts) expect(violatesPolicy(t), t).toBe(false)
  })

  it('описания анализов нейтральны', () => {
    for (const l of LAB_INFO) expect(violatesPolicy(l.about), l.name).toBe(false)
    expect(LAB_DISCLAIMER).toContain('не оценивает')
  })

  it('реплики Юви — без запрещённого и без «Пузыри не грустят»', () => {
    for (const t of [...FUN_LINES.map((l) => l.text), ...MOOD_REACTIONS]) {
      expect(violatesPolicy(t), t).toBe(false)
      expect(t).not.toMatch(/пузыри не грустят/i)
    }
  })
})
