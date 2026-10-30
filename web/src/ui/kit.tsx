import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, X } from 'lucide-react'
import { haptic, inTelegram } from '../lib/telegram'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }

export function Button({ variant = 'primary', className = '', onClick, ...rest }: BtnProps) {
  const base = 'h-14 w-full rounded-full text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100'
  const styles = {
    primary: 'bg-brand text-white shadow-btn',
    secondary: 'bg-white text-rose border border-line shadow-card',
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
      className={`block w-full rounded-card bg-surface p-4 text-left shadow-card ${onClick ? 'transition active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {action}
    </div>
  )
}

/** Шапка внутренних экранов. В Telegram «назад» — нативная кнопка, свою не рисуем. */
export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4">
        {!inTelegram && (
          <IconButton label="Назад" onClick={() => nav(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
        )}
        <h1 className="flex-1 truncate font-display text-[18px] font-bold">{title}</h1>
        {right}
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
      className={`grid size-9 shrink-0 place-items-center rounded-full bg-white/80 text-rose shadow-card transition active:scale-95 ${className}`}
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
      className={`rounded-2xl border px-4 py-3 text-[14px] font-medium transition active:scale-[0.97] ${
        active ? 'border-transparent bg-brand-soft text-ink ring-2 ring-rose/60' : 'border-line bg-white text-ink/80'
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
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-rose' : 'w-1.5 bg-rose/25'}`} />
      ))}
    </div>
  )
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-center text-[11px] text-muted ${className}`}>Это не заменяет консультацию врача</p>
}
