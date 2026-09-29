import type { ChatMessage, CitySummary } from '@/lib/types'

let seq = 0
export function mid(): string {
  seq += 1
  return `m${Date.now()}-${seq}`
}

export function msg(
  role: ChatMessage['role'],
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: mid(), role, text, at: Date.now(), ...extra }
}

/** Morning until noon, afternoon until five, evening after that. */
export function partOfDay(at = new Date()): string {
  const h = at.getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

/**
 * The on-device stand-in.
 *
 * This is only reached when the TripAgent backend is unreachable, and the screen
 * says so plainly. It deliberately does almost nothing: it cannot search, cannot
 * build a plan and has no memory, so it acknowledges and points at the Desk
 * rather than imitating Tara. Anything cleverer here would be a worse
 * lie, and this app's whole position is that it does not tell them.
 */
export function greeting(name: string, city: CitySummary | null): ChatMessage {
  const first = name.split(' ')[0]
  const open = `Good ${partOfDay()}, ${first}.`
  return msg(
    'ai',
    city
      ? `${open} Tara is not reachable from this device just now, so I can keep notes on ${city.name}, but I cannot plan or price anything until Tara is back.`
      : `${open} Tara is not reachable from this device just now, so I cannot plan or price anything until Tara is back.`,
  )
}

export function respond(input: string, city: CitySummary | null, turn: number): ChatMessage[] {
  const q = input.toLowerCase()
  const asksForWork = /plan|itinerar|book|price|cost|quote|flight|hotel|visa|build/.test(q)

  if (asksForWork) {
    return [
      msg(
        'ai',
        'That needs Tara, and it is not reachable from this device right now. Send it again in a moment, or write to maison@tripsure.com and the Desk will pick it up. Nothing you have saved is lost.',
      ),
    ]
  }

  const acks = [
    city
      ? `Noted against ${city.name}. Tara will pick this up once the connection is back.`
      : 'Noted. Tara will pick this up once the connection is back.',
    'Recorded. I am a stand-in while Tara is unreachable, so I will leave it there.',
  ]
  return [msg('ai', acks[turn % acks.length])]
}
