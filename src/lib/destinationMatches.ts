import type { CitySummary } from './catalogue'

const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]
}

/** Text matches only: an unknown name is never treated as a known location. */
export function destinationMatches(query: string, cities: CitySummary[], exclude = ''): CitySummary[] {
  const term = normalise(query).slice(0, 100)
  if (!term) return []
  return cities.filter(c => c.slug !== exclude).map(city => {
    const name = normalise(city.name)
    const slug = normalise(city.slug)
    const country = normalise(city.country ?? '')
    const region = normalise(city.region ?? '')
    const names = [name, slug]
    let score = names.includes(term) ? 100 : names.some(n => n.startsWith(term)) ? 85 : names.some(n => n.includes(term)) ? 75 : 0
    if (country.includes(term) || region.includes(term)) score = Math.max(score, 65)
    if (term.length >= 4 && normalise(city.tagline).includes(term)) score = Math.max(score, 35)
    if (term.length >= 4 && names.some(n => distance(n, term) <= (term.length > 7 ? 2 : 1))) score = Math.max(score, 50)
    return { city, score }
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name)).slice(0, 6).map(r => r.city)
}
