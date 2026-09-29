import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Screen, TopBar, Dock } from '@/components/Shell'
import { Btn, Card, Empty, Headline, Icon, Paper, Photo, Sheet, Sig } from '@/components/ui'
import { TermsPanel } from '@/components/Terms'
import { useStore } from '@/context/store'
import { DESK } from '@/data/members'
import { CITIES } from '@/data/catalogue.generated'
import { brandImage } from '@/lib/catalogue'
import { fileRequest, requestAction } from '@/lib/agentClient'
import { currentBooking, holdLeft, inr, when } from '@/lib/desk'

/**
 * Saying yes to a quote. The quote itself is a letter from the house, laid on the
 * dark desk: every line as the Desk sent it, the total, and the clock on the hold.
 * Two ways to say yes, both real: pay through the secure link the Desk attached
 * (Tripsure, on Razorpay), or ask for a call and close it on the phone. The app
 * never takes card details and never marks a trip paid on its own; the Desk
 * confirms once the payment is seen.
 */

const pad = (n: number) => String(n).padStart(2, '0')

function countdown(iso: string, now: number) {
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return null
  return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000), s: Math.floor((ms % 60_000) / 1000) }
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** A digit block on the paper hold panel. */
function Digits({ value }: { value: string }) {
  return (
    <span
      className="flex h-[52px] items-center justify-center"
      style={{
        borderRadius: 10,
        background: 'var(--paper)',
        border: '1px solid var(--paper-line)',
        boxShadow: '0 1px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(25,22,19,.04)',
        fontFamily: 'var(--f-mono)',
        fontSize: 28,
        lineHeight: '32px',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--paper-ink)',
      }}
    >
      {value}
    </span>
  )
}

export default function Quote() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { member, requests, refreshRequests } = useStore()
  const [now, setNow] = useState(() => Date.now())
  const [sent, setSent] = useState<'paid' | 'call' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    void refreshRequests()
    const poll = window.setInterval(() => void refreshRequests(), 15_000)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const r = currentBooking(requests, params.get('id'))
  const q = r?.quote

  if (!r || !q) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar solid title="Your quote" />
        <div className="pt-[110px]">
          <Empty
            icon="hourglass"
            title="No price to review yet."
            body="The Desk sends one price once the itinerary is checked. It appears here, and on your request, the moment it is released."
            action={<Btn onClick={() => navigate(r ? `/status?id=${r.id}` : '/status')}>See where it stands</Btn>}
          />
        </div>
      </Screen>
    )
  }

  const left = holdLeft(q, now)
  const clock = left ? countdown(q.holdUntil, now) : null
  const paid = r.status === 'paid' || r.status === 'closed'
  // The claim survives a reload because it is read from the Desk's own events.
  const claimed = r.events.some((e) => e.by === 'member' && /payment has been made/i.test(e.text))

  async function tellPaid() {
    setError(null)
    try {
      await requestAction(r!.id, 'paid')
      await refreshRequests()
      setSent('paid')
      setConfirming(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function askCall() {
    setError(null)
    try {
      await fileRequest({
        type: 'call',
        slot: 'As soon as possible',
        about: `Quote ${r!.id} · ${r!.title}`,
        note: 'I would like to go through the quote and pay on the phone.',
      })
      await refreshRequests()
      setSent('call')
      setConfirming(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  /* ------------------------------------------------------------ paid ------ */

  if (paid) {
    const city = CITIES.find((c) => r.title.toLowerCase().includes(c.name.toLowerCase())) ?? null
    return (
      <Screen tone="light" tabs={false}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: 560,
            background:
              'radial-gradient(ellipse 85% 75% at 50% 0%, rgba(216,194,154,.16) 0%, rgba(216,194,154,.05) 50%, rgba(216,194,154,0) 100%)',
          }}
        />
        <TopBar solid onBack={() => navigate(`/status?id=${r.id}`)} />

        <section aria-labelledby="booked-title" className="relative flex flex-col items-center px-6 text-center" style={{ paddingTop: 116 }}>
          <div className="relative w-full">
            <Photo
              src={brandImage('chauffeur')}
              alt="A doorman opening the door of a car at a lit hotel entrance at night"
              label={r.title}
              radius={24}
              veil="card"
              className="h-[240px] w-full"
            />
            <span
              aria-hidden="true"
              className="c-champagne absolute left-1/2 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                bottom: -28,
                marginLeft: -28,
                background: 'linear-gradient(var(--champagne-3), var(--champagne-3)), var(--ink-1)',
                border: '1px solid var(--champagne-line)',
                boxShadow: '0 0 0 6px var(--ink-0), 0 0 0 7px var(--champagne-line), 0 14px 36px rgba(216,194,154,.22)',
              }}
            >
              <Icon name="check" size={24} strokeWidth={1.75} />
            </span>
          </div>

          <div className="flex flex-col items-center gap-3" style={{ paddingTop: 56 }}>
            <Headline size="xl" className="text-center">
              {city ? (
                <>
                  {city.name} is <Sig>in hand.</Sig>
                </>
              ) : (
                <>
                  It is <Sig>in hand.</Sig>
                </>
              )}
            </Headline>
            <p className="t-body c-ivory-2">
              <span className="t-figure c-ivory">{inr(q.total)}</span> received for {r.title}. Tickets and confirmations follow
              from the Desk, and your reminders are now on.
            </p>
          </div>
        </section>

        <section aria-label="What happens next" className="px-6 pt-6">
          <Card className="px-4" style={{ borderRadius: 20 }}>
            <div className="k-row items-start py-3">
              <span className="c-ivory-2 mt-[3px]">
                <Icon name="document" size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="t-title-s">Tickets and vouchers</p>
                <p className="t-caption">The Desk sends them as they are issued.</p>
              </div>
            </div>

            <button type="button" onClick={() => navigate('/handover')} className="k-row w-full py-3 text-left">
              <span className="c-ivory-2">
                <Icon name="chat" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-title-s">Continue on WhatsApp</span>
                <span className="t-caption">
                  The Desk opens a thread
                  {member?.phoneMasked ? (
                    <>
                      {' on '}
                      <span className="t-figure">{member.phoneMasked}</span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="c-ivory-3 self-center">
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          </Card>
        </section>

        <div className="px-6 pt-7">
          <Btn tone="primary" block onClick={() => navigate(`/journeys/${r.planKey}`)}>
            Open the journey
          </Btn>
        </div>
      </Screen>
    )
  }

  /* ----------------------------------------------------------- letter ----- */

  // The Desk's own line labels, set under the heading each belongs to. A line the
  // manifest does not name is shown plainly rather than filed under a guess.
  const titles = (kind: 'flight' | 'hotel') =>
    r.components.filter((c) => c.kind === kind).map((c) => c.title.toLowerCase())
  const flights = titles('flight')
  const stays = titles('hotel')
  const groupOf = (label: string) => {
    const l = label.toLowerCase()
    if (flights.some((t) => t && l.includes(t))) return 'Flights'
    if (stays.some((t) => t && l.includes(t))) return 'Stays'
    return 'Other'
  }
  const groups = (['Flights', 'Stays', 'Other'] as const)
    .map((name) => ({ name, lines: q.lines.filter((l) => groupOf(l.label) === name) }))
    .filter((g) => g.lines.length > 0)
  const single = groups.length === 1

  const payLabel = left ? 'Ask for the payment link on a call' : 'Ask the Desk to re-check'

  return (
    <Screen tone="light" tabs={false} dock>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 720,
          background:
            'radial-gradient(ellipse 95% 70% at 50% 16%, rgba(216,194,154,.09) 0%, rgba(216,194,154,.03) 52%, rgba(216,194,154,0) 100%)',
        }}
      />

      <TopBar solid title="Your quote" onBack={() => navigate(`/status?id=${r.id}`)} />

      {/* The letter, on heavy ivory stock */}
      <section className="px-6" style={{ paddingTop: 122 }}>
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute"
            style={{ left: 12, right: 12, top: 18, bottom: -9, borderRadius: 24, background: 'var(--paper-2)', opacity: 0.4 }}
          />
          <Paper className="relative flex flex-col gap-7 p-[26px]" style={{ borderRadius: 24 }}>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{ inset: 8, border: '1px solid rgba(25,22,19,.06)', borderRadius: 18 }}
            />

            {/* Letterhead */}
            <header className="flex items-center justify-between gap-4">
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  border: '1px solid var(--paper-accent)',
                  boxShadow: 'inset 0 0 0 3px var(--paper), inset 0 0 0 4px rgba(138,106,58,.3)',
                  color: 'var(--paper-accent)',
                  fontFamily: 'var(--f-display)',
                  fontSize: 14,
                  lineHeight: '14px',
                  letterSpacing: '0.06em',
                }}
              >
                TA
              </span>
              <p className="t-mono text-right" style={{ color: 'var(--paper-ink-2)' }}>
                Quote {r.id}
                <br />
                {longDate(q.releasedAt ?? r.updatedAt)}
              </p>
            </header>

            {/* Salutation */}
            <div className="flex flex-col gap-2">
              <h2
                style={{
                  fontFamily: 'var(--f-display)',
                  fontWeight: 400,
                  fontSize: 26,
                  lineHeight: '32px',
                  letterSpacing: '-0.01em',
                  color: 'var(--paper-ink)',
                }}
              >
                For {member?.name ?? r.memberName},
                {r.party ? (
                  <>
                    <br />
                    <em className="t-italic">
                      {r.party} {r.party === 1 ? 'traveller' : 'travellers'}
                    </em>
                  </>
                ) : null}
              </h2>
              <p className="t-body-s" style={{ color: 'var(--paper-ink-2)' }}>
                {r.title}
              </p>
            </div>

            {/* The ledger, exactly as the Desk sent it */}
            <div className="flex flex-col">
              {groups.map((g) => (
                <section key={g.name} style={{ borderTop: '1px solid var(--paper-line)', paddingTop: 16 }}>
                  {single ? null : (
                    <h3 className="t-label" style={{ color: 'var(--paper-accent)' }}>
                      {g.name}
                    </h3>
                  )}
                  <ul>
                    {g.lines.map((l, i) => (
                      <li
                        key={`${l.label}-${i}`}
                        className="grid items-start gap-x-4 py-3"
                        style={{
                          gridTemplateColumns: 'minmax(0,1fr) auto',
                          borderTop: i === 0 ? undefined : '1px solid var(--paper-line)',
                        }}
                      >
                        <p className="t-title-s">{l.label}</p>
                        <p className="t-title-s t-figure whitespace-nowrap text-right">{inr(l.amount)}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {/* The sum, under an accountant's double rule */}
              <div className="flex flex-col gap-3.5 pt-2">
                <span
                  aria-hidden="true"
                  className="block"
                  style={{ height: 4, borderTop: '1px solid var(--paper-ink-2)', borderBottom: '1px solid var(--paper-ink-2)' }}
                />
                <div className="flex flex-col gap-1">
                  <p className="t-label" style={{ color: 'var(--paper-ink)' }}>
                    Total, all in
                  </p>
                  <p
                    className="t-figure text-right"
                    style={{
                      fontFamily: 'var(--f-display)',
                      fontWeight: 400,
                      fontSize: 36,
                      lineHeight: '40px',
                      letterSpacing: '-0.01em',
                      color: 'var(--paper-ink)',
                    }}
                  >
                    {inr(q.total)}
                  </p>
                </div>
              </div>
            </div>

            {/* The hold */}
            <div className="flex flex-col gap-3">
              <div
                role="group"
                aria-label="Price hold"
                className="flex flex-col gap-4 p-4"
                style={{ borderRadius: 14, background: 'var(--paper-2)' }}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="t-caption flex items-center gap-2">
                    <span style={{ color: 'var(--paper-accent)' }}>
                      <Icon name="clock" size={16} />
                    </span>
                    {clock ? 'Held until' : 'The hold lapsed'}
                  </p>
                  <p className="t-body-s t-figure" style={{ fontWeight: 500, color: 'var(--paper-ink)' }}>
                    {when(q.holdUntil)}
                  </p>
                </div>
                {clock ? (
                  <div
                    role="timer"
                    aria-label={`${clock.h} hours, ${clock.m} minutes and ${clock.s} seconds left`}
                    className="grid items-center"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) 14px minmax(0,1fr) 14px minmax(0,1fr)', rowGap: 6 }}
                  >
                    <Digits value={pad(clock.h)} />
                    <span
                      aria-hidden="true"
                      className="text-center"
                      style={{ fontFamily: 'var(--f-mono)', fontSize: 22, lineHeight: '32px', color: 'var(--paper-ink-2)' }}
                    >
                      :
                    </span>
                    <Digits value={pad(clock.m)} />
                    <span
                      aria-hidden="true"
                      className="text-center"
                      style={{ fontFamily: 'var(--f-mono)', fontSize: 22, lineHeight: '32px', color: 'var(--paper-ink-2)' }}
                    >
                      :
                    </span>
                    <Digits value={pad(clock.s)} />
                    <span className="t-mono text-center" style={{ color: 'var(--paper-ink-2)' }}>
                      hours
                    </span>
                    <span aria-hidden="true" />
                    <span className="t-mono text-center" style={{ color: 'var(--paper-ink-2)' }}>
                      min
                    </span>
                    <span aria-hidden="true" />
                    <span className="t-mono text-center" style={{ color: 'var(--paper-ink-2)' }}>
                      sec
                    </span>
                  </div>
                ) : null}
              </div>
              <p className="t-caption">
                {clock
                  ? 'This is the price you pay. After the hold it is re-checked, never quietly changed.'
                  : 'The hold has lapsed: ask the Desk to re-check it before paying.'}
              </p>
            </div>

            {/* A note in the Desk's hand */}
            {q.note ? (
              <figure className="flex flex-col gap-3">
                <span aria-hidden="true" className="block" style={{ width: 28, height: 1, background: 'var(--paper-accent)' }} />
                <blockquote
                  style={{
                    fontFamily: 'var(--f-display)',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: 18,
                    lineHeight: '26px',
                    color: 'var(--paper-ink)',
                  }}
                >
                  {q.note}
                </blockquote>
                <figcaption className="t-caption">— The Desk, Bengaluru</figcaption>
              </figure>
            ) : null}

            {/* Terms, as written on this quote */}
            {q.terms ? (
              <section
                aria-labelledby="q-terms"
                className="flex flex-col gap-1.5"
                style={{ borderTop: '1px solid var(--paper-line)', paddingTop: 20 }}
              >
                <h3 id="q-terms" className="t-title-s">
                  Cancellation and refunds
                </h3>
                <p className="t-body-s whitespace-pre-line" style={{ color: 'var(--paper-ink-2)' }}>
                  {q.terms}
                </p>
              </section>
            ) : null}

            <footer style={{ borderTop: '1px solid var(--paper-line)', paddingTop: 16 }}>
              <p className="t-caption">{DESK.operator}</p>
            </footer>
          </Paper>
        </div>
      </section>

      {/* How the money moves */}
      <section aria-labelledby="q-how" className="flex items-start gap-3.5 px-6 pt-9">
        <span
          aria-hidden="true"
          className="c-ivory-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--ink-2)', border: '1px solid var(--line-2)' }}
        >
          <Icon name="lock" size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="q-how" className="t-title-s">
            How you pay
          </h2>
          <p className="t-caption">A secure Tripsure link, on Razorpay. The Desk never asks for card details by message.</p>
        </div>
      </section>

      {(sent || claimed) && (
        <section className="px-6 pt-6">
          <Card className="flex items-start gap-3 p-4">
            <span className="c-champagne mt-0.5">
              <Icon name="check-circle" size={20} />
            </span>
            <p className="t-body-s c-ivory-2">
              {sent === 'call'
                ? 'The Desk will call to go through it and take payment on the phone.'
                : 'Thank you. The Desk confirms here as soon as the payment shows.'}
            </p>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">Terms of this booking</h2>
        <TermsPanel />
      </section>

      {error && !confirming ? (
        <section className="px-6 pt-6">
          <p className="t-body-s c-amber">{error}</p>
        </section>
      ) : null}

      <Dock>
        {q.paymentUrl && left ? (
          <>
            <Btn tone="commit" className="flex-1" onClick={() => setConfirming(true)}>
              <span className="t-figure">Approve and pay {inr(q.total)}</span>
            </Btn>
            <button
              type="button"
              aria-label="Pay on a call"
              disabled={sent === 'call'}
              onClick={() => void askCall()}
              className="k-icon-btn k-icon-btn-solid disabled:opacity-50"
              style={{ width: 52, height: 52 }}
            >
              <Icon name="phone" size={20} />
            </button>
          </>
        ) : (
          <Btn tone="primary" className="flex-1" icon="phone" disabled={sent === 'call'} onClick={() => void askCall()}>
            {payLabel}
          </Btn>
        )}
      </Dock>

      {confirming && q.paymentUrl && (
        <Sheet onClose={() => setConfirming(false)} labelledBy="pay-title">
          <div className="flex flex-col gap-6 px-6 pb-2 pt-3">
            <header className="flex flex-col gap-3.5">
              <h2 id="pay-title" className="t-display-s">
                Confirm and pay
              </h2>
              <div className="flex flex-col gap-1.5">
                <p
                  className="t-figure c-ivory"
                  style={{ fontFamily: 'var(--f-display)', fontWeight: 400, fontSize: 44, lineHeight: '48px', letterSpacing: '-0.01em' }}
                >
                  {inr(q.total)}
                </p>
                <p className="t-caption">
                  To Tripsure, operator of TripAgent
                  <br />
                  for {r.title}
                </p>
              </div>
            </header>

            <Card className="flex items-center gap-3 p-3" style={{ borderRadius: 18 }}>
              <span
                aria-hidden="true"
                className="c-champagne flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--ink-1)', border: '1px solid var(--champagne-line)' }}
              >
                <Icon name="lock" size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-title-s">Secure payment link</span>
                <span className="t-caption">UPI, card or net banking on Razorpay</span>
              </span>
            </Card>

            {clock ? (
              <p className="t-caption t-figure c-champagne flex items-center gap-2">
                <Icon name="clock" size={14} />
                Held until {when(q.holdUntil)} · {clock.h}h {pad(clock.m)}m left
              </p>
            ) : null}

            {error ? <p className="t-body-s c-amber">{error}</p> : null}

            <div className="flex flex-col gap-3.5">
              <a
                href={q.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="k-btn k-btn-commit k-btn-block"
              >
                <Icon name="lock" size={18} />
                Continue to secure payment
              </a>
              <p className="t-caption c-ivory-3 text-center">You finish on Razorpay's secure page, then return here.</p>
              <Btn
                tone="ghost"
                block
                disabled={claimed || sent === 'paid'}
                onClick={() => void tellPaid()}
              >
                {claimed || sent === 'paid' ? 'The Desk has been told' : 'I have paid'}
              </Btn>
              <button
                type="button"
                disabled={sent === 'call'}
                onClick={() => void askCall()}
                className="t-caption c-ivory-3 min-h-[44px] underline underline-offset-4 disabled:opacity-50"
              >
                Pay on a call with the Desk instead
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
