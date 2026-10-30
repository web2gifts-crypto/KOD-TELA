import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useApp } from '../store/app'
import { useCycleToday } from '../lib/useCycleToday'
import { yuviState } from '../lib/yuvi'
import { haptic } from '../lib/telegram'
import { Yuvi } from './Yuvi'

// Юви всегда рядом: парит поверх экранов, его можно перетащить пальцем —
// после отпускания он «примагничивается» к ближайшему краю. Тап — чат.

const SIZE = 68
const BOX_W = 72
const BOX_H = 76
const EDGE = 6
const TAB_BAR = 68
const DRAG_THRESHOLD = 6
const STORE_KEY = 'yuvi-pos'

type Side = 'left' | 'right'

function cssPx(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

/** колонка приложения (max-w 480, по центру) и допустимый диапазон по вертикали */
function frame() {
  const width = Math.min(window.innerWidth, 480)
  const left = (window.innerWidth - width) / 2
  const yMin = cssPx('--tg-content-top') + 64
  const yMax = window.innerHeight - TAB_BAR - cssPx('--tg-content-bottom') - BOX_H - 10
  return { left, width, yMin, yMax: Math.max(yMin, yMax) }
}

function snapX(side: Side) {
  const f = frame()
  return side === 'left' ? f.left + EDGE : f.left + f.width - BOX_W - EDGE
}

function loadPos(): { side: Side; ratio: number } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '')
    if ((v.side === 'left' || v.side === 'right') && typeof v.ratio === 'number') return v
  } catch {
    /* позиции ещё нет */
  }
  return { side: 'right', ratio: 1 }
}

export function FloatingYuvi() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { moods, labs, introSeen } = useApp()
  const { today, info } = useCycleToday()
  const state = yuviState({ moods, labs, today, info })

  const [saved, setSaved] = useState(loadPos)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [poke, setPoke] = useState(0)
  const [hint, setHint] = useState(false)
  const [, setTick] = useState(0)
  const gesture = useRef<{ px: number; py: number; x0: number; y0: number; moved: boolean } | null>(null)

  // пересчитать позицию при повороте/ресайзе
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // реплика один раз за сессию на главной
  useEffect(() => {
    if (pathname !== '/' || !introSeen || sessionStorage.getItem('yuvi-hint')) return
    const show = window.setTimeout(() => setHint(true), 900)
    const hide = window.setTimeout(() => setHint(false), 6500)
    sessionStorage.setItem('yuvi-hint', '1')
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [pathname, introSeen])

  const f = frame()
  const restY = f.yMin + saved.ratio * (f.yMax - f.yMin)
  const x = drag?.x ?? snapX(saved.side)
  const y = drag?.y ?? restY

  const openChat = () => {
    haptic.tap()
    setHint(false)
    setPoke((p) => p + 1)
    window.setTimeout(() => nav('/chat'), 220)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { px: e.clientX, py: e.clientY, x0: x, y0: y, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.px
    const dy = e.clientY - g.py
    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!g.moved) {
      g.moved = true
      setHint(false)
      haptic.select()
    }
    setDrag({ x: g.x0 + dx, y: g.y0 + dy })
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (!g.moved) return openChat()
    // примагнититься к ближайшему краю
    const fr = frame()
    const cx = (drag?.x ?? x) + BOX_W / 2
    const side: Side = cx < fr.left + fr.width / 2 ? 'left' : 'right'
    const cy = Math.min(fr.yMax, Math.max(fr.yMin, drag?.y ?? y))
    const next = { side, ratio: fr.yMax > fr.yMin ? (cy - fr.yMin) / (fr.yMax - fr.yMin) : 1 }
    setSaved(next)
    setDrag(null)
    setPoke((p) => p + 1)
    haptic.tap()
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next))
    } catch {
      /* без сохранения позиции */
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Юви — открыть чат. Можно перетащить"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openChat()}
      className="fixed left-0 top-0 z-40 select-none outline-none"
      style={{
        width: BOX_W,
        height: BOX_H,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        transition: drag ? 'none' : 'transform 0.55s cubic-bezier(0.2, 1.3, 0.35, 1)',
        touchAction: 'none',
      }}
    >
      {hint && (
        <div
          className={`anim-pop glass absolute top-0 w-[210px] rounded-3xl px-4 py-2.5 text-[13px] leading-snug shadow-card ${
            saved.side === 'right' ? 'right-full mr-1 rounded-br-md' : 'left-full ml-1 rounded-bl-md'
          }`}
        >
          {state.message}
        </div>
      )}
      <div className={`grid size-full place-items-center transition-transform duration-200 drop-shadow-[0_10px_18px_rgba(110,100,240,0.35)] ${drag ? 'scale-110' : ''}`}>
        <Yuvi mood={state.mood} size={SIZE} poke={poke} companion={!drag} />
      </div>
    </div>
  )
}
