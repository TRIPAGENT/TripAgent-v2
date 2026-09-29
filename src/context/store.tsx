import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BookingComponent, ChatMessage, Member } from '@/lib/types'
import { load, save, clearAll } from '@/lib/storage'
import { checkSession, clearSession, fetchRequests, hasSession, SIGNED_OUT_EVENT } from '@/lib/agentClient'
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(() => load<Member | null>('member', null))
  const [prefs, setPrefsState] = useState<Preferences>(() => load('prefs', EMPTY_PREFS))
  const [wishlist, setWishlist] = useState<string[]>(() => load<string[]>('wishlist', []))
  const [itinerary, setItinerary] = useState<string[]>(() => load<string[]>('itinerary', []))
  const [activeCity, setActiveCityState] = useState<string>(() => load('activeCity', 'tokyo'))
  const [components, setComponentsState] = useState<BookingComponent[]>(() =>
    load<BookingComponent[]>('components', []),
  )
  const [requests, setRequests] = useState<DeskRequest[]>(() => load<DeskRequest[]>('requests', []))
  const [chat, setChat] = useState<ChatMessage[]>(() => load<ChatMessage[]>('chat', []))
  const [plan, setPlanState] = useState<Store['plan']>(() => load<Store['plan']>('plan', null))
  const [booking, setBookingState] = useState<Store['booking']>(() => load<Store['booking']>('booking', null))

  useEffect(() => save('member', member), [member])
  useEffect(() => save('prefs', prefs), [prefs])
  useEffect(() => save('wishlist', wishlist), [wishlist])
  useEffect(() => save('itinerary', itinerary), [itinerary])
  useEffect(() => save('activeCity', activeCity), [activeCity])
  useEffect(() => save('components', components), [components])
  useEffect(() => save('requests', requests), [requests])
  useEffect(() => save('chat', chat), [chat])
  useEffect(() => save('plan', plan), [plan])
  useEffect(() => save('booking', booking), [booking])

  const signIn = useCallback((m: Member) => setMember(m), [])

  const signOut = useCallback(() => {
    clearAll()
    clearSession()
    setMember(null)
    setPrefsState(EMPTY_PREFS)
    setWishlist([])
    setItinerary([])
    setComponentsState([])
    setRequests([])
    setChat([])
    setPlanState(null)
    setBookingState(null)
  }, [])

  // The server ends a session (expired, or the code was revoked): back to the door.
  useEffect(() => {
    const out = () => signOut()
    window.addEventListener(SIGNED_OUT_EVENT, out)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, out)
  }, [signOut])

  // On open, confirm the session with the desk. Offline, the member keeps what is
  // on the device; a session the desk refuses, or none at all, means the door.
  useEffect(() => {
    if (!member) return
    if (!hasSession()) {
      signOut()
      return
    }
    void checkSession().then((m) => {
      if (m === false) signOut()
      else if (m) setMember((prev) => (prev ? { ...prev, name: m.name, tier: m.tier, phoneMasked: m.phoneMasked, directives: m.directives } : prev))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshRequests = useCallback(async () => {
    try {
      const list = await fetchRequests()
      setRequests(list)
      return list
    } catch {
      return requests
    }
  }, [requests])

  const toggleSaved = useCallback((key: string) => {
    setWishlist((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  const isSaved = useCallback((key: string) => wishlist.includes(key), [wishlist])

  const addToItinerary = useCallback((id: string) => {
    setItinerary((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const removeFromItinerary = useCallback((id: string) => {
    setItinerary((prev) => prev.filter((i) => i !== id))
  }, [])

  const pushChat = useCallback((m: ChatMessage) => setChat((prev) => [...prev, m]), [])
  const resetChat = useCallback(() => setChat([]), [])

  const value = useMemo<Store>(
    () => ({
      member,
      signIn,
      signOut,
      prefs,
      setPrefs: setPrefsState,
      wishlist,
      toggleSaved,
      isSaved,
      itinerary,
      addToItinerary,
      removeFromItinerary,
      activeCity,
      setActiveCity: setActiveCityState,
      components,
      setComponents: setComponentsState,
      requests,
      refreshRequests,
      plan,
      setPlan: setPlanState,
      booking,
      setBooking: setBookingState,
      chat,
      pushChat,
      resetChat,
    }),
    [
      member, signIn, signOut, prefs, wishlist, toggleSaved, isSaved, itinerary,
      addToItinerary, removeFromItinerary, activeCity, components, requests,
      refreshRequests, chat, pushChat, resetChat, plan, booking,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
