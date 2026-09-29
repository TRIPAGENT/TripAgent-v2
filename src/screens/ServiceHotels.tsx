import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Icon, Plate, Sig } from '@/components/ui'
import { CITIES } from '@/data/catalogue.generated'
import { cityCard } from '@/lib/catalogue'
import { useStore } from '@/context/store'

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

  const savedSlugs = useMemo(
    () => new Set(wishlist.filter((k) => k.startsWith('city:')).map((k) => k.slice(5))),
    [wishlist],
  )

  const monthIndex = new Date().getMonth()

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const match = (c: (typeof CITIES)[number]) =>
      !term ||
      c.name.toLowerCase().includes(term) ||
      (c.country ?? '').toLowerCase().includes(term)

    const saved = CITIES.filter((c) => savedSlugs.has(c.slug) && match(c))
    const peak = CITIES.filter(
      (c) => !savedSlugs.has(c.slug) && c.months[monthIndex] === 'peak' && match(c),
    )
    const rest = CITIES.filter(
      (c) => !savedSlugs.has(c.slug) && c.months[monthIndex] !== 'peak' && match(c),
    )
    return [
      { label: 'Where you are already looking', cities: saved },
      { label: 'At their best this month', cities: peak },
      { label: 'Everywhere else we cover', cities: rest },
    ].filter((g) => g.cities.length > 0)
  }, [q, savedSlugs, monthIndex])

  function open(slug: string) {
    setActiveCity(slug)
    navigate(`/city/${slug}`)
  }

  return (
    <Screen tone="light" tabs={false}>
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
        groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-4 px-6 pt-10">
            <h2 className="t-display-s">{g.label}</h2>
            <div className="k-card px-4" style={{ borderRadius: 20 }}>
              {g.cities.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => open(c.slug)}
                  className="k-row w-full py-3 text-left"
                >
                  <Plate
                    src={cityCard(c.slug)}
                    alt=""
                    label={c.name}
                    className="h-14 w-16 shrink-0 object-cover"
                    style={{ borderRadius: 12 }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t-title-s truncate">{c.name}</span>
                    {c.country && <span className="t-caption truncate">{c.country}</span>}
                  </span>
                  <span className="c-ivory-3 flex shrink-0">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </Screen>
  )
}
