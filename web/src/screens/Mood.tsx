import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Info, PenLine } from 'lucide-react'
import { useApp } from '../store/app'
import { Button, Card, Chip, IconButton, PageHeader } from '../ui/kit'
import { MOOD_SCALE, Yuvi, YUVI_MOODS } from '../ui/Yuvi'
import { MoodScene, SCENES } from '../ui/MoodScene'
import { addDays, fromISO, today as todayISO } from '../lib/date'
import { moodStreak } from '../lib/yuvi'
import { haptic } from '../lib/telegram'

const FACTORS = ['Сон', 'Питание', 'Активность', 'Цикл', 'Работа', 'Отношения', 'Стресс', 'Другое']
const SUBTITLE = {
  great: 'Ты на высоте 💙',
  good: 'Хороший день 🌿',
  neutral: 'Ровно — и это нормально',
  anxious: 'Я рядом, давай разберёмся',
  bad: 'Позаботимся о тебе вместе',
}

export function Mood() {
  const nav = useNavigate()
  const { moods, moodNotes, setMood } = useApp()
  const today = todayISO()
  const [value, setValue] = useState(moods[today] ?? 5)
  const [factors, setFactors] = useState<string[]>(moodNotes[today]?.factors ?? [])
  const [note, setNote] = useState(moodNotes[today]?.note ?? '')
  const mood = MOOD_SCALE[value - 1]
  const st = YUVI_MOODS[mood]

  const save = () => {
    setMood(today, value, { factors, note: note.trim() })
    haptic.success()
    nav(-1)
  }

  return (
    <div>
      <PageHeader
        title="Настроение Юви"
        right={
          <IconButton label="Что значит цвет Юви" onClick={() => nav('/yuvi')}>
            <Info size={18} />
          </IconButton>
        }
      />
      <div className="px-4 pb-8">
        {/* Юви на фоне «погоды» своего настроения */}
        <div className="relative flex flex-col items-center overflow-hidden rounded-[2rem] pb-6 pt-4 shadow-card">
          <MoodScene mood={mood} />
          <Yuvi key={mood} mood={mood} size={190} className="anim-pop relative" />
          <div className="relative mt-1 text-[30px] font-bold transition-colors duration-500" style={{ color: SCENES[mood].dark ? '#fff' : st.text }}>
            {st.label}!
          </div>
          <div className={`relative text-[14px] transition-colors duration-500 ${SCENES[mood].dark ? 'text-white/80' : 'text-muted'}`}>{SUBTITLE[mood]}</div>
        </div>

        {/* выбор */}
        <Card className="mt-2 flex justify-between px-3!">
          {MOOD_SCALE.map((m, i) => (
            <button
              key={m}
              aria-label={YUVI_MOODS[m].label}
              aria-pressed={value === i + 1}
              onClick={() => {
                haptic.select()
                setValue(i + 1)
              }}
              className={`rounded-full p-1 transition ${value === i + 1 ? 'scale-110 bg-white shadow-card ring-2' : 'opacity-75'}`}
              style={{ ['--tw-ring-color' as string]: YUVI_MOODS[m].c[2] }}
            >
              <Yuvi mood={m} size={48} still companion={false} />
            </button>
          ))}
        </Card>

        <Card className="mt-3">
          <div className="mb-3 text-[15px] font-bold">Что повлияло на настроение?</div>
          <div className="flex flex-wrap gap-2">
            {FACTORS.map((f) => (
              <Chip key={f} active={factors.includes(f)} onClick={() => setFactors((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]))} className="px-3.5! py-2! text-[13px]!">
                {f}
              </Chip>
            ))}
          </div>
        </Card>

        <label className="glass mt-3 flex items-center gap-2 rounded-card px-4 shadow-card">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка для себя…" maxLength={200} className="h-14 flex-1 bg-transparent text-[15px] outline-none" />
          <PenLine size={18} className="text-accent" />
        </label>

        <Button onClick={save} className="relative mt-5">
          Сохранить
          <span className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-accent">
            <Check size={20} strokeWidth={3} />
          </span>
        </Button>

        <MoodHistory moods={moods} today={today} />
      </div>
    </div>
  )
}

/** Статистика за 14 дней: столбики цвета настроения + серия */
function MoodHistory({ moods, today }: { moods: Record<string, number>; today: string }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const streak = moodStreak(moods, today)
  return (
    <Card className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[15px] font-bold">Последние 2 недели</span>
        {streak > 0 && <span className="text-[13px] font-semibold text-[#e07a1f]">🔥 {streak} подряд</span>}
      </div>
      <div className="flex h-28 items-end justify-between gap-1">
        {days.map((d) => {
          const v = moods[d]
          const m = v ? YUVI_MOODS[MOOD_SCALE[v - 1]] : null
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full max-w-3.5 rounded-full"
                style={{ height: v ? `${v * 18}px` : '6px', background: m ? `linear-gradient(${m.c[1]}, ${m.c[2]})` : 'var(--color-line)' }}
              />
              <span className={`text-[9px] ${d === today ? 'font-bold text-accent' : 'text-muted'}`}>{fromISO(d).getDate()}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
