import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Btn, Horizon, Icon, Photo, Seal } from '@/components/ui'
import { useStore } from '@/context/store'
import { brandImage } from '@/lib/catalogue'
import { ADVISOR, DESK, isValidCode, normaliseCode } from '@/data/members'
import { signInWithCode } from '@/lib/agentClient'
import type { Member } from '@/lib/types'

type Step = 'code' | 'welcome'

/** Eight cells, grouped 2 · 4 · 2, the way the code is written on the invitation. */
const GROUPS = [2, 4, 2] as const

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function SignIn() {
  const navigate = useNavigate()
  const { signIn, prefs, wishlist, itinerary, requests } = useStore()

  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Member | null>(null)
  const [checking, setChecking] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const clean = normaliseCode(code)
  const valid = isValidCode(clean)

  /**
   * Fails closed. A well-formed code that is not on file is refused rather than
   * letting the holder declare a name for it — with a payment instrument on the
   * member record, a self-declared identity is a fraud path with no upside.
   * Codes are pre-issued only.
   *
   * The shape check here is for instant feedback only. The server holds the
   * registry, checks the code, and issues the session; nobody is let in on the
   * strength of the app alone, including when the desk cannot be reached.
   */
  async function submitCode() {
    if (!valid) {
      setError('An access code is two letters, four numerals, then two letters.')
      return
    }
    setChecking(true)
    setError(null)
    try {
      const m = await signInWithCode(clean)
      setResolved({ code: m.code, name: m.name, tier: m.tier, phoneMasked: m.phoneMasked, directives: m.directives } as Member)
      setStep('welcome')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setChecking(false)
    }
  }

  function enter() {
    if (!resolved) return
    signIn(resolved)
    navigate(prefs.completed ? '/' : '/onboarding', { replace: true })
  }

  /* ------------------------------------------------------------- the door -- */

  if (step === 'code') {
    let cell = 0
    return (
      <div className="relative min-h-dvh overflow-hidden" style={{ background: 'var(--ink-0)' }}>
        <Photo
          src={brandImage('door')}
          alt="Desert dunes at dusk, the last light low on the horizon and the sand falling into shadow"
          label="TripAgent"
          veil="hero"
          eager
          radius={0}
          position="75% 50%"
          className="absolute inset-0 h-full w-full"
        />

        <div
          className="relative mx-auto flex min-h-dvh max-w-app flex-col px-6"
          style={{
            paddingTop: 'max(70px, calc(env(safe-area-inset-top) + 28px))',
            paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
          }}
        >
          <header className="flex flex-col items-center gap-3">
            <p className="k-wordmark" style={{ paddingLeft: '0.34em' }}>
              TripAgent
            </p>
            <p className="t-label c-ivory-3" style={{ paddingLeft: '0.14em' }}>
              By invitation
            </p>
          </header>

          <div className="flex-1" style={{ minHeight: 48 }} />

          <h1 className="t-display-xxl">
            Someone who travels <em className="t-italic">with</em> you.
          </h1>

          <div className="mt-9 flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <label className="t-caption" htmlFor="access-code">
                Your access code
              </label>

              {/* The cells are the picture of the field; one real input sits over them. */}
              <div className="relative" style={{ height: 54 }}>
                <div aria-hidden="true" className="flex h-[54px] items-center justify-center" style={{ gap: 20 }}>
                  {GROUPS.map((n, gi) => (
                    <span key={gi} className="flex" style={{ gap: 5 }}>
                      {Array.from({ length: n }, () => {
                        const i = cell++
                        const char = clean[i]
                        const active = focused && i === Math.min(clean.length, 7)
                        return (
                          <span
                            key={i}
                            className="relative flex items-center justify-center"
                            style={{
                              width: 34,
                              height: 54,
                              borderRadius: 12,
                              background: active ? 'rgba(242,237,228,.09)' : 'rgba(242,237,228,.06)',
                              border: active ? '1.5px solid var(--champagne)' : '1px solid var(--line-2)',
                              boxShadow: active
                                ? '0 0 0 4px var(--champagne-3), inset 0 1px 3px rgba(0,0,0,.45)'
                                : 'inset 0 1px 3px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.05)',
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                              fontFamily: 'var(--f-mono)',
                              fontSize: 22,
                              lineHeight: '24px',
                              color: 'var(--ivory)',
                            }}
                          >
                            {char ?? ''}
                            {active && !char ? (
                              <span
                                className="caret-blink absolute"
                                style={{
                                  left: '50%',
                                  top: 15,
                                  width: 1.5,
                                  height: 22,
                                  marginLeft: -0.75,
                                  borderRadius: 1,
                                  background: 'var(--champagne)',
                                }}
                              />
                            ) : null}
                          </span>
                        )
                      })}
                    </span>
                  ))}
                </div>

                <input
                  id="access-code"
                  ref={inputRef}
                  className="absolute inset-0 h-full w-full border-0 bg-transparent p-0 outline-none"
                  style={{ opacity: 0, fontSize: 16, color: 'transparent', caretColor: 'transparent' }}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={8}
                  aria-describedby="access-code-help"
                  aria-invalid={error ? true : undefined}
                  value={clean}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onChange={(e) => {
                    setCode(normaliseCode(e.target.value))
                    setError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !checking && void submitCode()}
                />
              </div>

              {/* The format is spoken only to assistive technology; the cells show it. */}
              <p id="access-code-help" className="sr-only">
                Eight characters: two letters, four numerals, two letters.
              </p>

              <figure className="mt-2 flex flex-col items-center gap-1.5 text-center">
                <blockquote
                  className="t-italic-plain c-ivory-2"
                  style={{ fontFamily: 'var(--f-display)', fontSize: 16, lineHeight: '22px' }}
                >
                  “To travel is to live.”
                </blockquote>
                <figcaption className="t-caption c-ivory-3">Hans Christian Andersen</figcaption>
              </figure>

              {error ? (
                <p className="t-body-s c-champagne" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <Btn block disabled={checking} onClick={() => void submitCode()}>
                {checking ? 'Checking with the Desk…' : 'Open the door'}
              </Btn>
              {/* Development builds only: never shipped to members. */}
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  className="k-link c-ivory-3 self-center"
                  style={{ height: 44, padding: '0 12px' }}
                  onClick={() => {
                    setCode('EV2410VC')
                    setError(null)
                    inputRef.current?.focus()
                  }}
                >
                  Fill the test code (dev only)
                </button>
              ) : null}
            </div>
          </div>

          <footer className="mt-8 flex flex-col items-center gap-2 text-center">
            <p className="t-caption c-ivory-3">
              Not yet invited?{' '}
              <a
                href={`mailto:${DESK.invite}`}
                className="c-ivory-2 underline underline-offset-4"
                style={{ textDecorationColor: 'var(--line-2)' }}
              >
                {DESK.invite}
              </a>
            </p>
            <p className="flex items-center gap-2 text-[12px] leading-4 c-ivory-3">
              <Link to="/legal/terms">Membership terms</Link>
              <span aria-hidden="true">·</span>
              <Link to="/legal/privacy">Privacy</Link>
            </p>
          </footer>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------- recognition -- */

  if (!resolved) return null
  const first = resolved.name.split(' ')[0]
  const masked = `${resolved.code.slice(0, 4)} ••••`
  /** Nothing on file and no preferences set: this is a first arrival, not a return. */
  const firstArrival =
    wishlist.length === 0 && itinerary.length === 0 && requests.length === 0 && !prefs.completed

  return (
    <div className="relative min-h-dvh overflow-hidden" style={{ background: 'var(--ink-0)' }}>
      <div className="k-photo absolute inset-0" aria-hidden="true">
        <img
          src={brandImage('door')}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '75% 50%', filter: 'blur(30px) saturate(.9)', opacity: 0.35 }}
        />
        <span className="k-veil-top" />
        <span className="k-veil-bottom" style={{ height: '60%' }} />
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0"
        style={{
          top: 12,
          height: 460,
          background:
            'radial-gradient(ellipse 58% 44% at 50% 48%, rgba(216,194,154,.26) 0%, rgba(216,194,154,.12) 42%, rgba(216,194,154,0) 100%)',
        }}
      />

      <div
        className="relative mx-auto flex min-h-dvh max-w-app flex-col items-center px-6"
        style={{
          paddingTop: 'max(66px, calc(env(safe-area-inset-top) + 24px))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <span className="k-status k-status-ok">Invitation recognised</span>

        {/* The membership card, as an object */}
        <figure
          className="mt-8 w-full"
          style={{ maxWidth: 342, transform: 'perspective(900px) rotateX(8deg) rotateY(-10deg) rotateZ(2deg)' }}
        >
          <div
            className="k-metal flex flex-col justify-between"
            style={{ height: 216, padding: '22px 22px 20px' }}
          >
            {/* Engraved great circles — the card's own quiet map. Behind everything. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 342 216"
              preserveAspectRatio="xMidYMid slice"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ color: 'var(--champagne)', opacity: 0.08 }}
            >
              <g fill="none" stroke="currentColor" strokeWidth="0.75">
                <circle cx="248" cy="108" r="86" />
                <ellipse cx="248" cy="108" rx="34" ry="86" />
                <ellipse cx="248" cy="108" rx="64" ry="86" />
                <path d="M162 108h172M176 62h144M176 154h144M170 85h156M170 131h156" />
                <path
                  d="M18 178C74 150 96 96 150 62c46-29 108-40 172-34"
                  strokeWidth="1"
                  strokeDasharray="5 6"
                />
              </g>
            </svg>

            <div className="relative flex items-start justify-between">
              {/* The mark: glyph and wordmark as one lockup. */}
              <span className="flex items-center gap-2">
                <Horizon size={16} />
                <span className="k-wordmark k-engrave" style={{ fontSize: 11, lineHeight: '13px' }}>
                  TripAgent
                </span>
              </span>
              <Seal size={36} />
            </div>
            <div className="relative flex flex-col gap-1.5">
              <span className="t-label c-champagne">{resolved.tier}</span>
              <span
                className="k-engrave truncate"
                style={{ fontFamily: 'var(--f-display)', fontSize: 22, lineHeight: '28px', letterSpacing: '0.01em' }}
              >
                {resolved.name}
              </span>
              <span className="t-mono k-engrave c-ivory-2 mt-2 flex justify-between gap-3">
                <span>Access code</span>
                <span>{masked}</span>
              </span>
            </div>
          </div>
        </figure>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <h1 className="t-display-xl">
            {greeting(new Date().getHours())},
            <br />
            <em className="t-italic">{first}.</em>
          </h1>
          <p className="t-body c-ivory-2 max-w-[320px]">
            {firstArrival
              ? 'Everything starts here. Tell Tara where you have always meant to go.'
              : 'Your saved places, your journeys and your requests are as you left them.'}
          </p>
        </div>

        {ADVISOR.hasAdvisor ? (
          <div
            className="mt-10 flex w-full flex-col gap-3 rounded-[18px] px-4 py-4"
            style={{ maxWidth: 342, background: 'var(--ink-2)', border: '1px solid var(--line-2)' }}
          >
            {/* The person, then how to reach them, then why to trust them. */}
            <div className="flex items-center gap-3">
              <Seal size={44} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="t-caption c-ivory-3">{ADVISOR.role}</span>
                <span className="t-title-s">{ADVISOR.name}</span>
                <span className="t-caption c-ivory-3">{ADVISOR.city}</span>
              </span>
            </div>

            {ADVISOR.travelled.length ? (
              <p className="t-caption c-ivory-2 text-left">
                <span className="c-ivory-3">Has travelled&nbsp;</span>
                {ADVISOR.travelled.join(' · ')}
              </p>
            ) : null}

            {ADVISOR.tel ? (
              <a
                href={ADVISOR.tel}
                className="k-btn k-btn-secondary k-btn-sm k-btn-block"
                aria-label={`Call ${ADVISOR.name}`}
              >
                <Icon name="phone" size={16} />
                <span className="t-figure">{ADVISOR.phone}</span>
              </a>
            ) : null}
          </div>
        ) : (
          <div className="mt-10 flex items-center gap-3">
            <Seal size={40} />
            <span className="flex flex-col gap-0.5 text-left">
              <span className="t-body-s">Looked after by the Desk, {DESK.city}</span>
              <span className="t-caption t-figure c-ivory-3">Replies the same day · All times IST</span>
            </span>
          </div>
        )}

        <div className="flex-1" style={{ minHeight: 40 }} />

        <Btn block onClick={enter}>
          Enter
        </Btn>
      </div>
    </div>
  )
}
