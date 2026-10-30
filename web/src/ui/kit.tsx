import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, X } from 'lucide-react'
import { haptic, inTelegram } from '../lib/telegram'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }

export function Button({ variant = 'primary', className = '', onClick, ...rest }: BtnProps) {
  const base = 'h-14 w-full rounded-full text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100'
  const styles = {
    primary: 'bg-brand text-white shadow-btn',
    secondary: 'glass text-accent shadow-card',
    ghost: 'text-muted',
  }[variant]
  return (
    <button
      className={`${base} ${styles} ${className}`}
      onClick={(e) => {
        haptic.tap()
        onClick?.(e)
      }}
      {...rest}
    />
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`glass block w-full rounded-card p-4 text-left shadow-card ${onClick ? 'transition active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[16px] font-bold">{children}</h2>
      {action}
    </div>
  )
}

/** Шапка внутренних экранов: заголовок по центру. В Telegram «назад» — нативная кнопка. */
export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/70 backdrop-blur-xl">
      <div className="relative flex h-14 items-center justify-between px-4">
        {inTelegram ? (
          <span className="size-9" />
        ) : (
          <IconButton label="Назад" onClick={() => nav(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
        )}
        <h1 className="absolute inset-x-16 truncate text-center text-[17px] font-bold">{title}</h1>
        {right ?? <span className="size-9" />}
      </div>
    </header>
  )
}

export function IconButton({ children, label, onClick, className = '' }: { children: ReactNode; label: string; onClick?: () => void; className?: string }) {
  return (
    <button
      aria-label={label}
      onClick={() => {
        haptic.tap()
        onClick?.()
      }}
      className={`glass grid size-9 shrink-0 place-items-center rounded-full text-accent shadow-card transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  )
}

export function CloseButton() {
  const nav = useNavigate()
  return (
    <IconButton label="Закрыть" onClick={() => nav('/')}>
      <X size={18} />
    </IconButton>
  )
}

export function Chip({ active, children, onClick, className = '' }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={() => {
        haptic.select()
        onClick?.()
      }}
      className={`rounded-full px-4 py-2.5 text-[14px] font-medium transition active:scale-[0.97] ${
        active ? 'bg-accent text-white shadow-btn' : 'bg-accent-soft text-accent'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-accent' : 'w-1.5 bg-accent/25'}`} />
      ))}
    </div>
  )
}

/** Реплика Юви — «облачко» с хвостиком */
export function SpeechBubble({ children, className = '', tail = 'left' }: { children: ReactNode; className?: string; tail?: 'left' | 'top' | 'right' }) {
  const tailPos = { left: '-left-1.5 top-5', top: 'left-8 -top-1.5', right: '-right-1.5 top-5' }[tail]
  return (
    <div className={`glass relative rounded-3xl px-4 py-3 text-[14px] leading-snug shadow-card ${className}`}>
      <span className={`absolute size-3.5 rotate-45 rounded-[3px] bg-white/80 ${tailPos}`} />
      <div className="relative">{children}</div>
    </div>
  )
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-center text-[11px] text-muted ${className}`}>Это не заменяет консультацию врача</p>
}

export type Tone = 'violet' | 'blue' | 'pink' | 'peach' | 'mint' | 'red'

export const TONES: Record<Tone, { g1: string; g2: string; soft: string; text: string }> = {
  violet: { g1: '#c9bcff', g2: '#7b6cf6', soft: '#efecff', text: '#6a5be6' },
  blue: { g1: '#b3d0ff', g2: '#5d86f8', soft: '#e8f0ff', text: '#3f6ae6' },
  pink: { g1: '#ffc6e6', g2: '#ef6aae', soft: '#ffeaf5', text: '#d2448f' },
  peach: { g1: '#ffdcb5', g2: '#ff9a5c', soft: '#fff1e4', text: '#d9712d' },
  mint: { g1: '#bdf2df', g2: '#2fbf98', soft: '#e3f8f0', text: '#1e9a78' },
  red: { g1: '#ffbcc5', g2: '#e8566c', soft: '#ffeaed', text: '#d23f57' },
}

/** Объёмная «стеклянная» иконка: градиент тона + блик */
export function GlassIcon({ icon: Icon, tone = 'violet', size = 44 }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; tone?: Tone; size?: number }) {
  const t = TONES[tone]
  return (
    <span className="gicon" style={{ width: size, height: size, ['--g1' as string]: t.g1, ['--g2' as string]: t.g2 }}>
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.3} />
    </span>
  )
}
