import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Screen, TopBar, Dock } from '@/components/Shell'
import { Btn, Empty, Icon, Status } from '@/components/ui'
import { Itinerary } from '@/components/Itinerary'
import { BASE, fetchDue, fetchPlan } from '@/lib/agentClient'
import { isBooking, isLive, holdLeft } from '@/lib/desk'
import { humanizePlan } from '@/lib/humanize'
import type { Nudge, PlanBundle, TripPlan } from '@/lib/plan'
import { useStore } from '@/context/store'

/**
 * One itinerary, at /journeys/:key.
 *
 * The list is Journeys; this screen is the document. It carries what the old
 * Planner did — the fetch, the remembered swaps, the booking step whose label
 * follows the request, the share sheet, the hand-over to WhatsApp after payment
 * — with the trip switcher replaced by the list a member came from.
 */
export default function ItineraryScreen() {
  const navigate = useNavigate()
  const { key = '' } = useParams<{ key: string }>()
  const { member, requests, refreshRequests, setBooking } = useStore()

  const [bundle, setBundle] = useState<PlanBundle | null>(null)
  const [coming, setComing] = useState<Nudge[]>([])
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    setBundle(null)
    setError(null)
    void refreshRequests()
    fetchPlan(key)
      .then((b) => !cancelled && setBundle({ ...b, plan: humanizePlan(b.plan) }))
      .catch((e: Error) => !cancelled && setError(e.message))
    fetchDue('month')
      .then((n) => !cancelled && setComing(n))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, member?.code])
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void refreshRequests() }
    const timer = window.setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [member?.code])

  /** A message the member has already composed: send it and open Tara. */
  const refine = useCallback(
    (text: string) => {
      navigate('/concierge', { state: { send: text } })
    },
    [navigate],
  )

  /** A question the member still has to write: Tara opens with it typed. */
  const ask = useCallback((draft: string) => navigate('/concierge', { state: { draft } }), [navigate])

  // The shared page lives on the agent. Locally that is this origin's /agent proxy.
  const shareUrl = useMemo(
    () => (key ? `${BASE.startsWith('http') ? BASE : `${window.location.origin}${BASE}`}/p/${key}` : ''),
    [key],
  )

  const share = useCallback(async () => {
    if (!bundle) return
    try {
      if (navigator.share) await navigator.share({ title: bundle.plan.title, url: shareUrl })
      else {
        await navigator.clipboard.writeText(shareUrl)
        // The old sheet copied the link and said nothing at all.
        setShared(true)
        window.setTimeout(() => setShared(false), 3000)
      }
    } catch {
      /* dismissed */
    }
  }, [bundle, shareUrl])

  if (error && !bundle) {
    return (
      <Screen tone="light">
        <TopBar back="/journeys" solid title="Itinerary" />
        <div className="pt-24">
          <Empty
            icon="cloud-off"
            title="The Desk is not reachable just now."
            body="Your itineraries are kept with the Desk. They will be here as soon as it is back."
            action={
              <Btn
                tone="ghost"
                icon="refresh"
                onClick={() => {
                  setError(null)
                  setBundle(null)
                  fetchPlan(key)
                    .then((b) => setBundle({ ...b, plan: humanizePlan(b.plan) }))
                    .catch((e: Error) => setError(e.message))
                }}
              >
                Try again
              </Btn>
            }
          />
        </div>
      </Screen>
    )
  }

  if (!bundle) {
    return (
      <Screen tone="light">
        <TopBar back="/journeys" solid title="Itinerary" />
        <p className="t-caption px-6 py-24 text-center">Opening your itinerary…</p>
      </Screen>
    )
  }

  if (bundle.plan.kind !== 'trip') {
    return (
      <Screen tone="light">
        <TopBar back="/journeys" solid title="Comparison" />
        <div className="pt-16">
          <Empty
            icon="swap"
            title={bundle.plan.title}
            body="This one compares several destinations. It opens as its own page."
            action={
              <a className="k-btn k-btn-primary" href={shareUrl} target="_blank" rel="noopener noreferrer">
                Open the comparison
              </a>
            }
          />
        </div>
      </Screen>
    )
  }

  const plan = bundle.plan
  // Where this trip stands with the Desk decides what the one call to action says.
  const req = requests.filter(isBooking).find((r) => r.planId === plan.id && (isLive(r) || r.status === 'closed'))
  const settled = req?.status === 'paid' || req?.status === 'closed'
  const bookingLabel = !req
    ? 'Send for a price'
    : req.status === 'quoted'
      ? 'Review quote & pay'
      : settled
        ? 'Booked · see the details'
        : 'With the Desk · see where it stands'

  const left = req?.quote ? holdLeft(req.quote) : null
  const heroStatus = !req ? null : req.status === 'quoted' ? (
    <Status tone="ready">{left ? `Price ready · held ${left.hours}h` : 'Price ready'}</Status>
  ) : settled ? (
    <Status tone="ok">{req.status === 'paid' ? 'Paid · booking' : 'Complete'}</Status>
  ) : (
    <Status tone="progress">{req.status === 'working' ? 'Being priced' : 'With the Desk'}</Status>
  )

  const openBooking = () => {
    setBooking({ key: bundle.key, planId: plan.id, title: plan.title })
    if (!req) navigate('/booking-request')
    else if (req.status === 'quoted') navigate(`/settlement?id=${req.id}`)
    else navigate(`/status?id=${req.id}`)
  }

  return (
    <Screen tone="light" tabs={false} dock>
      <nav className="pv-app-nav" style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px 0' }}><Link to="/journeys" className="pv-back">← Your journeys</Link></nav>

      <Itinerary
        key={bundle.key}
        bundle={bundle as PlanBundle & { plan: TripPlan }}
        madeFor={member?.name}
        coming={coming}
        status={heroStatus}
        onRefine={refine}
        onAsk={ask}
        onShare={share}
        bookingAction={{ label: bookingLabel, onClick: openBooking, detail: req?.status === 'quoted' ? 'Review the confirmed total and terms, then continue to secure payment.' : settled ? 'Payment is confirmed by the Desk. Your booking details stay with this journey.' : 'The Desk confirms rates and availability before sending your payable quote.' }}
        footer={
          <>
            {shared ? (
              <p className="t-caption c-champagne" role="status">
                The link is on your clipboard.
              </p>
            ) : null}
            {settled ? (
              <Btn tone="secondary" block icon="chat" onClick={() => navigate('/handover')}>
                Continue on WhatsApp
              </Btn>
            ) : null}
          </>
        }
      />

      <Dock>
        <Btn tone={req?.status === 'quoted' ? 'commit' : 'primary'} className="flex-1" onClick={openBooking}>
          {bookingLabel}
        </Btn>
        <button type="button" aria-label="The Desk" className="k-icon-btn k-icon-btn-solid" onClick={() => navigate('/desk')}>
          <Icon name="phone" size={20} />
        </button>
      </Dock>
    </Screen>
  )
}
