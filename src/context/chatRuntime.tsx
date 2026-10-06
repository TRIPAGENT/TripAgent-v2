import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from './store'
import { currentChatJob, submitChatJob, toChatMessages, type ChatJob, fetchChatHistory } from '@/lib/agentClient'
import { msg } from '@/lib/concierge'

interface Runtime { job: ChatJob | null; submitting: boolean; connectionIssue: boolean; submit: (message: string) => Promise<void> }
const Context = createContext<Runtime | null>(null)
/** Lives above routes, so a plan continues while the member explores Journeys. */
export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const { member, pushChat, setPlan, chat } = useStore()
  const chatIds = useRef(new Set<string>())
  chatIds.current = new Set(chat.map(m => m.id))
  const [job, setJob] = useState<ChatJob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [connectionIssue, setConnectionIssue] = useState(false)
  const owner = useRef(member?.code)
  owner.current = member?.code
  const latest = useRef<ChatJob | null>(null)
  const announced = useRef(new Set<string>())
  const posting = useRef<string | null>(null)
  const pending = useRef<{ text: string; id: string } | null>(null)
  const apply = useCallback((next: ChatJob | null) => {
    if (next && latest.current && Date.parse(next.updatedAt) < Date.parse(latest.current.updatedAt)) return
    if (!next && latest.current?.status === 'running') return
    latest.current = next
    setJob(next)
    if (!next) return
    for (const turn of next.messages) {
      pushChat(msg('member', turn.text, { id: `job-member-${turn.id}`, at: Date.parse(next.startedAt), delivery: 'received' }))
      if (turn.state === 'completed') toChatMessages(turn.replies).forEach((reply, i) => {
        pushChat({ ...reply, id: `job-reply-${turn.id}-${i}` })
        if (reply.planUrl) {
          setPlan({ url: reply.planUrl, title: reply.release?.title ?? 'Your itinerary', at: Date.parse(next.updatedAt) })
          const id = `${turn.id}-${i}`
          if (!announced.current.has(id)) { announced.current.add(id); window.dispatchEvent(new Event('tripagent:plan-ready')) }
        }
      })
    }
    if (next.status === 'failed') pushChat(msg('ai', next.error ?? 'Tara could not finish this reply.', { id: `job-error-${next.id}`, failed: true }))
  }, [pushChat, setPlan])
  const applyRef = useRef(apply); applyRef.current = apply
  useEffect(() => {
    const code = member?.code
    setJob(null); setSubmitting(false); setConnectionIssue(false); posting.current = null; pending.current = null; latest.current = null; announced.current.clear()
    if (!code) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const next = await currentChatJob()
        if (!cancelled && owner.current === code) { applyRef.current(next); setConnectionIssue(false) }
      } catch { if (!cancelled) setConnectionIssue(true) }
      if (!cancelled) timer = setTimeout(poll, 1800)
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [member?.code])
  // Reflect WhatsApp replies while the member keeps the web app open.
  useEffect(() => {
    const code = member?.code
    if (!code) return
    let cancelled = false
    const sync = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const history = await fetchChatHistory()
        if (cancelled || owner.current !== code) return
        for (const message of history) {
          if (chatIds.current.has(message.id)) continue
          chatIds.current.add(message.id)
          pushChat(message)
          if (message.planUrl) {
            setPlan({ url: message.planUrl, title: message.release?.title ?? 'Your itinerary', at: message.at })
            window.dispatchEvent(new Event('tripagent:plan-ready'))
          }
        }
      } catch { /* The normal job poll reports connection trouble; try history again later. */ }
    }
    const timer = window.setInterval(() => void sync(), 10000)
    document.addEventListener('visibilitychange', sync)
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', sync) }
  }, [member?.code, pushChat, setPlan])
  const submit = useCallback(async (text: string) => {
    if (posting.current) return
    const code = member?.code
    if (!code) throw new Error('Sign in to speak with Tara.')
    const clean = text.trim()
    if (!clean) return
    const request = pending.current?.text === clean ? pending.current : { text: clean, id: crypto.randomUUID() }
    posting.current = request.id; setSubmitting(true)
    pending.current = request
    pushChat(msg('member', clean, { id: `job-member-${request.id}`, delivery: 'sending' }))
    try {
      const next = await submitChatJob(clean, request.id)
      if (owner.current !== code) return
      if (!next) throw new Error('Tara did not confirm receiving this message. Please try again.')
      apply(next); pending.current = null; setConnectionIssue(false)
    } catch (error) {
      if (owner.current !== code) return
      if (owner.current === code && latest.current?.messages.some(turn => turn.id === request.id)) {
        apply(latest.current); pending.current = null; setConnectionIssue(false); return
      }
      if (owner.current === code) pushChat(msg('member', clean, { id: `job-member-${request.id}`, delivery: 'unconfirmed' }))
      throw error
    } finally { if (posting.current === request.id) { posting.current = null; if (owner.current === code) setSubmitting(false) } }
  }, [member?.code, apply, pushChat])
  return <Context.Provider value={{ job, submitting, connectionIssue, submit }}>{children}</Context.Provider>
}
export function useChatRuntime() {
  const value = useContext(Context)
  if (!value) throw new Error('Chat runtime is missing')
  return value
}
