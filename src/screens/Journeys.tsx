import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Shell'
import { Btn, Card, Empty, Icon, Photo, Status, Track, type StatusTone } from '@/components/ui'
import { fetchDue, fetchTrips } from '@/lib/agentClient'
import { cityCard, cityHero } from '@/lib/catalogue'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { holdLeft, inr, isBooking, isLive, STATUS_LABEL, TYPE_LABEL, when } from '@/lib/desk'
import type { BookingRequestRecord, DeskRequest, RequestStatus } from '@/lib/desk'
import { humanizePlan } from '@/lib/humanize'
import type { Nudge, TripSummary } from '@/lib/plan'
import { useStore } from '@/context/store'

/**
 * Journeys — the list the app never had.
 *
 * Before the redesign there was no list: the Planner opened straight into one
 * itinerary and switched between trips from a select in its hero. This is the
 * room: what is coming, what Tara is still shaping, what has been, the
 * dates the next weeks ask something of you, and every request with the Desk.
 */

/**
 * The words come from `STATUS_LABEL`, which every screen shares; only the tone
 * is this screen's business — champagne for a price waiting on the member.
 */
const TONE: Record<RequestStatus, StatusTone> = {
  open: 'progress',
  working: 'progress',
  quoted: 'ready',
  paid: 'ok',
  closed: 'ok',
  cancelled: 'progress',
}
const STATUS = Object.fromEntries(
  (Object.keys(TONE) as RequestStatus[]).map((s) => [s, { label: STATUS_LABEL[s], tone: TONE[s] }]),
) as Record<RequestStatus, { label: string; tone: StatusTone }>

type Segment = 'upcoming' | 'shaping' | 'past'

const today = () => new Date().toISOString().slice(0, 10)

const range = (t: TripSummary) => {
  const fmt = (iso: string, withYear: boolean) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    })
  }
  if (!t.start) return null
  return t.end ? `${fmt(t.start, false)} – ${fmt(t.end, true)}` : fmt(t.start, true)
}

const nudgeDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function Journeys() {
  const navigate = useNavigate()
  const { member, wishlist, requests, refreshRequests } = useStore()

  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [coming, setComing] = useState<Nudge[]>([])
  const [error, setError] = useState<string | null>(null)
  const [segment, setSegment] = useState<Segment>('upcoming')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(() => {
    setError(null)
    void refreshRequests()
    fetchTrips()
      .then((t) => setTrips(t.map((x) => ({ ...x, title: humanizePlan(x.title) }))))
      .catch((e: Error) => setError(e.message))
    fetchDue('month')
      .then(setComing)
      .catch(() => undefined)
    // refreshRequests changes on every list change; this is a one-shot load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.code])

  // A hold is a clock. It counts down while the screen is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const bookings = useMemo(() => requests.filter(isBooking), [requests])
  const bookingFor = useCallback(
    (planId: string): BookingRequestRecord | undefined =>
      bookings.find((r) => r.planId === planId && (isLive(r) || r.status === 'paid')) ??
      bookings.find((r) => r.planId === planId),
    [bookings],
  )

  /** Which shelf a trip sits on: the trip's own status, and what the Desk holds. */
  const shelfOf = useCallback(
    (t: TripSummary): Segment => {
      const d = today()
      if (t.status === 'completed' || t.status === 'cancelled') return 'past'
      if (t.end && t.end < d) return 'past'
      if (t.status === 'requested' || t.status === 'booked' || t.status === 'travelling') return 'upcoming'
      const r = bookingFor(t.planId)
      if (r && isLive(r)) return 'upcoming'
      return 'shaping'
    },
    [bookingFor],
  )

  const shelves = useMemo(() => {
    const out: Record<Segment, TripSummary[]> = { upcoming: [], shaping: [], past: [] }
    for (const t of trips ?? []) out[shelfOf(t)].push(t)
    out.upcoming.sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999'))
    out.past.sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
    return out
  }, [trips, shelfOf])

  // Open on the shelf that has something on it.
  useEffect(() => {
    if (!trips) return
    setSegment((s) =>
      shelves[s].length > 0 ? s : shelves.upcoming.length ? 'upcoming' : shelves.shaping.length ? 'shaping' : 'past',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips])

  const ledger = useMemo(
    () => [...requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    [requests],
  )

  if (error && !trips) {
    return (
      <Screen tone="light">
        <header className="px-6 pt-16">
          <h1 className="t-display-l">Journeys</h1>
        </header>
        <Empty
          icon="cloud-off"
          title="The Desk is not reachable just now."
          body="Your journeys are kept with the Desk. They will be here as soon as it is back."
          action={
            <Btn tone="ghost" icon="refresh" onClick={load}>
              Try again
            </Btn>
          }
        />
      </Screen>
    )
  }

  if (trips && trips.length === 0) {
    return (
      <Screen tone="light">
        <header className="px-6 pt-16">
          <h1 className="t-display-l">Journeys</h1>
        </header>
        <Empty
          icon="map"
          title="No itinerary yet."
          body={
            wishlist.length
              ? `You have ${wishlist.length} saved. Tara can shape a journey around them.`
              : 'Tell Tara where, and roughly when. Tara comes back with a plan you can change and forward.'
          }
          action={
            <Btn tone="primary" icon="horizon" onClick={() => navigate('/concierge')}>
              Shape a journey
            </Btn>
          }
        />
      </Screen>
    )
  }

  const shown = shelves[segment]
  const seg: { id: Segment; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming', count: shelves.upcoming.length },
    { id: 'shaping', label: 'Being shaped', count: shelves.shaping.length },
    { id: 'past', label: 'Past', count: shelves.past.length },
  ]

  return (
    <Screen tone="light">
      <header className="flex flex-col gap-5 px-6 pt-16">
        <div className="flex h-11 items-center justify-between">
          <h1 className="t-display-l">Journeys</h1>
          <button
            type="button"
            aria-label="Shape a new journey"
            className="k-icon-btn k-icon-btn-solid"
            onClick={() => navigate('/concierge')}
          >
            <Icon name="plus" size={20} />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Show journeys"
          className="flex gap-0.5 p-[3px]"
          style={{ height: 52, borderRadius: 26, background: 'var(--ink-2)', border: '1px solid var(--line)' }}
        >
          {seg.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={segment === s.id}
              onClick={() => setSegment(s.id)}
              className="t-figure flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-2"
              style={{
                height: 44,
                borderRadius: 22,
                fontWeight: 500,
                fontSize: 13,
                lineHeight: '18px',
                color: segment === s.id ? 'var(--ivory)' : 'var(--ivory-2)',
                background: segment === s.id ? 'var(--ink-4)' : undefined,
                border: segment === s.id ? '1px solid var(--line-2)' : '1px solid transparent',
                boxShadow: segment === s.id ? 'inset 0 1px 0 rgba(255,255,255,.06), 0 2px 6px rgba(0,0,0,.35)' : undefined,
              }}
            >
              {s.label}
              {s.count > 0 ? <span style={{ color: 'var(--ivory-3)' }}>({s.count})</span> : null}
            </button>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-3 px-6 pt-6">
        {shown.length === 0 ? (
          <p className="t-caption c-ivory-3 py-10 text-center">
            {segment === 'upcoming'
              ? 'Nothing booked or priced yet.'
              : segment === 'shaping'
                ? 'Nothing on Tara’s desk just now.'
                : 'Nothing behind you yet.'}
          </p>
        ) : null}

        {shown.map((t, i) => {
          const req = bookingFor(t.planId)
          const slug = t.places[0] ?? null
          const big = segment === 'upcoming' && i === 0
          const left = req?.status === 'quoted' && req.quote ? holdLeft(req.quote, now) : null
          const state = req ? STATUS[req.status] : null

          return (
            <article key={t.key} className="k-photo relative" style={{ borderRadius: 24, height: big ? 440 : 168 }}>
              <Photo
                src={slug ? (big ? cityHero(slug) : cityCard(slug)) : undefined}
                alt={slug ? CITY_BY_SLUG[slug]?.name ?? t.title : t.title}
                label={t.title}
                veil="card"
                radius={24}
                eager={big}
                className="absolute inset-0 h-full w-full"
              />
              <Link
                to={`/journeys/${t.key}`}
                aria-label={`Open the itinerary, ${t.title}`}
                className="absolute inset-0 z-[1]"
              />

              {state ? (
                <span className="absolute left-4 top-4 z-[2]">
                  <Status tone={state.tone}>{state.label}</Status>
                </span>
              ) : (
                <span className="absolute left-4 top-4 z-[2]">
                  <Status tone="progress">Draft · shaping</Status>
                </span>
              )}
              {req ? (
                <span className="t-mono absolute right-4 top-[21px] z-[2] c-ivory-2">{req.id}</span>
              ) : null}

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[2] flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 px-1">
                  <h2 className={big ? 't-display-m' : 't-title'}>{t.title}</h2>
                  <p className="t-caption t-figure">
                    {[range(t), t.nights ? `${t.nights} night${t.nights === 1 ? '' : 's'}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                {/* The live request: the hold, ticking, and the one thing to do. */}
                {req && req.status === 'quoted' && req.quote ? (
                  <div className="k-glass pointer-events-auto flex flex-col gap-3 p-3" style={{ borderRadius: 16 }}>
                    <div className="flex items-end justify-between gap-3 px-1 pt-0.5">
                      <p className="t-caption t-figure flex flex-col gap-0.5">
                        <span>{left ? 'Quote held until' : 'The hold has lapsed'}</span>
                        <span style={{ color: 'var(--ivory)', fontWeight: 500 }}>{when(req.quote.holdUntil)}</span>
                      </p>
                      <p className="t-caption flex flex-col items-end">
                        <span>{left ? 'Time left' : 'On your quote'}</span>
                        <span
                          className="t-figure c-champagne whitespace-nowrap"
                          style={{ fontSize: 22, lineHeight: '26px', fontWeight: 500, letterSpacing: '-0.01em' }}
                        >
                          {left ? `${left.hours}h ${left.minutes}m` : inr(req.quote.total)}
                        </span>
                      </p>
                    </div>
                    {left ? (
                      <Track
                        className="mx-1"
                        value={Math.min(1, (left.hours * 60 + left.minutes) / (48 * 60))}
                      />
                    ) : null}
                    <Btn tone="primary" block className="mt-0.5" onClick={() => navigate(`/settlement?id=${req.id}`)}>
                      Review the price
                    </Btn>
                  </div>
                ) : null}

                {/* Still being shaped: Tara's working light. */}
                {!req && segment === 'shaping' ? (
                  <div className="flex flex-col gap-2.5 px-1">
                    <span className="t-caption flex items-center gap-2">
                      <span className="c-champagne">
                        <Icon name="horizon" size={16} />
                      </span>
                      Tara is shaping this
                    </span>
                    <span className="k-track block">
                      <i className="k-sweep block h-full w-full" aria-hidden="true" />
                    </span>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </section>

      {coming.length > 0 ? (
        <section className="flex flex-col gap-4 px-6 pt-12">
          <h2 className="t-display-s">Coming up</h2>
          <Card className="flex flex-col gap-[18px] p-[18px]">
            <ol className="flex flex-col gap-4">
              {coming.slice(0, 6).map((n) => {
                const due = n.inDays <= 0
                return (
                  <li
                    key={`${n.trip}-${n.date}-${n.text}`}
                    className="grid"
                    style={{ gridTemplateColumns: '7px minmax(0,1fr)', columnGap: 14 }}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-[7px] w-[7px] rounded-full"
                      style={
                        due
                          ? { background: 'var(--amber)', boxShadow: '0 0 0 3px rgba(230,176,113,.18)' }
                          : { background: 'var(--ink-2)', border: '1px solid var(--champagne-line)' }
                      }
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className={`t-mono ${due ? 'c-amber' : 'c-champagne'}`}>
                        {due ? 'Now' : nudgeDate(n.date)}
                      </span>
                      <span className="t-body-s c-ivory-2">{n.text}</span>
                      <span className="t-caption c-ivory-3 truncate">{n.tripTitle}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </Card>
        </section>
      ) : null}

      {ledger.length > 0 ? (
        <section className="flex flex-col gap-4 px-6 pt-12">
          <h2 className="t-display-s">Requests</h2>
          <Card className="px-4">
            {ledger.map((r: DeskRequest) => (
              <Link key={r.id} to={`/status?id=${r.id}`} className="k-row py-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="t-title-s truncate">
                    <span style={{ color: 'var(--ivory-3)' }}>{TYPE_LABEL[r.type]} · </span>
                    {r.type === 'booking' ? r.title : r.type === 'call' ? r.slot : r.type === 'enquiry' ? r.kind : 'WhatsApp'}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <Status tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Status>
                    <span className="t-mono" style={{ color: 'var(--ivory-3)' }}>
                      {r.id}
                    </span>
                  </span>
                </span>
                <span className="c-ivory-3 shrink-0">
                  <Icon name="chevron-right" size={18} />
                </span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      <p className="t-caption c-ivory-3 px-6 pt-8 text-center">
        The Desk · Bengaluru
        <br />
        Replies the same day · All times IST
      </p>
    </Screen>
  )
}
