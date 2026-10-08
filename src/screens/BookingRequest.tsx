import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar, Dock } from '@/components/Shell'
import { Btn, Card, Empty, Headline, Icon, Photo, Sig, Status } from '@/components/ui'
import { TermsPanel } from '@/components/Terms'
import { useStore } from '@/context/store'
import { CITIES } from '@/data/catalogue.generated'
import { fetchPlan, fileRequest, savedChoices } from '@/lib/agentClient'
import type { TripPlan } from '@/lib/plan'
import { cityHero } from '@/lib/catalogue'
import type { BookingComponent } from '@/lib/types'
import { humanizePlan, splitName } from '@/lib/humanize'
import { tierLabel } from '@/lib/format'

/**
 * Asking a person to price the trip. What goes to the Desk is exactly what the
 * member chose on the itinerary, swaps included, re-derived from the plan every
 * time so a swap made a minute ago is what is asked for. No fare or rate is
 * stated here: the one price comes back from the Desk as a quote.
 */

const KIND_ICON: Record<string, string> = {
  flight: 'plane',
  hotel: 'stay',
  transfer: 'car',
  visa: 'passport',
  advisory: 'document',
}

export default function BookingRequest() {
  const navigate = useNavigate()
  const { member, prefs, setPrefs, components, setComponents, booking, refreshRequests } = useStore()

  /** This request only. What is already on the file is shown beside it, not retyped. */
  const [note, setNote] = useState('')
  const [party, setParty] = useState(() => Math.max(1, prefs.party ?? 1))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [hero, setHero] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(booking))
  /** Bumped by "Try again": the old screen left the CTA disabled with no way forward. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!booking) return
    let cancelled = false
    setLoading(true)
    setReadError(null)
    fetchPlan(booking.key)
      .then((b) => {
        if (cancelled || b.plan.kind !== 'trip') return
        const p = humanizePlan(b.plan) as TripPlan
        setPlan(p)
        setHero(b.places?.hero ?? null)
        const choices = savedChoices(booking.key)
        const pick = (g: TripPlan['flightOptions'][number], id: string) =>
          [g.recommended, ...g.alternatives][choices[id] ?? 0] ?? g.recommended
        const next: BookingComponent[] = [
          ...p.flightOptions.map((g, i) => {
            const o = pick(g, `flight-${i}`)
            return { id: `flight-${i}`, kind: 'flight' as const, title: splitName(o.name).name, detail: g.label, status: 'To quote' }
          }),
          ...p.hotelOptions.map((g, i) => {
            const o = pick(g, `stay-${i}`)
            return { id: `stay-${i}`, kind: 'hotel' as const, title: splitName(o.name).name, detail: g.label, status: 'To quote' }
          }),
          {
            id: 'advisory',
            kind: 'advisory' as const,
            title: 'The days',
            detail: `${p.days.length} days as planned · dining and experiences are guidance`,
            status: 'Guidance',
          },
        ]
        setComponents(next)
      })
      .catch(() => {
        if (!cancelled) setReadError('We could not open this itinerary just now. Check the connection and try again.')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [booking, setComponents, attempt])

  if (!booking) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar solid title="Request to book" />
        <div className="pt-[110px]">
          <Empty
            icon="plane"
            title="Nothing to book yet."
            body="Ask Tara for an itinerary first. Once you are happy with it, send it from the journey and the Desk prices it."
            action={
              <Btn onClick={() => navigate('/concierge')}>
                Ask Tara
              </Btn>
            }
          />
        </div>
      </Screen>
    )
  }

  // The photograph is the plan's own hero place, else the first city its title names.
  const city =
    (hero && CITIES.find((c) => c.slug === hero)) ||
    (plan ? CITIES.find((c) => plan.title.toLowerCase().includes(c.name.toLowerCase())) ?? null : null)
  const bookable = components.filter((c) => c.kind !== 'advisory')

  function setTravellers(n: number) {
    const v = Math.max(1, Math.min(12, n))
    setParty(v)
    setPrefs({ ...prefs, party: v })
  }

  async function submit() {
    if (!booking) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fileRequest({
        type: 'booking',
        planId: booking.planId,
        planKey: booking.key,
        title: booking.title,
        components: components.map(({ id, kind, title, detail }) => ({ id, kind, title, detail })),
        choices: savedChoices(booking.key),
        directives: note.trim() || member?.directives || undefined,
        party,
      })
      await refreshRequests()
      navigate(`/status?id=${r.id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <Screen tone="light" tabs={false} dock>
      <TopBar solid title="Request to book" onBack={() => navigate(`/journeys/${booking.key}`)} />

      {/* The promise, in one line */}
      <section className="flex flex-col gap-3.5 px-6" style={{ paddingTop: 126 }}>
        <Headline size="l">
          One price,
          <br />
          <Sig>held for you.</Sig>
        </Headline>
        <p className="t-body c-ivory-2">
          The Desk checks live rates and availability for exactly what you chose, then sends one quote —
          every line, taxes shown, and how long it holds.
        </p>
      </section>

      {/* The itinerary plate */}
      <section className="px-6 pt-7">
        <button
          type="button"
          onClick={() => navigate(`/journeys/${booking.key}`)}
          className="block w-full text-left"
          aria-label={`Your journey: ${booking.title}`}
        >
          <Photo
            src={city ? cityHero(city.slug) : undefined}
            alt={city ? `${city.name} at dusk` : booking.title}
            label={booking.title}
            radius={22}
            className="h-[170px] w-full"
          >
            {city && (
              <span className="k-glass-chip absolute left-3 top-3">
                <Icon name="pin" size={12} />
                {city.name}
              </span>
            )}
            <span className="absolute bottom-4 left-[18px] right-[18px] flex flex-col gap-1">
              <span className="t-caption">Your journey</span>
              <span className="t-display-s">{booking.title}</span>
              {plan?.sub ? <span className="t-caption t-figure">{plan.sub}</span> : null}
            </span>
          </Photo>
        </button>
      </section>

      {/* The manifest: what the Desk will price, and what stays guidance */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <div className="k-section-head">
          <h2 className="t-display-s">
            What will be priced <span className="t-figure c-ivory-3">· {bookable.length}</span>
          </h2>
          <button
            type="button"
            onClick={() => navigate(`/journeys/${booking.key}`)}
            className="k-link c-ivory-2 -my-3 py-3"
          >
            Change
          </button>
        </div>

        {loading ? (
          <p className="t-caption">Reading your itinerary…</p>
        ) : readError ? (
          <Card className="flex flex-col items-start gap-3 p-4">
            <p className="t-body-s c-ivory-2">{readError}</p>
            <Btn tone="secondary" size="sm" icon="refresh" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Btn>
          </Card>
        ) : (
          <ul className="flex flex-col" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            {components.map((c, i) => {
              const guidance = c.kind === 'advisory'
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3.5 py-3.5"
                  style={i === 0 ? undefined : { borderTop: '1px solid var(--line)' }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center"
                    style={{
                      borderRadius: 12,
                      background: guidance ? 'transparent' : 'var(--ink-3)',
                      border: guidance ? '1px dashed var(--line-2)' : '1px solid var(--line)',
                      color: guidance ? 'var(--ivory-3)' : 'var(--ivory-2)',
                    }}
                  >
                    <Icon name={KIND_ICON[c.kind] ?? 'document'} size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`t-title-s ${guidance ? 'c-ivory-2' : ''}`}>{c.title}</span>
                    <span className={`t-caption ${guidance ? 'c-ivory-3' : ''}`}>{c.detail}</span>
                  </span>
                  {guidance ? (
                    <span
                      className="k-status shrink-0"
                      style={{ background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ivory-3)' }}
                    >
                      {c.status}
                    </span>
                  ) : (
                    <Status tone="progress">{c.status}</Status>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Who is travelling */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">Travelling</h2>
        <Card className="flex flex-col gap-3.5 p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-3.5">
            <span className="k-monogram shrink-0" aria-hidden="true" style={{ width: 44, height: 44, fontSize: 16, lineHeight: '16px' }}>
              {(member?.name ?? 'TA')
                .trim()
                .split(/\s+/)
                .map((p) => p[0] ?? '')
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="t-title-s truncate">{member?.name ?? 'Guest'}</p>
              <p className="t-caption t-figure truncate">
                {tierLabel(member?.tier) ?? 'Invited Guest'}
                {member?.phoneMasked ? ` · ${member.phoneMasked}` : ''}
              </p>
            </div>
          </div>

          <span className="k-rule" aria-hidden="true" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="t-title-s" id="travellers-label">
                Travellers
              </p>
              <p className="t-caption">Including you</p>
            </div>
            <div
              role="group"
              aria-labelledby="travellers-label"
              className="flex h-[46px] items-center"
              style={{ borderRadius: 999, background: 'var(--ink-3)', border: '1px solid var(--line-2)' }}
            >
              <button
                type="button"
                aria-label="Fewer travellers"
                disabled={party <= 1}
                onClick={() => setTravellers(party - 1)}
                className="c-ivory-2 flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
              >
                <Icon name="minus" size={18} />
              </button>
              <output className="t-figure c-ivory w-7 text-center" style={{ fontWeight: 500, fontSize: 17, lineHeight: '22px' }} aria-live="polite">
                {party}
              </output>
              <button
                type="button"
                aria-label="More travellers"
                disabled={party >= 12}
                onClick={() => setTravellers(party + 1)}
                className="c-ivory-2 flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        </Card>
      </section>

      {/* A note for the Desk: the file, on paper; this trip, in your words */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">For the Desk</h2>
        <Card className="flex flex-col gap-4 p-4" style={{ borderRadius: 22 }}>
          {member?.directives ? (
            <div
              className="k-paper flex flex-col gap-1 px-4 pb-4 pt-3.5"
              style={{ borderRadius: 14, boxShadow: '0 12px 28px rgba(0,0,0,.4)' }}
            >
              <p className="t-caption">On your file</p>
              <p className="t-body-s" style={{ color: 'var(--paper-ink)' }}>
                {member.directives}
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="k-field-label" htmlFor="desk-note">
              Anything for this trip only
            </label>
            <div
              className="k-field items-start"
              style={{ height: 'auto', padding: '14px 16px', borderRadius: 16, background: 'var(--ink-1)' }}
            >
              <textarea
                id="desk-note"
                name="desk-note"
                rows={3}
                maxLength={1200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Arrival hours, a birthday, anyone joining…"
                className="h-[72px] resize-none p-0"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* The terms, in four plain lines */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">Terms of this booking</h2>
        <TermsPanel />
      </section>

      {error ? (
        <section className="px-6 pt-8">
          <Card className="flex items-start gap-3 p-4" style={{ borderColor: 'var(--line-2)' }}>
            <span className="c-amber mt-0.5">
              <Icon name="info" size={18} />
            </span>
            <p className="t-body-s c-ivory-2">{error}</p>
          </Card>
        </section>
      ) : null}

      <Dock caption="Nothing is charged by sending this.">
        <Btn
          tone="primary"
          className="flex-1"
          iconAfter={submitting ? undefined : 'forward'}
          onClick={() => void submit()}
          disabled={submitting || loading || !plan}
        >
          {submitting ? 'Sending to the Desk…' : 'Send for a price'}
        </Btn>
      </Dock>
    </Screen>
  )
}
