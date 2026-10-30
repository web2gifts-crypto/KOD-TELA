import { useMemo } from 'react'
import { useApp } from '../store/app'
import { buildCycleModel, type CycleSettings, type DayInfo } from './cycle'
import { today } from './date'

/** Цикл на сегодня: модель с прогнозом по истории + совместимые поля для экранов */
export function useCycleToday() {
  const cycle = useApp((s) => s.cycle)
  const periodDays = useApp((s) => s.periodDays)
  return useMemo(() => {
    const t = today()
    const model = buildCycleModel(periodDays, cycle, t)
    const st = model.status(t)
    const info: DayInfo | null = st ? { day: st.day, phase: st.phase, predicted: false } : null
    // эффективные настройки: длины — из истории, если она есть
    const settings: CycleSettings = { lastPeriodStart: model.lastStart, cycleLength: model.cycleLength, periodLength: model.periodLength }
    const next = model.nextPeriod && model.nextPeriod.inDays >= 0 ? model.nextPeriod : null
    return { today: t, model, info, next, settings }
  }, [cycle, periodDays])
}
