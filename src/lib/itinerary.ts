import type { CityDetail, GuideItem, PanelKey } from '@/lib/catalogue'

/**
 * A guide entry is identified by its city and its name. The sourcing engine has
 * no stable per-venue id across collections — `entity_key` is source-scoped — so
 * the name within a city is what we can honestly key on.
 */
export const itemKey = (slug: string, name: string) => `${slug}/${name}`
export const savedItemKey = (slug: string, name: string) => `item:${itemKey(slug, name)}`
export const savedCityKey = (slug: string) => `city:${slug}`

export function parseItemKey(key: string): { slug: string; name: string } | null {
  const bare = key.startsWith('item:') ? key.slice(5) : key
  const i = bare.indexOf('/')
  if (i <= 0) return null
  return { slug: bare.slice(0, i), name: bare.slice(i + 1) }
}

export interface FoundItem extends GuideItem {
  panel: PanelKey
  tier: string | null
}

/** Locate a guide entry inside a loaded city, so a saved key can be rendered. */
export function findItem(city: CityDetail, name: string): FoundItem | null {
  for (const panel of city.guide.panels) {
    for (const tier of panel.tiers) {
      const hit = tier.items.find((i) => i.name === name)
      if (hit) return { ...hit, panel: panel.key, tier: tier.label }
    }
  }
  return null
}

/** Every entry in a city, flattened, with its panel and tier carried along. */
export function allItems(city: CityDetail): FoundItem[] {
  return city.guide.panels.flatMap((p) =>
    p.tiers.flatMap((t) => t.items.map((i) => ({ ...i, panel: p.key, tier: t.label }))),
  )
}
