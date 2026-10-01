import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Shell'
import { AgentMark, Btn, Card, Horizon, Icon } from '@/components/ui'
import { useStore, type Preferences } from '@/context/store'
import { useThinkingWord } from '@/lib/useThinking'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { parseItemKey } from '@/lib/itinerary'
import { greeting, msg, respond } from '@/lib/concierge'
import { clock } from '@/lib/format'
import {
  AgentError,
  agentHealth,
  labelForTool,
  streamFromAgent,
  type AgentHealth,
} from '@/lib/agentClient'

/* --------------------------------------------------------------- speech --- */

/**
 * The browser's own dictation. There is no polyfill and no server transcription
 * behind this, so where the browser cannot listen the mic is not drawn at all —
 * a button that does nothing is worse than no button.
 */
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  0: RecognitionAlternative
  isFinal: boolean
}
interface RecognitionResultList {
  length: number
  [index: number]: RecognitionResult
}
interface RecognitionEvent {
  resultIndex: number
  results: RecognitionResultList
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/* ----------------------------------------------------------------- dates --- */

const startOfDay = (at: number) => {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** A real day, not the word "Today" on every message the app has ever kept. */
function dayLabel(at: number): string {
  const day = startOfDay(at)
  const today = startOfDay(Date.now())
  if (day === today) return 'Today'
  if (day === today - 86_400_000) return 'Yesterday'
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

/** The house greets by the hour; it does not say "evening" over breakfast. */
function timeOfDay(at = Date.now()): string {
  const h = new Date(at).getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/* ------------------------------------------------------------- the file --- */

/**
 * What Tara already knows, said back in one quiet line.
 *
 * The five questions are persona, not paperwork: they hold for years and shape
 * every trip. Showing them here is the point — a member should feel the file
 * being read before they type, not discover it later in a plan. It is one line,
 * in the member's own answers, and it is never a boast: four clauses at most,
 * and nothing at all when nothing has been answered.
 */
const PURPOSE_SAID: Record<string, string> = {
  restoration: 'travel as rest',
  discovery: 'travel as understanding',
  people: 'travel for the people in it',
  rare: 'travel for the rare',
}
const TERRAIN_SAID: Record<string, string> = {
  coast: 'drawn to water',
  mountain: 'drawn to high ground',
  city: 'drawn to cities',
  wild: 'drawn to the wild',
}
const COMPANY_SAID: Record<string, string> = {
  alone: 'travelling alone',
  partner: 'the two of you',
  family: 'family along',
  friends: 'friends along',
}
const PACE_SAID: Record<string, string> = {
  unhurried: 'unhurried days',
  balanced: 'balanced days',
  full: 'full days',
}
const LODGING_SAID: Record<string, string> = {
  sanctuary: 'a sanctuary to come back to',
  grand: 'a grand house to come back to',
  ultra: 'something modern to come back to',
  private: 'somewhere of your own to come back to',
}

function fileLine(prefs: Preferences): string | null {
  const clauses: string[] = []
  // Ordered by how much each narrows a suggestion, so the four that survive
  // the ceiling are the four worth saying.
  if (prefs.purpose && PURPOSE_SAID[prefs.purpose]) clauses.push(PURPOSE_SAID[prefs.purpose])
  if (prefs.terrain && TERRAIN_SAID[prefs.terrain]) clauses.push(TERRAIN_SAID[prefs.terrain])
  if (prefs.company && COMPANY_SAID[prefs.company]) clauses.push(COMPANY_SAID[prefs.company])
  if (prefs.pace && PACE_SAID[prefs.pace]) clauses.push(PACE_SAID[prefs.pace])
  // Four is the ceiling: this is evidence of being read, not a recital.
  if (clauses.length < 4 && prefs.lodging && LODGING_SAID[prefs.lodging]) {
    clauses.push(LODGING_SAID[prefs.lodging])
  }
  if (!clauses.length) return null
  const line = clauses.slice(0, 4).join(', ')
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`
}

/* -------------------------------------------------------------- the room --- */

export default function Concierge() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    member, chat, pushChat, activeCity, requests, wishlist, itinerary, setPlan, prefs,
  } = useStore()
  const openRequest = requests.find((r) => !['closed', 'cancelled'].includes(r.status)) ?? null
  const said = fileLine(prefs)

  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [health, setHealth] = useState<AgentHealth | null | undefined>(undefined)
  const [lastSent, setLastSent] = useState<string | null>(null)
  /** What Tara is saying as it says it, before the turn is committed. */
  const [partial, setPartial] = useState('')
  /** What Tara is doing right now, when it is working rather than talking. */
  const [activity, setActivity] = useState<string | null>(null)
  // Rotating language of the work, so a long build never reads as a hang.
  const thinkingWord = useThinkingWord(thinking && !activity && !partial)
  /** Real seconds since this turn began, for the working card. */
  const [elapsed, setElapsed] = useState(0)
  const [listening, setListening] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const greeted = useRef(false)
  const city = CITY_BY_SLUG[activeCity] ?? null
  const live = Boolean(health?.ok && health.modelReady)

  /**
   * What the member has already chosen, so Tara can open with a real
   * question instead of a blank box. Cities they saved plus the cities their
   * saved addresses belong to — an address kept in Kyoto means Kyoto is in play.
   */
  const held = useMemo(() => {
    const slugs = new Set<string>()
    for (const key of wishlist) {
      if (key.startsWith('city:')) slugs.add(key.slice(5))
      else {
        const parsed = parseItemKey(key)
        if (parsed) slugs.add(parsed.slug)
      }
    }
    for (const key of itinerary) {
      const parsed = parseItemKey(key)
      if (parsed) slugs.add(parsed.slug)
    }
    return [...slugs].map((s) => CITY_BY_SLUG[s]).filter(Boolean)
  }, [wishlist, itinerary])

  /** The saved addresses themselves, by name, for the proposal's chips. */
  const kept = useMemo(() => {
    const names: string[] = []
    for (const key of [...wishlist, ...itinerary]) {
      if (key.startsWith('city:')) continue
      const parsed = parseItemKey(key)
      if (parsed && !names.includes(parsed.name)) names.push(parsed.name)
    }
    return names
  }, [wishlist, itinerary])

  const heldNames = held.map((c) => c.name)
  const heldPhrase =
    heldNames.length === 1
      ? heldNames[0]
      : `${heldNames.slice(0, -1).join(', ')} and ${heldNames.at(-1)}`

  const proposal =
    heldNames.length === 0
      ? null
      : kept.length > 0
        ? {
            question: `Shall I shape ${heldPhrase} around the ${kept.length} place${kept.length === 1 ? '' : 's'} you kept?`,
            ask: `Shape ${heldPhrase} around the places I have saved.`,
          }
        : {
            question: `Shall I shape something around ${heldPhrase}?`,
            ask: `Shape something around ${heldPhrase}.`,
          }

  /**
   * Open the thread the first time Tara is visited — but only for the
   * offline stand-in. When the live Tara is answering, putting words in its
   * mouth would be a lie about what it said, and its own voice greets a greeting
   * perfectly well. So we wait for the member to speak first.
   */
  useEffect(() => {
    if (greeted.current || health === undefined || live) return
    if (chat.length === 0 && member) {
      greeted.current = true
      pushChat(greeting(member.name, city))
    }
  }, [chat.length, member, city, pushChat, health, live])

  /**
   * Probe Tara so the screen can say honestly whether it is reachable.
   * While it is down we keep probing, because a backend that comes back should be
   * picked up without a reload — otherwise a restart leaves the app answering
   * from the stand-in and quietly claiming to be Tara.
   */
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const probe = () => {
      agentHealth().then((h) => {
        if (cancelled) return
        setHealth(h)
        if (!(h?.ok && h.modelReady)) timer = window.setTimeout(probe, 10_000)
      })
    }
    probe()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  // Follow the thread as it grows — including while a reply is still being
  // streamed, so the newest words are never written below the fold.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat.length, thinking, partial, activity])

  // The turn's own clock, in real seconds.
  useEffect(() => {
    if (!thinking) return
    const started = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [thinking])

  /**
   * The live Tara is the TripAgent backend: it owns the voice, the member's
   * memory and the plan pages. When it is not reachable — no server, no API key —
   * we fall back to the on-device stand-in so the app is still usable, and the
   * screen says which one is answering. We never present the stand-in as the
   * Tara.
   */
  const reply = useCallback(
    async (body: string) => {
      setLastSent(body)
      setThinking(true)

      // The cached health may be stale — Tara can have come back since
      // the last probe. Check once more before falling back, so a restarted
      // backend is used straight away rather than a whole turn being answered by
      // the stand-in.
      let answering = live
      if (!answering) {
        const fresh = await agentHealth()
        setHealth(fresh)
        answering = Boolean(fresh?.ok && fresh.modelReady)
      }

      if (!answering) {
        const turn = chat.filter((m) => m.role === 'member').length
        window.setTimeout(() => {
          respond(body, city, turn).forEach(pushChat)
          setThinking(false)
        }, 500)
        return
      }

      setPartial('')
      setActivity(null)

      try {
        const replies = await streamFromAgent(body, (event) => {
          if (event.type === 'text') {
            // A tool call supersedes whatever preamble came before it.
            setActivity(null)
            setPartial((prev) => prev + event.delta)
          } else if (event.type === 'tool') {
            setPartial('')
            setActivity(labelForTool(event.name))
          }
        })
        replies.forEach(pushChat)
        // A built plan belongs in Journeys, not only in the transcript.
        const built = replies.find((r) => r.planUrl)
        if (built?.planUrl) {
          setPlan({ url: built.planUrl, title: built.release?.title ?? 'Your itinerary', at: Date.now() })
        }
      } catch (error) {
        const message =
          error instanceof AgentError ? error.message : 'Something went wrong reaching Tara.'
        pushChat(msg('ai', message, { failed: true }))
        // A dropped connection may simply have stopped; re-probe so the screen stays true.
        agentHealth().then(setHealth)
      } finally {
        setThinking(false)
        setPartial('')
        setActivity(null)
      }
    },
    [chat, city, live, pushChat, setPlan],
  )

  const send = useCallback(
    async (text: string) => {
      const body = text.trim()
      if (!body || thinking) return
      pushChat(msg('member', body))
      setDraft('')
      await reply(body)
    },
    [pushChat, reply, thinking],
  )

  /**
   * What the rest of the app hands over when it opens Tara.
   *
   * `send` is a line the member has already committed to — an enquiry form's
   * opening message, whose bubble is in the thread already, so only the reply is
   * needed. Everything else arrives as a *draft*: a question from the itinerary,
   * a search that found nothing, a place on the map, a city, the saved list. A
   * draft is written into the composer and left there. The member decides
   * whether to send it — the old screen fired half-finished messages
   * ("About "{title}": ") the moment a button was pressed.
   */
  const seeded = useRef(false)
  useEffect(() => {
    const s = location.state as
      | {
          send?: string
          draft?: string
          query?: string
          city?: string
          place?: { name?: string; area?: string | null; slug?: string }
        }
      | null
    if (!s || seeded.current || health === undefined) return

    const city = s.city ? CITY_BY_SLUG[s.city]?.name : null
    const draft =
      s.draft ??
      s.query ??
      (s.place?.name
        ? `Tell me about ${s.place.name}${s.place.area ? `, ${s.place.area}` : ''}.`
        : city
          ? `I am thinking about ${city}.`
          : undefined)

    if (!s.send && !draft) return
    seeded.current = true
    navigate(location.pathname, { replace: true, state: null })

    if (s.send) void reply(s.send)
    else if (draft) setDraft(draft)
    // `reply` closes over the thread; seeding must happen once, on arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, health, navigate])

  /** The member's line is already in the thread: repeat the turn, not the bubble. */
  function retry() {
    if (lastSent && !thinking) void reply(lastSent)
  }

  /* ------------------------------------------------------------ dictation -- */

  const Ctor = useMemo(recognitionCtor, [])
  const recognition = useRef<Recognition | null>(null)

  useEffect(() => () => recognition.current?.stop(), [])

  function toggleListening() {
    if (!Ctor) return
    if (listening) {
      recognition.current?.stop()
      setListening(false)
      return
    }
    const r = new Ctor()
    r.lang = navigator.language || 'en-GB'
    r.continuous = false
    r.interimResults = true
    let settled = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i]
        if (result.isFinal) settled += result[0].transcript
        else interim += result[0].transcript
      }
      setDraft((settled + interim).trim())
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognition.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  /* ---------------------------------------------------------------- view -- */

  const opening = chat.length === 0 && health !== undefined
  const first = member?.name.split(' ')[0]

  // Date dividers are drawn when the day actually changes.
  let lastDay = 0

  return (
    <Screen tone="light" tabs>
      {/* The empty room gets one warm wash from above and nothing else. The
          champagne hairline this used to carry was drawn for obsidian; on
          ivory it reads as a stray rule struck through the greeting. */}
      {opening && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0"
          style={{
            height: 420,
            background:
              'radial-gradient(ellipse 85% 100% at 50% 0%, rgba(138,106,58,.10) 0%, rgba(138,106,58,.04) 46%, rgba(138,106,58,0) 100%)',
          }}
        />
      )}

      {/* Header */}
      <header
        className="sticky z-30 flex items-center gap-3 px-4"
        style={{
          top: 0,
          paddingTop: 'max(54px, calc(env(safe-area-inset-top) + 12px))',
          paddingBottom: 12,
          background: 'linear-gradient(180deg, var(--ink-0) 68%, rgba(10,10,11,0) 100%)',
        }}
      >
        <span className="w-11 shrink-0" />
        <div className="min-w-0 flex-1 text-center">
          <AgentMark className="justify-center" />
          <p className="t-caption c-ivory-3 flex items-center justify-center gap-2 truncate">
            {live ? (
              <>
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--champagne)' }}
                />
                Here
              </>
            ) : health === undefined ? (
              'Connecting'
            ) : (
              'Not reachable just now'
            )}
            {openRequest && <span className="t-mono c-ivory-3">· {openRequest.id}</span>}
          </p>
        </div>
        <button
          type="button"
          aria-label="Speak to the Desk"
          onClick={() => navigate('/desk')}
          className="k-icon-btn k-icon-btn-solid shrink-0"
        >
          <Icon name="phone" size={20} />
        </button>
      </header>

      {/* Opening */}
      {opening && (
        <div className="px-6 pt-4">
          <section aria-label="Greeting" className="flex flex-col items-center gap-4 text-center">
            <Horizon size={44} working />
            <div className="flex flex-col gap-1.5">
              <h1 className="t-display-l">
                {first ? (
                  <>
                    {timeOfDay()},
                    <br />
                    <em className="t-italic">{first}.</em>
                  </>
                ) : (
                  `${timeOfDay()}.`
                )}
              </h1>
              <p className="t-body c-ivory-2">Where shall we begin?</p>
              {said ? (
                <p className="t-caption c-ivory-3 mt-3 flex items-start justify-center gap-2 px-2 text-center">
                  <span className="mt-[2px] shrink-0">
                    <Icon name="check" size={13} />
                  </span>
                  {said}
                </p>
              ) : null}
            </div>
          </section>

          <div className="mt-8 flex flex-col gap-4">
            {proposal && (
              <Card raised className="flex flex-col gap-3.5 p-4" style={{ borderRadius: 24 }}>
                <p className="t-caption c-champagne flex items-center gap-1.5">
                  <Icon name="bookmark" size={12} filled />
                  From your saved places
                </p>
                <h2 className="t-title">{proposal.question}</h2>
                {kept.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {kept.slice(0, 6).map((name) => (
                      <li
                        key={name}
                        className="k-chip max-w-full truncate"
                        style={{ height: 30, padding: '0 12px' }}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Btn size="sm" onClick={() => void send(proposal.ask)} disabled={thinking}>
                    Yes, shape it
                  </Btn>
                  <Btn
                    size="sm"
                    tone="ghost"
                    onClick={() => void send('Something else, please.')}
                    disabled={thinking}
                  >
                    Something else
                  </Btn>
                </div>
              </Card>
            )}

            <ul className="flex flex-col gap-2">
              {[
                'A quiet week, somewhere new',
                'Something for the whole family',
                'Where is warm right now?',
              ].map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => void send(starter)}
                    disabled={thinking}
                    className="k-card flex w-full items-center justify-between gap-3 px-5 text-left"
                    style={{ minHeight: 52, borderRadius: 26 }}
                  >
                    <span className="t-body-s">{starter}</span>
                    <span className="c-ivory-3">
                      <Icon name="arrow-up-right" size={16} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="t-caption c-ivory-3 flex items-center justify-center gap-1.5 text-center">
              <Icon name="bookmark" size={14} />
              Tara reads your saved places and your file.
            </p>
          </div>
        </div>
      )}

      {/* The thread */}
      <div className="flex flex-col gap-4 px-6 pt-4" style={{ paddingBottom: 96 }}>
        {chat.map((m) => {
          const day = startOfDay(m.at)
          const divider = day !== lastDay
          lastDay = day

          return (
            <div key={m.id} className="flex flex-col gap-4">
              {divider && (
                <p className="t-caption t-figure c-ivory-3 flex items-center gap-3">
                  <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--line)' }} />
                  {dayLabel(m.at)}, {clock(m.at)}
                  <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--line)' }} />
                </p>
              )}

              {m.role === 'member' ? (
                <p className="k-msg-member whitespace-pre-wrap">{m.text}</p>
              ) : m.role === 'advisor' ? (
                <div className="k-msg-desk">
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className="t-caption mt-2">— The Desk, Bengaluru</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="t-caption flex items-center gap-2">
                    <Horizon size={18} />
                    Tara
                  </p>
                  <p
                    className="k-msg-concierge whitespace-pre-wrap"
                    style={m.failed ? { color: 'var(--amber)' } : undefined}
                  >
                    {m.text}
                  </p>

                  {m.failed && lastSent && (
                    <button
                      type="button"
                      onClick={retry}
                      disabled={thinking}
                      className="k-link k-link-champagne self-start"
                      style={{ minHeight: 44 }}
                    >
                      <Icon name="refresh" size={16} />
                      Try that again
                    </button>
                  )}

                  {m.release && (
                    <Card raised className="mt-1 flex flex-col gap-3 p-4" style={{ borderRadius: 24 }}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="t-mono c-champagne">{m.release.version}</p>
                        <Icon name="check-circle" size={18} className="c-ivory-3" />
                      </div>
                      <p className="t-display-s">{m.release.title}</p>
                      <Btn block onClick={() => navigate('/journeys')} iconAfter="forward">
                        Open it
                      </Btn>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Working — Tara's signature moment */}
        {thinking && activity && !partial && (
          <div aria-busy="true" className="k-card-raised flex flex-col gap-4 p-[18px]" style={{ borderRadius: 24 }}>
            <div className="flex items-center gap-3">
              <span
                className="k-breathe inline-flex items-center justify-center rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  color: 'var(--champagne)',
                  background: 'var(--champagne-3)',
                  border: '1px solid var(--champagne-line)',
                }}
              >
                <Icon name="horizon" size={20} strokeWidth={1.6} />
              </span>
              <h2 className="t-title min-w-0 flex-1">{activity}</h2>
              <span className="t-mono c-ivory-3" aria-label={`${elapsed} seconds so far`}>
                {mmss(elapsed)}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="k-track relative block" aria-hidden="true">
                <span className="k-sweep absolute inset-0" />
              </span>
              <p className="t-caption">Usually under two minutes</p>
            </div>
            <div className="flex items-center justify-end pt-1" style={{ borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => navigate('/journeys')}
                className="k-link c-ivory-2"
                style={{ minHeight: 44 }}
              >
                Leave — I&rsquo;ll tell you when it&rsquo;s ready
                <Icon name="forward" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Speaking */}
        {thinking && !activity && (
          <div className="flex flex-col gap-2">
            <p className="t-caption flex items-center gap-2">
              <Horizon size={18} working />
              Tara
            </p>
            {partial ? (
              <p className="k-msg-concierge whitespace-pre-wrap">
                {partial}
                <span
                  aria-hidden="true"
                  className="ml-1 inline-block align-[-2px]"
                  style={{ width: 2, height: 18, background: 'var(--champagne)' }}
                />
              </p>
            ) : (
              <span className="flex flex-col gap-2.5" aria-live="polite">
                <span className="t-body-s c-ivory-2">{thinkingWord}…</span>
                <span className="k-track relative block w-24" aria-label="Thinking">
                  <span className="k-sweep absolute inset-0" />
                </span>
              </span>
            )}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div
        /* Chrome, like the tab bar: obsidian on either ground. */
        className="k-dark fixed z-40"
        style={{
          left: 'max(16px, calc(50% - 224px))',
          right: 'max(16px, calc(50% - 224px))',
          bottom: 'calc(max(20px, env(safe-area-inset-bottom)) + 76px)',
          background: 'transparent',
        }}
      >
        <form
          className="k-composer"
          style={{ padding: '0 8px' }}
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
        >
          {Ctor && (
            <button
              type="button"
              aria-label={listening ? 'Stop dictation' : 'Dictate your message'}
              aria-pressed={listening}
              onClick={toggleListening}
              className="k-icon-btn"
              style={{
                background: 'transparent',
                borderColor: 'transparent',
                color: listening ? 'var(--champagne)' : 'var(--ivory-2)',
              }}
            >
              <Icon name={listening ? 'waveform' : 'mic'} size={20} />
            </button>
          )}
          <label htmlFor="concierge-ask" className="sr-only">
            Ask Tara
          </label>
          <input
            id="concierge-ask"
            type="text"
            placeholder="Ask Tara…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ height: 44, fontSize: 16, lineHeight: '24px', color: 'var(--ivory)', paddingLeft: Ctor ? 0 : 6 }}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || thinking}
            className="inline-flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              background: draft.trim() && !thinking ? 'var(--ivory)' : 'var(--ink-4)',
              color: draft.trim() && !thinking ? 'var(--ink-0)' : 'var(--ivory-3)',
            }}
          >
            <Icon name="send" size={20} />
          </button>
        </form>

        {import.meta.env.DEV ? (
          <div className="mt-2 flex items-center justify-between px-2">
            <span className="t-mono c-ivory-3">
              {live ? 'Agent · memory on' : 'On-device stand-in · no memory'}
            </span>
            <span className="t-mono c-ivory-3">
              {live
                ? health?.researchReady
                  ? 'Research on'
                  : 'Research off'
                : 'Start the backend to go live'}
            </span>
          </div>
        ) : (
          !live &&
          health !== undefined && (
            <p className="t-caption c-ivory-3 mt-2 text-center">
              Tara is not reachable from this device just now.
            </p>
          )
        )}
      </div>
    </Screen>
  )
}
