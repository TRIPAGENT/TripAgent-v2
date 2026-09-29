import { useState } from 'react'
import { Btn, Card, Icon } from '@/components/ui'
import { useStore } from '@/context/store'
import { fetchHotelRates, fileRequest, type RatesResult } from '@/lib/agentClient'
import { inr } from '@/lib/desk'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const plusDays = (s: string, n: number) => iso(new Date(Date.parse(s) + n * 86_400_000))

/** The guest list always includes the member's own party, however large it is. */
function guestOptions(party: number) {
  const base = [1, 2, 3, 4, 5, 6]
  return Array.from(new Set([...base, party].filter((n) => n >= 1))).sort((a, b) => a - b)
}

/** Why Tripsure could not answer, said plainly. One line, then the human route. */
type Failure = Extract<RatesResult, { ok: false }>['reason']

const REASONS: Record<Failure, string> = {
  'not-configured': 'Live rates for this city are not switched on yet. The Desk quotes these rooms the same day.',
  'not-allowed': 'This account is not set up for live rates. The Desk quotes these rooms the same day.',
  rejected: 'Those dates came back refused. The Desk can look again, including rooms not sold online.',
  unreachable: 'We cannot reach Tripsure for rates just now. The Desk quotes these rooms the same day.',
  offline: 'We cannot reach the Desk from this device right now.',
}

const field =
  'mt-1 w-full rounded-xl px-3 py-2.5 text-[14px]'
const fieldStyle: React.CSSProperties = {
  background: 'var(--ink-3)',
  border: '1px solid var(--line-2)',
  color: 'var(--ivory)',
  fontFamily: 'var(--f-sans)',
  minHeight: 44,
}

/**
 * Live rooms and rates for a city, from Tripsure: the only price a member can pay.
 *
 * When Tripsure cannot answer (not yet switched on, not allowed, refused, or
 * unreachable) the block says so in one line and offers the Desk instead. It
 * never shows a price that did not come back from Tripsure for these dates.
 */
export function LiveRates({ slug, name }: { slug: string; name: string }) {
  const { prefs, refreshRequests } = useStore()
  const [checkIn, setCheckIn] = useState(() => iso(new Date(Date.now() + 30 * 86_400_000)))
  const [nights, setNights] = useState(3)
  const [adults, setAdults] = useState(prefs.party ?? 2)
  const [result, setResult] = useState<RatesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [asked, setAsked] = useState<string | null>(null)
  /** The hotel awaiting a yes before anything is filed. '' is the city-wide ask. */
  const [confirming, setConfirming] = useState<string | null>(null)

  const checkOut = plusDays(checkIn, nights)

  async function check() {
    setLoading(true)
    setAsked(null)
    setConfirming(null)
    setResult(await fetchHotelRates({ city: slug, checkIn, checkOut, adults }))
    setLoading(false)
  }

  async function ask(hotel?: string, seen?: string) {
    setConfirming(null)
    try {
      const r = await fileRequest({
        type: 'enquiry',
        kind: 'hotels',
        fields: {
          City: name,
          ...(hotel ? { Hotel: hotel } : {}),
          'Check-in': checkIn,
          Nights: String(nights),
          Guests: String(adults),
          ...(seen ? { 'Rate seen': seen } : {}),
        },
      })
      await refreshRequests()
      setAsked(r.id)
    } catch (e) {
      setAsked(`error:${(e as Error).message}`)
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-[18px]" style={{ borderRadius: 20 }}>
      <p className="t-label c-ivory-3">Rooms for your dates</p>

      <div className="grid grid-cols-3 gap-2">
        <label className="t-caption">
          Arriving
          <input
            type="date"
            value={checkIn}
            min={iso(new Date())}
            onChange={(e) => e.target.value && setCheckIn(e.target.value)}
            className={`${field} t-figure`}
            style={fieldStyle}
          />
        </label>
        <label className="t-caption">
          Nights
          <select
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
            className={`${field} t-figure`}
            style={fieldStyle}
          >
            {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="t-caption">
          Guests
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={`${field} t-figure`}
            style={fieldStyle}
          >
            {guestOptions(prefs.party ?? 2).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Btn tone="secondary" size="sm" block onClick={() => void check()} disabled={loading}>
        {loading ? 'Checking live rates…' : 'Check live rates'}
      </Btn>

      {result && result.ok && result.hotels.length > 0 && (
        <ul className="flex flex-col">
          {result.hotels.slice(0, 8).map((h) => {
            const key = h.id || h.name
            return (
              <li key={key} className="k-row flex-col items-stretch gap-2 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="t-title-s block">{h.name}</span>
                    <span className="t-caption block">
                      {[
                        h.boardBasis,
                        h.refundable === true ? 'Refundable' : h.refundable === false ? 'Non-refundable' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {h.perNight ? (
                      <span className="t-title-s t-figure block">
                        {inr(h.perNight)}
                        <span className="t-caption"> /night</span>
                      </span>
                    ) : (
                      <span className="t-caption">On request</span>
                    )}
                    {h.total && (
                      <span className="t-caption t-figure block">
                        {inr(h.total)} for {nights}
                      </span>
                    )}
                  </span>
                </div>

                {confirming === key ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="t-caption">Ask the Desk to hold this room?</span>
                    <Btn
                      tone="secondary"
                      size="sm"
                      onClick={() => void ask(h.name, h.total ? inr(h.total) : undefined)}
                    >
                      Yes, ask
                    </Btn>
                    <Btn tone="ghost" size="sm" onClick={() => setConfirming(null)}>
                      Not now
                    </Btn>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(key)}
                    className="k-link k-link-champagne self-start"
                    style={{ minHeight: 44 }}
                  >
                    Ask the Desk to hold this
                  </button>
                )}
              </li>
            )
          })}
          <li className="t-caption c-ivory-3 pt-3.5">
            Live from Tripsure just now. The Desk confirms the room and the rate on your quote.
          </li>
        </ul>
      )}

      {result && result.ok && result.hotels.length === 0 && (
        <p className="t-caption">
          Nothing came back for those dates. The Desk can look further, including rooms not sold online.
        </p>
      )}

      {result && !result.ok && (
        <div className="flex items-start gap-2">
          <span className="c-champagne mt-0.5 shrink-0">
            <Icon name="info" size={16} />
          </span>
          <p className="t-caption">{REASONS[result.reason]}</p>
        </div>
      )}

      {result && (!result.ok || result.hotels.length === 0) &&
        (confirming === '' ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="t-caption">Ask the Desk for a rate in {name}?</span>
            <Btn tone="secondary" size="sm" onClick={() => void ask()}>
              Yes, ask
            </Btn>
            <Btn tone="ghost" size="sm" onClick={() => setConfirming(null)}>
              Not now
            </Btn>
          </span>
        ) : (
          <Btn tone="ghost" size="sm" block onClick={() => setConfirming('')}>
            Ask for a rate in {name}
          </Btn>
        ))}

      {asked && (
        <p className="t-body-s c-champagne">
          {asked.startsWith('error:') ? asked.slice(6) : `Sent to the Desk, reference ${asked}.`}
        </p>
      )}
    </Card>
  )
}
