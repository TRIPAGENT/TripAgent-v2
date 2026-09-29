#!/usr/bin/env node
/**
 * Pulls the published catalogue out of the sourcing engine and into this app.
 *
 * Source of truth is the sourcing engine's generated content — 110 city pages and
 * 12 month pages that have already been written and reviewed. Nothing here is
 * invented: this script reshapes and trims, it does not author.
 *
 * It writes three things:
 *   src/data/catalogue.generated.ts   the index every screen needs at once (small)
 *   public/data/city/<slug>.json      the full city guide, fetched on demand
 *   public/img/{city,month}/...       resized derivatives of the image library
 *
 * Run: npm run catalogue
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const ENGINE =
  process.env.SOURCING_ENGINE ??
  '/Users/polaris/Downloads/VSC-Codes-Polaris/tripagent-sourcing-engine'
const APP = path.resolve(import.meta.dirname, '..')

const SRC_DATA = path.join(ENGINE, 'src/data')
const SRC_IMG = path.join(ENGINE, 'public/img')
const OUT_CITY_JSON = path.join(APP, 'public/data/city')
const OUT_IMG_CITY = path.join(APP, 'public/img/city')
const OUT_IMG_MONTH = path.join(APP, 'public/img/month')
const OUT_IMG_BRAND = path.join(APP, 'public/img/brand')
const OUT_MAP_JSON = path.join(APP, 'public/data/map')

/**
 * The agent gets the same catalogue, as a file it can search. Per the integration
 * decisions the curated library reaches it as a tool it calls, not as context
 * injected on every turn — 110 cities would not fit in a prompt and would be paid
 * for on every single message.
 */
const AGENT =
  process.env.AGENT_ROOT ??
  '/Users/polaris/Downloads/VSC-Codes-Polaris/Chatbot_v1/tripagent'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const CODES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** wm2 is the city at its best, wm1 is shoulder, wm0 is the month to avoid. */
const TIER = { wm2: 'peak', wm1: 'shoulder', wm0: 'avoid' }

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'))

/** The engine serves through a resizing proxy; we need the plain file it points at. */
function sourceImage(ref) {
  if (!ref || typeof ref !== 'string') return null
  const m = ref.match(/[?&]url=([^&]+)/)
  const raw = m ? decodeURIComponent(m[1]) : ref
  return raw.split('?')[0].replace(/^\//, '')
}

/**
 * A <br> is a space once the markup goes, not a join. Em dashes read as machine
 * copy in quantity, so they become commas, the same rule the itinerary follows
 * (tripagent/src/trip/humanize.ts). En dashes in ranges (Jan–Mar) are kept.
 */
const clean = (s) =>
  typeof s === 'string'
    ? s
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*—\s*$/g, '')
        .replace(/^\s*—\s*/g, '')
        .replace(/\s*—\s*/g, ', ')
        .replace(/,\s*,/g, ',')
        .replace(/\(\s*,\s*/g, '(')
        .trim()
    : s

/** Keep the engine's one styled phrase, which the app renders as the accent italic. */
function splitHeading(html) {
  if (typeof html !== 'string') return { text: clean(html) ?? '', accent: null }
  const m = html.match(/<span class="(?:it|em)">(.*?)<\/span>/)
  return { text: clean(html), accent: m ? clean(m[1]) : null }
}

/**
 * Image sizes. A 390pt phone at 3x needs ~1170px across a card and ~2500px down a
 * full-bleed hero, so cards are cut at 1080 and heroes at 1600 from the engine's
 * 2560px originals. Never upscaled: a soft hero is worse than a small one.
 */
export const CARD_PX = 1080
export const CARD_Q = 80
export const HERO_PX = 1600
export const HERO_Q = 82

const widthOf = async (file) =>
  Number((await run('sips', ['-g', 'pixelWidth', file])).stdout.match(/(\d+)\s*$/)?.[1] ?? 0)

/** Resize down to `width`; an existing derivative is kept only if it is already that sharp. */
export async function resize(from, to, width, quality) {
  if (!existsSync(from)) return false
  const target = Math.min(width, await widthOf(from))
  if (existsSync(to) && (await widthOf(to)) >= target - 1) return true
  await run('sips', [
    '-Z', String(target),
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(quality),
    from, '--out', to,
  ])
  return true
}

async function main() {
  const cities = await readJson(path.join(SRC_DATA, 'cities.generated.json'))
  const goin = await readJson(path.join(SRC_DATA, 'goin.generated.json'))
  /**
   * The hero breadcrumb omits the country for domestic destinations, so 43 of the
   * 110 cities have none there. The city index carries it for every one, grouped
   * by region, so that is the authority and the breadcrumb is the fallback.
   */
  const index = await readJson(path.join(SRC_DATA, 'cities-index.generated.json')).catch(() => null)
  const countryIndex = new Map()
  const regionIndex = new Map()
  for (const group of index?.groups ?? []) {
    for (const item of group.cities ?? []) {
      const slug = (item.href ?? '').replace(/^city-/, '').replace(/\.html$/, '')
      if (slug && item.country) countryIndex.set(slug, clean(item.country))
      if (slug && group.label) regionIndex.set(slug, clean(group.label))
    }
  }

  const home = await readJson(path.join(SRC_DATA, 'homepage.generated.json')).catch(() => null)

  await Promise.all(
    [OUT_CITY_JSON, OUT_IMG_CITY, OUT_IMG_MONTH, OUT_IMG_BRAND, OUT_MAP_JSON].map((d) =>
      fs.mkdir(d, { recursive: true }),
    ),
  )

  // Country per city, when the index carries it; the hero breadcrumb otherwise.
  const countryOf = (slug, city) =>
    countryIndex.get(slug) ?? clean(city?.hero?.breadcrumbCountry?.label) ?? null

  const slugs = Object.keys(cities).sort()
  const summaries = []
  let copied = 0
  let mapped = 0

  for (const slug of slugs) {
    const c = cities[slug]
    const hero = c.hero ?? {}
    const when = c.whenToGo ?? {}

    // ---- images -----------------------------------------------------------
    const heroSrc = sourceImage(hero.image) ?? `img/cities/${slug}.jpg`
    const from = path.join(ENGINE, 'public', heroSrc)
    const okCard = await resize(from, path.join(OUT_IMG_CITY, `${slug}-card.jpg`), CARD_PX, CARD_Q)
    const okHero = await resize(from, path.join(OUT_IMG_CITY, `${slug}-hero.jpg`), HERO_PX, HERO_Q)
    if (okCard && okHero) copied += 1
    else console.warn(`  ! no image for ${slug} (${heroSrc})`)

    // ---- month tiers ------------------------------------------------------
    const months = CODES.map((code, i) => {
      const m = (when.months ?? [])[i]
      return TIER[m?.tier] ?? 'shoulder'
    })

    const facts = (hero.facts ?? []).map((f) => ({
      label: clean(f.label),
      value: clean(f.value),
      small: clean(f.small) || null,
    }))

    // Where the city sits, for the world map: the region it is grouped under on
    // the website, and the centre of its curated addresses.
    const coordsFile = await readJson(path.join(SRC_DATA, 'venue-coords', `${slug}.json`)).catch(() => null)
    const centre = Array.isArray(coordsFile?.center) ? coordsFile.center : null

    summaries.push({
      slug,
      name: clean(hero.name) ?? slug,
      region: regionIndex.get(slug) ?? null,
      lat: centre ? Number(centre[0].toFixed(3)) : null,
      lon: centre ? Number(centre[1].toFixed(3)) : null,
      country: countryOf(slug, c),
      tagline: clean(hero.tagline) ?? '',
      facts,
      months,
      bestMonths: clean(when.bestMonths) ?? '',
      whenBlurb: clean(when.blurb) ?? '',
      lede: clean(c.ourTake?.lede) ?? '',
    })

    // ---- the full guide, fetched only when a city is opened ---------------
    const panels = (c.guide?.panels ?? []).map((p) => ({
      key: p.key,
      tiers: (p.tiers ?? []).map((t) => ({
        label: clean(t.label) || null,
        items: (t.items ?? []).map((it) => ({
          name: clean(it.name),
          area: clean(it.area) || null,
          credentials: (it.credentials ?? []).map(clean).filter(Boolean),
          description: clean(it.description) || null,
        })),
      })),
    }))

    const detail = {
      slug,
      name: clean(hero.name) ?? slug,
      country: countryOf(slug, c),
      tagline: clean(hero.tagline) ?? '',
      facts,
      months,
      bestMonths: clean(when.bestMonths) ?? '',
      whenBlurb: clean(when.blurb) ?? '',
      ourTake: {
        lede: clean(c.ourTake?.lede) ?? '',
        comeIf: clean(c.ourTake?.comeIf) ?? '',
        skipIf: clean(c.ourTake?.skipIf) ?? '',
      },
      guide: {
        verified: clean(c.guide?.verified) || null,
        heading: splitHeading(c.guide?.headingHtml),
        lede: clean(c.guide?.lede) ?? '',
        panels,
      },
      plan: {
        heading: clean(c.plan?.heading) ?? '',
        lede: clean(c.plan?.lede) ?? '',
        days: (c.plan?.days ?? []).map((d) => ({
          label: clean(d.dayNumber) ?? '',
          title: clean(d.title) ?? '',
          slots: (d.slots ?? []).map((s) => ({
            label: clean(s.label) ?? '',
            text: clean(s.text) ?? '',
            place: clean(s.place) || null,
          })),
        })),
      },
      neighbourhoods: {
        heading: clean(c.neighbourhoods?.heading) ?? '',
        pairWith: clean(c.neighbourhoods?.pairWith) || null,
        items: (c.neighbourhoods?.items ?? []).map((n) => ({
          name: clean(n.name),
          description: clean(n.description),
        })),
      },
      whatsOn: {
        heading: clean(c.whatsOn?.heading) ?? '',
        events: (c.whatsOn?.events ?? []).map((e) => ({
          name: clean(e.name),
          when: clean(e.when) || null,
          note: clean(e.note) || null,
        })),
      },
      goodToKnow: {
        onGround: {
          heading: clean(c.goodToKnow?.onGround?.heading) ?? 'On the ground',
          note: clean(c.goodToKnow?.onGround?.note) || null,
          rows: (c.goodToKnow?.onGround?.rows ?? []).map((r) => ({
            label: clean(r.label),
            value: clean(r.value),
          })),
        },
        beforeYouGo: {
          heading: clean(c.goodToKnow?.beforeYouGo?.heading) ?? 'Before you go',
          rows: (c.goodToKnow?.beforeYouGo?.rows ?? []).map((r) => ({
            label: clean(r.label),
            value: clean(r.value),
          })),
        },
      },
      collections: (c.collections?.items ?? []).map((i) => clean(i.label ?? i.name)).filter(Boolean),
    }

    await fs.writeFile(
      path.join(OUT_CITY_JSON, `${slug}.json`),
      JSON.stringify(detail),
      'utf8',
    )

    /*
     * The map layer. Coordinates come from the engine's own venue-coords files;
     * the credentials come from the guide above and are joined by name, which is
     * the only key the two share. A pin without a match still renders — it just
     * carries no award line, which is the honest outcome.
     */
    const coords = await readJson(path.join(SRC_DATA, 'venue-coords', `${slug}.json`)).catch(
      () => null,
    )
    if (coords?.venues?.length) {
      const credentialsByName = new Map()
      for (const panel of panels) {
        for (const t of panel.tiers) {
          for (const item of t.items) {
            if (item.credentials.length) credentialsByName.set(item.name, item.credentials)
          }
        }
      }
      const venues = coords.venues
        .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon))
        .map((v) => ({
          name: clean(v.n),
          cat: v.cat,
          tier: clean(v.tier) || null,
          area: clean(v.a) || null,
          note: clean(v.d) || null,
          lat: v.lat,
          lon: v.lon,
          credentials: credentialsByName.get(clean(v.n)) ?? [],
        }))
      await fs.writeFile(
        path.join(OUT_MAP_JSON, `${slug}.json`),
        JSON.stringify({ slug, name: detail.name, center: coords.center ?? null, venues }),
        'utf8',
      )
      mapped += venues.length
    }
  }

  // ---- months -------------------------------------------------------------
  const monthOut = []
  for (let i = 0; i < 12; i += 1) {
    const name = MONTHS[i]
    const g = goin[`go-in-${name.toLowerCase()}`]
    const no = String(i + 1).padStart(2, '0')

    await resize(path.join(SRC_IMG, 'mcal', `${no}.jpg`), path.join(OUT_IMG_MONTH, `${no}-card.jpg`), CARD_PX, CARD_Q)
    const heroFrom = sourceImage(g?.hero?.image)
    await resize(
      heroFrom ? path.join(ENGINE, 'public', heroFrom) : path.join(SRC_IMG, 'mcal', `${no}.jpg`),
      path.join(OUT_IMG_MONTH, `${no}-hero.jpg`),
      HERO_PX,
      HERO_Q,
    )

    const list = (node) =>
      (node?.points ?? node?.items ?? []).map((p) => ({
        heading: clean(p.heading) || null,
        text: clean(p.text ?? p.body ?? p),
      })).filter((p) => p.text)

    monthOut.push({
      no: i + 1,
      code: CODES[i],
      name,
      heading: splitHeading(g?.hero?.headingHtml),
      lede: clean(g?.hero?.lede) ?? '',
      statement: clean(g?.intro?.statement) ?? '',
      note: clean(g?.intro?.note) ?? '',
      intro: clean(g?.intro?.lede) ?? '',
      where: list(g?.where),
      avoid: list(g?.avoid),
      indianAngle: list(g?.indianAngle),
      flightsVisas: list(g?.flightsVisas),
      pull: clean(g?.signature?.pull) || null,
    })
  }

  // ---- the opening carousel and the three services ------------------------
  // The first screen sells the idea, not the calendar, so it carries the brand's
  // own lines over its own photography. Both come from the engine's homepage.
  const brandImage = async (ref, name) => {
    const src = sourceImage(ref)
    if (!src) return null
    const ok = await resize(path.join(ENGINE, 'public', src), path.join(OUT_IMG_BRAND, `${name}.jpg`), 1400, 78)
    return ok ? name : null
  }

  /**
   * The app is a phone, so the opening frames are portrait. The website's slides
   * are landscape and lose two thirds of the picture to a tall crop, so each
   * line gets a portrait photograph from the library instead, cut at 1200 x 2100
   * (the 520px frame at 2x, with room for the slow push-in). `crop` takes the
   * centre of a landscape source; `focus` is where the frame holds its weight.
   */
  const HERO_ART = [
    { src: 'img/cityart/soneva-19.jpg', focus: '50% 55%' },
    { src: 'img/h/flights.jpg', crop: [1440, 810], focus: '50% 50%' },
    { src: 'img/cityart/chevalblanc-18.jpg', focus: '50% 60%' },
    { src: 'img/cityart/abercrombiekent-11.jpg', focus: '40% 50%' },
  ]
  const heroImage = async (art, name) => {
    const from = path.join(ENGINE, 'public', art.src)
    const to = path.join(OUT_IMG_BRAND, `${name}.jpg`)
    if (!existsSync(from)) return null
    if (!existsSync(to)) {
      // Crop first, as its own pass: sips applies -Z before -c when given both.
      if (art.crop) await run('sips', ['-c', String(art.crop[0]), String(art.crop[1]), from, '--out', to])
      else await fs.copyFile(from, to)
      const dim = async (k) => Number((await run('sips', ['-g', k, to])).stdout.match(/(\d+)\s*$/)[1])
      const [w, h] = [await dim('pixelWidth'), await dim('pixelHeight')]
      // 1170 is a 390pt phone at 3x. Never upscale: a soft hero is worse than a small one.
      const k = Math.min(1, 1170 / w, 2100 / h)
      const size = k < 1 ? ['--resampleHeightWidth', String(Math.round(h * k)), String(Math.round(w * k))] : []
      await run('sips', [...size, '-s', 'format', 'jpeg', '-s', 'formatOptions', '74', to, '--out', to])
    }
    return name
  }

  const slides = []
  for (const [i, slide] of (home?.hero?.slides ?? []).entries()) {
    const art = HERO_ART[i]
    const key = art ? await heroImage(art, `hero-${i + 1}`) : await brandImage(slide.image, `slide-${i + 1}`)
    if (!key) continue
    slides.push({
      image: key,
      focus: art?.focus ?? '50% 50%',
      eyebrow: clean(slide.eyebrow) ?? '',
      heading: splitHeading(slide.headingHtml),
      lede: clean(slide.lede) ?? '',
    })
  }

  const services = []
  for (const [i, card] of (home?.services?.cards ?? []).entries()) {
    const key = await brandImage(card.image, `service-${i + 1}`)
    services.push({
      image: key,
      number: clean(card.number) ?? String(i + 1).padStart(2, '0'),
      heading: clean(card.heading) ?? '',
      body: clean(card.body) ?? '',
    })
  }

  // ---- emit ---------------------------------------------------------------
  const banner = `// Generated by scripts/build-catalogue.mjs from the sourcing engine.
// Do not edit by hand — run \`npm run catalogue\` instead.
// Source: tripagent-sourcing-engine/src/data (cities + goin, generated ${new Date().toISOString().slice(0, 10)})
`

  const ts = `${banner}
import type { CitySummary, MonthGuide, Slide, Service } from '@/lib/types'

export const CITIES: CitySummary[] = ${JSON.stringify(summaries, null, 0)}

export const MONTHS: MonthGuide[] = ${JSON.stringify(monthOut, null, 0)}

export const SLIDES: Slide[] = ${JSON.stringify(slides, null, 0)}

export const SERVICES: Service[] = ${JSON.stringify(services, null, 0)}

export const CITY_BY_SLUG: Record<string, CitySummary> = Object.fromEntries(
  CITIES.map((c) => [c.slug, c]),
)
`
  await fs.writeFile(path.join(APP, 'src/data/catalogue.generated.ts'), ts, 'utf8')

  // The agent's copy: summaries plus the month matrix, no images.
  const agentDir = path.join(AGENT, 'data')
  try {
    await fs.mkdir(agentDir, { recursive: true })
    await fs.writeFile(
      path.join(agentDir, 'catalogue.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), cities: summaries, months: monthOut }),
      'utf8',
    )
    console.log(`agent:    ${path.relative(process.cwd(), path.join(agentDir, 'catalogue.json'))}`)
  } catch (e) {
    console.warn(`  ! could not write the agent catalogue: ${e.message}`)
  }

  /*
   * The itinerary stylesheet is NO LONGER synced from the agent.
   *
   * It used to be: one file for both renderings, the agent's shared plan page and
   * this app's Itinerary screen, with the agent owning it. The Nocturne redesign
   * ends that. The in-app itinerary is now a dark document in the app's own
   * system, while the page a member forwards stays the agent's own light sheet —
   * two deliberately different objects. Copying the agent's file over
   * src/styles/itinerary.css would silently wipe the redesign, so it does not.
   *
   * `humanize.ts` is still shared: it is logic, not appearance, and both
   * renderings must strip em dashes the same way.
   */
  try {
    const hum = await fs.readFile(path.join(AGENT, 'src/trip/humanize.ts'), 'utf8')
    await fs.writeFile(
      path.join(APP, 'src/lib/humanize.ts'),
      `// Copied from tripagent/src/trip/humanize.ts by npm run catalogue — edit it there.\n${hum}`,
      'utf8',
    )
  } catch (e) {
    console.warn(`  ! could not sync humanize.ts: ${e.message}`)
  }

  const size = (await fs.stat(path.join(APP, 'src/data/catalogue.generated.ts'))).size
  console.log(`cities:   ${summaries.length}`)
  console.log(`months:   ${monthOut.length}`)
  console.log(`images:   ${copied}/${slugs.length} cities + 12 months (card + hero each)`)
  console.log(`map:      ${mapped} venues with coordinates`)
  console.log(`brand:    ${slides.length} slides, ${services.length} services`)
  console.log(`index:    ${Math.round(size / 1024)} KB`)

  // ---- the house's terms, as published on tripagent.vip ----------------------
  // Only <b> and mailto links survive; everything else is escaped. Em dashes read
  // as machine copy on a phone, so they become commas, as on the itinerary.
  const legal = await readJson(path.join(SRC_DATA, 'legal.generated.json')).catch(() => null)
  if (legal) {
    const esc = (s) => s.replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const safe = (html) =>
      esc(String(html ?? ''))
        .replace(/&lt;(\/?)b&gt;/g, '<$1b>')
        .replace(/&lt;a href="(mailto:[^"&<>]+)"&gt;(.*?)&lt;\/a&gt;/g, '<a href="$1">$2</a>')
        .replace(/\s*[—–]\s*/g, ', ')
    const out = {}
    for (const [slug, page] of Object.entries(legal)) {
      out[slug] = {
        heading: clean(page.hero?.heading) ?? slug,
        eyebrow: clean(page.hero?.eyebrow) ?? 'Legal',
        standfirst: (clean(page.hero?.standfirst) ?? '').replace(/\s*[—–]\s*/g, ', '),
        updated: clean(page.hero?.updated) ?? '',
        nodes: (page.nodes ?? []).map((n) =>
          n.kind === 'list' ? { kind: 'list', items: (n.items ?? []).map(safe) } : { kind: n.kind === 'heading' ? 'heading' : 'paragraph', html: safe(n.html) },
        ),
      }
    }
    await fs.writeFile(path.join(APP, 'public/data/legal.json'), JSON.stringify(out))
    console.log(`legal:    ${Object.keys(out).join(', ')}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
