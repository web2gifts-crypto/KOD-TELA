import { Heart, Sparkle } from 'lucide-react'
import { YUVI_MOODS, type YuviMood } from './Yuvi'

// Фон за Юви на экране настроения: у каждого настроения своя «погода».
// Все сцены лежат слоями и плавно меняются через opacity.

type Deco = 'sparkles' | 'hearts' | 'rain'

export const SCENES: Record<YuviMood, { bg: string; dark?: boolean; deco: Deco }> = {
  great: { bg: 'linear-gradient(160deg, #eef0ff 0%, #d9ddff 50%, #f2e6ff 100%)', deco: 'sparkles' },
  good: { bg: 'linear-gradient(160deg, #e9fbf1 0%, #c8f0da 50%, #e6f4ff 100%)', deco: 'sparkles' },
  neutral: { bg: 'linear-gradient(160deg, #fff6e8 0%, #ffe0bc 55%, #fff0f3 100%)', deco: 'sparkles' },
  anxious: { bg: 'linear-gradient(160deg, #fff0f3 0%, #ffd0da 55%, #f4e8ff 100%)', deco: 'hearts' },
  bad: { bg: 'linear-gradient(170deg, #5468cc 0%, #34449a 55%, #252f6f 100%)', dark: true, deco: 'rain' },
}

const SPARKLES = [
  { l: '10%', t: '14%', s: 18, d: '0s' },
  { l: '84%', t: '10%', s: 24, d: '0.8s' },
  { l: '78%', t: '52%', s: 14, d: '1.6s' },
  { l: '14%', t: '58%', s: 12, d: '2.2s' },
  { l: '50%', t: '6%', s: 10, d: '1.2s' },
]
const HEARTS = [
  { l: '12%', s: 16, d: '0s' },
  { l: '82%', s: 20, d: '1.4s' },
  { l: '26%', s: 12, d: '2.6s' },
  { l: '70%', s: 14, d: '3.4s' },
]
const DROPS = Array.from({ length: 16 }, (_, i) => ({ l: `${(i * 61) % 100}%`, d: `${((i * 0.37) % 1.4).toFixed(2)}s`, h: 10 + ((i * 7) % 9) }))

function Decor({ deco, mood }: { deco: Deco; mood: YuviMood }) {
  if (deco === 'rain')
    return (
      <>
        {DROPS.map((p, i) => (
          <span key={i} className="scene-drop absolute top-0 w-[2px] rounded-full bg-white/35" style={{ left: p.l, height: p.h, animationDelay: p.d }} />
        ))}
      </>
    )
  if (deco === 'hearts')
    return (
      <>
        {HEARTS.map((p, i) => (
          <Heart key={i} className="scene-float absolute bottom-0 fill-white/70 text-white/70" size={p.s} style={{ left: p.l, animationDelay: p.d }} />
        ))}
      </>
    )
  return (
    <>
      {SPARKLES.map((p, i) => (
        <Sparkle key={i} className="scene-twinkle absolute fill-white text-white" size={p.s} style={{ left: p.l, top: p.t, animationDelay: p.d, color: YUVI_MOODS[mood].c[0] }} />
      ))}
    </>
  )
}

/** Слои всех сцен; видима только текущая */
export function MoodScene({ mood }: { mood: YuviMood }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {(Object.keys(SCENES) as YuviMood[]).map((m) => {
        const sc = SCENES[m]
        const [, c1, c2] = YUVI_MOODS[m].c
        return (
          <div key={m} className="absolute inset-0 overflow-hidden transition-opacity duration-700" style={{ opacity: m === mood ? 1 : 0, background: sc.bg }}>
            {/* мягкие пятна цвета Юви */}
            <span className="absolute -left-10 top-6 size-44 rounded-full blur-2xl" style={{ background: c1, opacity: sc.dark ? 0.35 : 0.55 }} />
            <span className="absolute -right-12 bottom-0 size-52 rounded-full blur-3xl" style={{ background: c2, opacity: sc.dark ? 0.45 : 0.3 }} />
            {m === mood && <Decor deco={sc.deco} mood={m} />}
          </div>
        )
      })}
    </div>
  )
}
