export type {
  CitySummary,
  CityDetail,
  MonthGuide,
  MonthTier,
  GuidePanel,
  GuideItem,
  PlanDay,
  Fact,
  Slide,
  Service,
  Venue,
  CityMap,
} from './catalogue'

export type MemberTier = 'Private Tier Black' | 'Private Tier Ash' | 'Invited Guest'

export interface Member {
  code: string
  name: string
  tier: MemberTier
  phoneMasked?: string
  directives?: string
}

export interface Destination {
  id: string
  city: string
  country: string
  region: string
  tagline: string
  signature: string          // italic accent phrase inside the tagline
  hero: string
  bestMonths: string
  idealLength: string
  travelWindow: string
  formalities: string
  dossier: string
  seasonWindow: string
  months: { m: string; note: string; grade: 'peak' | 'good' | 'fair' }[]
  stays: Stay[]
  experiences: Experience[]
  route: RouteDay[]
}

export interface Stay {
  id: string
  name: string
  district: string
  badge?: string
  accolade?: string
  blurb: string
  tags: string[]
  image: string
  category: 'ultra' | 'grand' | 'luxury' | 'sanctuary'
}

export interface Experience {
  id: string
  name: string
  district: string
  badge?: string
  accolade?: string
  blurb: string
  tags: string[]
  image: string
  kind: 'omakase' | 'spirits' | 'sanctuary' | 'culture'
  time?: string
}

export interface RouteDay {
  day: number
  title: string
  pull: string
  stops: RouteStop[]
}

export interface RouteStop {
  time: string
  zone: string
  title: string
  detail: string
  icon: string
  note?: string
  status?: string
  image?: string
}

export type ComponentKind = 'flight' | 'hotel' | 'advisory'

export interface BookingComponent {
  id: string
  kind: ComponentKind
  title: string
  detail: string
  badge?: string
  status: string
}

export interface ChatMessage {
  id: string
  role: 'ai' | 'member' | 'advisor'
  text: string
  at: number
  release?: { version: string; title: string }
  /** Set when the message carries a plan page built by the TripAgent backend. */
  planUrl?: string
  /** Set when the turn failed, so the UI can offer a retry instead of a dead end. */
  failed?: boolean
  /** Receipt confirmation is separate from whether Tara finished the reply. */
  delivery?: 'sending' | 'received' | 'unconfirmed'
}
