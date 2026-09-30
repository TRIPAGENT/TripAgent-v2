import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Shell'
import { Btn, Icon, Mark, Status } from '@/components/ui'
import { useStore, type Preferences } from '@/context/store'
import { DESK } from '@/data/members'
import { isLive, STATUS_LABEL } from '@/lib/desk'

/* --------------------------------------------------------------- the file -- */

const PURPOSE: Record<string, string> = {
  restoration: 'To be restored · quiet and air',
  discovery: 'To understand a place · culture and craft',
  people: 'To be with people · the table that fills',
  rare: 'To see the rare · seldom opened',
}

const TERRAIN: Record<string, string> = {
  coast: 'Water · coast, islands, the long horizon',
  mountain: 'High ground · mountains, lakes, cold air',
  city: 'Cities · streets, rooms, things that are on',
  wild: 'The wild · desert, bush, ice, open ocean',
}

const COMPANY: Record<string, string> = {
  alone: 'Alone · one room, own hours',
  partner: 'The two of you',
  family: 'Family · children along',
  friends: 'Friends · a group that moves together',
}

const PACE: Record<string, string> = {
  unhurried: 'Unhurried · two anchors a day',
  balanced: 'Balanced · room to drift',
  full: 'Full · dawn to nocturne',
}

const LODGING: Record<string, string> = {
  sanctuary: 'Sanctuary · ryokan, riad, retreat',
  grand: 'Grand house · palace hotels',
  ultra: 'Ultra-modern · architectural, discreet',
  private: 'Somewhere private · the whole house',
}

const UNSAID = 'Not yet said'

/**
 * The profile, as Tara holds it. Values it does not recognise — older answers
 * left in storage — read as unsaid rather than as something invented.
 */
function memory(prefs: Preferences): { label: string; value: string }[] {
  const rows = [
    { label: 'What travel is for', value: prefs.purpose ? PURPOSE[prefs.purpose] ?? UNSAID : UNSAID },
    { label: 'Where you feel yourself', value: prefs.terrain ? TERRAIN[prefs.terrain] ?? UNSAID : UNSAID },
    { label: 'Usually with you', value: prefs.company ? COMPANY[prefs.company] ?? UNSAID : UNSAID },
    { label: 'Pace', value: prefs.pace ? PACE[prefs.pace] ?? UNSAID : UNSAID },
    { label: 'Stays', value: prefs.lodging ? LODGING[prefs.lodging] ?? UNSAID : UNSAID },
  ]

  /* Party size is a default rather than a fixed truth; each request may differ. */
  if (prefs.party) {
    rows.push({
      label: 'Usual party',
      value: `${prefs.party === 1 ? 'One traveller' : `${prefs.party} travelling`} · assumed unless a request says otherwise`,
    })
  }

  return rows
}

/* ------------------------------------------------------------------- rows -- */

function Row({
  label,
  value,
  icon,
  onClick,
  href,
  ariaLabel,
}: {
  label: ReactNode
  value?: ReactNode
  icon?: string
  onClick?: () => void
  href?: string
  ariaLabel?: string
}) {
  const inner = (
    <>
      {icon && (
        <span className="c-ivory-2 flex shrink-0">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {value !== undefined ? (
          <>
            <span className="t-caption c-ivory-3">{label}</span>
            <span className="t-title-s">{value}</span>
          </>
        ) : (
          <span className="t-title-s">{label}</span>
        )}
      </span>
      <span className="c-ivory-3 flex shrink-0">
        <Icon name="chevron-right" size={18} />
      </span>
    </>
  )

  if (href) {
    return (
      <a className="k-row py-3.5" href={href} aria-label={ariaLabel}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" className="k-row w-full py-3.5" onClick={onClick} aria-label={ariaLabel}>
      {inner}
    </button>
  )
}

/* ----------------------------------------------------------------- screen -- */

/**
 * Membership: the card, the Desk that holds the file, what Tara has
 * been told, what is open with the Desk, the house's own papers, and the door
 * out. Every control on this screen does something.
 */
export default function Membership() {
  const navigate = useNavigate()
  const { member, signOut, wishlist, itinerary, requests, prefs } = useStore()
  const [showCode, setShowCode] = useState(false)

  const live = requests.filter(isLive)
  const code = member?.code ?? ''
  const maskedCode = code ? `${code.slice(0, 4)} ••••` : '—'

  return (
    <Screen tone="light">
      {/* ---------------------------------------------------- the card ----- */}
      <section aria-label="Your membership card" className="relative" style={{ height: 404 }}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: 520,
            background:
              'radial-gradient(ellipse 72% 46% at 50% 42%, rgba(216,194,154,.20) 0%, rgba(216,194,154,.08) 46%, rgba(216,194,154,0) 100%)',
          }}
        />

        <header
          className="absolute left-6 right-6 flex items-center justify-center"
          style={{ top: 'max(54px, calc(env(safe-area-inset-top) + 12px))', height: 44 }}
        >
          <h1 className="t-label c-ivory-3">Membership</h1>
        </header>

        <figure className="absolute left-1/2 top-[112px] w-[342px] max-w-[calc(100%-48px)] -translate-x-1/2">
          <div
            className="k-metal flex flex-col justify-between"
            style={{ height: 216, padding: '22px 22px 20px' }}
          >
            <div className="flex items-start justify-between">
              <span className="k-engrave mt-1 inline-flex items-center gap-2">
                <Mark size={16} strokeWidth={30} />
                <span className="k-wordmark" style={{ fontSize: 13, lineHeight: '15px' }}>
                  TripAgent
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ border: '1px solid var(--champagne-line)' }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full c-champagne"
                  style={{
                    border: '1px solid rgba(216,194,154,.22)',
                    fontFamily: 'var(--f-display)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                  }}
                >
                  TA
                </span>
              </span>
            </div>

            <span className="c-champagne flex items-center gap-2.5">
              <Icon name="keyhole" size={16} />
              <span
                className="t-mono k-engrave c-ivory-2"
                style={{ fontSize: 15, lineHeight: '18px', letterSpacing: '0.24em' }}
              >
                {showCode ? code || '—' : maskedCode}
              </span>
            </span>

            <div className="flex flex-col gap-1.5">
              <span className="t-label c-champagne">{member?.tier ?? 'Member'}</span>
              <span
                className="k-engrave truncate"
                style={{ fontFamily: 'var(--f-display)', fontSize: 22, lineHeight: '28px', letterSpacing: '0.01em' }}
              >
                {member?.name ?? 'Member'}
              </span>
            </div>
          </div>
        </figure>

        <div className="absolute inset-x-6 top-[360px] flex justify-center">
          <Btn
            tone="secondary"
            size="sm"
            icon={showCode ? 'lock' : 'face-id'}
            style={{ height: 44 }}
            aria-pressed={showCode}
            onClick={() => setShowCode((s) => !s)}
          >
            {showCode ? 'Hide access code' : 'Show access code'}
          </Btn>
        </div>
      </section>

      {/* ----------------------------------------------------- the Desk ---- */}
      <section className="flex flex-col gap-5 px-6 pt-14">
        <h2 className="t-display-s t-italic">Looked after by</h2>
        <div className="k-card-raised flex flex-col gap-5 p-5" style={{ borderRadius: 22 }}>
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(160deg, var(--ink-4), var(--ink-1))',
                border: '1px solid var(--champagne-line)',
                boxShadow: '0 4px 12px rgba(0,0,0,.4)',
              }}
            >
              <span
                className="c-champagne flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  border: '1px solid rgba(216,194,154,.22)',
                  fontFamily: 'var(--f-display)',
                  fontSize: 16,
                  letterSpacing: '0.06em',
                }}
              >
                TA
              </span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="t-title">The Desk, Bengaluru</p>
              <p className="t-caption t-figure">Replies the same day · All times IST</p>
            </div>
          </div>

          <ul
            aria-label="Reach the Desk"
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${DESK.whatsapp ? 3 : 2}, minmax(0, 1fr))` }}
          >
            <li className="flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/desk')}
                className="flex min-w-[76px] flex-col items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                  style={{ background: 'var(--ivory)', color: 'var(--ink-0)' }}
                >
                  <Icon name="phone" size={22} />
                </span>
                <span className="t-caption c-ivory">Call back</span>
              </button>
            </li>

            {DESK.whatsapp && (
              <li className="flex justify-center">
                <a
                  href={DESK.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-[76px] flex-col items-center gap-2"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                    style={{ background: 'var(--ink-4)', border: '1px solid var(--line-2)' }}
                  >
                    <Icon name="chat" size={22} />
                  </span>
                  <span className="t-caption c-ivory">WhatsApp</span>
                </a>
              </li>
            )}

            <li className="flex justify-center">
              <a
                href={`mailto:${DESK.email}`}
                className="flex min-w-[76px] flex-col items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                  style={{ background: 'var(--ink-4)', border: '1px solid var(--line-2)' }}
                >
                  <Icon name="mail" size={22} />
                </span>
                <span className="t-caption c-ivory">Write</span>
              </a>
            </li>
          </ul>

          <p
            className="t-caption c-ivory-3 pt-4"
            style={{ borderTop: '1px solid var(--line)', textWrap: 'balance' }}
          >
            Your named advisor appears here once one is assigned.
          </p>
        </div>
      </section>

      {/* ------------------------------------- what Tara knows ---- */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <div className="flex flex-col gap-1.5">
          <h2 className="t-display-s">What Tara knows</h2>
          <p className="t-caption flex items-center gap-2">
            <span className="c-champagne flex">
              <Icon name="horizon" size={16} strokeWidth={1.6} />
            </span>
            Every suggestion starts here. Change any of it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="k-card px-4" style={{ borderRadius: 20 }}>
            {memory(prefs).map((m) => (
              <Row
                key={m.label}
                label={m.label}
                value={m.value}
                ariaLabel={`Edit ${m.label.toLowerCase()}: ${m.value}`}
                onClick={() => navigate('/onboarding')}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="k-link c-ivory-2 min-h-[44px] self-start"
          >
            <Icon name="sliders" size={18} />
            Retake the five questions
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ what you kept ---- */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">What you kept</h2>
        <div className="k-card px-4" style={{ borderRadius: 20 }}>
          <Row
            label="Saved"
            value={`${wishlist.length} ${wishlist.length === 1 ? 'place' : 'places'}`}
            onClick={() => navigate('/saved')}
          />
          <Row
            label="Shortlisted for a trip"
            value={`${itinerary.length} ${itinerary.length === 1 ? 'entry' : 'entries'}`}
            onClick={() => navigate('/saved')}
          />
        </div>
      </section>

      {/* ------------------------------------------ what is with the Desk -- */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">Your requests</h2>
        <div className="k-card px-4" style={{ borderRadius: 20 }}>
          <button
            type="button"
            className="k-row w-full py-3.5"
            onClick={() => navigate('/status')}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="t-title-s t-figure">
                {live.length === 0
                  ? 'Nothing open'
                  : `${live.length} open`}
              </span>
              {live[0] && (
                <span className="flex items-center gap-2.5">
                  <Status tone={live[0].status === 'quoted' ? 'ready' : 'progress'}>
                    {STATUS_LABEL[live[0].status]}
                  </Status>
                  <span className="t-mono c-ivory-3 truncate">{live[0].id}</span>
                </span>
              )}
            </span>
            <span className="c-ivory-3 flex shrink-0">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
          <Row label="Services we handle" icon="check" onClick={() => navigate('/services')} />
        </div>
      </section>

      {/* -------------------------------------------------- the house ------ */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">The house</h2>
        <div className="k-card px-4" style={{ borderRadius: 20 }}>
          <Row label="Membership terms" icon="document" onClick={() => navigate('/legal/terms')} />
          <Row label="Privacy" icon="shield" onClick={() => navigate('/legal/privacy')} />
          <Row label="Refund of fees" icon="refresh" onClick={() => navigate('/legal/refund')} />
        </div>
      </section>

      {/* ------------------------------------------- small print, leaving -- */}
      <footer className="flex flex-col gap-4 px-6 pt-10">
        <Btn
          tone="ghost"
          block
          className="c-ivory-2"
          onClick={() => {
            signOut()
            navigate('/signin', { replace: true })
          }}
        >
          Sign out of this device
        </Btn>
        <p className="t-caption c-ivory-3 px-2 text-center" style={{ textWrap: 'balance' }}>
          Signing out clears your saved places and your conversation from this device. Your file with
          the Desk is untouched.
        </p>
        <p className="t-caption c-ivory-3 px-2 text-center" style={{ textWrap: 'balance' }}>
          {DESK.operator} Write to{' '}
          <a href={`mailto:${DESK.email}`} className="c-champagne underline underline-offset-4">
            {DESK.email}
          </a>
          .
        </p>
      </footer>
    </Screen>
  )
}
