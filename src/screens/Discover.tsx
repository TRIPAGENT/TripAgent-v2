import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Shell'
import { SearchOverlay } from '@/components/SearchOverlay'
import { Band, Chip, Icon, Photo, Rail, Section, SectionHead, Status, Track, Wordmark } from '@/components/ui'
import { CITIES, CITY_BY_SLUG, MONTHS, SERVICES } from '@/data/catalogue.generated'
import { brandImage, cityCard, cityHero } from '@/lib/catalogue'
import type { CitySummary } from '@/lib/catalogue'
import { parseItemKey, savedCityKey } from '@/lib/itinerary'
import { currentBooking, holdLeft, isBooking, isLive, when, type DeskRequest } from '@/lib/desk'
import { DESK } from '@/data/members'
import { useStore } from '@/context/store'

/* ------------------------------------------------------------------ facts -- */

/** A fact exactly as the catalogue publishes it, or nothing. Never a stand-in. */
function factOf(city: CitySummary, label: string): string | null {
  const f = city.facts.find((x) => x.label.toLowerCase().includes(label))
  return f ? `${f.value}${f.small ? ` ${f.small}` : ''}` : null
}

/** Flight time and visa: the two facts that decide whether a trip is possible. */
function feasibility(city: CitySummary): string | null {
  const line = [factOf(city, 'from india'), factOf(city, 'visa')].filter(Boolean).join(' · ')
  return line || null
}

/* ------------------------------------------------------------------- time -- */

function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? ''

const COUNTS = ['', 'One thought', 'Two thoughts', 'Three thoughts']

/* ------------------------------------------------------------- proposals --- */

interface Proposal {
  city: CitySummary
  /** Why this city is on the screen tonight. Always something that is true. */
  reason: { text: string; icon: string } | null
}

/**
 * Three thoughts, in this order: the cities the member has already saved
 * something in, then cities at their peak this month. Nothing is generated —
 * every card is a city in the catalogue and every line is its own copy.
 */
function proposalsFor(wishlist: string[], month: number, monthName: string): Proposal[] {
  const out: Proposal[] = []
  const taken = new Set<string>()

  for (const key of wishlist) {
    const item = parseItemKey(key)
    const slug = item ? item.slug : key.startsWith('city:') ? key.slice(5) : null
    if (!slug || taken.has(slug)) continue
    const city = CITY_BY_SLUG[slug]
    if (!city) continue
    taken.add(slug)
    out.push({
      city,
      reason: { text: `Because you saved ${item ? item.name : city.name}`, icon: 'bookmark' },
    })
    if (out.length === 3) return out
  }

  for (const city of CITIES) {
    if (out.length === 3) break
    if (taken.has(city.slug)) continue
    if (city.months[month - 1] !== 'peak') continue
    taken.add(city.slug)
    out.push({ city, reason: { text: `At its best in ${monthName}`, icon: 'sun' } })
  }

  return out
}

/* --------------------------------------------------------------- services -- */

/** The house's four counters. The first three are the catalogue's own. */
const SERVICE_IMAGE: Record<string, string> = { Flights: 'cabin', Hotels: 'suite', Visas: 'visas' }
/** The catalogue says "Hotels"; the house says "Stays". */
const SERVICE_NAME: Record<string, string> = { Hotels: 'Stays' }
const SERVICE_LINE: Record<string, string> = {
  Flights: 'Business and first',
  Hotels: 'The room, not the listing',
  Visas: 'Checked, filed, tracked',
}

/* ------------------------------------------------------------------ screen - */

export default function Discover() {
  const navigate = useNavigate()
  const { member, wishlist, isSaved, toggleSaved, setActiveCity, requests, refreshRequests } = useStore()

  const now = useMemo(() => new Date(), [])
  const thisMonth = now.getMonth() + 1
  const [month, setMonth] = useState(thisMonth)
  const [searchOpen, setSearchOpen] = useState(false)

  // What the Desk holds, asked once when the screen opens.
  useEffect(() => {
    void refreshRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = MONTHS[month - 1]
  const atTheirBest = useMemo(() => CITIES.filter((c) => c.months[month - 1] === 'peak'), [month])
  const proposals = useMemo(
    () => proposalsFor(wishlist, thisMonth, MONTHS[thisMonth - 1].name),
    [wishlist, thisMonth],
  )

  const live = requests.filter(isLive)
  const booking = currentBooking(requests)
  const current: DeskRequest | null = (booking && isLive(booking) ? booking : null) ?? live[0] ?? null
  const liveBookings = requests.filter((r) => isBooking(r) && isLive(r)).slice(0, 3)

  const day = partOfDay(now.getHours())
  const greeting = `Good ${day},`
  const dateLine = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  function open(slug: string) {
    setActiveCity(slug)
    navigate(`/city/${slug}`)
  }

  function ask(query: string) {
    navigate('/concierge', { state: { query } })
  }

  return (
    <Screen tone="light">
      {/* --------------------------------------------------------- the hero -- */}
      <Photo
        src={brandImage('home')}
        alt="A suite in warm evening light"
        veil="hero"
        radius={0}
        eager
        kenburns
        className="h-[648px] max-h-[82svh] w-full"
      >
        <header
          className="absolute left-4 right-4 z-10 flex items-center justify-between gap-3"
          style={{ top: 'max(54px, calc(env(safe-area-inset-top) + 12px))', height: 44 }}
        >
          <button
            type="button"
            className="k-icon-btn c-champagne"
            aria-label={member?.name ? `Membership, ${member.name}` : 'Membership'}
            onClick={() => navigate('/membership')}
            style={{ fontFamily: 'var(--f-display)', fontSize: 14, letterSpacing: '0.04em' }}
          >
            {initials(member?.name)}
          </button>

          <Wordmark size={15} />

          <button
            type="button"
            className="k-icon-btn relative"
            aria-label={live.length > 0 ? 'Requests, one with the Desk' : 'Requests'}
            onClick={() => navigate('/status')}
          >
            <Icon name="bell" size={20} />
            {live.length > 0 && (
              <span
                className="absolute right-[11px] top-[10px] h-2 w-2 rounded-full"
                style={{ background: 'var(--champagne)', boxShadow: '0 0 0 2px rgba(10,10,11,.6)' }}
              />
            )}
          </button>
        </header>

        <div className="absolute inset-x-6 bottom-7 z-10 flex flex-col gap-[18px]">
          <p className="t-caption">{dateLine}</p>
          <h1 className="t-display-xxl">
            {greeting}
            <br />
            {firstName(member?.name) ? <em className="t-italic">{firstName(member?.name)}.</em> : null}
          </h1>

          {current ? <LiveCard request={current} onOpen={() => navigate('/status')} /> : null}
        </div>
      </Photo>

      {/* --------------------------------------------------- Tara -- */}
      <section className="flex flex-col gap-3.5 pt-6">
        <div className="k-composer mx-6">
          <button
            type="button"
            onClick={() => ask('')}
            className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left"
          >
            <span className="c-champagne flex">
              <Icon name="horizon" size={22} strokeWidth={1.6} />
            </span>
            <span className="t-body c-ivory-3 min-w-0 flex-1 truncate">Where would you like to be?</span>
          </button>
          <button
            type="button"
            aria-label="Search destinations"
            className="k-icon-btn k-icon-btn-solid"
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" size={20} />
          </button>
        </div>

        <Rail className="pb-1">
          {wishlist.length > 0 && (
            <Chip className="shrink-0" onClick={() => ask("Plan around what I've saved")}>
              Plan around what I&rsquo;ve saved
            </Chip>
          )}
          <Chip className="shrink-0" onClick={() => ask('Somewhere warm in December')}>
            Somewhere warm in December
          </Chip>
          <Chip className="shrink-0" onClick={() => ask('A quiet week, somewhere new')}>
            A quiet week, somewhere new
          </Chip>
        </Rail>
      </section>

      {/* ------------------------------------------------- a finite brief --- */}
      {proposals.length > 0 && (
        <section className="flex flex-col gap-5 pt-[52px]">
          <div className="flex flex-col gap-1.5 px-6">
            <h2 className="t-display-s">
              {COUNTS[proposals.length]} for this {day}
            </h2>
            <p className="t-caption">From what you saved, and the season.</p>
          </div>

          <Rail>
            {proposals.map(({ city, reason }) => (
              <article key={city.slug} className="shrink-0" style={{ width: 292 }}>
                <Photo
                  src={cityHero(city.slug)}
                  alt={city.name}
                  label={city.name}
                  radius={22}
                  className="h-[420px] w-full"
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-[1]"
                    aria-label={`Open ${city.name}`}
                    onClick={() => open(city.slug)}
                  />
                  {reason && (
                    <span className="k-glass-chip absolute left-3.5 top-3.5 z-[2] max-w-[252px]">
                      <Icon name={reason.icon} size={12} filled={reason.icon === 'bookmark'} />
                      <span className="truncate">{reason.text}</span>
                    </span>
                  )}
                  <div className="absolute inset-x-[18px] bottom-[18px] z-[2] flex flex-col gap-2">
                    {city.country && (
                      <p
                        className="t-italic c-champagne"
                        style={{ fontFamily: 'var(--f-display)', fontSize: 16, lineHeight: '20px' }}
                      >
                        {city.country}
                      </p>
                    )}
                    <h3 className="t-display-m">{city.name}</h3>
                    <p className="t-caption">{city.tagline}</p>
                    {feasibility(city) && <p className="t-caption t-figure c-ivory">{feasibility(city)}</p>}
                    <button
                      type="button"
                      className="k-btn k-btn-secondary k-btn-sm z-[2] mt-1.5 self-start"
                      onClick={() => ask(`Shape a trip to ${city.name}`)}
                    >
                      Shape it with Tara
                    </button>
                  </div>
                </Photo>
              </article>
            ))}
          </Rail>

          <p className="t-caption c-ivory-3 flex items-center justify-center gap-2 px-6">
            <Icon name="horizon" size={14} />
            That&rsquo;s all for this {day}.
          </p>
        </section>
      )}

      {/* --------------------------------------------- deciding by the month */}
      <section className="flex flex-col gap-[18px] pt-14">
        <Section>
          <SectionHead
            title={`At their best in ${active.name}`}
            action={
              <button
                type="button"
                className="k-link c-ivory-2 shrink-0"
                onClick={() => navigate(`/month/${active.no}`)}
              >
                All {atTheirBest.length}
                <Icon name="forward" size={16} />
              </button>
            }
          />
        </Section>

        <Rail className="pb-1">
          {MONTHS.map((m) => (
            <Chip key={m.no} on={m.no === month} className="shrink-0" onClick={() => setMonth(m.no)}>
              {m.name}
            </Chip>
          ))}
        </Rail>

        {atTheirBest.length === 0 ? (
          <p className="t-caption px-6">
            Nowhere we cover is at its best in {active.name}. {MONTHS[thisMonth - 1].name} is a better month to
            look at.
          </p>
        ) : (
          <Rail key={month}>
            {atTheirBest.slice(0, 12).map((c) => {
              const key = savedCityKey(c.slug)
              const saved = isSaved(key)
              return (
                <article key={c.slug} className="shrink-0" style={{ width: 216 }}>
                  <Photo src={cityCard(c.slug)} alt={c.name} label={c.name} className="h-[292px] w-full">
                    <button
                      type="button"
                      className="absolute inset-0 z-[1]"
                      aria-label={`Open ${c.name}`}
                      onClick={() => open(c.slug)}
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
                    <div className="absolute inset-x-4 bottom-4 z-[2] flex flex-col gap-1">
                      {c.country && <p className="t-caption truncate">{c.country}</p>}
                      <h3 className="t-display-s truncate">{c.name}</h3>
                      {feasibility(c) && <p className="t-caption t-figure c-ivory truncate">{feasibility(c)}</p>}
                    </div>
                  </Photo>
                </article>
              )
            })}
          </Rail>
        )}

        <Section className="pt-2">
          <button
            type="button"
            onClick={() => navigate('/map')}
            className="k-card flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="c-champagne">
              <Icon name="globe" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="t-title-s block">Every destination we cover</span>
              <span className="t-caption block">{CITIES.length} on the map, by region</span>
            </span>
            <Icon name="chevron-right" size={18} className="c-ivory-3" />
          </button>
        </Section>
      </section>

      {/* ----------------------------------------------- what is in motion -- */}
      {liveBookings.length > 0 && (
        <Section className="flex flex-col gap-[18px] pt-14">
          <SectionHead
            title="Your journeys"
            action={
              <button type="button" className="k-link c-ivory-2 shrink-0" onClick={() => navigate('/journeys')}>
                See all
                <Icon name="forward" size={16} />
              </button>
            }
          />
          <div className="flex flex-col gap-3">
            {liveBookings.map((r) => (
              <JourneyRow key={r.id} request={r} onOpen={() => navigate(`/status?id=${r.id}`)} />
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------- what we handle --- */}
      <Section className="flex flex-col gap-[18px] pt-14">
        <SectionHead
          title="What we handle"
          action={
            <button type="button" className="k-link c-ivory-2 shrink-0" onClick={() => navigate('/services')}>
              Services
              <Icon name="forward" size={16} />
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map((s) => (
            <button key={s.heading} type="button" onClick={() => navigate('/services')} className="text-left">
              <Photo
                src={brandImage(SERVICE_IMAGE[s.heading] ?? s.image ?? 'home')}
                alt={SERVICE_NAME[s.heading] ?? s.heading}
                label={SERVICE_NAME[s.heading] ?? s.heading}
                className="h-44 w-full"
              >
                <span className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-0.5">
                  <span className="t-title">{SERVICE_NAME[s.heading] ?? s.heading}</span>
                  {SERVICE_LINE[s.heading] && <span className="t-caption">{SERVICE_LINE[s.heading]}</span>}
                </span>
              </Photo>
            </button>
          ))}
          <button type="button" onClick={() => navigate('/desk')} className="text-left">
            <Photo
              src={brandImage('champagne')}
              alt="Champagne poured into rows of coupes"
              label="Anything else"
              className="h-44 w-full"
            >
              <span className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-0.5">
                <span className="t-title">Anything else</span>
                <span className="t-caption">Ask the Desk</span>
              </span>
            </Photo>
          </button>
        </div>
      </Section>

      {/* ------------------------------------------------- the dark band ---
          One obsidian statement near the foot of the home screen. The house
          reads as two-tone rather than as a pale app with a dark photograph
          at the top, and the band earns its weight by carrying the one thing
          a member is meant to remember: there are people behind this. */}
      <Band tone="dark" className="mt-14 px-6 py-14">
        <p className="k-eyebrow">The house</p>
        <h2 className="t-display-m mt-4">
          You bring the <em className="t-italic">why.</em>
          <br />
          We handle the <em className="t-italic">how.</em>
        </h2>
        <p className="t-body-s c-ivory-2 mt-4 max-w-quote">
          Tara shapes the journey. {DESK.name} books it, holds it, and answers the phone when
          something moves.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <button type="button" className="k-btn k-btn-secondary k-btn-sm" onClick={() => navigate('/desk')}>
            <Icon name="phone" size={16} />
            Speak to the Desk
          </button>
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => navigate('/membership')}>
            Your membership
          </button>
        </div>
      </Band>

      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onPick={(slug) => {
            setSearchOpen(false)
            open(slug)
          }}
        />
      )}
    </Screen>
  )
}

/* ------------------------------------------------------------- the pieces -- */

function initials(name?: string | null) {
  if (!name) return 'TA'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase() || 'TA'
}

/** The title of a request, as the member would name it. */
function titleOf(r: DeskRequest): string {
  if (isBooking(r)) return r.title
  if (r.type === 'enquiry') return `${r.kind[0].toUpperCase()}${r.kind.slice(1)} enquiry`
  if (r.type === 'call') return 'Call with the Desk'
  return 'WhatsApp with the Desk'
}

/**
 * The one live request, on the hero. It says only what has actually happened:
 * a price that is ready and how long it holds, or that the file is with the Desk.
 */
function LiveCard({ request, onOpen }: { request: DeskRequest; onOpen: () => void }) {
  const title = titleOf(request)
  const quote = request.quote
  const left = quote ? holdLeft(quote) : null

  let line: string
  let caption: string | null
  if (request.status === 'quoted' && quote) {
    line = `Your ${title} price is ready`
    caption = left
      ? `Held until ${when(quote.holdUntil)} · ${left.hours}h left`
      : `The hold ended ${when(quote.holdUntil)}`
  } else if (request.status === 'paid') {
    line = 'Booked'
    caption = title
  } else {
    line = 'With the Desk'
    caption = request.status === 'working' ? `${title} · being priced` : title
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="k-glass flex w-full items-center gap-3 text-left"
      style={{ padding: '12px 14px', borderRadius: 20 }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: request.status === 'quoted' ? 'var(--champagne)' : 'var(--ivory-3)' }}
          />
          <span className="t-title-s truncate">{line}</span>
        </span>
        {caption && <span className="t-caption block truncate">{caption}</span>}
      </span>
      <Icon name="chevron-right" size={18} className="c-ivory-2" />
    </button>
  )
}

/** How much of a real hold window has passed, 0–1. */
function elapsed(from: string, to: string): number {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.max(0, Math.min(1, (Date.now() - a) / (b - a)))
}

/** A journey already with the Desk. Typographic: there is no photograph of it. */
function JourneyRow({ request, onOpen }: { request: DeskRequest; onOpen: () => void }) {
  const quote = request.quote
  const left = quote ? holdLeft(quote) : null
  const tone =
    request.status === 'quoted' ? 'ready' : request.status === 'paid' ? 'ok' : ('progress' as const)
  const label =
    request.status === 'quoted'
      ? 'Price ready'
      : request.status === 'paid'
        ? 'Paid · booking'
        : request.status === 'working'
          ? 'Being priced'
          : 'With the Desk'

  return (
    <button type="button" onClick={onOpen} className="k-card w-full p-4 text-left">
      <span className="flex items-start justify-between gap-3">
        <Status tone={tone}>{label}</Status>
        <Icon name="chevron-right" size={18} className="c-ivory-3 mt-1" />
      </span>
      <span className="t-title mt-3 block">{titleOf(request)}</span>
      {quote && request.status === 'quoted' && (
        <span className="mt-3 block">
          {/* The bar only appears when the Desk told us when the quote was released. */}
          {quote.releasedAt && <Track value={elapsed(quote.releasedAt, quote.holdUntil)} />}
          <span className="t-caption t-figure mt-1.5 flex justify-between">
            <span>{left ? `Held until ${when(quote.holdUntil)}` : `The hold ended ${when(quote.holdUntil)}`}</span>
            {left && <span className="c-champagne">{left.hours}h left</span>}
          </span>
        </span>
      )}
    </button>
  )
}
