/**
 * The plan as the agent writes it (tripagent/src/trip/plan.ts). Mirrored here so
 * the app can render the itinerary itself instead of framing a web page. Only the
 * trip shape is modelled; comparison plans still open as their shared page.
 */

export interface FlightLeg {
  depTime?: string
  depCity: string
  arrTime?: string
  arrCity: string
  flightNos?: string
  duration?: string
  cabin?: string
}

/**
 * A small benefit attached to a choice.
 *
 * `included` is only ever set by the agent when it has evidence for this exact
 * rate, room or cabin; everything else is `requested`. The app must preserve
 * that distinction on screen, because "breakfast included" and "breakfast
 * requested" are two different promises and only one of them is ours to make.
 */
export interface Inclusion {
  label: string
  status: 'included' | 'requested'
  source?: string
  checked?: string
}

export interface Choice {
  name: string
  details: string
  why: string
  tradeoff: string
  priceEvidence?: { provider: 'web'; source: string; checkedAt: string; basis: string; unit: string; match: 'exact' | 'from'; terms: string }
  price: string
  source?: string
  checked?: string
  /** One to three comparison bullets, known facts only. */
  highlights?: string[]
  inclusions?: Inclusion[]
  flight?: FlightLeg
}

/** A titled checklist with its own sources and check date. */
export interface Guidance {
  title: string
  points: string[]
  sources: { t: string; u: string }[]
  /** An actual source-check date. Never a claim that a forecast was verified. */
  checked?: string
}

/**
 * A pending decision. `status` is descriptive plan content, not a booking
 * state: `confirmed` here never means the Desk has held or paid for anything.
 */
export interface BookingAction {
  title: string
  points: string[]
  status: 'your-choice' | 'with-advisor' | 'confirmed'
  due?: string
}

export type DestinationTopic = 'weather' | 'traditional-dress' | 'style' | 'explore' | 'practical'

export interface DestinationNote extends Guidance {
  topic: DestinationTopic
}

export interface ChoiceGroup {
  label: string
  recommended: Choice
  alternatives: Choice[]
}

export interface Row {
  t: string
  m?: string
  d?: string
  /** Preferred over `d` for display when the agent supplies it. */
  highlights?: string[]
}

export interface DayRow extends Row {
  date?: string
  place?: string
}

export interface TripPlan {
  kind: 'trip'
  id: string
  title: string
  sub: string
  lede: string
  startDate?: string
  endDate?: string
  places?: string[]
  shape: { k: string; v: string }[]
  shapeNote?: { t: string; b: string }
  stay: Row[]
  hotelOptions: ChoiceGroup[]
  move: Row[]
  flightOptions: ChoiceGroup[]
  allowance: { k: string; v: string }[]
  days: DayRow[]
  daysNote?: { t: string; b: string }
  bookOrder: Row[]
  gate: { t: string; b: string }
  gateLinks: { t: string; u: string }[]
  decisions: Row[]

  /* --- agent 0.2.1: all optional, so plans written before it still parse --- */

  /** The traveller's actual visa status. `to-check` when it is not known. */
  visa?: { status: 'pending' | 'confirmed' | 'not-needed' | 'to-check'; note: string }
  /** The entry checklist. When absent, `gate` is still the fallback. */
  visaGuidance?: Guidance
  /** Specific pending decisions, traveller's and the Desk's. */
  bookingActions?: BookingAction[]
  /** Secondary reading about the destination. Never a dated forecast. */
  destinationNotes?: DestinationNote[]

  why: string[]
  asof: string
}

export type TripStatus = 'proposed' | 'requested' | 'booked' | 'travelling' | 'completed' | 'cancelled'

export interface PlanBundle {
  plan: TripPlan | { kind: 'compare'; id: string; title: string }
  key: string
  status: TripStatus
  start: string | null
  end: string | null
  places: { hero: string | null; stays: (string | null)[]; days: (string | null)[] }
  bookDue: (string | null)[]
}

export interface TripSummary {
  planId: string
  key: string
  title: string
  status: TripStatus
  start: string | null
  end: string | null
  nights: number | null
  places: string[]
}

export interface Nudge {
  trip: string
  tripTitle: string
  date: string
  inDays: number
  kind: string
  text: string
  deliverable: boolean
}
