// Нейтральный график динамики (без «норм» и цветов «хорошо/плохо»)
export function Sparkline({ points, height = 40, className = '' }: { points: number[]; height?: number; className?: string }) {
  if (points.length < 2) return null
  const w = 120
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const y = (v: number) => height - 5 - ((v - lo) / (hi - lo || 1)) * (height - 10)
  const x = (i: number) => (i / (points.length - 1)) * (w - 8) + 4
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={`w-full ${className}`} style={{ height }} preserveAspectRatio="none" aria-hidden>
      <polyline
        points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
