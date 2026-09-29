import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dock, Screen, TopBar } from '@/components/Shell'
import { Btn, Chip, Icon, Photo, Sig } from '@/components/ui'
import { useStore } from '@/context/store'
import { DESK } from '@/data/members'
import { brandImage } from '@/lib/catalogue'
import { fileRequest } from '@/lib/agentClient'

const SLOTS = ['As soon as possible', 'This evening, after 6 pm', 'Tomorrow morning', 'Tomorrow afternoon']

type Channel = 'call' | 'whatsapp' | 'write'

/**
 * The Desk: the people. Asking one of them to call goes to their inbox with the
 * note and whatever journey the member chose to attach, so the call starts where
 * they are. WhatsApp and writing are offered only where they actually exist.
 */
export default function Desk() {
  const navigate = useNavigate()
  const { member, booking, refreshRequests } = useStore()
  const [channel, setChannel] = useState<Channel>('call')
  const [slot, setSlot] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [requested, setRequested] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const about = booking?.title ?? null

  async function request() {
    if (!slot) return
    setSending(true)
    setError(null)
    try {
      await fileRequest({ type: 'call', slot, note: note.trim() || undefined, about: about ?? undefined })
      await refreshRequests()
      setRequested(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  /* -------------------------------------------------------- the reply ----- */

  if (requested) {
    return (
      <Screen tone="light" tabs={false} dock>
        <TopBar back solid />
        <section className="flex flex-col items-center px-6 pt-[160px] text-center">
          <span className="c-champagne flex">
            <Icon name="check-circle" size={30} />
          </span>
          <h1 className="t-display-l mt-5">
            The Desk <Sig>will call.</Sig>
          </h1>
          <p className="t-body c-ivory-2 mt-4 max-w-quote">
            {slot}
            {member?.phoneMasked ? `, on ${member.phoneMasked}` : ', on the number on your file'}.
            {about ? ` About ${about}.` : ''} You can see the request, and anything they send back,
            under your requests.
          </p>
          <Btn tone="secondary" className="mt-8" onClick={() => navigate(-1)}>
            Back
          </Btn>
        </section>

        <Dock>
          <button
            type="button"
            className="k-btn k-btn-primary flex-1"
            onClick={() => navigate('/status')}
          >
            See your requests
          </button>
        </Dock>
      </Screen>
    )
  }

  /* ------------------------------------------------------------ the desk -- */

  const mailto = `mailto:${DESK.email}${about ? `?subject=${encodeURIComponent(about)}` : ''}`

  return (
    <Screen tone="light" tabs={false} dock>
      {/* A lamp left on in Bengaluru. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 540,
          background:
            'radial-gradient(ellipse 78% 64% at 16% 30%, rgba(216,194,154,.14) 0%, rgba(216,194,154,.05) 46%, rgba(216,194,154,0) 100%)',
        }}
      />

      <TopBar back solid />

      {/* Who you are speaking to: a house, not a stock portrait. */}
      <section className="relative flex flex-col items-start px-6 pt-32">
        <span
          aria-hidden="true"
          className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{
            background:
              'radial-gradient(circle at 32% 24%, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 48%), linear-gradient(160deg, #2A2A2E 0%, #141416 56%, #1B1B1E 100%)',
            border: '1px solid var(--champagne-line)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(0,0,0,.6), 0 0 0 7px rgba(216,194,154,.05), 0 18px 40px rgba(0,0,0,.55)',
          }}
        >
          <span
            className="absolute rounded-full"
            style={{ inset: 5, border: '1px solid rgba(216,194,154,.24)' }}
          />
          <span
            className="k-engrave c-champagne relative"
            style={{ fontFamily: 'var(--f-display)', fontWeight: 500, fontSize: 24, letterSpacing: '0.08em' }}
          >
            TA
          </span>
        </span>

        <div className="flex flex-col gap-3.5 pt-7">
          <h1 className="t-display-l">
            Speak to
            <br />
            <Sig>the Desk.</Sig>
          </h1>
          <p className="t-body c-ivory-2">
            The people who hold your whole file: the plan, the bookings, the visas, the changes. They
            read it before they call, so you never repeat yourself.
          </p>
          <p className="t-caption c-ivory-3">Bengaluru · replies the same day · all times IST</p>
        </div>
      </section>

      {/* How to reach them. Only the doors that exist. */}
      <div
        role="radiogroup"
        aria-label="How to reach the Desk"
        className="grid gap-3 px-6 pt-9"
        style={{ gridTemplateColumns: `repeat(${1 + (DESK.whatsapp ? 1 : 0) + 1}, minmax(0, 1fr))` }}
      >
        {([
          { id: 'call' as Channel, label: 'Call back', icon: 'phone', show: true },
          { id: 'whatsapp' as Channel, label: 'WhatsApp', icon: 'chat', show: Boolean(DESK.whatsapp) },
          { id: 'write' as Channel, label: 'Write', icon: 'mail', show: true },
        ])
          .filter((c) => c.show)
          .map((c) => {
            const on = channel === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChannel(c.id)}
                className={`relative flex h-24 flex-col justify-between p-3.5 ${on ? '' : 'k-card'}`}
                style={
                  on
                    ? {
                        borderRadius: 18,
                        background: 'var(--ivory)',
                        color: 'var(--ink-0)',
                        boxShadow: '0 12px 32px rgba(0,0,0,.45)',
                      }
                    : { borderRadius: 18, color: 'var(--ivory-2)' }
                }
              >
                <Icon name={c.icon} size={22} />
                <span className={`t-title-s ${on ? '' : 'c-ivory'}`}>{c.label}</span>
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full"
                  style={
                    on
                      ? { background: 'var(--ink-0)', color: 'var(--ivory)' }
                      : { border: '1px solid var(--line-2)' }
                  }
                >
                  {on ? <Icon name="check" size={12} strokeWidth={2.2} /> : null}
                </span>
              </button>
            )
          })}
      </div>

      {channel === 'call' ? (
        <>
          {/* When */}
          <section aria-labelledby="when-title" className="flex flex-col gap-4 px-6 pt-12">
            <h2 id="when-title" className="t-title">
              When should they call?
            </h2>
            <div aria-labelledby="when-title" className="flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <Chip
                  key={s}
                  on={slot === s}
                  onClick={() => setSlot(s)}
                  className="h-11 flex-1 justify-center whitespace-normal text-center"
                  style={{ minWidth: 150 }}
                >
                  {s}
                </Chip>
              ))}
            </div>
          </section>

          {/* About: the journey travels with the request, and the member chooses it. */}
          <section aria-labelledby="about-title" className="flex flex-col gap-4 px-6 pt-12">
            <h2 id="about-title" className="t-title">
              About
            </h2>
            <div
              className="k-card flex items-center gap-3.5"
              style={{ borderRadius: 18, padding: '12px 6px 12px 12px' }}
            >
              <Photo
                src={brandImage('door')}
                alt=""
                radius={12}
                veil="none"
                className="h-12 w-12 shrink-0"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-title-s truncate">{about ?? 'No journey attached'}</span>
                <span className="t-caption c-ivory-3 truncate">
                  {about ? 'This will be attached to the call' : 'They will call about anything you like'}
                </span>
              </span>
              <button
                type="button"
                className="k-link c-ivory-2 h-11 shrink-0 px-2.5"
                onClick={() => navigate('/journeys')}
              >
                {about ? 'Change' : 'Choose'}
              </button>
            </div>
          </section>

          {/* A note for them to read first */}
          <section className="flex flex-col gap-4 px-6 pt-12">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="desk-note" className="t-title">
                Anything to read first?
              </label>
              <span className="t-caption c-ivory-3">Optional</span>
            </div>
            <div className="flex flex-col gap-3">
              <div
                className="k-field relative items-start"
                style={{ height: 120, padding: '14px 18px', borderRadius: 20 }}
              >
                <textarea
                  id="desk-note"
                  rows={3}
                  maxLength={1200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Dates that must not move, people travelling, anything delicate."
                  className="h-[72px] resize-none"
                />
                <span
                  className="t-mono c-ivory-3 absolute bottom-3 right-4"
                  aria-hidden="true"
                >
                  {note.length} / 1200
                </span>
              </div>
              <p className="t-caption c-ivory-3 flex items-center gap-2">
                <Icon name="lock" size={14} />
                Goes only to the Desk, on your file.
              </p>
            </div>
          </section>

          {/* Where the call will land */}
          <section aria-label="The number they will call" className="px-6 pt-10">
            <div
              className="k-card flex items-center gap-3.5"
              style={{ borderRadius: 18, padding: '14px 16px' }}
            >
              <span
                aria-hidden="true"
                className="c-ivory-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--ink-3)', border: '1px solid var(--line-2)' }}
              >
                <Icon name="phone" size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-title-s truncate">
                  {member?.phoneMasked ? (
                    <>
                      We&rsquo;ll call <span className="t-figure">{member.phoneMasked}</span>
                    </>
                  ) : (
                    'We’ll call the number on your file'
                  )}
                </span>
                <span className="t-caption">The number on your file</span>
              </span>
            </div>
          </section>

          <Dock caption={error ? <span className="c-amber">{error}</span> : undefined}>
            <button
              type="button"
              disabled={!slot || sending}
              onClick={() => void request()}
              className="k-btn k-btn-primary flex-1"
              style={!slot || sending ? { opacity: 0.5 } : undefined}
            >
              <Icon name="phone" size={18} />
              {sending ? 'Sending…' : 'Request the call'}
            </button>
          </Dock>
        </>
      ) : channel === 'whatsapp' && DESK.whatsapp ? (
        <>
          <section className="px-6 pt-12">
            <div className="k-card flex flex-col gap-2 p-5" style={{ borderRadius: 20 }}>
              <p className="t-title-s">WhatsApp the Desk</p>
              <p className="t-body-s c-ivory-2">
                The thread opens in WhatsApp. Anything you send there reaches the same people who
                hold your file{about ? `, including on ${about}` : ''}.
              </p>
            </div>
          </section>
          <Dock>
            <a
              href={DESK.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="k-btn k-btn-primary flex-1"
            >
              <Icon name="chat" size={18} />
              Open WhatsApp
            </a>
          </Dock>
        </>
      ) : (
        <>
          <section className="px-6 pt-12">
            <div className="k-card flex flex-col gap-2 p-5" style={{ borderRadius: 20 }}>
              <p className="t-title-s">Write to the Desk</p>
              <p className="t-body-s c-ivory-2">
                {DESK.email} — a letter reaches the whole Desk{about ? `, about ${about}` : ''}. They
                reply the same day, all times IST.
              </p>
            </div>
          </section>
          <Dock>
            <a href={mailto} className="k-btn k-btn-primary flex-1">
              <Icon name="mail" size={18} />
              Write to the Desk
            </a>
          </Dock>
        </>
      )}
    </Screen>
  )
}
