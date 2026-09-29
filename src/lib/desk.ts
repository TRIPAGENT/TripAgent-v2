/**
 * The desk's requests, as the agent keeps them (tripagent/src/desk/requests.ts).
 * A booking request moves open → working → quoted → paid → closed, and only the
 * desk moves it past "open". The quote is the one price a member can say yes to.
 */

export type RequestStatus = 'open' | 'working' | 'quoted' | 'paid' | 'closed' | 'cancelled'

export interface Quote {
  currency: 'INR'
  lines: { label: string; amount: number }[]
  total: number
  holdUntil: string
  paymentUrl?: string
  terms?: string
  note?: string
  releasedAt?: string
}

export interface DeskEvent {
  at: string
  by: 'member' | 'desk'
  text: string
}

interface Base {
  id: string
  userId: string
  memberName: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
  quote?: Quote
  events: DeskEvent[]
}

export interface BookingComponentOut {
  id: string
  kind: 'flight' | 'hotel' | 'advisory' | 'visa' | 'transfer'
  title: string
  detail: string
}

export type NewDeskRequest =
  | {
      type: 'booking'
      planId: string
      planKey: string
      title: string
      components: BookingComponentOut[]
      choices?: Record<string, number>
      directives?: string
      party?: number
    }
  | { type: 'call'; slot: string; note?: string; about?: string }
  | { type: 'enquiry'; kind: 'flights' | 'visas' | 'hotels'; fields: Record<string, string> }
  | { type: 'handover'; phone: string; about?: string }

export type DeskRequest = Base & NewDeskRequest

export type BookingRequestRecord = Base & Extract<NewDeskRequest, { type: 'booking' }>

export const isBooking = (r: DeskRequest): r is BookingRequestRecord => r.type === 'booking'
export const isLive = (r: DeskRequest) => !['closed', 'cancelled'].includes(r.status)

/** The booking a member is most likely asking about: the newest one still moving, else the newest. */
export function currentBooking(list: DeskRequest[], id?: string | null): BookingRequestRecord | null {
  const bookings = list.filter(isBooking)
  if (id) return bookings.find((r) => r.id === id) ?? null
  return bookings.find((r) => isLive(r)) ?? bookings[0] ?? null
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** The one vocabulary for where a request stands. Every screen reads it here. */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  open: 'With the Desk',
  working: 'Being priced',
  quoted: 'Price ready',
  paid: 'Paid · booking',
  closed: 'Confirmed',
  cancelled: 'Cancelled',
}

export const TYPE_LABEL: Record<DeskRequest['type'], string> = {
  booking: 'Booking',
  call: 'Call',
  enquiry: 'Enquiry',
  handover: 'WhatsApp',
}

/** Time left on a quote's hold, or null once it has lapsed. */
export function holdLeft(q: Quote, now = Date.now()): { hours: number; minutes: number } | null {
  const ms = Date.parse(q.holdUntil) - now
  if (!(ms > 0)) return null
  return { hours: Math.floor(ms / 3_600_000), minutes: Math.floor((ms % 3_600_000) / 60_000) }
}
