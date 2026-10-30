import { useId, useState } from 'react'

// Юви — маскот «Код Тела». Пузырь из вектора: цвет и лицо зависят от настроения,
// анимация (парение, «дыхание», моргание, взгляд) — CSS в styles.css.

export type YuviMood = 'great' | 'good' | 'neutral' | 'anxious' | 'bad'

export const YUVI_MOODS: Record<YuviMood, { label: string; caption: string; c: [string, string, string]; text: string }> = {
  great: { label: 'Отлично', caption: 'Данные в балансе', c: ['#f4f5ff', '#c9cdfb', '#93a0f1'], text: '#5b6cf0' },
  good: { label: 'Хорошо', caption: 'Небольшие изменения', c: ['#f0fff4', '#b9efc8', '#74d494'], text: '#2f9e63' },
  neutral: { label: 'Нейтрально', caption: 'Стоит обратить внимание', c: ['#fff8ec', '#ffdcaa', '#ffb35f'], text: '#d1801c' },
  anxious: { label: 'Тревожно', caption: 'Есть отклонения', c: ['#fff1f3', '#ffc3cc', '#ff8597'], text: '#e0546b' },
  bad: { label: 'Плохо', caption: 'Нужна забота и поддержка', c: ['#dfe6ff', '#7d93df', '#3a50b3'], text: '#3c51b8' },
}

/** порядок шкалы настроения 1..5 */
export const MOOD_SCALE: YuviMood[] = ['bad', 'anxious', 'neutral', 'good', 'great']

const INK = '#172463'

interface Props {
  mood?: YuviMood
  size?: number
  /** выключить анимацию (миниатюры в списках) */
  still?: boolean
  /** «говорит» — рот двигается */
  talking?: boolean
  /** глаза закрыты */
  sleepy?: boolean
  /** маленький пузырёк-спутник */
  companion?: boolean
  className?: string
  onClick?: () => void
  label?: string
  /** меняется — Юви «пружинит» (для внешнего управления, например при перетаскивании) */
  poke?: number
}

export function Yuvi({ mood = 'great', size = 120, still, talking, sleepy, companion = true, className = '', onClick, label, poke }: Props) {
  const id = useId().replace(/:/g, '')
  const [boing, setBoing] = useState(0)
  const [c0, c1, c2] = YUVI_MOODS[mood].c
  const bounce = poke ?? boing

  const svg = (
    <svg
      viewBox="0 0 120 124"
      width={size}
      height={(size * 124) / 120}
      className={`yuvi ${still ? 'yuvi-still' : ''} ${className}`}
      aria-hidden={!onClick}
      role={onClick ? undefined : 'img'}
      aria-label={onClick ? undefined : `Юви: ${YUVI_MOODS[mood].label.toLowerCase()}`}
    >
      <defs>
        <radialGradient id={`b${id}`} cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor={c0} />
          <stop offset=".55" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </radialGradient>
        <linearGradient id={`ir${id}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc8ee" stopOpacity=".55" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#a9d8ff" stopOpacity=".55" />
        </linearGradient>
        <radialGradient id={`hl${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sh${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={c2} stopOpacity=".45" />
          <stop offset="1" stopColor={c2} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="yuvi-shadow" cx="60" cy="116" rx="30" ry="5" fill={`url(#sh${id})`} />

      <g className="yuvi-float">
        <g key={bounce} className={`yuvi-body ${bounce ? 'yuvi-boing' : ''}`}>
          {/* тело-пузырь */}
          <circle cx="60" cy="58" r="44" fill={`url(#b${id})`} />
          <circle cx="60" cy="58" r="44" fill={`url(#ir${id})`} />
          <circle cx="60" cy="58" r="43.4" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.4" />
          {/* блики */}
          <ellipse cx="40" cy="32" rx="15" ry="8" transform="rotate(-32 40 32)" fill={`url(#hl${id})`} />
          <circle cx="83" cy="30" r="2.2" fill="#fff" opacity=".8" />
          <rect x="36" y="74" width="12" height="12" rx="2" transform="rotate(22 42 80)" fill="#fff" opacity=".28" />

          {/* лицо */}
          <g className="yuvi-face">
            <circle cx="40" cy="67" r="5.5" fill="#ff8fbf" opacity=".32" />
            <circle cx="80" cy="67" r="5.5" fill="#ff8fbf" opacity=".32" />
            <Brows mood={mood} />
            {sleepy ? (
              <g stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none">
                <path d="M41 57 Q47 61 53 57" />
                <path d="M67 57 Q73 61 79 57" />
              </g>
            ) : (
              <g className="yuvi-eyes">
                <g className="yuvi-pupils">
                  <Eye x={47} />
                  <Eye x={73} />
                </g>
              </g>
            )}
            <Mouth mood={mood} talking={talking} />
          </g>
        </g>
      </g>

      {companion && (
        <>
          {/* левый пузырёк — полупрозрачный */}
          <g className="yuvi-mini" opacity=".6">
            <circle cx="19" cy="98" r="11" fill={`url(#b${id})`} />
            <circle cx="19" cy="98" r="11" fill={`url(#ir${id})`} />
            <circle cx="19" cy="98" r="10.5" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1" />
            <ellipse cx="15" cy="93" rx="4" ry="2.2" transform="rotate(-30 15 93)" fill="#fff" opacity=".8" />
          </g>
          {/* правый — меньше и ещё прозрачнее, качается в своём ритме */}
          <g className="yuvi-mini-2" opacity=".38">
            <circle cx="103" cy="90" r="6" fill={`url(#b${id})`} />
            <circle cx="103" cy="90" r="6" fill={`url(#ir${id})`} />
            <circle cx="103" cy="90" r="5.6" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth=".8" />
            <ellipse cx="101" cy="87.5" rx="2.2" ry="1.2" transform="rotate(-30 101 87.5)" fill="#fff" opacity=".8" />
          </g>
        </>
      )}
    </svg>
  )

  if (!onClick) return svg
  return (
    <button
      type="button"
      aria-label={label ?? 'Открыть чат с Юви'}
      className="yuvi-btn"
      onClick={() => {
        setBoing((b) => b + 1)
        onClick()
      }}
    >
      {svg}
    </button>
  )
}

function Eye({ x }: { x: number }) {
  return (
    <g>
      <ellipse cx={x} cy="56" rx="6.4" ry="7.2" fill={INK} stroke="#fff" strokeWidth="1.3" />
      <circle cx={x + 2} cy="53" r="2.3" fill="#fff" />
      <circle cx={x - 2} cy="59.5" r="1" fill="#fff" opacity=".85" />
    </g>
  )
}

function Brows({ mood }: { mood: YuviMood }) {
  if (mood !== 'bad' && mood !== 'anxious') return null
  // грустные «домиком»
  return (
    <g stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" opacity=".75">
      <path d={mood === 'bad' ? 'M41 46 L51 43' : 'M41 45 Q46 42 51 44'} />
      <path d={mood === 'bad' ? 'M79 46 L69 43' : 'M79 45 Q74 42 69 44'} />
    </g>
  )
}

function Mouth({ mood, talking }: { mood: YuviMood; talking?: boolean }) {
  const s = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' }
  if (talking) return <ellipse className="yuvi-talk" cx="60" cy="70" rx="3.6" ry="3.4" fill={INK} />
  switch (mood) {
    case 'great':
      return (
        <g>
          <path d="M52 66 Q60 77 68 66 Z" fill={INK} />
          <path d="M55.5 71.5 Q60 74.5 64.5 71.5 Q60 69.5 55.5 71.5Z" fill="#ff8fa8" />
        </g>
      )
    case 'good':
      return <path d="M53.5 67 Q60 73 66.5 67" {...s} />
    case 'neutral':
      return <path d="M54.5 70 L65.5 70" {...s} />
    case 'anxious':
      return <path d="M53 71 Q56 68 59.5 70.5 Q63 73 67 69.5" {...s} />
    case 'bad':
      return <path d="M54 72 Q60 67 66 72" {...s} />
  }
}
