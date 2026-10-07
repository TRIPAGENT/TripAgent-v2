import {
  DEFAULT_PASSIONS, HOUSES, HOUSE_IDS, PASSIONS, PASSION_IDS, PLACES, PLACE_IDS,
  type HouseId, type PassionId, type PlaceId,
} from './data';
import type { TravelProfile } from './types';

export type DeckCard = PlaceId | 'surprise';

/**
 * The six cards a member swipes: five places matched to their passions,
 * taken round-robin so every passion is represented, then the surprise card.
 * Deterministic for a given set of passions.
 */
export function buildDeck(passions: PassionId[]): DeckCard[] {
  const tags = passions.length ? passions : DEFAULT_PASSIONS;
  const picked: PlaceId[] = [];
  for (let round = 0; round < 10 && picked.length < 5; round++) {
    for (const tag of tags) {
      if (picked.length >= 5) break;
      const hit = PLACES.find((p) => p.tags.includes(tag) && !picked.includes(p.id));
      if (hit) picked.push(hit.id);
    }
  }
  for (const p of PLACES) {
    if (picked.length >= 5) break;
    if (!picked.includes(p.id)) picked.push(p.id);
  }
  return [...picked, 'surprise'];
}

/** Style tags of the ranked houses, weighted so the preferred house counts most. */
export function houseStyleTags(ranked: HouseId[], limit = 5): string[] {
  const score = new Map<string, number>();
  ranked.forEach((id, i) => {
    const house = HOUSES.find((h) => h.id === id);
    if (!house) return;
    const weight = ranked.length - i;
    for (const t of house.tags) score.set(t, (score.get(t) ?? 0) + weight);
  });
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

export function buildProfile(input: {
  passions: PassionId[];
  ranked: HouseId[];
  noHousePreference: boolean;
  deck: DeckCard[];
  yes: DeckCard[];
  no: DeckCard[];
}): TravelProfile {
  const isPlace = (c: DeckCard): c is PlaceId => c !== 'surprise';
  const ranked = input.noHousePreference ? [] : input.ranked;
  return {
    version: 1,
    passions: [...input.passions],
    houses: { ranked, noPreference: input.noHousePreference, styleTags: houseStyleTags(ranked) },
    places: {
      shown: input.deck.filter(isPlace),
      yes: input.yes.filter(isPlace),
      no: input.no.filter(isPlace),
    },
    openToSurprise: input.yes.includes('surprise') ? true : input.no.includes('surprise') ? false : null,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Validate an untrusted profile (e.g. a POST body) against the known option ids.
 * Returns null when anything is malformed. Use it on the server as well as the client.
 */
export function parseTravelProfile(input: unknown): TravelProfile | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const ids = <T extends string>(v: unknown, allowed: readonly T[], max: number): T[] | null => {
    if (!Array.isArray(v) || v.length > max) return null;
    if (!v.every((x) => typeof x === 'string' && (allowed as readonly string[]).includes(x))) return null;
    if (new Set(v).size !== v.length) return null;
    return v as T[];
  };
  if (o.version !== 1) return null;
  const passions = ids(o.passions, PASSION_IDS, PASSION_IDS.length);
  const h = o.houses as Record<string, unknown> | undefined;
  const p = o.places as Record<string, unknown> | undefined;
  if (!passions || !h || !p) return null;
  const ranked = ids(h.ranked, HOUSE_IDS, HOUSE_IDS.length);
  const shown = ids(p.shown, PLACE_IDS, 5);
  const yes = ids(p.yes, PLACE_IDS, 5);
  const no = ids(p.no, PLACE_IDS, 5);
  if (!ranked || !shown || !yes || !no || typeof h.noPreference !== 'boolean') return null;
  if (h.noPreference && ranked.length) return null;
  if (![...yes, ...no].every((x) => shown.includes(x))) return null;
  if (!(o.openToSurprise === null || typeof o.openToSurprise === 'boolean')) return null;
  if (typeof o.completedAt !== 'string' || Number.isNaN(Date.parse(o.completedAt))) return null;
  return {
    version: 1,
    passions,
    houses: { ranked, noPreference: h.noPreference, styleTags: houseStyleTags(ranked) },
    places: { shown, yes, no },
    openToSurprise: o.openToSurprise as boolean | null,
    completedAt: o.completedAt,
  };
}

/**
 * A short block for the agent's system prompt. Inject it on every turn, so a
 * profile change applies immediately on web and WhatsApp.
 */
export function toAgentContext(profile: TravelProfile): string {
  const passion = (id: PassionId) => PASSIONS.find((x) => x.id === id)?.label ?? id;
  const house = (id: HouseId) => HOUSES.find((x) => x.id === id)?.name ?? id;
  const place = (id: PlaceId) => PLACES.find((x) => x.id === id)?.place ?? id;
  const lines: string[] = [
    'Traveller profile, from onboarding. These are defaults: the latest request always overrides them. Never recite this profile back to the traveller.',
  ];
  if (profile.passions.length) {
    lines.push(`- Loves: ${profile.passions.map(passion).join(', ')}. Let these shape which experiences you suggest and lead with.`);
  }
  if (profile.houses.noPreference) {
    lines.push('- Houses: no preferred brand. Recommend the finest property for each destination on its merits.');
  } else if (profile.houses.ranked.length) {
    const [first, ...rest] = profile.houses.ranked.map(house);
    lines.push(
      `- Preferred houses, in order: ${[first, ...rest].join(', ')}. Where ${first} operates at the destination, lead the stay shortlist with it and say why.` +
      (rest.length ? ` Include ${rest.join(' and ')} where they operate and fit the trip.` : ''),
    );
    if (profile.houses.styleTags.length) {
      lines.push(
        `- Where none of those houses operates, say so plainly, then suggest properties that feel ${profile.houses.styleTags.slice(0, 3).join(', ').toLowerCase()}.`,
      );
    }
  }
  if (profile.places.yes.length) lines.push(`- Drawn to: ${profile.places.yes.map(place).join(', ')}.`);
  if (profile.places.no.length) lines.push(`- Passed on: ${profile.places.no.map(place).join(', ')}. Don't rule these out, but don't lead with them.`);
  if (profile.openToSurprise === true) lines.push('- Open to the unexpected: include one well-explained suggestion they would not have picked themselves.');
  if (profile.openToSurprise === false) lines.push('- Prefers the familiar: keep suggestions close to what they have shown interest in.');
  lines.push('- A preferred house is a taste signal, not a budget statement or a paid placement.');
  return lines.join('\n');
}
