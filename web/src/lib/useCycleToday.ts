import { useMemo } from 'react'
import { useApp } from '../store/app'
import { dayInfo, nextPeriod } from './cycle'
import { today } from './date'

export function useCycleToday() {
  const cycle = useApp((s) => s.cycle)
  return useMemo(() => {
    const t = today()
    return { today: t, info: dayInfo(t, cycle, t), next: nextPeriod(cycle, t), settings: cycle }
  }, [cycle])
}
