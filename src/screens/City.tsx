import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Screen, TopBar, Dock } from '@/components/Shell'
import { Photo, GlassChip, Cred, Card, Btn, Chip, Clamp, Disclosure, Icon, Sig } from '@/components/ui'
import { CITIES, MONTHS } from '@/data/catalogue.generated'
import {
  PANEL_LABELS,
  cityHero,
  loadCity,
  type CityDetail,
  type MonthTier,
  type PanelKey,
  type Row,
  type CitySummary,
} from '@/lib/catalogue'
import { LiveRates } from '@/components/LiveRates'
import { savedCityKey, savedItemKey } from '@/lib/itinerary'
import { useStore } from '@/context/store'

/** What a month is worth, in the member's words rather than the trade's. */
const TIER_WORD: Record<MonthTier, string> = {
  peak: 'at its best',
  shoulder: 'good',
  avoid: 'not now',
}

/** The ribbon: champagne for the best months, an outline for the good ones. */
function monthStyle(tier: MonthTier): React.CSSProperties {
  if (tier === 'peak') {
    return { background: 'var(--champagne)', border: '1px solid var(--champagne)', color: 'var(--ink-0)', fontWeight: 600 }
  }
  if (tier === 'shoulder') {
    return { border: '1px solid var(--ivory-3)', color: 'var(--ivory-2)', fontWeight: 500 }
  }
  return { background: 'var(--line)', border: '1px solid transparent', color: 'var(--ivory-3)', fontWeight: 500 }
}

/** A practical fact, given the glyph that matches what it answers. */
const FACT_ICONS: [string, string][] = [
  ['arriv', 'plane'],
  ['flight', 'plane'],
  ['getting around', 'car'],
  ['money', 'wallet'],
  ['pay', 'wallet'],
  ['climate', 'sun'],
  ['weather', 'sun'],
  ['dining', 'dine'],
  ['food', 'dine'],
  ['veg', 'dine'],
  ['visa', 'passport'],
  ['passport', 'passport'],
  ['language', 'globe'],
  ['connect', 'globe'],
  ['safety', 'shield'],
  ['health', 'shield'],
  ['etiquette', 'rosette'],
  ['tipping', 'wallet'],
  ['power', 'sun'],
  ['time', 'clock'],
]

function factIcon(label: string) {
  const key = label.trim().toLowerCase()
  return FACT_ICONS.find(([k]) => key.includes(k))?.[1] ?? 'info'
}

/** The good-to-know rows: one glyph, one question, one answer. */
function FactRows({ rows, note }: { rows: Row[]; note?: string | null }) {
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Card className="px-[18px]">
        <ul>
          {rows.map((r) => (
            <li key={r.label} className="k-row items-start gap-3.5 py-3.5">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full c-ivory-2"
                style={{ border: '1px solid var(--line-2)' }}
              >
                <Icon name={factIcon(r.label)} size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-title-s">{r.label}</span>
                <span className="t-caption">{r.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {note ? <p className="t-caption c-ivory-3">{note}</p> : null}
    </div>
  )
}

/**
 * A destination we have not written up.
 *
 * The old version of this was a dead end: a sentence and a button back to
 * Discover. But not having a guide is not the same as not being able to help —
 * Tara can research anywhere, so the one thing this screen must do is offer
 * that, and offer it as the main action rather than a footnote.
 *
 * Above it, anything close we *do* have, because a member who typed "como" and
 * meant Lake Como should not have to guess our spelling.
 */
function NoGuide({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { setActiveCity } = useStore()
  const asked = humaniseSlug(slug)
  const near = useMemo(() => nearestCities(slug), [slug])

  return (
    <Screen tone="light" tabs={false}>
      <TopBar back="/" solid title="Destination" />
      <section className="flex flex-col gap-4 px-6" style={{ paddingTop: 108 }}>
        <h1 className="t-display-l">
          No guide for <Sig>{asked}</Sig> yet.
        </h1>
        <p className="t-body c-ivory-2 max-w-quote">
          We write these ourselves, city by city, and have not reached this one. That does not
          mean we cannot plan it — Tara can research it with you now, and the Desk books it the
          same way as anywhere else.
        </p>
      </section>

      {near.length > 0 ? (
        <section className="flex flex-col gap-4 px-6 pt-10">
          <h2 className="t-display-s">Did you mean one of these?</h2>
          <Card className="px-4">
            {near.map((c) => (
              <button
                key={c.slug}
                type="button"
                className="k-row w-full py-3.5 text-left"
                onClick={() => {
                  setActiveCity(c.slug)
                  navigate(`/city/${c.slug}`, { replace: true })
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-title-s truncate">{c.name}</span>
                  {c.country ? <span className="t-caption truncate">{c.country}</span> : null}
                </span>
                <Icon name="chevron-right" size={18} className="c-ivory-3 shrink-0" />
              </button>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 px-6 pt-10">
        <Btn
          tone="primary"
          block
          icon="horizon"
          onClick={() =>
            navigate('/concierge', {
              state: { query: `I would like to go to ${asked}. What should I know, and when is best?` },
            })
          }
        >
          Ask Tara about {asked}
        </Btn>
        <Btn tone="ghost" block onClick={() => navigate('/map')}>
          See everywhere we cover
        </Btn>
        <p className="t-caption c-ivory-3 pt-1 text-center">
          {CITIES.length} destinations have a written guide. Tara is not limited to them.
        </p>
      </section>
    </Screen>
  )
}

/** "lake-como" → "Lake Como". Only for showing back what someone asked for. */
function humaniseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * The closest guides we actually have.
 *
 * Scored on shared words with the name or country, then on a shared opening —
 * enough to catch a misspelling or a half-remembered name without pretending to
 * be a search engine. Nothing weak is offered: a bad suggestion is worse than
 * none, because it sends a member somewhere they did not ask for.
 */
function nearestCities(slug: string): CitySummary[] {
  const asked = slug.toLowerCase().split('-').filter(Boolean)
  if (!asked.length) return []
  const scored = CITIES.map((c) => {
    const hay = `${c.slug} ${c.name} ${c.country ?? ''} ${c.region ?? ''}`.toLowerCase()
    let score = 0
    for (const w of asked) {
      if (w.length < 3) continue
      if (hay.includes(w)) score += 3
      else if (hay.split(/[\s-]+/).some((h) => h.startsWith(w.slice(0, 4)))) score += 1
    }
    return { c, score }
  })
  return scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.c)
}

export default function City() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { isSaved, toggleSaved, setActiveCity } = useStore()

  const [city, setCity] = useState<CityDetail | null>(null)
  const [error, setError] = useState(false)
  const [panel, setPanel] = useState<PanelKey>('stay')
  const [tierIndex, setTierIndex] = useState(0)
  const [day, setDay] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCity(null)
    setError(false)
    setPanel('stay')
    setTierIndex(0)
    loadCity(slug)
      .then((c) => {
        if (cancelled) return
        setCity(c)
        setActiveCity(slug)
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [slug, setActiveCity])

  const current = useMemo(
    () => city?.guide.panels.find((p) => p.key === panel) ?? null,
    [city, panel],
  )
  const tier = current?.tiers[tierIndex] ?? null
  const shown = expanded ? tier?.items ?? [] : (tier?.items ?? []).slice(0, 6)

  if (error) return <NoGuide slug={slug} />

  if (!city) {
    return (
      <Screen tone="light">
        <p className="t-caption px-6 py-24 text-center">Opening the guide…</p>
      </Screen>
    )
  }

  const cityKey = savedCityKey(city.slug)
  const citySaved = isSaved(cityKey)
  const planDay = city.plan.days[day]
  const thisMonth = new Date().getMonth() // 0-based
  const factCols = Math.min(city.facts.length || 1, 4)

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: city?.name ?? 'TripAgent', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShared(true)
      window.setTimeout(() => setShared(false), 2400)
    } catch {
      /* the member cancelled, or the browser refused — say nothing */
    }
  }

  return (
    <Screen tone="light" tabs={false} dock>
      {/* Hero */}
      <div className="relative">
        <Photo
          src={cityHero(city.slug)}
          alt={`${city.name}, ${city.country ?? ''}`.trim()}
          label={city.name}
          veil="hero"
          radius={0}
          eager
          className="h-[600px] w-full"
        >
          <div className="absolute inset-x-6 bottom-[60px] z-[2] flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              {city.country ? <p className="t-caption">{city.country}</p> : null}
              <h1 className="t-display-xl">{city.name}</h1>
              <p
                className="t-italic mt-1 max-w-[300px]"
                style={{ fontFamily: 'var(--f-display)', fontSize: 19, lineHeight: '26px', color: 'var(--ivory-2)' }}
              >
                {city.tagline}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {city.guide.verified ? <GlassChip icon="check">{city.guide.verified}</GlassChip> : null}
              {citySaved ? <GlassChip icon="bookmark">In your saved</GlassChip> : null}
            </div>
          </div>
        </Photo>

        <TopBar
          actions={
            <>
              <button type="button" aria-label={`Share ${city.name}`} className="k-icon-btn" onClick={() => void share()}>
                <Icon name="share" size={20} />
              </button>
              <button
                type="button"
                aria-label={citySaved ? `Remove ${city.name} from saved` : `Save ${city.name}`}
                aria-pressed={citySaved}
                className="k-icon-btn"
                style={citySaved ? { color: 'var(--champagne)' } : undefined}
                onClick={() => toggleSaved(cityKey)}
              >
                <Icon name="bookmark" size={20} filled={citySaved} />
              </button>
            </>
          }
        />
        {shared ? (
          <p className="absolute inset-x-0 top-[116px] z-30 text-center t-caption">Link copied.</p>
        ) : null}
      </div>

      {/* The four facts, a plate of glass laid over the photograph */}
      {city.facts.length > 0 && (
        <dl
          className="k-glass-strong relative z-[3] mx-6 grid"
          style={{ marginTop: -32, borderRadius: 22, gridTemplateColumns: `repeat(${factCols}, minmax(0, 1fr))` }}
        >
          {city.facts.map((f, i) => (
            <div
              key={f.label}
              className="my-4 flex flex-col items-center gap-1.5 px-1 text-center"
              style={i % factCols === 0 ? undefined : { borderLeft: '1px solid var(--line-2)' }}
            >
              <dt className="t-label c-ivory-3" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
                {f.label}
              </dt>
              <dd className="flex flex-col items-center">
                <span className="t-title-s t-figure">{f.value}</span>
                {f.small ? <span className="t-caption t-figure">{f.small}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* The verdict first */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <h2 className="t-display-s">Our take</h2>
        <Clamp lines={3}>{city.ourTake.lede}</Clamp>
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-2.5 p-4" style={{ borderRadius: 20 }}>
            <p className="t-title-s flex items-center gap-2">
              <span style={{ color: 'var(--sage)' }}>
                <Icon name="check" size={18} />
              </span>
              Come if
            </p>
            <p className="t-body-s c-ivory-2">{city.ourTake.comeIf}</p>
          </Card>
          <Card className="flex flex-col gap-2.5 p-4" style={{ borderRadius: 20 }}>
            <p className="t-title-s flex items-center gap-2">
              <span className="c-ivory-3">
                <Icon name="close" size={18} />
              </span>
              Skip if
            </p>
            <p className="t-body-s c-ivory-2">{city.ourTake.skipIf}</p>
          </Card>
        </div>
      </section>

      {/* The year, as a ribbon */}
      <section className="flex flex-col gap-5 px-6 pt-14">
        <h2 className="t-display-s">When to go</h2>
        <div className="flex flex-col gap-3.5">
          <ol
            aria-label={`${city.name}, month by month`}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
          >
            {city.months.map((t, i) => (
              <li key={MONTHS[i].code}>
                <button
                  type="button"
                  onClick={() => navigate(`/month/${i + 1}`)}
                  className="relative flex h-12 w-full items-center justify-center rounded-full text-[13px] leading-4"
                  style={{
                    ...monthStyle(t),
                    ...(i === thisMonth
                      ? { boxShadow: '0 0 0 2px var(--ink-0), 0 0 0 3.5px var(--ivory)' }
                      : null),
                  }}
                >
                  <span aria-hidden="true">{MONTHS[i].code.slice(0, 1)}</span>
                  <span className="sr-only">
                    {MONTHS[i].name}, {TIER_WORD[t]}
                    {i === thisMonth ? ', this month' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div aria-hidden="true" className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <span className="t-caption inline-flex items-center gap-1.5 text-[12px] leading-4">
                <span className="h-3.5 w-2 rounded-full" style={{ background: 'var(--champagne)' }} />
                At its best
              </span>
              <span className="t-caption inline-flex items-center gap-1.5 text-[12px] leading-4">
                <span className="h-3.5 w-2 rounded-full" style={{ border: '1px solid var(--ivory-3)' }} />
                Good
              </span>
              <span className="t-caption inline-flex items-center gap-1.5 text-[12px] leading-4">
                <span className="h-3.5 w-2 rounded-full" style={{ background: 'var(--line-2)' }} />
                Not now
              </span>
            </div>
            <span className="t-caption inline-flex items-center gap-1.5 text-[12px] leading-4 c-ivory">
              <span className="h-3 w-3 rounded-full" style={{ border: '1.5px solid var(--ivory)' }} />
              This month
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3.5">
          <Clamp lines={2}>{city.whenBlurb}</Clamp>
          <button
            type="button"
            onClick={() => navigate(`/month/${thisMonth + 1}`)}
            className="k-link min-h-[44px]"
          >
            Go in {MONTHS[thisMonth].name}
            <Icon name="forward" size={16} />
          </button>
        </div>
      </section>

      {/* The guide */}
      <section className="flex flex-col gap-5 px-6 pt-12">
        <div className="flex flex-col gap-1.5">
          <div className="k-section-head">
            <h2 className="t-display-s">
              {city.guide.heading.accent ? (
                <>
                  {city.guide.heading.text.split(city.guide.heading.accent)[0]}
                  <em className="t-italic c-champagne">{city.guide.heading.accent}</em>
                  {city.guide.heading.text.split(city.guide.heading.accent)[1]}
                </>
              ) : (
                city.guide.heading.text
              )}
            </h2>
            <button
              type="button"
              onClick={() => navigate(`/city/${city.slug}/map`)}
              className="k-link c-ivory-2"
            >
              <Icon name="map" size={16} />
              Map
            </button>
          </div>
          <p className="t-caption">{city.guide.lede}</p>
        </div>

        <div
          role="tablist"
          aria-label="The guide"
          className="grid h-12 gap-1 rounded-full p-1"
          style={{
            gridTemplateColumns: `repeat(${city.guide.panels.length}, minmax(0, 1fr))`,
            background: 'var(--ink-2)',
            border: '1px solid var(--line)',
          }}
        >
          {city.guide.panels.map((p) => {
            const on = panel === p.key
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={on}
                className="t-title-s truncate rounded-full px-1 text-center text-[14px]"
                style={on ? { background: 'var(--ivory)', color: 'var(--ink-0)' } : { color: 'var(--ivory-2)' }}
                onClick={() => {
                  setPanel(p.key)
                  setTierIndex(0)
                  setExpanded(false)
                }}
              >
                {PANEL_LABELS[p.key] ?? p.key}
              </button>
            )
          })}
        </div>

        {(current?.tiers.length ?? 0) > 1 && (
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6">
            {current!.tiers.map((t, i) => (
              <Chip
                key={t.label ?? i}
                on={tierIndex === i}
                onClick={() => {
                  setTierIndex(i)
                  setExpanded(false)
                }}
              >
                {t.label ?? 'All'} ({t.items.length})
              </Chip>
            ))}
          </div>
        )}

        {panel === 'stay' && <LiveRates slug={city.slug} name={city.name} />}

        <ul className="flex flex-col gap-3">
          {shown.map((item) => {
            const itemKey = savedItemKey(city.slug, item.name)
            const saved = isSaved(itemKey)
            return (
              <li key={item.name}>
                <Card className="relative flex flex-col gap-3.5 p-[18px]" style={{ borderRadius: 20 }}>
                  <button
                    type="button"
                    aria-label={saved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
                    aria-pressed={saved}
                    onClick={() => toggleSaved(itemKey)}
                    className={`k-icon-btn ${saved ? '' : 'k-icon-btn-solid'} absolute right-3.5 top-3.5 z-[2]`}
                    style={
                      saved
                        ? {
                            width: 36,
                            height: 36,
                            background: 'var(--champagne-3)',
                            borderColor: 'var(--champagne-line)',
                            color: 'var(--champagne)',
                          }
                        : { width: 36, height: 36 }
                    }
                  >
                    <Icon name="bookmark" size={16} filled={saved} />
                  </button>

                  <div className="flex flex-col gap-1 pr-11">
                    {item.area ? <p className="t-caption">{item.area}</p> : null}
                    <h3 className="t-display-s">{item.name}</h3>
                  </div>

                  {item.credentials.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.credentials.map((c) => (
                        <Cred key={c}>{c}</Cred>
                      ))}
                    </div>
                  )}

                  {item.description ? <p className="t-body-s c-ivory-2">{item.description}</p> : null}

                  <p
                    className="t-caption c-ivory-3 pt-3.5"
                    style={{ borderTop: '1px solid var(--line)' }}
                  >
                    Rate on request · the Desk quotes
                  </p>
                </Card>
              </li>
            )
          })}
        </ul>

        {(tier?.items.length ?? 0) > 6 && (
          <Btn tone="ghost" block onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show fewer' : `Show all ${tier!.items.length}`}
          </Btn>
        )}
      </section>

      {/* The shape of the days */}
      {city.plan.days.length > 0 && (
        <section className="flex flex-col gap-5 pt-14">
          <div className="flex flex-col gap-1.5 px-6">
            <p className="t-label c-ivory-3">The shape</p>
            <h2 className="t-display-s">{city.plan.heading}</h2>
            {city.plan.lede ? <p className="t-caption">{city.plan.lede}</p> : null}
          </div>

          <div className="flex gap-3 overflow-x-auto px-6">
            {city.plan.days.map((d, i) => (
              <Chip key={d.label} on={day === i} onClick={() => setDay(i)}>
                {d.label}
              </Chip>
            ))}
          </div>

          {planDay && (
            <div className="px-6">
              <Card className="flex flex-col" style={{ borderRadius: 20 }}>
                <div className="flex flex-col gap-1 p-[18px]">
                  <p className="t-label c-ivory-3">{planDay.label}</p>
                  <h3 className="t-display-s">{planDay.title}</h3>
                </div>
                <ul className="px-[18px] pb-2">
                  {planDay.slots.map((s) => (
                    <li key={s.label} className="k-row items-start gap-3.5 py-3.5">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="t-label c-ivory-3">{s.label}</span>
                        <span className="t-body-s c-ivory-2">{s.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------- the reference --
          Below the guide, a city page stops being reading and becomes
          reference. Folded, the page ends somewhere a member can actually
          reach; nothing here has been cut, only closed. */}
      <section className="px-6 pt-14">
        {city.neighbourhoods.items.length > 0 && (
          <Disclosure
            title={city.neighbourhoods.heading}
            icon="pin"
            count={city.neighbourhoods.items.length}
          >
            <ul>
              {city.neighbourhoods.items.map((n) => (
                <li key={n.name} className="k-row items-start gap-3.5 py-4">
                  <span className="c-ivory-2">
                    <Icon name="pin" size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="t-title-s">{n.name}</span>
                    <span className="t-caption">{n.description}</span>
                  </span>
                </li>
              ))}
            </ul>
            {city.neighbourhoods.pairWith && (
              <p className="t-caption c-ivory-3 pt-2">Pairs well with {city.neighbourhoods.pairWith}</p>
            )}
          </Disclosure>
        )}

        {city.whatsOn.events.length > 0 && (
          <Disclosure
            title={city.whatsOn.heading}
            icon="calendar"
            count={city.whatsOn.events.length}
          >
            <ul className="flex flex-col gap-3">
              {city.whatsOn.events.map((e) => (
                <li key={e.name}>
                  <Card className="flex flex-col gap-1.5 p-[18px]" style={{ borderRadius: 20 }}>
                    {e.when ? <p className="t-label c-champagne t-figure">{e.when}</p> : null}
                    <h3 className="t-title">{e.name}</h3>
                    {e.note ? <p className="t-body-s c-ivory-2">{e.note}</p> : null}
                  </Card>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        <Disclosure title={city.goodToKnow.onGround.heading} icon="info">
          <FactRows rows={city.goodToKnow.onGround.rows} note={city.goodToKnow.onGround.note} />
        </Disclosure>

        {city.goodToKnow.beforeYouGo.rows.length > 0 && (
          <Disclosure title={city.goodToKnow.beforeYouGo.heading} icon="check">
            <FactRows rows={city.goodToKnow.beforeYouGo.rows} />
          </Disclosure>
        )}

        <p className="t-caption c-ivory-3 flex items-center justify-center gap-2 pt-8">
          <Icon name="shield" size={14} />
          {city.guide.verified ? `${city.guide.verified} · ` : ''}rates quoted by the Desk
        </p>
      </section>

      <Dock>
        <button
          type="button"
          onClick={() => navigate('/concierge', { state: { city: city.slug } })}
          className="k-btn k-btn-primary flex-1"
          style={{ padding: '0 18px' }}
        >
          <Icon name="horizon" size={20} />
          Plan {city.name} with Tara
        </button>
        <button
          type="button"
          onClick={() => navigate('/desk')}
          aria-label="Speak to the Desk"
          className="k-icon-btn k-icon-btn-solid"
          style={{ width: 52, height: 52 }}
        >
          <Icon name="phone" size={20} />
        </button>
      </Dock>
    </Screen>
  )
}
