import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Dock, Screen, TopBar } from '@/components/Shell'
import { Btn, Card, Empty, Icon, Photo, Sig } from '@/components/ui'
import { CITIES, MONTHS } from '@/data/catalogue.generated'
import { cityCard, monthHero } from '@/lib/catalogue'
import { savedCityKey } from '@/lib/itinerary'
import { useStore } from '@/context/store'
import type { CitySummary, MonthPoint } from '@/lib/catalogue'

/** The two facts that decide a month: how far it is, and what the border asks. */
function factOf(city: CitySummary, label: string) {
  const f = city.facts.find((x) => x.label === label)
  if (!f) return null
  return [f.value, f.small].filter(Boolean).join(' · ')
}

/**
 * Reading matter, folded away.
 *
 * Each point keeps its heading visible — that alone answers "where" — and opens
 * to the paragraph only if asked. Four paragraphs stacked on a phone is a screen
 * nobody scrolls past, and the headings are the part that actually decides.
 */
function Points({ points, idPrefix }: { points: MonthPoint[]; idPrefix: string }) {
  // The first point is open: a closed ledger tells a member nothing.
  const [open, setOpen] = useState(0)

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      {points.map((p, i) => {
        const id = `${idPrefix}-${i}`
        if (!p.heading) {
          return (
            <p key={id} className="t-body-s c-ivory-2 py-4" style={{ borderTop: '1px solid var(--line)' }}>
              {p.text}
            </p>
          )
        }
        const on = open === i
        return (
          <div key={id} style={{ borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              className="k-row w-full"
              style={{ minHeight: 64 }}
              aria-expanded={on}
              aria-controls={id}
              onClick={() => setOpen(on ? -1 : i)}
            >
              <span className="t-mono c-ivory-3" style={{ width: 20 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="t-title min-w-0 flex-1">{p.heading}</span>
              <Icon
                name="chevron-down"
                size={18}
                className={`c-ivory-3 transition-transform ${on ? 'rotate-180' : ''}`}
              />
            </button>
            {on && (
              <p id={id} className="t-body-s c-ivory-2 pb-7 pt-1">
                {p.text}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Month() {
  const { no = '' } = useParams()
  const navigate = useNavigate()
  const { isSaved, toggleSaved, setActiveCity } = useStore()
  // Seventy-eight cards is four thousand pixels of scroll. Show a dozen.
  const [showAll, setShowAll] = useState(false)
  const scrubber = useRef<HTMLDivElement>(null)

  const m = MONTHS.find((x) => x.no === Number(no))

  const { peak, shoulder } = useMemo(() => {
    if (!m) return { peak: [] as CitySummary[], shoulder: [] as CitySummary[] }
    const i = m.no - 1
    return {
      peak: CITIES.filter((c) => c.months[i] === 'peak'),
      shoulder: CITIES.filter((c) => c.months[i] === 'shoulder'),
    }
  }, [m])

  /** How many destinations peak in each month — read from the catalogue, never authored. */
  const peakCounts = useMemo(
    () => MONTHS.map((x) => CITIES.filter((c) => c.months[x.no - 1] === 'peak').length),
    [],
  )
  const busiest = Math.max(1, ...peakCounts)

  // The scrubber opens on the month you are reading, whichever one that is.
  useEffect(() => {
    setShowAll(false)
    const el = scrubber.current?.querySelector('[aria-current="page"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
    window.scrollTo(0, 0)
  }, [no])

  if (!m) {
    return (
      <Screen tone="light">
        <Empty
          icon="calendar"
          title="No such month."
          body="Pick one from the calendar and we will show you where it is the right time to be."
          action={
            <Btn tone="secondary" onClick={() => navigate('/')}>
              Back to the calendar
            </Btn>
          }
        />
      </Screen>
    )
  }

  const prev = MONTHS[(m.no + 10) % 12]
  const next = MONTHS[m.no % 12]
  const open = (slug: string) => {
    setActiveCity(slug)
    navigate(`/city/${slug}`)
  }

  return (
    <Screen tone="light" tabs={false} dock>
      {/* The month as a place */}
      <Photo
        src={monthHero(m.no)}
        alt={`${m.name} — the month at its best`}
        label={m.name}
        veil="hero"
        radius={0}
        eager
        style={{ height: 520 }}
      >
        <TopBar back="/" />
        <div className="absolute bottom-[30px] left-6 right-6 z-[2] flex flex-col gap-3.5">
          <p className="k-eyebrow t-figure">Month {String(m.no).padStart(2, '0')}</p>
          <h1 className="t-display-xl">
            Go in <Sig>{m.name}.</Sig>
          </h1>
          <p className="t-body c-ivory-2">{m.lede}</p>
        </div>
      </Photo>

      {/* The year, weighed */}
      <section className="flex flex-col gap-3.5 pt-6">
        <nav
          ref={scrubber}
          aria-label="Months"
          className="flex gap-2 overflow-x-auto px-6"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {MONTHS.map((x, i) => {
            const on = x.no === m.no
            const n = peakCounts[i]
            return (
              <button
                key={x.no}
                type="button"
                aria-current={on ? 'page' : undefined}
                aria-label={`${x.name}, ${n} at their best`}
                onClick={() => navigate(`/month/${x.no}`)}
                className="flex shrink-0 flex-col items-center justify-center gap-1.5"
                style={{
                  width: 60,
                  height: 76,
                  borderRadius: 20,
                  border: `1px solid ${on ? 'var(--ivory)' : 'var(--line-2)'}`,
                  background: on ? 'var(--ivory)' : 'transparent',
                  color: on ? 'var(--ink-0)' : 'var(--ivory)',
                }}
              >
                <span className="t-title-s" style={{ fontWeight: on ? 600 : 500 }}>
                  {x.code}
                </span>
                <span className={`t-mono ${on ? '' : 'c-ivory-3'}`} style={on ? { opacity: 0.72 } : undefined}>
                  {n}
                </span>
                <span
                  aria-hidden="true"
                  className="block overflow-hidden"
                  style={{ width: 28, height: 2, borderRadius: 2, background: on ? 'transparent' : 'var(--line)' }}
                >
                  <span
                    className="block"
                    style={{
                      width: on ? 28 : Math.max(3, Math.round((n / busiest) * 28)),
                      height: 2,
                      borderRadius: 2,
                      background: on ? 'var(--ink-0)' : 'var(--ivory-3)',
                    }}
                  />
                </span>
              </button>
            )
          })}
        </nav>
        <p className="t-caption c-ivory-3 px-6">Destinations at their best, month by month</p>
      </section>

      {/* The statement */}
      <section className="flex flex-col gap-3.5 px-6 pt-12">
        <h2 className="t-display-m">{m.statement}</h2>
        <p className="t-body-s c-ivory-2">{m.note}</p>
        <p className="t-body-s c-ivory-2">{m.intro}</p>
      </section>

      {/* At their best, with the facts kept on every card */}
      {peak.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-14">
          <div className="flex flex-col gap-1.5">
            <h2 className="t-display-s t-figure">{peak.length} at their best</h2>
            <p className="t-caption">In their peak window. Flight times are from India.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(showAll ? peak : peak.slice(0, 12)).map((c) => {
              const key = savedCityKey(c.slug)
              const saved = isSaved(key)
              const flight = factOf(c, 'From India')
              const visa = factOf(c, 'Visa')
              return (
                <Photo
                  key={c.slug}
                  src={cityCard(c.slug)}
                  alt={c.name}
                  label={c.name}
                  veil="card"
                  radius={18}
                  style={{ height: 220 }}
                >
                  {/* A second veil: two facts and a name need more ground than one pass gives. */}
                  <span className="k-veil-card" aria-hidden="true" style={{ height: '58%' }} />
                  <button
                    type="button"
                    aria-label={`Open ${c.name}`}
                    onClick={() => open(c.slug)}
                    className="absolute inset-0 z-[1]"
                  />
                  <button
                    type="button"
                    aria-label={saved ? `Remove ${c.name}` : `Save ${c.name}`}
                    aria-pressed={saved}
                    onClick={() => toggleSaved(key)}
                    className="k-icon-btn absolute right-2.5 top-2.5 z-[2]"
                    style={{ width: 36, height: 36 }}
                  >
                    <Icon name="bookmark" size={16} filled={saved} />
                  </button>
                  <div className="absolute bottom-3.5 left-3.5 right-3.5 z-[2] flex flex-col gap-2">
                    <div className="flex flex-col gap-0.5">
                      {c.country ? <p className="t-caption truncate">{c.country}</p> : null}
                      <h3 className="t-title truncate">{c.name}</h3>
                    </div>
                    <div className="t-caption t-figure c-ivory flex flex-col gap-0.5">
                      {flight ? (
                        <p className="flex items-center gap-1.5 truncate">
                          <Icon name="plane" size={12} strokeWidth={1.7} className="c-ivory-2" />
                          {flight}
                        </p>
                      ) : null}
                      {visa ? (
                        <p className="flex items-center gap-1.5 truncate">
                          <Icon name="passport" size={12} strokeWidth={1.7} className="c-ivory-2" />
                          {visa}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Photo>
              )
            })}
          </div>

          {peak.length > 12 && (
            <Btn
              tone="ghost"
              block
              iconAfter={showAll ? 'chevron-up' : 'chevron-down'}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Show fewer' : `Show all ${peak.length}`}
            </Btn>
          )}
        </section>
      )}

      {m.where.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-14">
          <h2 className="t-display-s">Where it is the right time</h2>
          <Points points={m.where} idPrefix="where" />
        </section>
      )}

      {m.avoid.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-14">
          <h2 className="t-display-s">Where {m.name} does not reward</h2>
          <Points points={m.avoid} idPrefix="avoid" />
        </section>
      )}

      {m.indianAngle.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-14">
          <h2 className="t-display-s">The Indian-calendar angle</h2>
          <Points points={m.indianAngle} idPrefix="indian" />
        </section>
      )}

      {m.flightsVisas.length > 0 && (
        <section className="flex flex-col gap-5 px-6 pt-14">
          <h2 className="t-display-s">Flights and visas</h2>
          <Points points={m.flightsVisas} idPrefix="flights" />
        </section>
      )}

      {shoulder.length > 0 && (
        <section className="flex flex-col gap-5 pt-14">
          <div className="flex flex-col gap-1.5 px-6">
            <h2 className="t-display-s">Also workable</h2>
            <p className="t-caption">Shoulder season: good, with a trade-off you should hear before you book.</p>
          </div>
          <div className="flex gap-3 overflow-x-auto px-6" style={{ scrollSnapType: 'x proximity' }}>
            {shoulder.slice(0, 14).map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => open(c.slug)}
                className="flex w-[150px] shrink-0 flex-col gap-2 text-left"
              >
                <Photo
                  src={cityCard(c.slug)}
                  alt={c.name}
                  label={c.name}
                  veil="none"
                  radius={18}
                  className="h-[112px] w-full"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="t-title-s truncate">{c.name}</span>
                  {c.country ? <span className="t-caption c-ivory-3 truncate">{c.country}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {m.pull && (
        <section className="flex flex-col items-center gap-3.5 px-9 pt-[72px] text-center">
          <span
            aria-hidden="true"
            className="block c-champagne"
            style={{ height: 40, fontFamily: 'var(--f-display)', fontSize: 80, lineHeight: '80px' }}
          >
            &#8220;
          </span>
          <blockquote
            className="t-italic c-ivory max-w-quote"
            style={{
              fontFamily: 'var(--f-display)',
              fontSize: 26,
              lineHeight: '34px',
              letterSpacing: '-0.005em',
            }}
          >
            {m.pull}
          </blockquote>
        </section>
      )}

      {/* Either side of this month */}
      <nav aria-label="Other months" className="grid grid-cols-2 gap-3 px-6 pt-16">
        <Card>
          <button
            type="button"
            onClick={() => navigate(`/month/${prev.no}`)}
            className="flex w-full flex-col gap-3.5 p-4 text-left"
          >
            <span className="t-caption flex items-center gap-1.5">
              <Icon name="back" size={14} />
              Previous
            </span>
            <span className="flex flex-col gap-1">
              <span className="t-title">{prev.name}</span>
              <span className="t-caption c-ivory-3">{prev.statement}</span>
            </span>
          </button>
        </Card>
        <Card>
          <button
            type="button"
            onClick={() => navigate(`/month/${next.no}`)}
            className="flex w-full flex-col items-end gap-3.5 p-4 text-right"
          >
            <span className="t-caption flex items-center gap-1.5">
              Next
              <Icon name="forward" size={14} />
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="t-title">{next.name}</span>
              <span className="t-caption c-ivory-3">{next.statement}</span>
            </span>
          </button>
        </Card>
      </nav>

      <Dock>
        <button
          type="button"
          onClick={() => navigate('/concierge')}
          className="k-btn k-btn-primary flex-1"
        >
          <Icon name="horizon" size={20} strokeWidth={1.6} />
          Ask Tara about {m.name}
        </button>
      </Dock>
    </Screen>
  )
}
