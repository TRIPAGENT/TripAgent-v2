import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Btn, Cred, Empty, Icon, Sheet } from '@/components/ui'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { loadMap, type CityMap as CityMapData, type Venue } from '@/lib/catalogue'
import { itemKey, savedItemKey } from '@/lib/itinerary'
import { useStore } from '@/context/store'

const CATS: { key: Venue['cat']; label: string; icon: string }[] = [
  { key: 'stay', label: 'Stay', icon: 'stay' },
  { key: 'eat', label: 'Eat', icon: 'dine' },
  { key: 'do', label: 'Do', icon: 'do' },
  { key: 'party', label: 'After dark', icon: 'moon' },
]

const ALL_CATS: Venue['cat'][] = ['stay', 'eat', 'do', 'party']

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

/** Anything award-bearing is worth seeing before you tap the pin. */
const badgeOf = (v: Venue): string | null => {
  const c = v.credentials.find((x) => /michelin|world's 50|forbes|green guide/i.test(x))
  return c ?? v.tier
}

declare global {
  interface Window {
    google?: typeof globalThis & { maps?: unknown }
  }
}

/** Loads the Maps script once per document, regardless of how often we mount. */
let scriptPromise: Promise<void> | null = null
function loadMaps(): Promise<void> {
  if (!KEY) return Promise.reject(new Error('no key'))
  if (window.google?.maps) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=marker&v=weekly`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('maps failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * Nocturne, applied to Google's base map: obsidian ground, dim roads, muted
 * water, and none of Google's own labels — the places we hold are the content,
 * not every petrol station between them.
 */
const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0E0E10' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6E6A63' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0B' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2A2A2E' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#807B72' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#121214' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#111113' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A1A1D' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5F5B55' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#242427' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1418' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3F4A4E' }] },
]

/** The 24-grid glyph for each category, drawn into the marker. */
const GLYPH: Record<Venue['cat'], string> = {
  stay: '<path d="M3 18.5V7"/><path d="M3 14h18v4.5"/><path d="M21 14v-2.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="11" r="1.8"/>',
  eat: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
  do: '<path d="m3 19 6.5-10 4 6 2.5-3.5L21 19Z"/>',
  party: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z"/>',
}

/**
 * A pin in the house palette: a champagne-ringed glass circle carrying the
 * category glyph. Saved places are filled champagne; the selected one is larger
 * and lit.
 */
function pinSvg(cat: Venue['cat'], saved: boolean, selected: boolean): string {
  const size = selected ? 56 : 38
  const r = selected ? 17 : 13
  const c = size / 2
  const solid = saved || selected
  const body = solid ? '#D8C29A' : 'rgba(14,14,16,.88)'
  const ring = solid ? '#D8C29A' : 'rgba(216,194,154,.38)'
  const ink = solid ? '#0A0A0B' : '#F2EDE4'
  const g = selected ? 20 : 14
  const k = g / 24
  const glow = selected
    ? `<circle cx="${c}" cy="${c}" r="${r + 9}" fill="rgba(216,194,154,.16)"/><circle cx="${c}" cy="${c}" r="${r + 4}" fill="rgba(216,194,154,.26)"/>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    glow +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="${body}" stroke="${ring}" stroke-width="1"/>` +
    `<g transform="translate(${c - g / 2} ${c - g / 2}) scale(${k})" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPH[cat]}</g>` +
    `</svg>`
  )
}

const pinUrl = (cat: Venue['cat'], saved: boolean, selected: boolean) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg(cat, saved, selected))}`

/* eslint-disable @typescript-eslint/no-explicit-any */
type GMarker = any

export default function CityMapScreen() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { isSaved, toggleSaved, itinerary, addToItinerary } = useStore()

  const [data, setData] = useState<CityMapData | null>(null)
  const [error, setError] = useState(false)
  const [cats, setCats] = useState<Venue['cat'][]>(ALL_CATS)
  const [selected, setSelected] = useState<Venue | null>(null)
  const [mapsReady, setMapsReady] = useState<boolean | null>(KEY ? null : false)
  const holder = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)
  const markers = useRef<{ venue: Venue; marker: GMarker }[]>([])

  const summary = CITY_BY_SLUG[slug]
  const cityName = summary?.name ?? data?.name ?? slug

  useEffect(() => {
    let cancelled = false
    loadMap(slug)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!KEY) return
    loadMaps()
      .then(() => setMapsReady(true))
      .catch(() => setMapsReady(false))
  }, [])

  const venues = useMemo(() => data?.venues ?? [], [data])
  const shown = useMemo(() => venues.filter((v) => cats.includes(v.cat)), [venues, cats])
  const counts = useMemo(() => {
    const out: Record<string, number> = { stay: 0, eat: 0, do: 0, party: 0 }
    for (const v of venues) out[v.cat] = (out[v.cat] ?? 0) + 1
    return out
  }, [venues])

  /**
   * The map is built once and then left alone. Rebuilding it on every filter tap
   * threw away the member's pan and zoom, which is the one thing a map must keep.
   */
  useEffect(() => {
    if (!mapsReady || !data || !holder.current || mapObj.current) return
    const g = (window as unknown as { google: any }).google
    const centre = data.center ?? [data.venues[0]?.lat ?? 0, data.venues[0]?.lon ?? 0]
    const map = new g.maps.Map(holder.current, {
      center: { lat: centre[0], lng: centre[1] },
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: false,
      gestureHandling: 'greedy',
      backgroundColor: '#0E0E10',
      clickableIcons: false,
      styles: MAP_STYLES,
    })
    mapObj.current = map

    markers.current = data.venues.map((venue) => {
      const marker = new g.maps.Marker({
        position: { lat: venue.lat, lng: venue.lon },
        map,
        title: venue.name,
        icon: {
          url: pinUrl(venue.cat, false, false),
          scaledSize: new g.maps.Size(38, 38),
          anchor: new g.maps.Point(19, 19),
        },
      })
      marker.addListener('click', () => setSelected(venue))
      return { venue, marker }
    })

    // Open on the places themselves, not on an arbitrary radius around a centroid.
    if (data.venues.length > 1) {
      const bounds = new g.maps.LatLngBounds()
      for (const v of data.venues) bounds.extend({ lat: v.lat, lng: v.lon })
      map.fitBounds(bounds, 48)
    }

    return () => {
      for (const { marker } of markers.current) marker.setMap(null)
      markers.current = []
      mapObj.current = null
    }
  }, [mapsReady, data])

  // Filters hide and show pins; they never rebuild the map.
  useEffect(() => {
    for (const { venue, marker } of markers.current) marker.setVisible(cats.includes(venue.cat))
  }, [cats, mapsReady, data])

  // Saved and selected are states of a pin, redrawn in place.
  useEffect(() => {
    const g = (window as unknown as { google?: any }).google
    if (!g?.maps) return
    for (const { venue, marker } of markers.current) {
      const on = selected?.name === venue.name && selected?.lat === venue.lat
      const size = on ? 56 : 38
      marker.setIcon({
        url: pinUrl(venue.cat, isSaved(savedItemKey(slug, venue.name)), on),
        scaledSize: new g.maps.Size(size, size),
        anchor: new g.maps.Point(size / 2, size / 2),
      })
      marker.setZIndex(on ? 1000 : 1)
    }
  }, [selected, isSaved, slug, mapsReady, data])

  // A place chosen from the list is brought under the sheet, not left off-screen.
  useEffect(() => {
    if (selected) mapObj.current?.panTo({ lat: selected.lat, lng: selected.lon })
  }, [selected])

  if (error) {
    return (
      <div className="mx-auto min-h-full max-w-app" style={{ background: 'var(--ink-0)' }}>
        <Empty
          icon="map"
          title="No map for this one yet."
          body="The addresses are in the guide; their coordinates are not on file."
          action={
            <Btn tone="secondary" onClick={() => navigate(`/city/${slug}`)}>
              Open the guide
            </Btn>
          }
        />
      </div>
    )
  }

  const selectedKey = selected ? savedItemKey(slug, selected.name) : ''
  const selectedSaved = selected ? isSaved(selectedKey) : false
  const selectedAdded = selected ? itinerary.includes(itemKey(slug, selected.name)) : false
  const selectedCat = selected ? CATS.find((c) => c.key === selected.cat) : undefined

  return (
    <div
      className="relative mx-auto flex h-full max-w-app flex-col overflow-hidden"
      style={{ background: 'var(--ink-0)' }}
    >
      {/* The ground: the map itself, or the same places as a list */}
      <div className="relative min-h-0 flex-1">
        {!data && !error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <span className="k-breathe c-champagne">
              <Icon name="map" size={26} />
            </span>
            <p className="t-caption c-ivory-3">Placing {cityName} on the map…</p>
          </div>
        ) : mapsReady === true ? (
          <div ref={holder} className="h-full w-full" style={{ background: '#0E0E10' }} />
        ) : (
          <div className="h-full overflow-y-auto" style={{ paddingTop: 170 }}>
            {mapsReady === false && (
              <p
                className="t-caption px-6 py-3"
                style={{ background: 'var(--ink-1)', borderBottom: '1px solid var(--line)' }}
              >
                {KEY
                  ? 'The map could not load. The places are all here.'
                  : (import.meta.env.DEV
                      ? 'Add VITE_GOOGLE_MAPS_API_KEY to .env.local to see these on a map. '
                      : 'The map is not available just now. ') + 'Everything below is the same data.'}
              </p>
            )}
            <ul>
              {shown.slice(0, 200).map((v) => (
                <li key={`${v.name}-${v.lat}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    className="flex w-full items-start gap-3 px-6 py-3.5 text-left"
                    style={{ borderBottom: '1px solid var(--line)' }}
                  >
                    <span className="c-champagne mt-0.5">
                      <Icon name={CATS.find((c) => c.key === v.cat)?.icon ?? 'pin'} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="t-title block truncate">{v.name}</span>
                      <span className="t-caption block truncate">
                        {[badgeOf(v), v.area].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Night falls from the top so the chrome reads over the map */}
      <span className="k-veil-top pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: 210 }} />

      <header
        className="absolute left-4 right-4 z-20 flex items-center justify-between gap-3"
        style={{ top: 'max(54px, calc(env(safe-area-inset-top) + 12px))', height: 44 }}
      >
        <button
          type="button"
          aria-label={`Back to the ${cityName} guide`}
          onClick={() => navigate(`/city/${slug}`)}
          className="k-icon-btn"
        >
          <Icon name="back" size={20} />
        </button>
        <h1
          className="k-glass flex min-w-0 items-center gap-2 px-4"
          style={{ height: 44, borderRadius: 999 }}
        >
          <span className="t-title-s truncate">{cityName}</span>
          <span aria-hidden="true" className="h-[3px] w-[3px] shrink-0 rounded-full" style={{ background: 'var(--ivory-3)' }} />
          <span className="t-caption t-figure shrink-0">{shown.length} places</span>
        </h1>
        <span className="w-11" />
      </header>

      <div
        role="group"
        aria-label="Show on the map"
        className="absolute inset-x-0 z-20 flex gap-2 overflow-x-auto px-6"
        style={{ top: 'calc(max(54px, env(safe-area-inset-top) + 12px) + 54px)' }}
      >
        {CATS.map((c) => {
          const on = cats.includes(c.key)
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setCats((prev) =>
                  prev.includes(c.key) ? prev.filter((x) => x !== c.key) : [...prev, c.key],
                )
              }
              className={`k-chip shrink-0 ${on ? 'is-on' : ''}`}
              style={
                on
                  ? { gap: 6 }
                  : {
                      gap: 6,
                      background: 'var(--glass-strong)',
                      backdropFilter: 'blur(20px) saturate(150%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                    }
              }
            >
              {c.label}
              <span className="t-figure" style={{ color: on ? 'var(--paper-ink-2)' : 'var(--ivory-3)' }}>
                {counts[c.key] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* The tapped place */}
      {selected && selectedCat && (
        <Sheet onClose={() => setSelected(null)} labelledBy="cm-place">
          <div className="flex flex-col gap-4 px-6 pb-2 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="t-caption truncate">
                  {selectedCat.label}
                  {selected.area ? ` · ${selected.area}` : ''}
                </p>
                <h2 id="cm-place" className="t-display-s">
                  {selected.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label={`Close ${selected.name}`}
                onClick={() => setSelected(null)}
                className="k-icon-btn k-icon-btn-solid shrink-0"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {selected.credentials.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {selected.credentials.map((c) => (
                  <li key={c}>
                    <Cred>{c}</Cred>
                  </li>
                ))}
              </ul>
            )}

            {selected.note && <p className="t-body-s c-ivory-2">{selected.note}</p>}

            <div className="grid grid-cols-4 pt-1">
              <button
                type="button"
                aria-pressed={selectedSaved}
                aria-label={selectedSaved ? `Saved: ${selected.name}` : `Save ${selected.name}`}
                onClick={() => toggleSaved(selectedKey)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    background: selectedSaved ? 'var(--champagne-3)' : 'var(--ink-3)',
                    border: `1px solid ${selectedSaved ? 'var(--champagne-line)' : 'var(--line-2)'}`,
                    color: selectedSaved ? 'var(--champagne)' : 'var(--ivory)',
                  }}
                >
                  <Icon name="bookmark" size={20} filled={selectedSaved} />
                </span>
                <span className="t-caption whitespace-nowrap" style={selectedSaved ? { color: 'var(--champagne)' } : undefined}>
                  {selectedSaved ? 'Saved' : 'Save'}
                </span>
              </button>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lon}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Directions to ${selected.name}`}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: 'var(--ivory)', color: 'var(--ink-0)' }}
                >
                  <Icon name="arrow-up-right" size={20} strokeWidth={1.6} />
                </span>
                <span className="t-caption c-ivory whitespace-nowrap">Directions</span>
              </a>

              <button
                type="button"
                aria-label={`Ask Tara about ${selected.name}`}
                onClick={() =>
                  navigate('/concierge', {
                    state: { place: { slug, name: selected.name, cat: selected.cat, area: selected.area } },
                  })
                }
                className="flex flex-col items-center gap-1.5"
              >
                <span className="k-icon-btn k-icon-btn-solid c-champagne">
                  <Icon name="horizon" size={20} />
                </span>
                <span className="t-caption whitespace-nowrap">Ask</span>
              </button>

              <button
                type="button"
                aria-label={
                  selectedAdded ? `${selected.name} is on the journey` : `Add ${selected.name} to the journey`
                }
                disabled={selectedAdded}
                onClick={() => addToItinerary(itemKey(slug, selected.name))}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="k-icon-btn k-icon-btn-solid">
                  <Icon name={selectedAdded ? 'check' : 'plus'} size={20} />
                </span>
                <span className="t-caption whitespace-nowrap">{selectedAdded ? 'Added' : 'Add'}</span>
              </button>
            </div>

            <p className="t-caption c-ivory-3 pt-1 text-center">
              Curated addresses only — every one earned by a name worth trusting
            </p>
          </div>
        </Sheet>
      )}
    </div>
  )
}
