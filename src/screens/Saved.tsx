import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Shell'
import { Btn, Cred, Empty, Horizon, Icon, Photo } from '@/components/ui'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { cityCard, loadCity, type CityDetail, type CitySummary, type PanelKey } from '@/lib/catalogue'
import { findItem, parseItemKey, savedCityKey } from '@/lib/itinerary'
import { useStore } from '@/context/store'

/* ------------------------------------------------------------------ facts -- */

/** A fact exactly as the catalogue publishes it, or nothing. Never a stand-in. */
function factOf(city: CitySummary, label: string): string | null {
  const f = city.facts.find((x) => x.label.toLowerCase().includes(label))
  return f ? `${f.value}${f.small ? ` ${f.small}` : ''}` : null
}

/** Flight time and visa: the two facts that decide whether a trip is possible. */
function feasibility(city: CitySummary): string | null {
  return [factOf(city, 'from india'), factOf(city, 'visa')].filter(Boolean).join(' · ') || null
}

/**
 * The season chip, computed from the city's own twelve verdicts. A city is only
 * ever called "at its best now" when this month is one of its peaks; otherwise
 * the chip says which months are, so nothing on this screen over-promises.
 */
function season(city: CitySummary, month: number): { text: string; now: boolean } {
  const now = city.months[month] === 'peak'
  if (now) return { text: city.bestMonths ? `At its best now · ${city.bestMonths}` : 'At its best now', now }
  return { text: city.bestMonths ? `Best ${city.bestMonths}` : 'Not its season', now: false }
}

/* ------------------------------------------------------------------ places -- */

/** The short label a saved address wears in a list. */
const PANEL_SHORT: Record<PanelKey, string> = {
  stay: 'Stay',
  do: 'To do',
  eat: 'Eat',
  party: 'After dark',
}

const PANEL_ICON: Record<PanelKey, string> = { stay: 'stay', do: 'do', eat: 'dine', party: 'moon' }

interface SavedPlace {
  key: string
  slug: string
  name: string
}

/* ------------------------------------------------------------------ screen -- */

/**
 * Saved: the cities and the addresses the member has kept, and the shortlist of
 * places pulled towards a trip. Nothing here is booked — it is the raw material
 * Tara reads when it shapes a journey.
 */
export default function Saved() {
  const navigate = useNavigate()
  const { wishlist, toggleSaved, itinerary, removeFromItinerary, setActiveCity } = useStore()
  const [details, setDetails] = useState<Record<string, CityDetail>>({})

  const month = new Date().getMonth()

  const cities = useMemo(
    () =>
      wishlist
        .filter((k) => k.startsWith('city:'))
        .map((k) => CITY_BY_SLUG[k.slice(5)])
        .filter(Boolean),
    [wishlist],
  )

  const places = useMemo<SavedPlace[]>(
    () =>
      wishlist
        .filter((k) => k.startsWith('item:'))
        .map((k) => {
          const parsed = parseItemKey(k)
          return parsed ? { key: k, slug: parsed.slug, name: parsed.name } : null
        })
        .filter((x): x is SavedPlace => Boolean(x)),
    [wishlist],
  )

  // Saved entries carry a city and a name; the guide they came from tells us the rest.
  useEffect(() => {
    const needed = [...new Set(places.map((i) => i.slug))].filter((s) => !details[s])
    if (needed.length === 0) return
    let cancelled = false
    void Promise.all(needed.map((s) => loadCity(s).catch(() => null))).then((loaded) => {
      if (cancelled) return
      const next: Record<string, CityDetail> = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c
      })
      if (Object.keys(next).length) setDetails((prev) => ({ ...prev, ...next }))
    })
    return () => {
      cancelled = true
    }
  }, [places, details])

  /** The saved addresses, gathered under the city they belong to. */
  const byCity = useMemo(() => {
    const map = new Map<string, SavedPlace[]>()
    for (const p of places) {
      const list = map.get(p.slug)
      if (list) list.push(p)
      else map.set(p.slug, [p])
    }
    return [...map.entries()]
  }, [places])

  // The shortlist used to sit in front of the itinerary on the old Planner. It is
  // the raw material for a journey, so it lives here now, beside what was saved.
  const shortlist = useMemo(
    () =>
      itinerary
        .map((k) => parseItemKey(k))
        .filter((x): x is { slug: string; name: string } => Boolean(x)),
    [itinerary],
  )

  function openCity(slug: string) {
    setActiveCity(slug)
    navigate(`/city/${slug}`)
  }

  /** Tara should arrive already holding what the member kept. */
  function shapeAJourney() {
    const names = [
      ...cities.map((c) => c.name),
      ...places.map((p) => p.name),
      ...shortlist.map((s) => s.name),
    ]
    const unique = [...new Set(names)]
    navigate('/concierge', {
      state: {
        saved: unique,
        query: unique.length
          ? `Shape a journey from what I have saved: ${unique.join(', ')}.`
          : 'Shape a journey from what I have saved.',
      },
    })
  }

  if (wishlist.length === 0 && shortlist.length === 0) {
    return (
      <Screen tone="light">
        <Empty
          icon="bookmark"
          title="Nothing saved yet."
          body="Save a destination or an address from a guide and it waits here until you are ready."
          action={
            <Btn tone="primary" onClick={() => navigate('/')}>
              Discover destinations
            </Btn>
          }
        />
      </Screen>
    )
  }

  return (
    <Screen tone="light">
      {/* ------------------------------------------------------- the title -- */}
      <header className="flex flex-col gap-1.5 px-6 pt-16">
        <h1 className="t-display-l">Saved</h1>
        <p className="t-caption t-figure">
          {wishlist.length} saved · Tara reads every one
        </p>
      </header>

      {/* ------------------------------------------------------ the action -- */}
      <section className="px-6 pt-6">
        <button
          type="button"
          onClick={shapeAJourney}
          className="k-card-raised relative flex w-full items-center gap-3.5 overflow-hidden p-4 text-left"
          style={{
            borderRadius: 22,
            borderColor: 'var(--champagne-line)',
            background:
              'radial-gradient(120% 150% at 0% 0%, rgba(216,194,154,.11) 0%, rgba(216,194,154,0) 58%), var(--ink-3)',
          }}
        >
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--champagne-3)', border: '1px solid var(--champagne-line)' }}
          >
            <Horizon size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="t-title">Shape a journey from these</span>
            <span className="t-caption" style={{ textWrap: 'balance' }}>
              Tara starts from everything on this screen.
            </span>
          </span>
          <span className="c-ivory-2 flex">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      </section>

      {/* ------------------------------------------------- the destinations -- */}
      {cities.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-12">
          <h2 className="t-display-s">Destinations</h2>
          <div className="flex flex-col gap-3">
            {cities.map((city) => {
              const chip = season(city, month)
              const line = feasibility(city)
              return (
                <Photo
                  key={city.slug}
                  src={cityCard(city.slug)}
                  alt={city.name}
                  label={city.name}
                  radius={22}
                  className="h-[190px] w-full"
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-[1]"
                    aria-label={`Open ${city.name}`}
                    onClick={() => openCity(city.slug)}
                  />
                  <span className="k-glass-chip t-figure absolute left-3.5 top-3.5 z-[2] max-w-[230px]">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={
                        chip.now
                          ? { background: 'var(--champagne)', boxShadow: '0 0 0 3px rgba(216,194,154,.20)' }
                          : { border: '1px solid var(--ivory-2)' }
                      }
                    />
                    <span className="truncate">{chip.text}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${city.name} from saved`}
                    onClick={() => toggleSaved(savedCityKey(city.slug))}
                    className="absolute right-[7px] top-[7px] z-[3] flex h-11 w-11 items-center justify-center"
                  >
                    <span
                      className="k-icon-btn"
                      style={{
                        width: 36,
                        height: 36,
                        background: 'rgba(10,10,11,.45)',
                        borderColor: 'var(--champagne-line)',
                        color: 'var(--champagne)',
                      }}
                    >
                      <Icon name="bookmark" size={16} filled />
                    </span>
                  </button>
                  <div className="pointer-events-none absolute inset-x-[18px] bottom-4 z-[2] flex flex-col gap-0.5">
                    {city.country && <p className="t-caption">{city.country}</p>}
                    <h3 className="t-display-s">{city.name}</h3>
                    {line && (
                      <p className="t-caption t-figure c-ivory mt-0.5 truncate">{line}</p>
                    )}
                  </div>
                </Photo>
              )
            })}
          </div>
        </section>
      )}

      {/* -------------------------------------------- the places, by city --- */}
      {byCity.length > 0 && (
        <section className="flex flex-col gap-2 px-6 pt-12">
          <h2 className="t-display-s">Places</h2>
          {byCity.map(([slug, list]) => {
            const city = CITY_BY_SLUG[slug]
            const guide = details[slug]
            return (
              <div key={slug} className="flex flex-col gap-2 pt-3">
                <div className="flex min-h-[44px] items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h3 className="t-title-s truncate">{city?.name ?? slug}</h3>
                    <p className="t-caption t-figure shrink-0">
                      {list.length} {list.length === 1 ? 'place' : 'places'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="k-link c-ivory-2 min-h-[44px] shrink-0"
                    onClick={() => navigate(`/city/${slug}/map`)}
                  >
                    <Icon name="map" size={16} />
                    On the map
                  </button>
                </div>

                <div className="k-card px-4" style={{ borderRadius: 20 }}>
                  {list.map((place) => {
                    const found = guide ? findItem(guide, place.name) : null
                    const credential = found?.credentials?.[0] ?? null
                    return (
                      <div key={place.key} className="k-row items-start py-3.5">
                        <span
                          aria-hidden="true"
                          className="c-ivory-2 flex h-10 w-10 shrink-0 items-center justify-center"
                          style={{
                            borderRadius: 12,
                            background: 'var(--ink-3)',
                            border: '1px solid var(--line)',
                          }}
                        >
                          <Icon name={found ? PANEL_ICON[found.panel] : 'pin'} size={20} />
                        </span>

                        <span className="flex min-w-0 flex-1 flex-col gap-2.5">
                          <span className="flex min-h-[40px] items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openCity(slug)}
                              className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                            >
                              <span className="t-title-s truncate">{place.name}</span>
                              <span className="t-caption truncate">
                                {[found ? PANEL_SHORT[found.panel] : null, found?.area]
                                  .filter(Boolean)
                                  .join(' · ') || (city?.name ?? slug)}
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${place.name} from saved`}
                              onClick={() => toggleSaved(place.key)}
                              className="flex h-11 w-11 shrink-0 items-center justify-center"
                            >
                              <span
                                className="k-icon-btn"
                                style={{
                                  width: 36,
                                  height: 36,
                                  background: 'transparent',
                                  borderColor: 'var(--champagne-line)',
                                  color: 'var(--champagne)',
                                }}
                              >
                                <Icon name="bookmark" size={16} filled />
                              </span>
                            </button>
                          </span>
                          {credential && (
                            <span className="self-start">
                              <Cred>{credential}</Cred>
                            </span>
                          )}
                          {found?.description && (
                            <span className="t-body-s c-ivory-2">{found.description}</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* --------------------------------------------------- the shortlist -- */}
      {shortlist.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-12">
          <div className="flex flex-col gap-1.5">
            <h2 className="t-display-s">Shortlisted for a trip</h2>
            <p className="t-caption">
              Kept from an earlier visit. Tara reads these with everything you have saved.
            </p>
          </div>
          <div className="k-card px-4" style={{ borderRadius: 20 }}>
            {shortlist.map(({ slug, name }) => (
              <div key={`${slug}/${name}`} className="k-row py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-caption c-ivory-3 truncate">
                    {CITY_BY_SLUG[slug]?.name ?? slug}
                  </span>
                  <span className="t-title-s truncate">{name}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${name} from the shortlist`}
                  onClick={() => removeFromItinerary(`${slug}/${name}`)}
                  className="k-icon-btn k-icon-btn-solid shrink-0"
                  style={{ width: 36, height: 36 }}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------- the house rule, quietly -- */}
      <footer className="flex flex-col items-center gap-3.5 px-10 pt-9">
        <span aria-hidden="true" className="h-px w-6" style={{ background: 'var(--line-2)' }} />
        <p className="t-caption c-ivory-3 text-center" style={{ textWrap: 'balance' }}>
          Nothing here is booked. It waits until you and Tara agree the shape.
        </p>
      </footer>
    </Screen>
  )
}
