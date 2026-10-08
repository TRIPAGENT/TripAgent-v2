import { planLinks, withoutPlanLinks } from './planLinks'
import type { ChatMessage } from '@/lib/types'
import { msg } from '@/lib/concierge'

/**
 * Client for the TripAgent backend (Chatbot_v1/tripagent).
 *
 * Locally everything goes through the app's own origin under /agent (see the
 * proxy in vite.config.ts). Deployed, VITE_AGENT_URL points at the agent's own
 * https address and the agent allows this app's origin. The backend owns the
 * voice, the memory, the plan pages and the Desk; this module translates its
 * wire shape into the app's model.
 *
 * Every member call carries the signed session issued at the door. The server
 * reads who the member is from that, never from anything the app claims.
 */

export const BASE = ((import.meta.env.VITE_AGENT_URL as string | undefined) || '/agent').replace(/\/$/, '')

/* ---------------------------------------------------------------- session --- */

const SESSION_KEY = 'tripagent:session'

interface Session {
  token: string
  expiresAt: string
}

function readSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null
    return s && Date.parse(s.expiresAt) > Date.now() ? s : null
  } catch {
    return null
  }
}

export const hasSession = () => readSession() !== null
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* private mode */
  }
}

/** Fired when the server says the session is over, so the app returns to the door. */
export const SIGNED_OUT_EVENT = 'tripagent:signed-out'

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const s = readSession()
  if (!s) {
    clearSession()
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    throw new AgentError('Sign in again to view your saved chat. Accepted itinerary work continues in the background.', false)
  }
  return { ...extra, Authorization: `Bearer ${s.token}` }
}

async function sessionFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const sent = new Headers(init.headers).get('Authorization')?.replace(/^Bearer /, '')
  const res = await fetch(input, init)
  // A stale request must not sign out a newly signed-in member.
  if (res.status === 401 && sent === readSession()?.token) {
    clearSession()
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
  }
  return res
}

export interface SessionMember {
  code: string
  name: string
  tier: import('./types').MemberTier
  phoneMasked?: string
  directives?: string
}

/**
 * The door. The code is checked by the server against the member registry; the
 * app holds no list of members. Fails closed, including when the Desk is
 * unreachable: nobody is let in on the strength of a client-side check.
 */
export async function signInWithCode(code: string): Promise<SessionMember> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new AgentError('We cannot reach the Desk from this device. Check the connection and try again.')
  }
  const body = (await res.json().catch(() => ({}))) as { member?: SessionMember; token?: string; expiresAt?: string | number; error?: string }
  if (!res.ok || !body.member || !body.token || !body.expiresAt) {
    throw new AgentError(body.error ?? 'We could not open the door just now. Try again in a moment.', res.status !== 401)
  }
  // The Node agent sends the expiry as an ISO date; the Python agent as epoch milliseconds. Keep ISO.
  const expiresAt = typeof body.expiresAt === 'number' ? new Date(body.expiresAt).toISOString() : body.expiresAt
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: body.token, expiresAt }))
  return body.member
}

/** Is the stored session still good? `null` means the Desk could not be asked. */
export async function checkSession(): Promise<SessionMember | false | null> {
  if (!readSession()) return false
  try {
    const res = await sessionFetch(`${BASE}/api/session`, { headers: authHeaders(), signal: AbortSignal.timeout(6_000) })
    if (res.status === 401) {
      return false
    }
    if (!res.ok) return null
    return ((await res.json()) as { member: SessionMember }).member
  } catch {
    return null
  }
}

export interface AgentHealth {
  ok: boolean
  modelReady: boolean
  researchReady: boolean
}

/** A turn can legitimately take a long time: up to 6 tool steps behind one reply. */
const TURN_TIMEOUT_MS = 190_000
const HEALTH_TIMEOUT_MS = 4_000

export async function agentHealth(): Promise<AgentHealth | null> {
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = (await res.json()) as Partial<AgentHealth>
    return {
      ok: Boolean(body.ok),
      modelReady: Boolean(body.modelReady),
      researchReady: Boolean(body.researchReady),
    }
  } catch {
    return null
  }
}

export class AgentError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'AgentError'
    this.retryable = retryable
  }
}

interface ChatResponse {
  messages?: string[]
  error?: string
}

export async function sendToAgent(message: string): Promise<ChatMessage[]> {
  let res: Response
  try {
    res = await sessionFetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new AgentError(
      timedOut
        ? 'Tara took too long to answer. Send that again when you are ready.'
        : 'Tara is not reachable from this device right now.',
    )
  }

  let body: ChatResponse = {}
  try {
    body = (await res.json()) as ChatResponse
  } catch {
    /* fall through to the status handling below */
  }

  if (!res.ok) {
    // 503 means no model key configured; retrying will not help until that is fixed.
    throw new AgentError(body.error ?? 'Tara could not complete that turn.', res.status !== 503)
  }

  const parts = (body.messages ?? []).map((m) => m.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new AgentError('Tara returned an empty reply.')
  }

  return toChatMessages(parts)
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; messages: string[]; cost?: number }
  | { type: 'error'; message: string }

/**
 * What each tool is called while the traveller is waiting on it.
 *
 * Said the way a person at a desk would say it, not the way the system works.
 * Each one still describes what is actually happening — a member waiting two
 * minutes deserves to know it is reading sources rather than inventing.
 */
const TOOL_LABELS: Record<string, string> = {
  resuming_plan: 'Recovering your itinerary',
  build_trip_plan: 'Creating your itinerary',
  search_travel_prices: 'Checking published travel prices',
  build_comparison: 'Laying them side by side',
  get_plan: 'Opening your itinerary',
  web_search: 'Looking it up',
  read_page: 'Reading the source',
  search_memory: 'Checking your file',
  read_memory: 'Checking your file',
  memory_history: 'Looking back through your file',
  where_to_go: 'Finding the season’s best escapes',
  find_destination: 'Exploring places for your journey',
  get_destination_guide: 'Opening the destination guide',
  search_hotel_rates: 'Checking stays for your dates',
  todo_update: 'Updating your travel notes',
  todo_add: 'Noting that down',
  todo_list: 'Checking what is still open',
  todo_done: 'Closing that off',
}

export const labelForTool = (name: string) => TOOL_LABELS[name] ?? 'Working'

/**
 * Streams a turn. A plan build runs well over a minute, so the caller gets text
 * deltas and tool names as they happen rather than a dead screen.
 *
 * The final `done` event carries the same `messages` array the non-streaming
 * route returns, so both paths converge on one shape.
 */
export async function streamFromAgent(
  message: string,
  onEvent: (e: StreamEvent) => void,
): Promise<ChatMessage[]> {
  let res: Response
  try {
    res = await sessionFetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new AgentError(
      timedOut
        ? 'Tara took too long to answer. Send that again when you are ready.'
        : 'Tara is not reachable from this device right now.',
    )
  }

  if (!res.ok || !res.body) {
    let error: string | undefined
    try {
      error = ((await res.json()) as ChatResponse).error
    } catch {
      /* no body */
    }
    throw new AgentError(error ?? 'Tara could not complete that turn.', res.status !== 503)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalMessages: string[] | null = null
  let failure: string | null = null

  // SSE frames are separated by a blank line and can split across chunks, so the
  // buffer is only drained up to the last complete frame.
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      let event: StreamEvent
      try {
        event = JSON.parse(line.slice(5).trim()) as StreamEvent
      } catch {
        continue
      }
      if (event.type === 'done') finalMessages = event.messages
      else if (event.type === 'error') failure = event.message
      onEvent(event)
    }
  }

  if (failure) throw new AgentError(failure)
  if (!finalMessages || finalMessages.length === 0) {
    throw new AgentError('Tara returned an empty reply.')
  }
  return toChatMessages(finalMessages.map((m) => m.trim()).filter(Boolean))
}

/** Recognise bare, Markdown and inline itinerary links, without swallowing other links. */
export function toChatMessages(parts: string[]): ChatMessage[] {
  const out: ChatMessage[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const links = planLinks(part)
    if (!links.length) { out.push(msg('ai', part)); continue }
    const text = withoutPlanLinks(part)
    for (const link of links) {
      if (seen.has(link.key)) continue
      seen.add(link.key)
      out.push(msg('ai', text || 'Your itinerary is ready.', {
        release: { version: planVersionFrom(link.url), title: planTitleFrom(text) }, planUrl: link.url,
      }))
    }
  }
  return out
}

/** The page key is opaque; show a short stable stub so revisions are distinguishable. */
function planVersionFrom(url: string): string {
  const key = url.split('/').filter(Boolean).at(-1) ?? ''
  return key ? `Ref ${key.slice(0, 6).toUpperCase()}` : 'Plan'
}

/**
 * The introduction is already shown as its own message, so the card carries a short
 * neutral label instead of repeating it. Only the shape of the artefact differs
 * between the two page types, and the agent's wording is enough to tell them apart.
 */
function planTitleFrom(intro: string): string {
  return /\b(option|options|compare|comparison|side by side)\b/i.test(intro)
    ? 'Your options, compared'
    : 'Your itinerary'
}

/* ------------------------------------------------------------------ trips --- */

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await sessionFetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new AgentError('The Desk is not reachable from this device right now.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new AgentError(body.error ?? 'The Desk could not find that.', res.status >= 500)
  }
  return (await res.json()) as T
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await sessionFetch(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new AgentError('The Desk is not reachable from this device right now. Nothing was sent.')
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new AgentError(json.error ?? 'The Desk could not take that just now. Nothing was sent.', res.status >= 500)
  return json
}

/** The member's swaps on an itinerary, as saved by the Itinerary screen. */
export function savedChoices(key: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(`tripagent:choices:${key}`) ?? '{}')
  } catch {
    return {}
  }
}

/** The page key is the last segment of a plan URL. */
export const planKeyOf = (url: string) => url.split('/').filter(Boolean).at(-1) ?? ''

export const fetchPlan = (key: string) => getJson<import('./plan').PlanBundle>(`${BASE}/api/plan/${key}`)

export const fetchTrips = () =>
  getJson<{ trips: import('./plan').TripSummary[] }>(`${BASE}/api/trips`).then((r) => r.trips)

export const fetchDue = (window: 'day' | 'week' | 'month' = 'month') =>
  getJson<{ nudges: import('./plan').Nudge[] }>(`${BASE}/api/trips/due?window=${window}`).then((r) => r.nudges)

/**
 * A member may move a trip between proposed and requested. Booked, and what
 * follows, is set by the Desk once the payment is seen.
 */
export async function setTripStatus(planId: string, status: 'proposed' | 'requested', choices?: Record<string, number>) {
  try {
    await postJson(`${BASE}/api/trips/status`, { planId, status, ...(choices ? { choices } : {}) })
  } catch {
    /* the calendar catches up the next time a request is filed */
  }
}

/* --------------------------------------------------------------- the Desk --- */

export type DeskRequest = import('./desk').DeskRequest
export type NewDeskRequest = import('./desk').NewDeskRequest

export const fetchRequests = () =>
  getJson<{ requests: DeskRequest[] }>(`${BASE}/api/requests`).then((r) => r.requests)

export const fileRequest = (input: NewDeskRequest) =>
  postJson<{ request: DeskRequest }>(`${BASE}/api/requests`, input).then((r) => r.request)

export const requestAction = (id: string, action: 'cancel' | 'paid') =>
  postJson<{ request: DeskRequest }>(`${BASE}/api/requests/${id}/${action}`).then((r) => r.request)
export const validatedPayment = (id: string) => getJson<{ url: string; total: number; currency: string; releasedAt?: string }>(`${BASE}/api/requests/${id}/payment`)

/* ------------------------------------------------------------------ hotels --- */

export interface HotelRate {
  id: string
  name: string
  address?: string
  stars?: number
  image?: string
  total: number | null
  perNight: number | null
  currency: string
  refundable?: boolean
  boardBasis?: string
}

export type RatesResult =
  | { ok: true; checkedAt: string; hotels: HotelRate[] }
  | { ok: false; reason: 'not-configured' | 'not-allowed' | 'rejected' | 'unreachable' | 'offline' }

/** Live rates from Tripsure, the only price a member can pay. */
export async function fetchHotelRates(q: { city: string; checkIn: string; checkOut: string; adults: number; rooms?: number }): Promise<RatesResult> {
  const qs = new URLSearchParams({ city: q.city, checkIn: q.checkIn, checkOut: q.checkOut, adults: String(q.adults), rooms: String(q.rooms ?? 1) })
  try {
    return await getJson<RatesResult>(`${BASE}/api/hotels/rates?${qs}`)
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

/* --------------------------------------------------------- asking to join --- */

/**
 * Ask the Desk for an invitation.
 *
 * The only call this app makes without a session. It records an ask and returns
 * nothing about the person: whether an address is already on the list is not
 * something a stranger should be able to probe for, so the answer reads the same
 * either way. No code is issued here — a person at the Desk decides.
 */
export async function requestAccess(input: {
  name: string
  email: string
  phone: string
  note?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/access-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return { ok: false, error: 'We could not reach the Desk just now. Try again in a moment.' }
  }
  if (res.ok) return { ok: true }
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return {
    ok: false,
    error: body?.error ?? 'That did not go through. Check the details and try again.',
  }
}

/* --------------------------------------------------------- place photos --- */

export interface PlacePhoto {
  url: string
  attribution: string
  placeName: string
  googleMapsUri?: string
  authors?: { name: string; uri?: string }[]
}

/**
 * A photograph of a named place, resolved by the agent.
 *
 * The key stays on the server; this gets back a signed URL and the attribution
 * Google requires us to show. A miss is an ordinary answer — the caller falls
 * back to the house's own photography — so this never throws and never blocks
 * anything a member is looking at.
 */
export async function fetchPlacePhoto(q: string, width = 1200, expectedName?: string): Promise<PlacePhoto | null> {
  return (await fetchPlacePhotos(q, width, expectedName, 1))[0] ?? null
}
export async function fetchPlacePhotos(q: string, width = 1200, expectedName?: string, count = 4): Promise<PlacePhoto[]> {
  try {
    const res = await sessionFetch(`${BASE}/api/place-photo?q=${encodeURIComponent(q)}&w=${width}&count=${count}${expectedName ? `&name=${encodeURIComponent(expectedName)}` : ''}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(22_000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { photo?: PlacePhoto | null; photos?: PlacePhoto[] }
    return body.photos ?? (body.photo ? [body.photo] : [])
  } catch {
    return []
  }
}


export interface ChatJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  updatedAt: string
  activity: string | null
  partial: string
  error?: string
  messages: { id: string; text: string; state: 'queued' | 'running' | 'completed' | 'failed'; replies: string[] }[]
}
async function jobRequest(path: string, body?: { message: string; requestId: string }): Promise<ChatJob | null> {
  const res = await sessionFetch(`${BASE}${path}`, { method: body ? 'POST' : 'GET', headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) })
  const data = await res.json().catch(() => ({})) as { job?: ChatJob; error?: string }
  if (!res.ok) throw new AgentError(data.error ?? 'Tara’s progress could not be reached. Try again shortly.')
  return data.job ?? null
}
export const currentChatJob = () => jobRequest('/api/chat/jobs/current')
export const submitChatJob = (message: string, requestId: string) => jobRequest('/api/chat/jobs', { message, requestId })

export interface AccountState {
  prefs: import('@/context/store').Preferences
  wishlist: string[]
  itinerary: string[]
  activeCity: string
  components: import('./types').BookingComponent[]
  plan: { url: string; title: string; at: number } | null
  booking: { key: string; planId: string; title: string } | null
  choices: Record<string, Record<string, number>>
}
export const fetchAccountState = () => getJson<{ state: Partial<AccountState> }>(`${BASE}/api/member-state`).then(r => r.state)
export const saveAccountState = (patch: Partial<AccountState>) => postJson(`${BASE}/api/member-state`, patch)
export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const { messages } = await getJson<{ messages: { id: string; role: string; content: string; at?: number; parts?: string[] }[] }>(`${BASE}/api/history`)
  return messages.flatMap(m => m.role === 'user'
    ? [msg('member', m.content, { id: m.id, at: m.at ?? 0, delivery: 'received' })]
    : m.role === 'assistant' ? toChatMessages(m.parts ?? [m.content]).map((reply, i) => ({ ...reply, id: `${m.id}-${i}`, at: m.at ?? 0 })) : [])
}

export interface WhatsAppStatus {
  enabled: boolean
  linked: boolean
  phoneMasked: string | null
  chatUrl: string | null
}
export const fetchWhatsAppStatus = () => getJson<WhatsAppStatus>(`${BASE}/api/whatsapp`)
export const connectWhatsApp = (phone: string) => postJson<{ url: string; expiresAt: string }>(`${BASE}/api/whatsapp/link`, { phone })
export const disconnectWhatsApp = () => postJson<{ ok: true }>(`${BASE}/api/whatsapp/unlink`)

export const cancelWhatsAppLink = () => postJson<{ ok: true }>(`${BASE}/api/whatsapp/link/cancel`)
