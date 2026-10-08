/*
 * KEPT FOR REFERENCE, NOT ROUTED. This is the Tara chat screen as it was built and designed on this
 * machine. The app's /concierge route now renders the chatbot-fe chat (src/chatbot-fe), with this
 * screen's design and behaviour applied on top of it. Re-enable it in src/App.tsx if ever needed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useChatRuntime } from '@/context/chatRuntime'
import { CHAT_SUGGESTIONS, addSuggestionToDraft } from '@/lib/chatSuggestions'
import { planKeyFrom } from '@/lib/planLinks'
import { Screen } from '@/components/Shell'
import { AgentMark, BackButton, Btn, Card, Horizon, Icon } from '@/components/ui'
import { useStore, type Preferences } from '@/context/store'
import { useThinkingWord } from '@/lib/useThinking'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { parseItemKey } from '@/lib/itinerary'
import { greeting, msg, respond } from '@/lib/concierge'
import { clock } from '@/lib/format'
import { MeshBackdrop } from '@/components/mesh/MeshBackdrop'
import { TARA_COLORS, TARA_TUNING } from '@/components/mesh/presets'
import {
  AgentError,
  agentHealth,
  labelForTool,
  toChatMessages,
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
    member, chat, pushChat, activeCity, requests, wishlist, itinerary, prefs,
  } = useStore()
  const displayChat = useMemo(() => chat.flatMap(m => m.role === 'ai' && !m.release ? toChatMessages([m.text]).map((parsed, i) => ({ ...m, ...parsed, id: `${m.id}-display-${i}`, at: m.at, failed: m.failed })) : [m]), [chat])
  const openRequest = requests.find((r) => !['closed', 'cancelled'].includes(r.status)) ?? null
  const said = fileLine(prefs)

  const [draft, setDraft] = useState('')
  const runtime = useChatRuntime()
  const [localThinking, setLocalThinking] = useState(false)
  const thinking = localThinking || runtime.submitting || runtime.job?.status === 'running'
  const [health, setHealth] = useState<AgentHealth | null | undefined>(undefined)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const partial = runtime.job?.status === 'running' ? runtime.job.partial : ''
  const activity = runtime.job?.status === 'running' && runtime.job.activity ? labelForTool(runtime.job.activity) : null
  // Rotating language of the work, so a long build never reads as a hang.
  const thinkingWord = useThinkingWord(thinking && !partial)
  /** Real seconds since this turn began, for the working card. */
  const [elapsed, setElapsed] = useState(0)
  const [listening, setListening] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLInputElement>(null)
  const currentMember = useRef(member?.code)
  currentMember.current = member?.code
  useEffect(() => {
    currentMember.current = member?.code
    return () => { currentMember.current = undefined }
  }, [member?.code])
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
    const started = runtime.job?.startedAt ? Date.parse(runtime.job.startedAt) : Date.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [thinking, runtime.job?.startedAt])

  /**
   * The live Tara is the TripAgent backend: it owns the voice, the member's
   * memory and the plan pages. When it is not reachable — no server, no API key —
   * we fall back to the on-device stand-in so the app is still usable, and the
   * screen says which one is answering. We never present the stand-in as the
   * Tara.
   */
  const reply = useCallback(async (body: string) => {
    const code = member?.code
    setLastSent(body)
    if (live || runtime.job?.status === 'running') {
      try { await runtime.submit(body) }
      catch (error) { if (currentMember.current === code) pushChat(msg('ai', error instanceof Error ? error.message : 'Tara could not receive that message.', { failed: true })) }
      return
    }
    setLocalThinking(true)
    try {
      const fresh = await agentHealth()
      if (currentMember.current !== code) return
      setHealth(fresh)
      if (fresh?.ok && fresh.modelReady) await runtime.submit(body)
      else {
        pushChat(msg('member', body))
        respond(body, city, chat.filter(m => m.role === 'member').length).forEach(pushChat)
      }
    } catch (error) { if (currentMember.current === code) pushChat(msg('ai', error instanceof AgentError ? error.message : 'Tara could not receive that message.', { failed: true })) }
    finally { if (currentMember.current === code) setLocalThinking(false) }
  }, [live, runtime, pushChat, city, chat, member?.code])

  const send = useCallback(async (text: string) => {
    const body = text.trim()
    if (!body || runtime.submitting) return
    setDraft('')
    await reply(body)
  }, [reply, runtime.submitting])

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
    <Screen tone="dark" tabs={false} flush className="isolate k-chat-dark">
      <MeshBackdrop
        id="tara-mesh"
        colors={TARA_COLORS}
        tuning={TARA_TUNING}
        fallback="radial-gradient(75% 40% at 85% 12%, rgba(83,102,122,.7) 0%, rgba(83,102,122,0) 70%), radial-gradient(85% 40% at 40% 50%, rgba(154,90,48,.7) 0%, rgba(154,90,48,0) 70%), #080605"
      />
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
        }}
      >
        {/* Frosted glass: messages blur and fade out beneath the header instead
            of running through the title. A separate layer, so the buttons and
            title are not masked with it. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0"
          style={{
            zIndex: -1,
            bottom: -20,
            background: 'linear-gradient(180deg, rgba(8,6,5,.50) 0%, rgba(8,6,5,.38) 60%, rgba(8,6,5,0) 100%)',
            backdropFilter: 'blur(20px) saturate(1.15)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.15)',
            maskImage: 'linear-gradient(180deg, #000 0%, #000 66%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 66%, transparent 100%)',
          }}
        />
        <BackButton solid onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))} />
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
        {displayChat.map((m, index) => {
          const day = startOfDay(m.at)
          const divider = day !== lastDay
          lastDay = day
          // Tara is named once, above the first bubble of a run of replies.
          const firstOfRun = divider || displayChat[index - 1]?.role !== 'ai'

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
                <div className="flex flex-col items-end gap-1.5">
                  <p className="k-msg-member whitespace-pre-wrap">{m.text}</p>
                  {m.delivery === 'unconfirmed' && <button type="button" className="k-link t-caption" style={{ minHeight: 44 }} onClick={() => { setDraft(m.text); composerRef.current?.focus() }}>Review and resend</button>}
                </div>
              ) : m.role === 'advisor' ? (
                <div className="k-msg-desk">
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className="t-caption mt-2">— The Desk, Bengaluru</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {firstOfRun && (
                    <p className="t-caption flex items-center gap-2">
                      <Horizon size={18} />
                      Tara
                    </p>
                  )}
                  <p
                    className="k-msg-concierge whitespace-pre-wrap"
                    style={m.failed ? { color: '#F2B879' } : undefined}
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
                      <Link className="k-btn k-btn-primary k-btn-block" to={m.planUrl && planKeyFrom(m.planUrl) ? `/journeys/${planKeyFrom(m.planUrl)}` : '/journeys'}>
                        View your itinerary <Icon name="forward" size={18} />
                      </Link>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {runtime.connectionIssue && <p role="status" className="t-caption">Reconnecting to Tara’s progress. Any request already accepted continues in the background.</p>}
        {thinking && <div role="status" className="k-card p-4 flex flex-col gap-2">
          <p className="t-body-s">{runtime.job?.activity?.startsWith('build_')
            ? 'I’m putting your journey together. This usually takes about two minutes. Add anything else here; I’ll pick it up once this version is ready.'
            : 'I’m working on your reply. You can add another message while I do.'}</p>
          {(runtime.job?.messages.filter(m => m.state === 'queued').length ?? 0) > 0 && <p className="t-caption">Your added messages are received and will be answered in order.</p>}
        </div>}

        {runtime.job?.status === 'failed' && runtime.job.messages.filter(m => m.state === 'failed').map(turn => <button key={turn.id} type="button" className="k-link text-left" disabled={runtime.submitting} onClick={() => setDraft(turn.text)}>Review unsent reply: {turn.text.slice(0, 90)}</button>)}

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
              <p className="t-body-s c-ivory-2">{thinkingWord}</p>
              <p className="t-caption">{elapsed >= 60 ? 'Still working on your reply. Thank you for staying with me.' : 'Take a moment. I’m here with your journey.'}</p>
            </div>
            <div className="flex items-center justify-end pt-1" style={{ borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => navigate('/journeys')}
                className="k-link c-ivory-2"
                style={{ minHeight: 44 }}
              >
                View your journeys
                <Icon name="forward" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Speaking */}
        {thinking && !activity && (
          <div className="flex flex-col gap-2">
            {displayChat[displayChat.length - 1]?.role !== 'ai' && (
              <p className="t-caption flex items-center gap-2">
                <Horizon size={18} working />
                Tara
              </p>
            )}
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
              <span className="flex flex-col gap-2.5" role="status" aria-label="Tara is preparing your reply">
                <span className="t-body-s c-ivory-2" aria-hidden="true">{thinkingWord}</span>
                <span className="k-track relative block w-24" aria-label="Thinking">
                  <span className="k-sweep absolute inset-0" />
                </span>
              </span>
            )}
          </div>
        )}

        {!thinking && displayChat.some(message => message.role === 'ai' && !message.failed) && <section aria-label="Explore travel options" className="flex flex-col gap-2.5 pt-3">
          <p className="t-caption c-ivory-3">Explore with Tara</p>
          {/* One line, scrolling sideways; bleeds to the screen edges so the next chip is seen to continue. */}
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6" style={{ scrollbarWidth: 'none' }}>
            {CHAT_SUGGESTIONS.map(suggestion => <button key={suggestion.label} type="button" className="k-chip shrink-0" style={{ height: 28, padding: '0 12px' }} onClick={() => {
              setDraft(current => addSuggestionToDraft(current, suggestion.prompt)); composerRef.current?.focus()
            }}>{suggestion.label}<Icon name="arrow-up-right" size={14} /></button>)}
          </div>
        </section>}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div
        /* Chrome: obsidian on either ground. The tab bar is hidden in this room, so the composer sits at the bottom edge. */
        className="k-dark fixed z-40"
        style={{
          left: 'max(16px, calc(50% - 199px))',
          right: 'max(16px, calc(50% - 199px))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
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
                background: listening ? 'var(--champagne)' : '#D6D6DA',
                borderColor: 'transparent',
                color: '#1B1B1E',
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
            ref={composerRef}
            type="text"
            placeholder={thinking ? "Anything to add to your journey?" : "Ask Tara…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ height: 44, fontSize: 16, lineHeight: '24px', color: 'var(--ivory)', paddingLeft: Ctor ? 0 : 6 }}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || runtime.submitting}
            className="inline-flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              background: '#D6D6DA',
              color: '#1B1B1E',
              opacity: draft.trim() && !runtime.submitting ? 1 : 0.5,
            }}
          >
            <Icon name="send" size={20} />
          </button>
        </form>

        {!live && health !== undefined && (
          <p className="t-caption c-ivory-3 mt-2 text-center">
            Tara is not reachable from this device just now.
          </p>
        )}
      </div>
    </Screen>
  )
}
