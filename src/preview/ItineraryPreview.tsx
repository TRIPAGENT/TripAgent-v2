import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Itinerary } from '@/components/Itinerary'
import { Screen, Dock } from '@/components/Shell'
import { Btn, Sheet, Status } from '@/components/ui'
import { switzerlandPreview } from './switzerland'

/** Member-accessible demo of the real customer component, with no Desk writes. */
export default function ItineraryPreview() {
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true) }
    catch { setMessage('Copy this page’s address to share the preview after signing in.') }
  }
  return <Screen tone="light" tabs={false} dock>
    <div className="px-6 py-4" style={{ background: 'var(--ink-1)' }}>
      <Link to="/journeys" className="k-link mb-3">← Your journeys</Link>
      <p className="t-label">Sample itinerary</p>
      <p className="t-caption mt-2">Explore a journey with TripAgent. This sample is illustrative; no booking will be sent.</p>
    </div>
    <Itinerary bundle={switzerlandPreview} madeFor="you" coming={[]} status={<Status>Proposed journey · sample</Status>}
      onRefine={text => setMessage(`In the customer app, this goes to Tara to revise the plan:\n\n${text}`)}
      onAsk={text => setMessage(`In the customer app, Tara opens with this draft:\n\n${text}`)}
      onShare={() => void share()} footer={copied ? <p role="status" className="t-caption">Preview link copied.</p> : undefined} />
    <Dock><Btn className="flex-1" onClick={() => setMessage('The next customer step collects traveller details and confirms the selected journey before sending it to the Desk. The Desk then checks availability and releases a quote with inclusions and terms. This preview sends nothing.')}>Send for a price</Btn></Dock>
    {message && <Sheet onClose={() => setMessage(null)} labelledBy="preview-action"><div className="flex flex-col gap-4 px-6 pb-6"><h2 id="preview-action" className="t-display-s">The next step</h2><p className="t-body-s whitespace-pre-wrap">{message}</p><Btn onClick={() => setMessage(null)}>Back to the itinerary</Btn></div></Sheet>}
  </Screen>
}
