import { PageHeader } from '../ui/kit'
import { MOOD_SCALE, Yuvi, YUVI_MOODS } from '../ui/Yuvi'

/** «Индикатор настроения Юви» — объясняет, что значит цвет Юви */
export function YuviGuide() {
  return (
    <div>
      <PageHeader title="Индикатор настроения Юви" />
      <div className="px-4 pb-6">
        <div className="glass rounded-card p-2 shadow-card">
          {[...MOOD_SCALE].reverse().map((m, i) => (
            <div key={m} className={`flex items-center gap-4 px-3 py-3 ${i ? 'border-t border-line' : ''}`}>
              <Yuvi mood={m} size={64} companion={false} />
              <div>
                <div className="text-[16px] font-bold" style={{ color: YUVI_MOODS[m].text }}>
                  {YUVI_MOODS[m].label}
                </div>
                <div className="text-[13px] text-muted">{YUVI_MOODS[m].caption}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 px-2 text-center text-[13px] leading-relaxed text-muted">
          Юви меняет цвет и выражение в зависимости от твоего настроения и данных: анализов, цикла и самочувствия.
        </p>
      </div>
    </div>
  )
}
