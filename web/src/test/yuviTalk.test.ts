import { describe, expect, it } from 'vitest'
import { contextLines, FUN_LINES, markSeen, yuviTalk, type TalkContext, type TalkSeen } from '../lib/yuviTalk'
import { addDays } from '../lib/date'

const ctx = (today: string, extra: Partial<TalkContext> = {}): TalkContext => ({
  today,
  info: { day: 20, phase: 'luteal', predicted: false },
  mood: 4,
  streak: 3,
  periodInDays: 2,
  fertile: false,
  hasLabs: false,
  ...extra,
})

describe('реплики Юви', () => {
  it('у всех реплик уникальные id и тексты', () => {
    expect(new Set(FUN_LINES.map((l) => l.id)).size).toBe(FUN_LINES.length)
    expect(new Set(FUN_LINES.map((l) => l.text)).size).toBe(FUN_LINES.length)
    expect(FUN_LINES.length).toBeGreaterThanOrEqual(40)
  })

  it('лента: 2 лёгкие на 1 по данным, внутри ленты лёгкие не повторяются', () => {
    const feed = yuviTalk(ctx('2026-05-01'))
    expect(feed.slice(0, 3).map((l) => l.kind)).toEqual(['fun', 'fun', 'ctx'])
    const funIds = feed.filter((l) => l.kind === 'fun').map((l) => l.id)
    expect(new Set(funIds).size).toBe(funIds.length)
  })

  it('между запусками и днями лёгкие реплики не повторяются, пока не показан весь набор', () => {
    let seen: TalkSeen = {}
    const shown: string[] = []
    let day = '2026-05-01'
    // человек открывает главную по 3 раза в день и читает по 4 лёгкие реплики
    while (shown.length < FUN_LINES.length) {
      for (let open = 0; open < 3 && shown.length < FUN_LINES.length; open++) {
        const fun = yuviTalk(ctx(day), seen).filter((l) => l.kind === 'fun').slice(0, 4)
        for (const l of fun) {
          if (shown.length >= FUN_LINES.length) break
          shown.push(l.id)
          seen = markSeen(seen, l.id, day)
        }
      }
      day = addDays(day, 1)
    }
    expect(new Set(shown).size).toBe(FUN_LINES.length)
    // после полного круга первыми идут самые давние
    const next = yuviTalk(ctx(day), seen).find((l) => l.kind === 'fun')!
    expect(seen[next.id]).toBe('2026-05-01')
  })

  it('реплика по данным — не чаще раза в день', () => {
    const today = '2026-05-01'
    let seen: TalkSeen = {}
    const first = yuviTalk(ctx(today), seen).filter((l) => l.kind === 'ctx')
    for (const l of first) seen = markSeen(seen, l.id, today)
    expect(yuviTalk(ctx(today), seen).filter((l) => l.kind === 'ctx')).toEqual([])
    expect(yuviTalk(ctx(addDays(today, 1)), seen).filter((l) => l.kind === 'ctx').length).toBe(first.length)
  })

  it('реплики по данным соответствуют данным', () => {
    const ids = (c: TalkContext) => contextLines(c).map((l) => l.id)
    expect(ids(ctx('2026-05-01', { mood: undefined }))).toContain('c:ask-mood')
    expect(ids(ctx('2026-05-01', { mood: 2 }))).toContain('c:mood2')
    expect(ids(ctx('2026-05-01', { periodInDays: 10 }))).not.toContain('c:period-soon')
    expect(ids(ctx('2026-05-01', { hasLabs: true }))).not.toContain('c:labs')
    expect(ids(ctx('2026-05-01', { streak: 1 }))).not.toContain('c:streak')
    expect(contextLines(ctx('2026-05-01', { periodInDays: 1 })).find((l) => l.id === 'c:period-soon')?.text).toContain('1 день')
  })
})
