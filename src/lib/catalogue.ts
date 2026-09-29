/**
 * Shapes for the catalogue pulled out of the sourcing engine.
 *
 * These mirror what the engine publishes. Nothing here is authored in this app —
 * if a field is missing it is missing upstream, and the UI says so rather than
 * inventing a stand-in.
 */

/** A month is either the city at its best, a workable shoulder, or one to avoid. */
export type MonthTier = 'peak' | 'shoulder' | 'avoid'

export interface Fact {
  label: string
  value: string
  small: string | null
}

export interface CitySummary {
  slug: string
  name: string
  /** the region it is grouped under, e.g. "Southern Europe" */
  region: string | null
  lat: number | null
  lon: number | null
  country: string | null
  tagline: string
  facts: Fact[]
  /** Twelve tiers, January first. */
  months: MonthTier[]
  bestMonths: string
  whenBlurb: string
  lede: string
}

export interface Heading {
  text: string
  /** The one phrase the engine styles; rendered as the wine-red italic. */
  accent: string | null
}

export interface GuideItem {
  name: string
  area: string | null
  credentials: string[]
  description: string | null
}

export interface GuideTier {
  label: string | null
  items: GuideItem[]
}

export type PanelKey = 'stay' | 'do' | 'eat' | 'party'

export interface GuidePanel {
  key: PanelKey
  tiers: GuideTier[]
}

export interface PlanSlot {
  label: string
  text: string
  place: string | null
}

export interface PlanDay {
  label: string
  title: string
  slots: PlanSlot[]
}

export interface Row {
  label: string
  value: string
}

export interface CityDetail extends CitySummary {
  ourTake: { lede: string; comeIf: string; skipIf: string }
  guide: { verified: string | null; heading: Heading; lede: string; panels: GuidePanel[] }
  plan: { heading: string; lede: string; days: PlanDay[] }
  neighbourhoods: { heading: string; pairWith: string | null; items: { name: string; description: string }[] }
  whatsOn: { heading: string; events: { name: string; when: string | null; note: string | null }[] }
  goodToKnow: {
    onGround: { heading: string; note: string | null; rows: Row[] }
    beforeYouGo: { heading: string; rows: Row[] }
  }
  collections: string[]
}

export interface Slide {
  image: string
  /** object-position for the portrait frame. */
  focus?: string
  eyebrow: string
  heading: Heading
  lede: string
}

export interface Service {
  image: string | null
  number: string
  heading: string
  body: string
}

export interface Venue {
  name: string
  cat: 'stay' | 'do' | 'eat' | 'party'
  tier: string | null
  area: string | null
  note: string | null
  lat: number
  lon: number
  credentials: string[]
}

export interface CityMap {
  slug: string
  name: string
  center: [number, number] | null
  venues: Venue[]
}

const mapCache = new Map<string, CityMap>()

/** The map layer for a city: 8,000-odd venues across the catalogue, so per-city. */
export async function loadMap(slug: string): Promise<CityMap> {
  const hit = mapCache.get(slug)
  if (hit) return hit
  const res = await fetch(`/data/map/${slug}.json`)
  if (!res.ok) throw new Error(`No map for ${slug}`)
  const data = (await res.json()) as CityMap
  mapCache.set(slug, data)
  return data
}

export interface MonthPoint {
  heading: string | null
  text: string
}

export interface MonthGuide {
  no: number
  code: string
  name: string
  heading: Heading
  lede: string
  statement: string
  note: string
  intro: string
  where: MonthPoint[]
  avoid: MonthPoint[]
  indianAngle: MonthPoint[]
  flightsVisas: MonthPoint[]
  pull: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Images are served from the app today and from a CDN later. Every reference
 * goes through here so that move is one environment variable, not a find and
 * replace across the screens.
 */
const BASE = (import.meta.env.VITE_IMAGE_CDN_BASE ?? '').replace(/\/$/, '')
const img = (p: string) => `${BASE}${p}`

export const cityCard = (slug: string) => img(`/img/city/${slug}-card.jpg`)
export const cityHero = (slug: string) => img(`/img/city/${slug}-hero.jpg`)
export const monthCard = (no: number) => img(`/img/month/${pad(no)}-card.jpg`)
export const monthHero = (no: number) => img(`/img/month/${pad(no)}-hero.jpg`)
export const brandImage = (name: string) => img(`/img/brand/${name}.jpg`)

export const PANEL_LABELS: Record<PanelKey, string> = {
  stay: 'Where to stay',
  do: 'What to do',
  eat: 'Where to eat',
  party: 'After dark',
}

/** Per-city detail is fetched on demand — 110 full guides do not belong in the bundle. */
const cache = new Map<string, CityDetail>()

export async function loadCity(slug: string): Promise<CityDetail> {
  const hit = cache.get(slug)
  if (hit) return hit
  const res = await fetch(`/data/city/${slug}.json`)
  if (!res.ok) throw new Error(`No guide on file for ${slug}`)
  const detail = (await res.json()) as CityDetail
  cache.set(slug, detail)
  return detail
}
