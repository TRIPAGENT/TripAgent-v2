/**
 * Access-code helpers and the house's own details. The member registry itself is
 * on the server (tripagent/src/desk/members.ts): a list of codes and names in the
 * app bundle would be readable by anyone who opened it.
 */

const env = (k: string) => ((import.meta.env[k] as string | undefined) ?? '').trim()
const WHATSAPP = env('VITE_WHATSAPP_NUMBER').replace(/\D/g, '')

/**
 * The house, and the person who answers for it.
 *
 * A member paying this much is owed a name, a city and a number — not a
 * faceless queue. But the name has to be a real person on a real shift, so it
 * comes from the environment (`VITE_ADVISOR_*`), never from this file. Fill it
 * in and every screen picks it up: the door, the membership card, the Desk.
 * Leave it empty and the house speaks as "the Desk" instead, which is still
 * true — a real team in a real city — rather than inventing someone.
 *
 * `hasAdvisor` is the switch every screen should read before promising a person.
 */
const ADVISOR_NAME = env('VITE_ADVISOR_NAME')
const ADVISOR_PHONE = env('VITE_ADVISOR_PHONE')

export const ADVISOR = {
  /** A real name, or null. Never a placeholder. */
  name: ADVISOR_NAME || null,
  /** What they are called on screen: "Ananya Rao" or "the Desk". */
  displayName: ADVISOR_NAME || 'the Desk',
  role: env('VITE_ADVISOR_ROLE') || 'Your travel advisor',
  city: env('VITE_ADVISOR_CITY') || 'Bengaluru',
  phone: ADVISOR_PHONE || null,
  /** `tel:` target, digits only. */
  tel: ADVISOR_PHONE ? `tel:${ADVISOR_PHONE.replace(/[^\d+]/g, '')}` : null,
  /**
   * Cities this advisor has actually travelled, shown as evidence that the
   * recommendation comes from someone who has been there. Comma-separated in
   * the environment; empty until it is true.
   */
  travelled: env('VITE_ADVISOR_TRAVELLED')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  hasAdvisor: Boolean(ADVISOR_NAME),
} as const

/**
 * The agent that answers in the app.
 *
 * Tara is the house's AI, and the app never lets that be ambiguous: wherever
 * the name carries weight it is set beside an `AI` mark, so a member is never
 * left guessing whether a person or a model just replied. The humans remain
 * the Desk, and a booking, a price or a hold is always their work.
 */
export const AGENT = {
  name: 'Tara',
  mark: 'AI',
  role: 'AI travel agent',
  /** Said once, where a member first meets Tara. */
  line: 'TripAgent’s AI travel agent. The Desk handles anything that costs money.',
} as const

export const DESK = {
  name: 'The Desk',
  city: ADVISOR.city,
  signature: `— ${ADVISOR.displayName}, ${ADVISOR.city}`,
  title: 'TripAgent · by invitation',
  email: 'maison@tripsure.com',
  /** Where an invitation is asked for, by someone who has no code yet. */
  invite: 'invite@tripagent.vip',
  whatsapp: WHATSAPP ? `https://wa.me/${WHATSAPP}` : null,
  replies: `${ADVISOR.hasAdvisor ? ADVISOR.displayName : 'The Desk'} replies the same day. All times IST.`,
  operator: 'TripAgent is operated by Tripsure, 44 Kingfisher Towers, Bangalore 560 001, India.',
} as const

export const ACCESS_CODE_PATTERN = /^[A-Z]{2}\d{4}[A-Z]{2}$/

export function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

export function isValidCode(raw: string): boolean {
  return ACCESS_CODE_PATTERN.test(normaliseCode(raw))
}
