import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Yuvi } from './Yuvi'

/** Записка-предсказание Юви: экран размывается, слева Юви, справа — записка как из печенья */
export function PredictionOverlay({ text, onClose }: { text: string; onClose: () => void }) {

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Предсказание Юви на сегодня" className="prediction-backdrop fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="mx-auto w-full max-w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-white drop-shadow">Предсказание на сегодня</div>

        <div className="flex items-center gap-1">
          <div className="prediction-yuvi shrink-0">
            <Yuvi mood="great" size={112} />
          </div>

          {/* записка из печенья */}
          <button onClick={onClose} aria-label="Закрыть предсказание" className="prediction-note relative min-w-0 flex-1 text-left">
            <span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rotate-45 rounded-[3px] bg-[#fffaf0]" />
            <div className="relative rounded-2xl bg-[#fffaf0] px-4 py-4 shadow-[0_20px_40px_-18px_rgba(60,40,140,0.55)]">
              {/* край бумажной записки */}
              <span className="pointer-events-none absolute inset-1.5 rounded-xl border border-dashed border-[#e8d9bd]" />
              <p className="relative text-[16px] font-semibold italic leading-snug text-[#3a2e22]">«{text}»</p>
              <p className="relative mt-2 text-right text-[12px] font-semibold text-[#a08a6a]">— твой Юви 💙</p>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="prediction-close mx-auto mt-6 block rounded-full bg-white/90 px-8 py-3 text-[15px] font-bold text-accent shadow-card">
          Закрыть
        </button>
      </div>
    </div>,
    document.body,
  )
}
