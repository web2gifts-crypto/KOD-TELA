import { describe, expect, it } from 'vitest'
import { merge, pick, SYNC_KEYS, toState } from '../lib/sync'
import { migrateState, useApp } from '../store/app'

describe('синхронизация: объединение правок с двух устройств', () => {
  it('дни и настроение — объединяются, локальные правки важнее', () => {
    expect(merge('moods', { a: 1, b: 2 }, { b: 5, c: 3 })).toEqual({ a: 1, b: 5, c: 3 })
    expect(merge('periodDays', { '2026-01-01': 2 }, { '2026-01-02': 3 })).toEqual({ '2026-01-01': 2, '2026-01-02': 3 })
  })

  it('анализы и чаты — по id, без дублей, по порядку', () => {
    const s = [
      { id: 'x', date: '2026-01-01' },
      { id: 'y', date: '2026-03-01' },
    ]
    const l = [
      { id: 'y', date: '2026-03-02' },
      { id: 'z', date: '2026-02-01' },
    ]
    expect(merge('labs', s, l)).toEqual([
      { id: 'y', date: '2026-03-02' },
      { id: 'z', date: '2026-02-01' },
      { id: 'x', date: '2026-01-01' },
    ])
    const chats = merge('chats', [{ id: 'a', startedAt: 1 }], [{ id: 'b', startedAt: 2 }]) as { id: string }[]
    expect(chats.map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('настройки — списки и память реплик объединяются', () => {
    const m = merge('prefs', { favorites: ['a'], readNotifications: ['n1'], talkSeen: { f1: '2026-01-01' }, introSeen: true }, { favorites: ['b'], readNotifications: [], talkSeen: { f2: '2026-01-02' }, introSeen: false }) as Record<string, unknown>
    expect(m.favorites).toEqual(['a', 'b'])
    expect(m.readNotifications).toEqual(['n1'])
    expect(m.talkSeen).toEqual({ f1: '2026-01-01', f2: '2026-01-02' })
  })

  it('пустая сторона — берётся другая', () => {
    expect(merge('labs', null, [{ id: 'a', date: '' }])).toEqual([{ id: 'a', date: '' }])
    expect(merge('profile', { name: 'A' }, null)).toEqual({ name: 'A' })
  })

  it('каждый ключ туда-обратно без потерь', () => {
    const st = migrateState({ moods: { d: 3 }, favorites: ['r1'], introSeen: true })
    for (const k of SYNC_KEYS) expect(pick({ ...st, ...toState(k, pick(st, k)) }, k)).toEqual(pick(st, k))
  })

  it('дни месячных с сервера — начала и последние месячные пересчитываются', () => {
    useApp.getState().applyRemote({ periodDays: { '2026-01-01': 2, '2026-01-02': 2, '2026-01-29': 3 } })
    const st = useApp.getState()
    expect(st.periodStarts).toEqual(['2026-01-01', '2026-01-29'])
    expect(st.cycle.lastPeriodStart).toBe('2026-01-29')
  })
})
