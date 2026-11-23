import { Delete, Fingerprint, ScanFace } from 'lucide-react'
import { haptic } from '../lib/telegram'

/** Цифровая клавиатура для кода из 4 цифр */
export function PinPad({ value, onChange, error, bio, onBio }: { value: string; onChange: (v: string) => void; error?: boolean; bio?: 'face' | 'finger' | 'unknown' | null; onBio?: () => void }) {
  const press = (d: string) => {
    haptic.select()
    if (value.length < 4) onChange(value + d)
  }
  return (
    <div className="flex flex-col items-center">
      <div className={`flex gap-4 ${error ? 'anim-shake' : ''}`} aria-label={`Введено цифр: ${value.length} из 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-4 rounded-full border-2 transition ${error ? 'border-bad bg-bad' : i < value.length ? 'border-accent bg-accent' : 'border-muted/50'}`} />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)} label={d}>
            {d}
          </Key>
        ))}
        {bio && onBio ? (
          <Key onClick={onBio} label="Войти по биометрии">
            {bio === 'face' ? <ScanFace size={26} /> : <Fingerprint size={26} />}
          </Key>
        ) : (
          <span />
        )}
        <Key onClick={() => press('0')} label="0">
          0
        </Key>
        <Key onClick={() => onChange(value.slice(0, -1))} label="Стереть">
          <Delete size={24} />
        </Key>
      </div>
    </div>
  )
}

function Key({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="glass grid size-[72px] place-items-center rounded-full text-[26px] font-semibold text-ink shadow-card transition active:scale-95">
      {children}
    </button>
  )
}
