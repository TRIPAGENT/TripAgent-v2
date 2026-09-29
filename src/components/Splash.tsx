import { useEffect, useState } from 'react'

/**
 * The first second of the app: the wordmark on ink while the opening photograph
 * arrives. Shown once per session and never longer than it needs to be — it
 * lifts as soon as the first hero image has loaded, or after 1.4s regardless.
 */
export function Splash() {
  const [done, setDone] = useState(() => {
    try {
      return sessionStorage.getItem('tripagent:splash') === '1'
    } catch {
      return true
    }
  })
  const [gone, setGone] = useState(done)

  useEffect(() => {
    if (done) return
    const finish = () => {
      setDone(true)
      try {
        sessionStorage.setItem('tripagent:splash', '1')
      } catch {
        /* private mode */
      }
      window.setTimeout(() => setGone(true), 700)
    }
    const min = window.setTimeout(() => {
      const hero = document.querySelector<HTMLImageElement>('img.plate')
      if (!hero || hero.complete) finish()
      else hero.addEventListener('load', finish, { once: true })
    }, 900)
    const max = window.setTimeout(finish, 1400)
    return () => {
      window.clearTimeout(min)
      window.clearTimeout(max)
    }
  }, [done])

  if (gone) return null
  return (
    <div className={`splash${done ? ' is-done' : ''}`} aria-hidden style={{ background: 'var(--ink-0)' }}>
      <span className="splash-mark k-wordmark" style={{ fontSize: 18, paddingLeft: '0.34em' }}>
        TripAgent
      </span>
      <span className="splash-line" />
      <span className="splash-sub t-label c-ivory-3" style={{ paddingLeft: '0.14em' }}>
        By invitation
      </span>
    </div>
  )
}
