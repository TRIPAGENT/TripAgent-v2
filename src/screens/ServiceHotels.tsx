import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Icon, Plate, Sheet, Sig } from '@/components/ui'
import { CITIES } from '@/data/catalogue.generated'
import { cityCard } from '@/lib/catalogue'
import { useStore } from '@/context/store'
import { MeshBackdrop } from '@/components/mesh/MeshBackdrop'
import { DIM_TARA_COLORS, TARA_TUNING } from '@/components/mesh/presets'
import mapTabs from '@/components/worldmap/data/map-tabs.json'

/** The regions of the world map, in its order, with the name each carries as a heading. */
const HEADINGS: Record<string, string> = {
  americas: 'The Americas',
  europe: 'Europe',
  africa: 'Africa',
  'middle-east': 'The Middle East',
  india: 'South Asia',
  'east-asia': 'East Asia',
  'southeast-asia': 'Southeast Asia',
  oceania: 'Oceania',
}
const REGIONS = (mapTabs.regions as Array<{ key: string; cities: Array<{ slug: string }> }>).map((r) => ({
  key: r.key,
  title: HEADINGS[r.key] ?? r.key,
  slugs: new Set(r.cities.map((c) => c.slug)),
}))
const regionKeyOf = (slug: string) => REGIONS.find((r) => r.slugs.has(slug))?.key

/**
 * Stays, entered by destination.
 *
 * The rooms themselves live in each city's guide, graded by tier and carrying the
 * credentials that earned them the place. This screen's only job is to get the
 * member to the right city quickly — by where they have already saved, by what is
 * at its best now, or by name.
 */
export default function ServiceHotels() {
  const navigate = useNavigate()
  const { wishlist, setActiveCity } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'best'>('all')
  const [region, setRegion] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const savedSlugs = useMemo(
    () => new Set(wishlist.filter((k) => k.startsWith('city:')).map((k) => k.slice(5))),
    [wishlist],
  )

  const monthIndex = new Date().getMonth()

  // Cities grouped by the regions of the world map. Within a region the cities you have saved come
  // first, then those at their best now. "Best this month" keeps only the peak ones.
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const match = (c: (typeof CITIES)[number]) =>
      !term || c.name.toLowerCase().includes(term) || (c.country ?? '').toLowerCase().includes(term)
    const rank = (c: (typeof CITIES)[number]) =>
      (savedSlugs.has(c.slug) ? 0 : 2) + (c.months[monthIndex] === 'peak' ? 0 : 1)
    const pool = CITIES.filter((c) => match(c) && (filter !== 'best' || c.months[monthIndex] === 'peak'))
    return REGIONS.filter((r) => !region || r.key === region)
      .map((r) => ({
        key: r.key,
        title: r.title,
        cities: pool
          .filter((c) => regionKeyOf(c.slug) === r.key)
          .map((c, i) => ({ c, i }))
          .sort((x, y) => rank(x.c) - rank(y.c) || x.i - y.i)
          .map(({ c }) => c),
      }))
      .filter((g) => g.cities.length > 0)
  }, [q, filter, region, savedSlugs, monthIndex])

  function open(slug: string) {
    setActiveCity(slug)
    navigate(`/city/${slug}`)
  }

  return (
    <Screen tone="dark" tabs={false} className="isolate">
      <MeshBackdrop
        id="hotels-mesh"
        colors={DIM_TARA_COLORS}
        tuning={TARA_TUNING}
        fallback="radial-gradient(75% 40% at 85% 12%, rgba(70,87,102,.7) 0%, rgba(70,87,102,0) 70%), radial-gradient(85% 40% at 40% 50%, rgba(130,80,43,.7) 0%, rgba(130,80,43,0) 70%), #080605"
      />
      <TopBar back="/services" solid />

      <section className="flex flex-col gap-3.5 px-6 pt-32">
        <h1 className="t-display-l">
          The room, <Sig>not the listing.</Sig>
        </h1>
        <p className="t-body c-ivory-2">
          The houses we would stay in ourselves, city by city. Pick a destination: the guide opens at
          where to stay, with live rooms for your dates.
        </p>
      </section>

      <div className="px-6 pt-8">
        <div className="k-field">
          <Icon name="search" size={20} />
          <label htmlFor="hotels-city" className="sr-only">
            Which city?
          </label>
          <input
            id="hotels-city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Which city?"
          />
          {q && (
            <button type="button" aria-label="Clear the search" onClick={() => setQ('')} className="flex">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 px-6 pt-4" role="tablist" aria-label="Filter cities">
          {([
            ['all', 'All cities'],
            ['best', 'Best this month'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`k-chip shrink-0 ${filter === id ? 'is-on' : ''}`}
              style={{ padding: '0 10px', fontSize: 12.5 }}
              onClick={() => {
                setFilter(id)
                setMenuOpen(false)
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className="k-chip ml-auto shrink-0"
            style={{ gap: 4, padding: '0 10px', fontSize: 12.5 }}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {region ? REGIONS.find((r) => r.key === region)?.title : 'All regions'}
            <Icon name="chevron-down" size={14} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} labelledBy="region-sheet-title">
          <div className="px-6 pb-2 pt-1">
            <h2 id="region-sheet-title" className="t-display-s">
              Where in the world
            </h2>
            <div role="listbox" className="mt-3 flex flex-col">
              {[{ key: null as string | null, title: 'All regions' }, ...REGIONS].map((r) => {
                const on = region === r.key
                return (
                  <button
                    key={r.key ?? 'all'}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className="flex items-center justify-between py-3.5 text-left"
                    style={{ borderBottom: '1px solid var(--line-2)', fontWeight: on ? 600 : 400 }}
                    onClick={() => {
                      setRegion(r.key)
                      setMenuOpen(false)
                    }}
                  >
                    {r.title}
                    {on && <Icon name="check" size={18} />}
                  </button>
                )
              })}
            </div>
          </div>
        </Sheet>
      )}

      {groups.length === 0 ? (
        <section className="flex flex-col items-center px-8 pt-20 text-center">
          <span className="c-ivory-3 flex">
            <Icon name="search" size={28} />
          </span>
          <p className="t-display-m mt-6">No city by that name.</p>
          <p className="t-caption mt-3 max-w-quote">
            We cover {CITIES.length} destinations. Try a country, clear the search — or tell the
            Tara where you want to be and Tara will find the room.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Btn tone="secondary" onClick={() => setQ('')}>
              Clear the search
            </Btn>
            <Btn
              tone="ghost"
              onClick={() => navigate('/concierge', { state: { query: `A room in ${q.trim()}` } })}
            >
              Ask Tara
            </Btn>
          </div>
        </section>
      ) : (
        groups.map((g) => {
          const shut = collapsed.has(g.key)
          return (
            <section key={g.key} className="px-6 pt-8">
              <button
                type="button"
                aria-expanded={!shut}
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    if (next.has(g.key)) next.delete(g.key)
                    else next.add(g.key)
                    return next
                  })
                }
                className="flex w-full items-center gap-2.5 pb-3 text-left"
                style={{ borderBottom: '1px solid var(--line-2)' }}
              >
                <span className="flex" style={{ transform: shut ? 'rotate(-90deg)' : undefined, transition: 'transform .2s' }}>
                  <Icon name="chevron-down" size={18} />
                </span>
                <h2 className="t-display-s">{g.title}</h2>
              </button>
              <div
                aria-hidden={shut}
                style={{
                  display: 'grid',
                  gridTemplateRows: shut ? '0fr' : '1fr',
                  opacity: shut ? 0 : 1,
                  transition: 'grid-template-rows .32s cubic-bezier(.2,.8,.2,1), opacity .24s ease',
                }}
              >
                <div className="-mx-3 min-h-0 overflow-hidden px-3 pb-4">
                  <div className="grid grid-cols-3 gap-x-3 gap-y-6 pt-5">
            {g.cities.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => open(c.slug)}
                className="relative block overflow-hidden text-left"
                style={{
                  borderRadius: 16,
                  aspectRatio: '1 / 1.1',
                  border: 0,
                outline: 'none',
                boxShadow: '0 8px 32px rgba(205, 208, 215, 0.2)',
                }}
              >
                <Plate
                  src={cityCard(c.slug)}
                  alt=""
                  label={c.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, rgba(8,6,5,0) 45%, rgba(8,6,5,0.78) 100%)' }}
                />
                <span className="absolute bottom-0 left-0 right-0 flex flex-col px-2.5 pb-2.5" style={{ color: '#fff' }}>
                  <span className="truncate" style={{ fontSize: 14, lineHeight: '18px', fontWeight: 500 }}>
                    {c.name}
                  </span>
                  {c.country && (
                    <span className="truncate" style={{ fontSize: 11, lineHeight: '15px', color: 'rgba(255,255,255,0.7)' }}>
                      {c.country}
                    </span>
                  )}
                </span>
              </button>
            ))}
                  </div>
                </div>
              </div>
            </section>
          )
        })
      )}
    </Screen>
  )
}
