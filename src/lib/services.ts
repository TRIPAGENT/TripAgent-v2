/**
 * What the house calls its counters, in one place.
 *
 * The catalogue names these in its own words; the app names them in the
 * house's. That translation was written out twice — once on Discover and once
 * on Services — with the same "Hotels is Stays" comment copied into both, so
 * the two could drift and the route to each counter lived only in one of them.
 * Discover therefore sent everyone to the index instead of the counter they
 * had just tapped.
 */

export interface ServiceFace {
  /** Where tapping it should land. */
  route: string
  /** The house's name for it. */
  name: string
  /** A brand photograph, by `brandImage` key. */
  image: string
  /** The short line beneath the name on a card. */
  line: string
  /** The line above the name on the Services page. */
  eyebrow: string
  /** What the button on the Services page says. */
  action: string
}

/** Keyed by the catalogue's own heading. */
export const SERVICE_FACES: Record<string, ServiceFace> = {
  Flights: {
    route: '/services/flights',
    name: 'Flights',
    image: 'cabin',
    line: 'Business and first',
    eyebrow: 'Business, first and suites',
    action: 'Tell us the journey',
  },
  Hotels: {
    route: '/services/hotels',
    name: 'Stays',
    image: 'suite',
    line: 'The room, not the listing',
    eyebrow: 'The room, not the listing',
    action: 'Find a room',
  },
  Visas: {
    route: '/services/visas',
    name: 'Visas',
    image: 'visas',
    line: 'Checked, filed, tracked',
    eyebrow: 'Before money moves',
    action: 'Start a visa',
  },
}

/**
 * The face for a catalogue heading.
 *
 * A counter we have no face for still gets a usable one rather than a blank
 * card: the catalogue can add a service before the app has words for it.
 */
export function serviceFace(heading: string, fallbackImage?: string | null): ServiceFace {
  return (
    SERVICE_FACES[heading] ?? {
      route: `/services/${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: heading,
      image: fallbackImage ?? 'home',
      line: '',
      eyebrow: '',
      action: 'Ask the Desk',
    }
  )
}
