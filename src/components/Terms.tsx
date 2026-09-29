import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { DESK } from '@/data/members'

/**
 * Who a member is paying, and what happens if it goes wrong, in plain words and
 * before any money moves. These are the house's own promises (tripagent.vip,
 * Protection; the Tripsure operating principles): the price on the quote is the
 * price paid, refunds go back to the original payment method, one accountable
 * party per booking. Supplier cancellation terms vary, so they are stated on each
 * quote rather than generalised here.
 */
export function TermsPanel({ compact = false }: { compact?: boolean }) {
  const rows: [string, string, string][] = [
    ['document', 'Who you pay', 'Tripsure, which operates TripAgent, is the seller for everything on your quote. One company is accountable for the whole booking.'],
    ['clock', 'When a price holds', 'Your quote lists each flight and stay with taxes shown, and the time it is held until. The price on the quote is the price you pay. After the hold it is re-checked, never quietly changed.'],
    ['refresh', 'If plans change', "Each airline's and hotel's cancellation terms are written on your quote before you pay. Refunds go back to the card or account you paid from."],
    ['lock', 'How you pay', 'Through a secure payment link from Tripsure, on Razorpay. Nothing is charged by sending a request.'],
  ]

  return (
    <section className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-4 px-6 py-10'}>
      <p className="t-label c-ivory-3">Terms of this booking</p>

      <ul className="k-card px-[18px]">
        {rows.map(([icon, title, body]) => (
          <li key={title} className="k-row items-start gap-3.5 py-4">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full c-champagne"
              style={{ border: '1px solid var(--champagne-line)' }}
            >
              <Icon name={icon} size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="t-title-s">{title}</span>
              <span className="t-body-s c-ivory-2">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="t-caption c-ivory-3">
        {DESK.operator}{' '}
        <Link to="/legal/terms" className="c-champagne underline underline-offset-4">Terms</Link>
        {' · '}
        <Link to="/legal/privacy" className="c-champagne underline underline-offset-4">Privacy</Link>
        {' · '}
        <Link to="/legal/refund" className="c-champagne underline underline-offset-4">Refund of fees</Link>
      </p>
    </section>
  )
}
