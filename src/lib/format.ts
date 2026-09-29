export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export interface Countdown {
  hours: number
  minutes: number
  seconds: number
  elapsedRatio: number
  expired: boolean
}

export function countdown(from: number, windowHours: number, now: number): Countdown {
  const end = from + windowHours * 3600_000
  const left = Math.max(0, end - now)
  return {
    hours: Math.floor(left / 3600_000),
    minutes: Math.floor((left % 3600_000) / 60_000),
    seconds: Math.floor((left % 60_000) / 1000),
    elapsedRatio: Math.min(1, (now - from) / (windowHours * 3600_000)),
    expired: left === 0,
  }
}

export function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function dossierRef(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9000
  return `#TA-${1000 + h}`
}
