/**
 * Installing the app, and keeping it current.
 *
 * TripAgent goes out as a link before it goes to an app store, so the link has
 * to behave like an app: it installs to a home screen, opens without browser
 * chrome, and updates itself quietly. None of that is allowed to interrupt a
 * member — an update is applied on the next open, never mid-sentence.
 */

let deferred: BeforeInstallPromptEvent | null = null
let onChange: ((can: boolean) => void) | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Already on a home screen, or opened from one. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS reports it here and nowhere else.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** iOS never fires the install prompt; it installs through the Share sheet. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export const canInstall = () => deferred !== null

/** Tell a screen when the browser becomes willing to install. */
export function watchInstall(fn: (can: boolean) => void): () => void {
  onChange = fn
  fn(canInstall())
  return () => {
    onChange = null
  }
}

/** Ask the browser to install. Resolves true only if the member accepted. */
export async function install(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  onChange?.(false)
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === 'accepted'
}

export function registerPwa(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e) => {
    // Hold the prompt so the app can offer it in its own words, in its own place.
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    onChange?.(true)
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    onChange?.(false)
  })

  // The service worker is a production concern: in development it would serve
  // yesterday's bundle back to us and make every change look like it failed.
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
