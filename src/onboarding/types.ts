import type { HouseId, PassionId, PlaceId } from './data';

/**
 * What onboarding produces. Store it on the authenticated member and read it
 * into the agent context before every turn (web and WhatsApp alike).
 *
 * Versioned so later copy or option changes never reinterpret old answers.
 */
export interface TravelProfile {
  version: 1;
  /** Step 1, in the order the member added them. Empty = skipped. */
  passions: PassionId[];
  houses: {
    /** Step 2, in tap order. Index 0 is the preferred house. */
    ranked: HouseId[];
    /** "No preferred house. Recommend the finest for each destination." */
    noPreference: boolean;
    /** Style tags derived from the ranked houses, strongest first. Used where none of the houses operates. */
    styleTags: string[];
  };
  places: {
    /** The five place cards this member was shown (excludes the surprise card). */
    shown: PlaceId[];
    yes: PlaceId[];
    no: PlaceId[];
  };
  /** The last card, "Something I haven't tried". null = not reached. */
  openToSurprise: boolean | null;
  completedAt: string;
}

/** Image URLs keyed by slot. Any slot left out renders its tone and shot brief. */
export type ImageKey =
  | 'hero'
  | `passion:${PassionId}`
  | `house:${HouseId}`
  | `place:${PlaceId}`;

export type ImageMap = Partial<Record<ImageKey, string>>;

export type InviteResult =
  | { ok: true; memberName?: string }
  | { ok: false; message?: string };
