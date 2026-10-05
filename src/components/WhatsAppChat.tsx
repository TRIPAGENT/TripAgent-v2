import { useEffect, useState } from 'react'
import { Icon } from './ui'
import { connectWhatsApp, cancelWhatsAppLink, disconnectWhatsApp, fetchWhatsAppStatus, type WhatsAppStatus } from '@/lib/agentClient'

/** Only the authenticated backend decides which account owns the WhatsApp number. */
export default function WhatsAppChat() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [phone, setPhone] = useState('+91 ')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const next = await fetchWhatsAppStatus()
        if (alive) {
          setStatus(next); setLoadError('')
          if (next.linked) { setLink(null); setOpen(false); setExpired(false) }
        }
      } catch { if (alive) setLoadError('We could not reach your WhatsApp settings. Reopen your profile to try again.') }
      if (alive && link && Date.parse(link.expiresAt) <= Date.now()) { setLink(null); setExpired(true) }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), link ? 3000 : 15000)
    document.addEventListener('visibilitychange', refresh)
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [link])

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setError(''); setExpired(false)
    if (!phone.trim().startsWith('+')) {
      setError('Include your country code. For India, enter +91 followed by your 10-digit WhatsApp number.'); return
    }
    setWorking(true)
    try { setLink(await connectWhatsApp(phone)) }
    catch (e) { setError(e instanceof Error ? e.message : 'We could not create your WhatsApp link. Please try again.') }
    finally { setWorking(false) }
  }
  async function cancel() {
    setWorking(true); setError('')
    try {
      await cancelWhatsAppLink()
      setStatus(await fetchWhatsAppStatus()); setOpen(false); setLink(null); setExpired(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'We could not cancel the link. Please try again.') }
    finally { setWorking(false) }
  }
  async function disconnect() {
    setWorking(true); setError('')
    try { await disconnectWhatsApp(); setStatus(await fetchWhatsAppStatus()); setLink(null); setPhone('+91 ') }
    catch (e) { setError(e instanceof Error ? e.message : 'We could not disconnect WhatsApp. Please try again.') }
    finally { setWorking(false) }
  }

  return <section aria-labelledby="whatsapp-chat-title" className="flex flex-col gap-4 px-6 pt-12">
    <div className="flex items-center gap-3">
      <Icon name="chat" size={22} />
      <h2 id="whatsapp-chat-title" className="t-display-s">Tara on WhatsApp</h2>
      <span className="t-label">AI</span>
    </div>
    <p className="t-body-s">The same travel companion, wherever you prefer to chat. Your messages and travel context stay with your personal membership.</p>
    {!status && !error && !loadError && <p className="t-caption" role="status">Checking WhatsApp availability…</p>}
    {status && !status.enabled && <p className="t-caption">WhatsApp chat is being set up. Tara is available in the app meanwhile.</p>}
    {status?.enabled && status.linked && <>
      <p className="t-caption" role="status">Connected · {status.phoneMasked}</p>
      <a className="k-btn k-btn-primary" href={status.chatUrl ?? undefined} target="_blank" rel="noopener noreferrer">Chat via WhatsApp <Icon name="arrow-up-right" size={18} /></a>
      <button type="button" className="k-btn k-btn-secondary" disabled={working} onClick={() => void disconnect()}>{working ? 'Disconnecting…' : 'Disconnect WhatsApp'}</button>
    </>}
    {status?.enabled && !status.linked && !open && <button type="button" className="k-btn k-btn-primary" onClick={() => { setOpen(true); setError('') }}>Chat via WhatsApp <Icon name="arrow-up-right" size={18} /></button>}
    {status?.enabled && !status.linked && open && <form onSubmit={connect} className="flex flex-col gap-3">
      <label htmlFor="whatsapp-phone" className="t-caption">Your WhatsApp number, including country code</label>
      <div className="k-field"><input id="whatsapp-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 9876543210" maxLength={30} required value={phone} disabled={working || Boolean(link)} onChange={e => setPhone(e.target.value)} /></div>
      <p className="t-caption">For India, keep +91 before your 10-digit number. For another country, replace +91 with your country code.</p>
      <p className="t-caption">Send the prepared message from this number to connect it to your profile. Only you can use this link; it expires after 10 minutes.</p>
      {!link && <button type="submit" disabled={working} className="k-btn k-btn-primary">{working ? 'Preparing your link…' : 'Create WhatsApp link'}</button>}
      {link && <>
        <a className="k-btn k-btn-primary" href={link.url} target="_blank" rel="noopener noreferrer">Open WhatsApp and send <Icon name="arrow-up-right" size={18} /></a>
        <p className="t-caption" role="status">Send the prefilled LINK message in WhatsApp. Tara will confirm your connection and you can start chatting here or on WhatsApp.</p>
      </>}
      <button type="button" className="k-btn k-btn-secondary" disabled={working} onClick={() => void cancel()}>Cancel</button>
    </form>}
    {expired && <p className="t-caption" role="status">Your link expired. Create a new link to connect WhatsApp.</p>}
    {loadError && <p className="t-caption" role="alert">{loadError}</p>}
    {error && <p className="t-caption" role="alert">{error}</p>}
  </section>
}
