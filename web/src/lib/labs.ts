// Справочник показателей. Референсы — ориентировочные для взрослых женщин;
// финальные значения и тексты согласует медицинский эксперт проекта.

export type LabStatus = 'ok' | 'warn' | 'bad'

export interface LabDef {
  code: string
  name: string
  unit: string
  min: number
  max: number
  low: { note: string; advice: string }
  high: { note: string; advice: string }
  okAdvice: string
}

export const LABS: LabDef[] = [
  {
    code: 'hgb',
    name: 'Гемоглобин',
    unit: 'г/л',
    min: 120,
    max: 160,
    low: { note: 'Ниже нормы. Возможна анемия.', advice: 'Ешь больше красного мяса, печени, шпината и бобовых' },
    high: { note: 'Выше нормы. Бывает при обезвоживании.', advice: 'Пей больше воды и пересдай через 2–3 недели' },
    okAdvice: 'Отличный уровень — поддерживай разнообразное питание',
  },
  {
    code: 'ferritin',
    name: 'Ферритин',
    unit: 'мкг/л',
    min: 12,
    max: 150,
    low: { note: 'Низкий. Запасы железа истощены.', advice: 'Обратись к врачу для назначения препаратов железа' },
    high: { note: 'Повышен. Бывает при воспалении.', advice: 'Покажи результат терапевту — нужен контекст' },
    okAdvice: 'Запасы железа в порядке',
  },
  {
    code: 'vitd',
    name: 'Витамин D',
    unit: 'нг/мл',
    min: 30,
    max: 100,
    low: { note: 'Дефицит витамина D.', advice: 'Обсуди с врачом дозировку витамина D' },
    high: { note: 'Выше нормы — возможна передозировка.', advice: 'Приостанови добавки и обратись к врачу' },
    okAdvice: 'Продолжай принимать витамин D 1000–2000 МЕ',
  },
  {
    code: 'tsh',
    name: 'ТТГ',
    unit: 'мМЕ/л',
    min: 0.4,
    max: 4,
    low: { note: 'Снижен. Стоит проверить щитовидную железу.', advice: 'Сдай Т4 свободный и покажи эндокринологу' },
    high: { note: 'Повышен. Возможен гипотиреоз.', advice: 'Сдай Т4 свободный и анти-ТПО, запишись к эндокринологу' },
    okAdvice: 'Щитовидная железа работает стабильно',
  },
  {
    code: 'b12',
    name: 'Витамин B12',
    unit: 'пг/мл',
    min: 190,
    max: 900,
    low: { note: 'Низкий уровень B12.', advice: 'Добавь яйца, рыбу, мясо; обсуди добавку с врачом' },
    high: { note: 'Выше нормы.', advice: 'Если принимаешь добавки — сделай паузу' },
    okAdvice: 'B12 в норме',
  },
  {
    code: 'glucose',
    name: 'Глюкоза',
    unit: 'ммоль/л',
    min: 3.9,
    max: 5.5,
    low: { note: 'Низкий сахар.', advice: 'Не пропускай приёмы пищи, добавь сложные углеводы' },
    high: { note: 'Повышена натощак.', advice: 'Пересдай натощак и сдай гликированный гемоглобин' },
    okAdvice: 'Углеводный обмен в порядке',
  },
  {
    code: 'iron',
    name: 'Железо сывороточное',
    unit: 'мкмоль/л',
    min: 9,
    max: 30,
    low: { note: 'Ниже нормы.', advice: 'Смотри вместе с ферритином — добавь продукты с железом' },
    high: { note: 'Выше нормы.', advice: 'Если принимаешь железо — покажи результат врачу' },
    okAdvice: 'Железо в норме',
  },
]

export const LAB_BY_CODE = Object.fromEntries(LABS.map((l) => [l.code, l])) as Record<string, LabDef>

export interface LabEval {
  def: LabDef
  value: number
  status: LabStatus
  direction: 'low' | 'high' | 'ok'
  note: string
  advice: string
  /** положение значения на шкале 0..1 для прогресс-бара */
  position: number
}

/** Отклонение до 15% от границы — «обрати внимание», больше — «требует внимания». */
export function evaluate(code: string, value: number): LabEval | null {
  const def = LAB_BY_CODE[code]
  if (!def) return null
  const span = def.max - def.min
  const position = Math.min(1, Math.max(0.03, (value - (def.min - span * 0.25)) / (span * 1.5)))
  if (value < def.min || value > def.max) {
    const direction = value < def.min ? 'low' : 'high'
    const bound = direction === 'low' ? def.min : def.max
    const deviation = Math.abs(value - bound) / bound
    return { def, value, direction, status: deviation <= 0.15 ? 'warn' : 'bad', ...def[direction], position }
  }
  return { def, value, direction: 'ok', status: 'ok', note: 'В норме. Хороший результат!', advice: def.okAdvice, position }
}

export const STATUS_COLOR: Record<LabStatus, string> = {
  ok: 'var(--color-ok)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
}
