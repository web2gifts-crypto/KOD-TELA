// Базовый аватар (по ТЗ — без геймификации). 4 пресета, как в прототипе.

export interface AvatarPreset {
  id: string
  name: string
  skin: string
  hair: string
  top: string
  bg: string
  bun?: boolean
}

export const AVATARS: AvatarPreset[] = [
  { id: 'anya', name: 'Аня', skin: '#ffd9bf', hair: '#4a2c1d', top: '#e58fc9', bg: '#f6dcf0' },
  { id: 'mia', name: 'Мия', skin: '#b9825c', hair: '#2a1a12', top: '#95beff', bg: '#dfe8ff', bun: true },
  { id: 'sonya', name: 'Соня', skin: '#ffe0c8', hair: '#c9893f', top: '#fcb3ef', bg: '#fdeaf7' },
  { id: 'eva', name: 'Ева', skin: '#f3c7a5', hair: '#3a2416', top: '#ffd48a', bg: '#fff1d6', bun: true },
]

export function Avatar({ id, size = 64, ring }: { id: string; size?: number; ring?: boolean }) {
  const p = AVATARS.find((a) => a.id === id) ?? AVATARS[0]
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={p.name} className={ring ? 'rounded-full ring-2 ring-rose' : 'rounded-full'}>
      <circle cx="50" cy="50" r="50" fill={p.bg} />
      <clipPath id={`c-${p.id}-${size}`}>
        <circle cx="50" cy="50" r="50" />
      </clipPath>
      <g clipPath={`url(#c-${p.id}-${size})`}>
        {/* плечи */}
        <path d="M18 104c2-20 16-30 32-30s30 10 32 30z" fill={p.top} />
        <rect x="43" y="62" width="14" height="14" rx="6" fill={p.skin} />
        {/* волосы сзади */}
        <path d="M24 50c0-20 11-32 26-32s26 12 26 32v18c-6 4-46 4-52 0z" fill={p.hair} />
        {p.bun && <circle cx="50" cy="15" r="9" fill={p.hair} />}
        {/* лицо */}
        <ellipse cx="50" cy="48" rx="20" ry="21" fill={p.skin} />
        {/* чёлка */}
        <path d="M29 44c2-14 11-22 21-22s20 8 22 22c-8-1-15-6-19-12-4 7-14 12-24 12z" fill={p.hair} />
        <circle cx="42" cy="50" r="2.6" fill="#2b2233" />
        <circle cx="58" cy="50" r="2.6" fill="#2b2233" />
        <circle cx="42.8" cy="49.2" r="0.8" fill="#fff" />
        <circle cx="58.8" cy="49.2" r="0.8" fill="#fff" />
        <circle cx="37" cy="57" r="3.4" fill="#f59fb8" opacity=".55" />
        <circle cx="63" cy="57" r="3.4" fill="#f59fb8" opacity=".55" />
        <path d="M45 59c3 3 7 3 10 0" stroke="#b5566e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}
