import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react'
import type { BookingComponent, ChatMessage, Member } from '@/lib/types'
import { load, save, clearAll } from '@/lib/storage'
import { checkSession, clearSession, fetchRequests, hasSession, SIGNED_OUT_EVENT, fetchAccountState, saveAccountState, fetchChatHistory, type AccountState } from '@/lib/agentClient'
import type { DeskRequest } from '@/lib/desk'

/**
 * A persona, not a trip. Every field here is meant to hold for years and shape
 * every journey we draw; the one per-trip figure, `party`, stays only as a
 * default the booking form may override. Fields are optional and read loosely:
 * a member carrying older stored data simply reads as unanswered.
 */
/**
 * The member's standing travel profile.
 *
 * These describe the traveller, not a trip: they are asked once, they hold
 * across every journey, and their job is to make a suggestion right before a
 * member has said anything. Nothing here is a booking detail — a trip's own
 * dates, party and budget are asked for on the request that needs them.
 */
export interface Preferences {
  /** What travel is for. The motive that repeats. */
  purpose?: 'restoration' | 'discovery' | 'people' | 'rare'
  /** The landscape a member gravitates to. The strongest destination signal. */
  terrain?: 'coast' | 'mountain' | 'city' | 'wild'
  /** Who is usually along. Sets the default party, and shapes what we suggest. */
  company?: 'alone' | 'partner' | 'family' | 'friends'
  /** How full their days usually run. */
  pace?: 'unhurried' | 'balanced' | 'full'
  /** Where the night settles. */
  lodging?: 'sanctuary' | 'grand' | 'ultra' | 'private'
  /** Default party size, derived from `company` and overridable per request. */
  party?: number
  completed: boolean
}

/** The party a given company usually implies, used only as a starting number. */
export const PARTY_FOR: Record<string, number> = {
  alone: 1,
  partner: 2,
  family: 4,
  friends: 4,
}

const EMPTY_PREFS: Preferences = { party: 2, completed: false }

interface Store {
  choices: AccountState['choices']
  setChoices: (key: string, choices: Record<string, number>) => void
  member: Member | null
  signIn: (member: Member) => void
  signOut: () => void

  prefs: Preferences
  setPrefs: (p: Preferences) => void

  /** Saved cities and guide entries, keyed `city:<slug>` or `item:<slug>/<name>`. */
  wishlist: string[]
  toggleSaved: (key: string) => void
  isSaved: (key: string) => boolean

  /** Guide entries pulled into the working itinerary, keyed `<slug>/<name>`. */
  itinerary: string[]
  addToItinerary: (id: string) => void
  removeFromItinerary: (id: string) => void

  activeCity: string
  setActiveCity: (slug: string) => void

  components: BookingComponent[]
  setComponents: (c: BookingComponent[]) => void

  /** Everything the member has asked the desk to do, as the desk holds it. */
  requests: DeskRequest[]
  refreshRequests: () => Promise<DeskRequest[]>

  /** The plan a booking request was raised for — carried through to settlement. */
  booking: { key: string; planId: string; title: string } | null
  setBooking: (b: { key: string; planId: string; title: string } | null) => void

  /** The most recent plan page the desk built, shown inside the Planner. */
  plan: { url: string; title: string; at: number } | null
  setPlan: (p: { url: string; title: string; at: number } | null) => void

  chat: ChatMessage[]
  pushChat: (m: ChatMessage) => void
  resetChat: () => void
}

const StoreContext = createContext<Store | null>(null)

const emptyAccount = (): AccountState => ({ prefs: { ...EMPTY_PREFS }, wishlist: [], itinerary: [], activeCity: 'tokyo', components: [], plan: null, booking: null, choices: {} })
interface AccountCache { state: AccountState; pending: Partial<AccountState>; chat: ChatMessage[] }
const cacheKey = (code: string) => `account:${code}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(() => load<Member | null>('member', null))
  const [account, setAccount] = useState<AccountState>(emptyAccount)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [requests, setRequests] = useState<DeskRequest[]>([])
  const [ready, setReady] = useState(false)
  const [restoreError, setRestoreError] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const owner = useRef(member?.code)
  owner.current = member?.code
  const cacheOwner = useRef<string | undefined>(undefined)
  const current = useRef<AccountCache>({ state: emptyAccount(), pending: {}, chat: [] })
  const syncing = useRef(false)
  const generation = useRef(0)
  const persist = useCallback(() => {
    if (owner.current && cacheOwner.current === owner.current) save(cacheKey(owner.current), current.current)
  }, [])
  const flush = useCallback(async () => {
    const code = owner.current
    const gen = generation.current
    if (!code || syncing.current) return
    syncing.current = true
    try {
      while (owner.current === code && generation.current === gen && Object.keys(current.current.pending).length) {
        const patch = { ...current.current.pending }
        await saveAccountState(patch)
        if (owner.current !== code || generation.current !== gen) return
        for (const key of Object.keys(patch) as (keyof AccountState)[]) {
          if (current.current.pending[key] === patch[key]) delete current.current.pending[key]
        }
        persist()
      }
      if (generation.current === gen) setSyncError(false)
    } catch { if (generation.current === gen) setSyncError(true) }
    finally { if (generation.current === gen) syncing.current = false }
  }, [persist])
  const update = useCallback((patch: Partial<AccountState>) => {
    patch = Object.fromEntries(Object.entries(patch).filter(([key, value]) => JSON.stringify(current.current.state[key as keyof AccountState]) !== JSON.stringify(value)))
    if (!Object.keys(patch).length) return
    current.current.state = { ...current.current.state, ...patch }
    current.current.pending = { ...current.current.pending, ...patch }
    setAccount(current.current.state)
    persist()
    void flush()
  }, [flush, persist])
  const signIn = useCallback((m: Member) => {
    owner.current = m.code
    setReady(false)
    setMember(m)
    save('member', m)
  }, [])
  const signOut = useCallback(() => {
    persist()
    owner.current = undefined
    cacheOwner.current = undefined
    generation.current += 1
    syncing.current = false
    clearAll()
    clearSession()
    setMember(null)
    setReady(false)
    setAccount(emptyAccount())
    setRequests([])
    setChat([])
    current.current = { state: emptyAccount(), pending: {}, chat: [] }
  }, [persist])
  useEffect(() => {
    window.addEventListener(SIGNED_OUT_EVENT, signOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signOut)
  }, [signOut])

  useEffect(() => {
    const code = member?.code
    if (!code) return
    if (!hasSession()) { signOut(); return }
    let cancelled = false
    const gen = ++generation.current
    syncing.current = false
    setReady(false); setRestoreError(false); setSyncError(false)
    const restore = async () => {
      try {
        const verified = await checkSession()
        if (cancelled) return
        if (verified === false || (verified && verified.code !== code)) { signOut(); return }
        const [remote, history, desk] = await Promise.all([fetchAccountState(), fetchChatHistory(), fetchRequests()])
        if (cancelled || owner.current !== code || gen !== generation.current) return
        const cached = load<AccountCache | null>(cacheKey(code), null)
        // Migrate only data belonging to the currently signed-in legacy session.
        const legacy: Partial<AccountState> = {}
        if (!cached && load<Member | null>('member', null)?.code === code) {
          for (const key of Object.keys(emptyAccount()) as (keyof AccountState)[]) {
            const value = load<unknown>(key, undefined)
            if (value !== undefined && remote[key] === undefined) Object.assign(legacy, { [key]: value })
          }
          const choices: AccountState['choices'] = {}
          for (const key of Object.keys(localStorage)) if (/^tripagent:choices:[a-f0-9]{64}$/.test(key)) choices[key.slice('tripagent:choices:'.length)] = JSON.parse(localStorage.getItem(key) ?? '{}')
          if (Object.keys(choices).length && !remote.choices) legacy.choices = choices
        }
        const pending = { ...legacy, ...cached?.pending }
        const state = { ...emptyAccount(), ...remote, ...pending }
        state.choices = { ...remote.choices, ...pending.choices }
        // The server owns chat history. Preserve only cached unsent/error notices.
        const ids = new Set(history.map(m => m.id))
        const extras = (cached?.chat ?? []).filter(m => !ids.has(m.id) && (m.failed || !m.id.startsWith('job-')))
        cacheOwner.current = code
        current.current = { state, pending, chat: [...history, ...extras] }
        setAccount(state); setChat(current.current.chat); setRequests(desk)
        if (verified) { setMember(verified); save('member', verified) }
        for (const [key, choices] of Object.entries(state.choices)) save(`choices:${key}`, choices)
        persist(); setReady(true)
        void flush()
      } catch { if (!cancelled) setRestoreError(true) }
    }
    void restore()
    return () => { cancelled = true }
  }, [member?.code, attempt, signOut, persist, flush])

  useEffect(() => {
    if (!member || !ready) return
    const timer = window.setInterval(() => void flush(), 5000)
    const online = () => void flush()
    window.addEventListener('online', online)
    return () => { clearInterval(timer); window.removeEventListener('online', online) }
  }, [member?.code, ready, flush])

  const refreshRequests = useCallback(async () => {
    const code = owner.current
    try {
      const list = await fetchRequests()
      if (owner.current === code) setRequests(list)
      return list
    } catch { return requests }
  }, [requests])
  const pushChat = useCallback((m: ChatMessage) => {
    if (current.current.chat.some(existing => existing.id === m.id)) return
    current.current.chat = [...current.current.chat, m]
    setChat(current.current.chat); persist()
  }, [persist])
  const actions = useMemo<Pick<Store, 'setPrefs' | 'toggleSaved' | 'addToItinerary' | 'removeFromItinerary' | 'setActiveCity' | 'setComponents' | 'setPlan' | 'setBooking' | 'setChoices' | 'resetChat'>>(() => ({
    setPrefs: prefs => update({ prefs }),
    toggleSaved: key => { const list = current.current.state.wishlist; update({ wishlist: list.includes(key) ? list.filter(k => k !== key) : [...list, key] }) },
    addToItinerary: id => { const list = current.current.state.itinerary; if (!list.includes(id)) update({ itinerary: [...list, id] }) },
    removeFromItinerary: id => update({ itinerary: current.current.state.itinerary.filter(i => i !== id) }),
    setActiveCity: activeCity => update({ activeCity }),
    setComponents: components => update({ components }),
    setPlan: plan => { if (JSON.stringify(plan) !== JSON.stringify(current.current.state.plan)) update({ plan }) },
    setBooking: booking => update({ booking }),
    setChoices: (key, choices) => { save(`choices:${key}`, choices); update({ choices: { ...current.current.state.choices, [key]: choices } }) },
    resetChat: () => { current.current.chat = []; setChat([]); persist() },
  }), [update, persist])
  const value = useMemo<Store>(() => ({
    member, signIn, signOut, ...account, requests, refreshRequests, chat, pushChat, ...actions,
    isSaved: (key: string) => account.wishlist.includes(key),
  }), [member, signIn, signOut, account, requests, refreshRequests, chat, pushChat, actions])

  return <StoreContext.Provider value={value}>
    {member && !ready ? <main style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', padding: 24, textAlign: 'center' }}>
      <p role="status">{restoreError ? 'We could not load your saved journeys and conversation. Your account data has not been changed.' : 'Opening your journeys and conversation…'}</p>
      {restoreError && <><button onClick={() => setAttempt(n => n + 1)}>Try again</button><button onClick={signOut}>Sign out</button></>}
    </main> : <>{syncError && <div role="status" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: '#fff3d6', color: '#302516', padding: 10, textAlign: 'center' }}>We couldn’t sync your latest changes. Keep this page open while we retry.</div>}{children}</>}
  </StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
