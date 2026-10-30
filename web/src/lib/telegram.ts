// Тонкая обёртка над Telegram WebApp API.
// Вне Telegram (локальная разработка в браузере) всё работает на заглушках.

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: TgUser; start_param?: string }
  version: string
  platform: string
  ready(): void
  expand(): void
  close(): void
  isVersionAtLeast(v: string): boolean
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  setBottomBarColor?(color: string): void
  disableVerticalSwipes?(): void
  /** Bot API 8.0: полноэкранный режим */
  isFullscreen?: boolean
  requestFullscreen?(): void
  openLink(url: string): void
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  HapticFeedback: {
    impactOccurred(style: HapticStyle): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  contentSafeAreaInset?: { top: number; bottom: number }
  safeAreaInset?: { top: number; bottom: number }
  onEvent(event: string, cb: () => void): void
}

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp }
  }
}

const tg: TgWebApp | undefined = window.Telegram?.WebApp
/** true — запущено внутри Telegram (есть подписанные initData) */
export const inTelegram = Boolean(tg?.initData)

const DEV_USER: TgUser = { id: 1, first_name: 'Катя' }

export function getUser(): TgUser {
  return (inTelegram && tg?.initDataUnsafe.user) || DEV_USER
}

/** Сырые initData — уходят на бэкенд для проверки подписи (HMAC) */
export function getInitData(): string {
  return tg?.initData ?? ''
}

function applySafeArea() {
  if (!tg) return
  const root = document.documentElement.style
  const top = (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0)
  const bottom = (tg.safeAreaInset?.bottom ?? 0) + (tg.contentSafeAreaInset?.bottom ?? 0)
  root.setProperty('--tg-content-top', `${top}px`)
  root.setProperty('--tg-content-bottom', `${bottom}px`)
}

export function initTelegram() {
  if (!inTelegram || !tg) return
  tg.ready()
  tg.expand()
  // Через кнопку меню Mini App открывается не во весь экран (в отличие от «Открыть приложение»,
  // где fullscreen включён в BotFather) — просим полноэкранный режим сами. Только на телефонах:
  // в десктопном Telegram это развернуло бы всё окно.
  const mobile = ['ios', 'android', 'android_x'].includes(tg.platform)
  if (mobile && tg.isVersionAtLeast('8.0') && !tg.isFullscreen) tg.requestFullscreen?.()
  const bg = '#F4F3FF'
  tg.setHeaderColor(bg)
  tg.setBackgroundColor(bg)
  tg.setBottomBarColor?.(bg)
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.()
  applySafeArea()
  tg.onEvent('safeAreaChanged', applySafeArea)
  tg.onEvent('contentSafeAreaChanged', applySafeArea)
  tg.onEvent('fullscreenChanged', applySafeArea)
}

export const haptic = {
  tap: () => inTelegram && tg?.HapticFeedback.impactOccurred('light'),
  poke: () => inTelegram && tg?.HapticFeedback.impactOccurred('medium'),
  select: () => inTelegram && tg?.HapticFeedback.selectionChanged(),
  success: () => inTelegram && tg?.HapticFeedback.notificationOccurred('success'),
  warn: () => inTelegram && tg?.HapticFeedback.notificationOccurred('warning'),
}

/** Нативная кнопка «Назад» Telegram. Возвращает функцию отписки. */
export function bindBackButton(visible: boolean, onBack: () => void): () => void {
  if (!inTelegram || !tg) return () => {}
  if (!visible) {
    tg.BackButton.hide()
    return () => {}
  }
  tg.BackButton.show()
  tg.BackButton.onClick(onBack)
  return () => tg.BackButton.offClick(onBack)
}

export function closeApp() {
  if (inTelegram) tg?.close()
}
