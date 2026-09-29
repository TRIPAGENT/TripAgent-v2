import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Eyebrow, Headline, Icon, Seal, Sig } from '@/components/ui'
import { useStore } from '@/context/store'
import { fileRequest } from '@/lib/agentClient'
import { currentBooking } from '@/lib/desk'

const PHONE = /^\+?[0-9 ()-]{6,24}$/

/** A masked number ("+91 ••••• ••890") can be shown, but never typed back in. */
const isRealNumber = (value?: string) => Boolean(value && PHONE.test(value.trim()))

/**
 * Moving a settled journey onto WhatsApp.
 *
 * This is deliberately a post-payment service. Before money moves Tara
 * and the Desk are the place to plan; after it, the member should be able to
 * reach the Desk on the channel they already live in, with the whole file
 * already handed over — nothing repeated, nothing re-explained.
 *
 * The member's number goes to the Desk as a handover request; the Desk opens the
 * thread from the business number. The app does not send WhatsApp itself.
 */
export default function Handover() {
  const navigate = useNavigate()
  const { member, plan, requests, refreshRequests } = useStore()
  const masked = member?.phoneMasked
  const [phone, setPhone] = useState(isRealNumber(masked) ? (masked as string) : '')
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const booking = currentBooking(requests.filter((r) => r.status === 'paid' || r.status === 'closed'))
  const settled = Boolean(booking)
  const title = booking?.title ?? plan?.title ?? 'Your journey'

  async function handOver() {
    setSending(true)
    setError(null)
    try {
      await fileRequest({ type: 'handover', phone: phone.trim(), about: booking?.title ?? plan?.title })
      await refreshRequests()
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (!settled) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar back="/journeys" solid title="Handover" />
        <div className="flex flex-col items-center px-8 pb-16 pt-40 text-center">
          <span className="c-ivory-3">
            <Icon name="lock" size={28} />
          </span>
          <p className="t-display-m mt-6">Not yet.</p>
          <p className="t-caption mt-3 max-w-quote">
            The handover opens once the journey is paid for. Until then the Desk holds the file here,
            and you can reach it at any time.
          </p>
          <Btn tone="secondary" className="mt-8" onClick={() => navigate('/journeys')}>
            Back to your journeys
          </Btn>
        </div>
      </Screen>
    )
  }

  if (done) {
    return (
      <Screen tone="light" tabs={false}>
        <div className="flex flex-col items-center px-8 pb-16 pt-40 text-center">
          <Seal size={44} />
          <Headline size="m" className="mt-6">
            Handed over. <Sig>They have the file.</Sig>
          </Headline>
          <p className="t-body c-ivory-2 mt-4 max-w-quote">
            The Desk will message you on <span className="t-figure">{phone}</span> from the TripAgent
            number. Everything planned here goes with you, so you will not be asked for it again.
          </p>
          <p className="t-caption c-ivory-3 mt-3">— The Desk, Bengaluru</p>
          <Btn className="mt-8" onClick={() => navigate('/journeys')}>
            Back to the journey
          </Btn>
        </div>
      </Screen>
    )
  }

  return (
    <Screen tone="light" tabs={false} dock>
      <TopBar back="/journeys" solid />

      <section className="px-6 pt-32">
        <Eyebrow accent>While you travel</Eyebrow>
        <Headline size="l" className="mt-3">
          Take us <Sig>with you.</Sig>
        </Headline>
        <p className="t-body c-ivory-2 mt-4">
          {title} moves to WhatsApp, with the Desk, which already has the itinerary, the bookings and
          every preference you have set here.
        </p>
      </section>

      <section className="mt-12 px-6">
        <ul style={{ borderTop: '1px solid var(--line)' }}>
          {[
            ['Nothing repeated', 'They read the file before they message you. You never start again.'],
            ['One thread', 'Changes, confirmations and the 2 a.m. question, all in the same place.'],
            ['It follows the journey', 'The thread closes when you are home, not when the booking is made.'],
          ].map(([t, d]) => (
            <li
              key={t}
              className="flex items-start gap-3 py-4"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span className="c-champagne mt-0.5 shrink-0">
                <Icon name="check" size={18} />
              </span>
              <span>
                <span className="t-title-s block">{t}</span>
                <span className="t-caption mt-0.5 block">{d}</span>
              </span>
            </li>
          ))}
        </ul>

        <label htmlFor="wa" className="k-field-label mt-8 block">
          WhatsApp number
        </label>
        <div className="k-field mt-2">
          <span className="c-ivory-3">
            <Icon name="chat" size={18} />
          </span>
          <input
            id="wa"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91…"
            className="t-figure"
          />
        </div>
        {!isRealNumber(masked) && masked && (
          <p className="t-caption c-ivory-3 mt-2">
            We hold <span className="t-figure">{masked}</span> on your file. Write it in full so the
            Desk can open the thread.
          </p>
        )}

        {error && (
          <p className="t-body-s mt-4" style={{ color: 'var(--rose)' }}>
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="c-ivory-3">
            <Icon name="lock" size={14} />
          </span>
          <p className="t-caption c-ivory-3">Your file, and no one else&rsquo;s</p>
        </div>
      </section>

      <div
        className="fixed z-40"
        style={{
          left: 'max(16px, calc(50% - 224px))',
          right: 'max(16px, calc(50% - 224px))',
          bottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="k-dark k-glass-strong flex items-center gap-2 p-2" style={{ borderRadius: 32 }}>
          <Btn
            className="flex-1"
            icon="chat"
            disabled={!PHONE.test(phone.trim()) || sending}
            onClick={() => void handOver()}
          >
            {sending ? 'Sending…' : 'Hand over the file'}
          </Btn>
        </div>
      </div>
    </Screen>
  )
}
