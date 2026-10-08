import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { SIGNED_OUT_EVENT } from '@/lib/agentClient'
import { useStore } from '@/context/store'
import Chat from './pages/Chat'

/**
 * The host side of the chatbot-fe chat, for THIS app only. Not part of chatbot-fe.
 *
 *  - Sign-in is the app's: chatbot-fe's client reads its token from `tripagent.token`, so the
 *    app's own session token is copied there before the chat first renders.
 *  - Other screens open the chat with router state ({ send } to send a line, { draft } /
 *    { query } / { place } / { city } to leave a line in the box); that is turned into the
 *    chat's `seed` once, and the state is cleared.
 *  - Back goes to the previous screen (the home screen when the chat was opened directly);
 *    the call button opens the Desk.
 */

const APP_SESSION_KEY = 'tripagent:session'
const CHATBOT_TOKEN_KEY = 'tripagent.token'

function bridgeToken() {
  try {
    const s = JSON.parse(localStorage.getItem(APP_SESSION_KEY) ?? 'null') as { token?: string } | null
    if (s?.token) localStorage.setItem(CHATBOT_TOKEN_KEY, s.token)
    else localStorage.removeItem(CHATBOT_TOKEN_KEY)
  } catch {
    /* private mode: the chat will ask the member to sign in again */
  }
}

interface RouteState {
  send?: string
  draft?: string
  query?: string
  city?: string
  place?: { name?: string; area?: string | null; slug?: string }
}

export default function ChatbotScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { member } = useStore()
  // Before the first render of the chat, so its first request already carries the token.
  useState(bridgeToken)

  const [seed] = useState(() => {
    const s = location.state as RouteState | null
    if (!s) return null
    if (s.send) return { send: s.send }
    const city = s.city ? CITY_BY_SLUG[s.city]?.name : null
    const draft =
      s.draft ??
      s.query ??
      (s.place?.name
        ? `Tell me about ${s.place.name}${s.place.area ? `, ${s.place.area}` : ''}.`
        : city
          ? `I am thinking about ${city}.`
          : undefined)
    return draft ? { draft } : null
  })
  const cleared = useRef(false)
  useEffect(() => {
    if (seed && !cleared.current) {
      cleared.current = true
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [seed, navigate, location.pathname])

  return (
    <Chat
      memberName={member?.name.split(' ')[0]}
      seed={seed}
      onBack={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
      onCall={() => navigate('/desk')}
      onAuthError={() => window.dispatchEvent(new Event(SIGNED_OUT_EVENT))}
    />
  )
}
