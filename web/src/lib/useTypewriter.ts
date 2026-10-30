import { useEffect, useMemo, useState } from 'react'

// Текст печатается по одному символу, как ответ ИИ.
// Делим по графемам, чтобы эмодзи (🌡️, 👩‍⚕️) появлялись целиком, а не кусками.

function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter('ru', { granularity: 'grapheme' }).segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useTypewriter(text: string, msPerChar = 35) {
  const chars = useMemo(() => graphemes(text), [text])
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (reducedMotion()) {
      setCount(chars.length)
      return
    }
    setCount(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setCount(i)
      if (i >= chars.length) window.clearInterval(id)
    }, msPerChar)
    return () => window.clearInterval(id)
  }, [chars, msPerChar])

  return { shown: chars.slice(0, count).join(''), done: count >= chars.length }
}
