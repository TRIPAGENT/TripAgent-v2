import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Card, Empty, Headline, Icon, Sheet, Sig, Status as StatusPill, Track } from '@/components/ui'
import { useStore } from '@/context/store'
import { requestAction } from '@/lib/agentClient'
import {
  currentBooking,
  holdLeft,
  inr,
  isBooking,
  STATUS_LABEL,
  TYPE_LABEL,
  when,
  type DeskRequest,
  type RequestStatus,
} from '@/lib/desk'

/**
 * Where a request stands, as the Desk holds it. Every line here is something that
 * has actually happened: there is no countdown to a promise, no projected saving,
 * no progress bar standing in for work. The screen asks the Desk again every 15
 * seconds while it is open, and says so plainly when the answer did not arrive.
 */

const STEPS: { at: RequestStatus[]; title: string; detail: string }[] = [
  { at: ['open', 'working', 'quoted', 'paid', 'closed'], title: 'With the Desk', detail: 'Your itinerary, exactly as you chose it.' },
  { at: ['working', 'quoted', 'paid', 'closed'], title: 'Being priced', detail: 'Live rates and availability, checked with the airlines and hotels.' },
  { at: ['quoted', 'paid', 'closed'], title: 'Price ready', detail: 'One quote, every line itemised, held until a stated time.' },
  { at: ['paid', 'closed'], title: 'Paid · booking', detail: 'Tickets and confirmations follow, and your reminders begin.' },
]

const KIND_ICON: Record<string, string> = {
  flight: 'plane',
  hotel: 'stay',
  transfer: 'car',
  visa: 'passport',
  advisory: 'document',
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A clock that reads in hours, minutes and seconds. */
function countdown(iso: string, now: number) {
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return null
  return {
    h: Math.floor(ms / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1000),
    ms,
  }
}

function subtitle(r: DeskRequest) {
  if (r.type === 'call') return r.slot
  if (r.type === 'enquiry') return r.kind
  if (r.type === 'handover') return r.about ?? 'WhatsApp'
  return r.title
}

export default function Status() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { requests, refreshRequests } = useStore()
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The Desk did not answer the last time we asked: what is below is what we last heard. */
  const [stale, setStale] = useState(false)
  const [lastHeard, setLastHeard] = useState<number | null>(null)

  const listRef = useRef(requests)
  listRef.current = requests

  useEffect(() => {
    let cancelled = false

    // refreshRequests() swallows a failed fetch and hands back the list it already
    // held — the very same array. That identity is how we know the Desk did not
    // answer, rather than presenting stale figures as live.
    async function ask() {
      const before = listRef.current
      const list = await refreshRequests()
      if (cancelled) return
      if (list === before && before.length > 0) {
        setStale(true)
      } else {
        setStale(false)
        setLastHeard(Date.now())
      }
    }

    void ask()
    const poll = window.setInterval(() => void ask(), 15_000)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const id = params.get('id')
  const booking = currentBooking(requests, id)
  const others = requests.filter((r) => !isBooking(r))
  const focused = id && !booking ? others.find((r) => r.id === id) ?? null : null

  if (!booking && others.length === 0) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar solid title="With the Desk" />
        <div className="pt-[110px]">
          <Empty
            icon="clock"
            title="Nothing with the Desk yet."
            body="When you send an itinerary for a price, ask for a call or send an enquiry, it appears here with where it stands."
            action={<Btn onClick={() => navigate('/journeys')}>Open your journeys</Btn>}
          />
        </div>
      </Screen>
    )
  }

  const quote = booking?.quote
  const left = quote ? holdLeft(quote, now) : null
  const clock = quote && left ? countdown(quote.holdUntil, now) : null
  const showHold = Boolean(quote && booking?.status === 'quoted')
  const canCancel = Boolean(booking && ['open', 'working', 'quoted'].includes(booking.status))

  async function cancel() {
    if (!booking) return
    setBusy(true)
    setError(null)
    try {
      await requestAction(booking.id, 'cancel')
      await refreshRequests()
      setConfirming(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen tone="light" tabs={false}>
      {/* A low champagne light behind the one raised object */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 640,
          background:
            'radial-gradient(ellipse 95% 55% at 50% 60%, rgba(216,194,154,.10) 0%, rgba(216,194,154,.035) 48%, rgba(216,194,154,0) 100%)',
        }}
      />

      <TopBar
        solid
        onBack={() => navigate('/journeys')}
        actions={
          booking ? (
            <p
              className="t-mono c-ivory-2 inline-flex h-8 items-center px-3"
              style={{ borderRadius: 999, border: '1px solid var(--line)' }}
            >
              {booking.id}
            </p>
          ) : undefined
        }
      />

      {booking && (
        <>
          {/* Where it has arrived */}
          <section className="relative flex flex-col gap-2 px-6" style={{ paddingTop: 126 }}>
            <p className="t-caption">{booking.title}</p>
            <Headline size="l">
              {booking.status === 'quoted' ? (
                <>
                  Your price is <Sig>ready.</Sig>
                </>
              ) : booking.status === 'paid' ? (
                <>
                  Paid. <Sig>It is being booked.</Sig>
                </>
              ) : booking.status === 'closed' ? (
                <>
                  Booked. <Sig>It is complete.</Sig>
                </>
              ) : booking.status === 'cancelled' ? (
                <>
                  This request was <Sig>cancelled.</Sig>
                </>
              ) : (
                <>
                  With the <Sig>Desk.</Sig>
                </>
              )}
            </Headline>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusPill tone={booking.status === 'quoted' ? 'ready' : booking.status === 'closed' ? 'ok' : 'progress'}>
                {STATUS_LABEL[booking.status]}
              </StatusPill>
              {stale ? (
                <span className="k-status k-status-alert">
                  <Icon name="cloud-off" size={13} />
                  {lastHeard ? `Last heard ${when(new Date(lastHeard).toISOString())}` : 'Not reaching the Desk'}
                </span>
              ) : null}
            </div>
          </section>

          {/* The hold: one figure, one clock, one action */}
          {showHold && quote ? (
            <section className="relative px-6 pt-7">
              <article
                className="k-card-raised flex flex-col gap-[22px] p-[22px]"
                aria-label="Your quote, held"
                style={{
                  borderRadius: 24,
                  borderColor: 'var(--champagne-line)',
                  background:
                    'radial-gradient(120% 90% at 100% 0%, rgba(216,194,154,.15) 0%, rgba(216,194,154,.05) 40%, rgba(216,194,154,0) 72%), var(--ink-3)',
                  boxShadow: 'inset 0 1px 0 rgba(216,194,154,.22), var(--shadow-card), 0 0 64px rgba(216,194,154,.07)',
                }}
              >
                <div className="flex flex-col gap-2.5">
                  <p className="t-label c-champagne">All in</p>
                  <p
                    className="t-figure c-ivory"
                    style={{ fontFamily: 'var(--f-display)', fontWeight: 400, fontSize: 40, lineHeight: '44px', letterSpacing: '-0.01em' }}
                  >
                    {inr(quote.total)}
                  </p>
                </div>

                <div className="flex flex-col gap-3.5">
                  <div className="flex items-end justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="t-caption flex items-center gap-1.5">
                        <Icon name="clock" size={14} />
                        {clock ? 'Held until' : 'The hold has lapsed'}
                      </p>
                      <p className="t-figure c-ivory" style={{ fontWeight: 500, fontSize: 14, lineHeight: '20px' }}>
                        {when(quote.holdUntil)}
                      </p>
                    </div>
                    {clock ? (
                      <div
                        role="timer"
                        aria-label={`${clock.h} hours ${clock.m} minutes ${clock.s} seconds left`}
                        className="flex shrink-0 flex-col items-end"
                      >
                        <span
                          className="t-figure c-champagne"
                          aria-hidden="true"
                          style={{ fontWeight: 400, fontSize: 30, lineHeight: '34px', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}
                        >
                          {clock.h}:{pad(clock.m)}:{pad(clock.s)}
                        </span>
                        <span className="t-caption" aria-hidden="true">
                          left on the hold
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {/* The track only appears when the Desk told us when the hold began. */}
                  {clock && quote.releasedAt
                    ? (() => {
                        const span = Date.parse(quote.holdUntil) - Date.parse(quote.releasedAt)
                        return span > 0 ? <Track value={clock.ms / span} /> : null
                      })()
                    : null}
                </div>

                {clock ? (
                  <Btn tone="primary" block iconAfter="forward" onClick={() => navigate(`/settlement?id=${booking.id}`)}>
                    Review and pay
                  </Btn>
                ) : (
                  <Btn tone="secondary" block onClick={() => navigate(`/settlement?id=${booking.id}`)}>
                    Open the quote
                  </Btn>
                )}
              </article>
            </section>
          ) : null}

          {/* The ledger, as the Desk holds it */}
          <section className="flex flex-col gap-5 px-6 pt-12">
            <h2 className="t-display-s">Where it stands</h2>
            <ol aria-label="Where it stands" className="flex flex-col gap-[22px]">
              {STEPS.map((s, i) => {
                const done = s.at.includes(booking.status)
                const here = !done && booking.status !== 'cancelled' && (i === 0 || STEPS[i - 1].at.includes(booking.status))
                const last = i === STEPS.length - 1
                return (
                  <li
                    key={s.title}
                    aria-current={here ? 'step' : undefined}
                    className="relative grid gap-x-4"
                    style={{ gridTemplateColumns: '22px minmax(0,1fr)' }}
                  >
                    {!last && (
                      <span
                        aria-hidden="true"
                        className="absolute"
                        style={{
                          left: 10.5,
                          top: here ? 32 : 26,
                          bottom: -18,
                          width: 1,
                          background: done
                            ? 'var(--champagne-line)'
                            : 'repeating-linear-gradient(180deg, var(--line-2) 0px, var(--line-2) 3px, transparent 3px, transparent 7px)',
                        }}
                      />
                    )}
                    {here ? (
                      <span
                        aria-hidden="true"
                        className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full"
                        style={{
                          background: 'var(--ink-0)',
                          border: '1.5px solid var(--champagne)',
                          boxShadow: '0 0 0 5px var(--champagne-3), 0 0 22px rgba(216,194,154,.45)',
                        }}
                      >
                        <span
                          className="k-breathe absolute rounded-full"
                          style={{ left: -10, top: -10, width: 42, height: 42, border: '1px solid var(--champagne-line)' }}
                        />
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--champagne)' }} />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
                        style={{
                          background: done ? 'var(--ink-3)' : 'var(--ink-0)',
                          border: '1px solid var(--line-2)',
                          color: 'var(--ivory-2)',
                        }}
                      >
                        {done ? <Icon name="check" size={12} strokeWidth={2.4} /> : null}
                      </span>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <p className={`t-title-s ${here ? 'c-champagne' : done ? '' : 'c-ivory-3'}`}>{s.title}</p>
                      <p className={`t-body-s ${done || here ? 'c-ivory-2' : 'c-ivory-3'}`}>{s.detail}</p>
                      {i === 0 ? <p className="t-mono c-ivory-3 pt-1">{when(booking.createdAt)}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* In the Desk's own hand, newest first */}
          {booking.events.length > 0 && (
            <section className="flex flex-col gap-5 px-6 pt-12">
              <div className="k-section-head">
                <h2 className="t-display-s">From the Desk</h2>
                <p className="t-caption c-ivory-3 pb-[3px]">All times IST</p>
              </div>
              <div className="flex flex-col gap-3">
                {[...booking.events].reverse().map((e, i) => (
                  <article
                    key={`${e.at}-${i}`}
                    className={e.by === 'desk' ? 'k-msg-desk flex flex-col gap-2' : 'k-msg-member flex flex-col gap-2 self-end'}
                    style={e.by === 'desk' && i > 0 ? { background: 'var(--paper-2)' } : undefined}
                  >
                    <p>{e.text}</p>
                    <p
                      className="t-caption t-figure"
                      style={{ color: e.by === 'desk' ? 'var(--paper-ink-2)' : 'var(--ivory-3)' }}
                    >
                      {e.by === 'desk' ? '— The Desk, Bengaluru · ' : 'You · '}
                      {when(e.at)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* What the Desk is holding */}
          {booking.components.filter((c) => c.kind !== 'advisory').length > 0 && (
            <section className="flex flex-col gap-5 px-6 pt-12">
              <h2 className="t-display-s">What is being priced</h2>
              <ul className="flex flex-col" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                {booking.components
                  .filter((c) => c.kind !== 'advisory')
                  .map((c, i) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3.5 py-3.5"
                      style={i === 0 ? undefined : { borderTop: '1px solid var(--line)' }}
                    >
                      <span
                        aria-hidden="true"
                        className="c-ivory-2 flex h-10 w-10 shrink-0 items-center justify-center"
                        style={{ borderRadius: 12, background: 'var(--ink-3)', border: '1px solid var(--line)' }}
                      >
                        <Icon name={KIND_ICON[c.kind] ?? 'document'} size={20} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t-title-s">{c.title}</span>
                        <span className="t-caption">{c.detail}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* A request that is not a booking, opened by its own reference */}
      {focused && (
        <section className="flex flex-col gap-5 px-6" style={{ paddingTop: booking ? 48 : 126 }}>
          <Headline size="l">{TYPE_LABEL[focused.type]}</Headline>
          <Card className="flex flex-col gap-3 p-4" style={{ borderRadius: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <p className="t-title-s truncate">{subtitle(focused)}</p>
              <StatusPill tone={focused.status === 'closed' ? 'ok' : 'progress'}>{STATUS_LABEL[focused.status]}</StatusPill>
            </div>
            <p className="t-mono c-ivory-3">
              {focused.id} · {when(focused.createdAt)}
            </p>
            {focused.events.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">
                {[...focused.events].reverse().map((e, i) => (
                  <p key={`${e.at}-${i}`} className="t-body-s c-ivory-2">
                    {e.text}
                    <span className="t-mono c-ivory-3 block pt-0.5">
                      {e.by === 'desk' ? 'The Desk' : 'You'} · {when(e.at)}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Everything else with the Desk */}
      {others.length > 0 && (
        <section className="flex flex-col gap-5 px-6" style={{ paddingTop: booking || focused ? 48 : 126 }}>
          <h2 className="t-display-s">Other requests</h2>
          <Card className="px-4" style={{ borderRadius: 20 }}>
            {others.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/status?id=${r.id}`)}
                className="k-row w-full py-3.5 text-left"
                aria-current={focused?.id === r.id ? 'true' : undefined}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="t-title-s truncate">
                    <span className="c-ivory-3">{TYPE_LABEL[r.type]} ·</span> {subtitle(r)}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <StatusPill tone={r.status === 'closed' ? 'ok' : 'progress'}>{STATUS_LABEL[r.status]}</StatusPill>
                    <span className="t-mono c-ivory-3">{r.id}</span>
                  </span>
                </span>
                <span className="c-ivory-3 shrink-0">
                  <Icon name="chevron-right" size={18} />
                </span>
              </button>
            ))}
          </Card>
        </section>
      )}

      {/* A person, and a way out */}
      <section className="flex flex-col items-center gap-3 px-6 pt-10">
        <Btn tone="secondary" block icon="phone" onClick={() => navigate('/desk')}>
          Speak to the Desk
        </Btn>
        {canCancel && (
          <div className="flex flex-col items-center">
            <button
              type="button"
              className="t-caption c-ivory-3 min-h-[44px] px-3 underline underline-offset-4"
              onClick={() => {
                setError(null)
                setConfirming(true)
              }}
            >
              Cancel this request
            </button>
            <p className="t-caption c-ivory-3">Nothing has been charged.</p>
          </div>
        )}
        {error && !confirming ? <p className="t-caption c-amber text-center">{error}</p> : null}
      </section>

      {confirming && booking && (
        <Sheet onClose={() => setConfirming(false)} labelledBy="cancel-title">
          <div className="flex flex-col gap-6 px-6 pb-2 pt-4">
            <div className="flex flex-col gap-2">
              <h2 id="cancel-title" className="t-display-s">
                Cancel this request?
              </h2>
              <p className="t-body-s c-ivory-2">
                {booking.title} leaves the Desk and any hold on it ends. Nothing has been charged. You can ask again at any time.
              </p>
            </div>
            {error ? <p className="t-body-s c-amber">{error}</p> : null}
            <div className="flex flex-col gap-2">
              <Btn tone="secondary" block disabled={busy} onClick={() => void cancel()}>
                {busy ? 'Telling the Desk…' : 'Yes, cancel it'}
              </Btn>
              <Btn tone="ghost" block onClick={() => setConfirming(false)}>
                Keep it with the Desk
              </Btn>
            </div>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
