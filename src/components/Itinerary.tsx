import { flushSync } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '@/context/store'
import { usePlacePhoto } from '@/lib/usePlacePhoto'
import type { PlacePhoto } from '@/lib/agentClient'
import { CITY_BY_SLUG } from '@/data/catalogue.generated'
import { cityHero, cityCard } from '@/lib/catalogue'
import type { Choice, ChoiceGroup, DayRow, Guidance, Nudge, PlanBundle, Row, TripPlan } from '@/lib/plan'
import '@/styles/proposal.css'

export interface ItineraryProps {
  bundle: PlanBundle & { plan: TripPlan }
  madeFor?: string
  coming: Nudge[]
  status?: ReactNode
  onRefine: (message: string) => void
  onAsk: (draft: string) => void
  onShare: () => void
  footer?: ReactNode
  bookingAction?: { label: string; detail: string; onClick: () => void }
}
const safeUrl = (url?: string) => url && /^https:\/\//i.test(url) ? url : undefined
const placeName = (slug?: string | null) => slug ? CITY_BY_SLUG[slug]?.name ?? slug.replace(/-/g, ' ') : ''
const hotelName = (name: string) => name.split(/\s[·|]\s|,/)[0].trim()
const dateLabel = (date?: string) => date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : date
function Credit({ photo }: { photo: PlacePhoto }) {
  return <span><a href={safeUrl(photo.googleMapsUri) ?? 'https://maps.google.com'} target="_blank" rel="noreferrer">Google Maps</a>{photo.authors?.length ? photo.authors.map((a, i) => <span key={i}> · {safeUrl(a.uri) ? <a href={a.uri} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</span>) : photo.attribution ? ` · ${photo.attribution}` : null}</span>
}
function Photo({ query, expectedName, fallback, className, thumb = false }: { query: string; expectedName?: string; fallback?: string | null; className: string; thumb?: boolean }) {
  const photo = usePlacePhoto(query, expectedName)
  const [failed, setFailed] = useState<string | null>(null)
  const src = photo?.url ?? fallback
  if (!src || failed === src) return <div className={`${className} pv-placeholder`}>{expectedName ? 'Hotel photo unavailable' : query || 'Destination photo unavailable'}</div>
  return <figure><img className={className} src={src} alt={photo ? expectedName ?? photo.placeName : `${query} · destination photograph`} loading="lazy" onError={() => setFailed(src)} />{<figcaption className={`pv-photo-credit ${thumb ? 'pv-photo-credit--thumb' : ''}`}>{photo ? <Credit photo={photo} /> : `${query} · destination photograph`}</figcaption>}</figure>
}
function Sources({ links }: { links?: { t: string; u: string }[] }) {
  return <div className="pv-sources">{links?.filter(l => safeUrl(l.u)).map((l, i) => <a key={i} href={l.u} target="_blank" rel="noreferrer">{l.t}</a>)}</div>
}
function PriceEvidence({ option }: { option: Choice }) {
  const e = option.priceEvidence
  return <details className="pv-evidence"><summary>{e ? 'Indicative web price · source & details' : 'Details & what to confirm'}</summary>
    {option.details && <p>{option.details}</p>}
    {option.why && <p><strong>Why this choice:</strong> {option.why}</p>}
    {option.tradeoff && <p><strong>Worth considering:</strong> {option.tradeoff}</p>}
    {option.inclusions?.map((item, i) => <p key={i}>{item.label} · {item.status === 'included' ? 'Included' : 'Requested, to confirm'}{safeUrl(item.source) && <> · <a href={item.source} target="_blank" rel="noreferrer">Source</a></>}</p>)}
    {e && <><p>{e.unit} · {e.match === 'exact' ? 'Matches the stated search basis' : 'Public from-rate; your exact trip is not confirmed'}</p><p>{e.basis}</p><p>{e.terms}</p><p>Checked {dateLabel(e.checkedAt.slice(0, 10))}. Availability and final pricing need confirmation.</p></>}
    {safeUrl(e?.source ?? option.source) && <p><a href={e?.source ?? option.source} target="_blank" rel="noreferrer">View price source</a>{!e && option.checked ? ` · checked ${option.checked}` : ''}</p>}
  </details>
}
const price = (o: Choice) => o.priceEvidence && !/^indicative/i.test(o.price) ? `Indicative · ${o.price}` : o.price || 'Not checked'
function Badge({ chosen }: { chosen: number }) { return <span className="pv-chip pv-chip--choice">{chosen === 0 ? '★ Our choice' : 'Selected'}</span> }
function Flight({ option: o, chosen }: { option: Choice; chosen: number }) {
  const f = o.flight
  const timing = (time?: string) => time && /^\d{2}:\d{2}$/.test(time) ? time : 'To confirm'
  return <div className="pv-recflight">
    <div className="pv-recflight-head"><span className="pv-option-name">{o.name}</span><Badge chosen={chosen} /></div>
    {f ? <div className="pv-recflight-row"><div><div className="pv-recflight-time">{timing(f.depTime)}</div><div className="pv-recflight-city">{f.depCity}</div></div><div className="pv-recflight-mid"><div className="pv-recflight-nos">{f.flightNos || 'Schedule to confirm'}</div><div className="pv-recflight-line" /><div className="pv-recflight-sub">{[f.duration, f.cabin].filter(Boolean).join(' · ')}</div></div><div style={{ textAlign: 'right' }}><div className="pv-recflight-time">{timing(f.arrTime)}</div><div className="pv-recflight-city">{f.arrCity}</div></div></div> : <p className="pv-option-detail">Route and schedule to confirm</p>}
    <div className="pv-recflight-foot"><span>{o.highlights?.join(' · ') || o.details}</span><span className="pv-option-price">{price(o)}</span></div><PriceEvidence option={o} />
  </div>
}
function Stay({ option: o, chosen, place }: { option: Choice; chosen: number; place: string }) {
  const name = hotelName(o.name)
  return <div className="pv-recstay-stacked"><div className="pv-recstay-stacked-media"><Photo query={`${name} ${place}`} expectedName={name} className="pv-recstay-stacked-photo" /><div className="pv-recstay-chip-overlay"><Badge chosen={chosen} /></div></div><div className="pv-recstay-stacked-body"><span className="pv-option-name">{o.name}</span><div className="pv-option-detail">{o.highlights?.length ? <ul>{o.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> : o.details}</div><div className="pv-option-price pv-option-price--hotel" style={{ marginTop: 10 }}>{price(o)}</div><PriceEvidence option={o} /></div></div>
}
function Group({ group, kind, chosen, choose, place }: { group: ChoiceGroup; kind: 'flight' | 'stay'; chosen: number; choose: (index: number) => void; place: string }) {
  const options = [group.recommended, ...group.alternatives]
  const selected = options[chosen] ? chosen : 0
  const current = options[selected]
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 641px)').matches)
  useEffect(() => { const mq = window.matchMedia('(min-width: 641px)'); const change = () => setWide(mq.matches); mq.addEventListener('change', change); return () => mq.removeEventListener('change', change) }, [])
  return <section className="pv-recgroup" aria-label={group.label}><div className={`pv-recgroup-head ${kind === 'flight' ? 'pv-recgroup-head--flight' : ''}`}><h3 className="pv-recgroup-title">{group.label}</h3></div>
    <div className={kind === 'stay' ? 'pv-recgroup-split' : undefined}><div>{kind === 'flight' ? <Flight option={current} chosen={selected} /> : <Stay option={current} chosen={selected} place={place} />}</div>
      {options.length > 1 && <details className={`pv-otheroptions ${kind === 'stay' ? 'pv-stay-alternatives' : ''}`} open={kind === 'stay' && wide ? true : undefined}><summary>Other options</summary><div className={kind === 'stay' ? 'pv-alt-stack' : 'pv-alt-grid'}>{options.map((o, i) => i === selected ? null : <div key={i}><div className="pv-option">{kind === 'stay' && <Photo query={`${hotelName(o.name)} ${place}`} expectedName={hotelName(o.name)} className="pv-option-thumb" thumb />}<div className="pv-option-body"><span className="pv-option-name">{o.name}</span>{o.flight?.depTime && o.flight.arrTime && <div className="pv-option-timing">{o.flight.depTime} – {o.flight.arrTime}</div>}<div className="pv-option-detail">{o.highlights?.join(' · ') || o.details}</div></div><div className="pv-option-side"><span className="pv-option-price">{price(o)}</span><button className="pv-swap-btn" onClick={() => choose(i)} aria-label={`Swap to ${o.name}`}>Swap</button></div></div><PriceEvidence option={o} /></div>)}</div></details>}
    </div>
  </section>
}
function Rows({ rows }: { rows: Row[] }) { return <div className="pv-days">{rows.map((r, i) => <div className="pv-day" key={i}><span className="pv-day-num">{i + 1}</span><div><h3 className="pv-day-head">{r.t}</h3>{r.m && <p className="pv-day-meta">{r.m}</p>}{r.highlights?.length ? <ul className="pv-bullets">{r.highlights.map((h, j) => <li key={j}>{h}</li>)}</ul> : r.d && <p className="pv-day-body">{r.d}</p>}</div></div>)}</div> }
function GuidanceCard({ guidance }: { guidance: Guidance }) { return <section className="pv-decision"><h3>{guidance.title}</h3><ul className="pv-bullets">{guidance.points.map((p, i) => <li key={i}>{p}</li>)}</ul><Sources links={guidance.sources} />{guidance.checked && <p>Checked {guidance.checked}</p>}</section> }
function DayCard({ day, index, slug, hidden }: { day: DayRow; index: number; slug?: string | null; hidden: boolean }) {
  const place = placeName(day.place || slug)
  return <article className="pv-day-card" hidden={hidden}><Photo query={place} fallback={slug ? cityCard(slug) : undefined} className="pv-day-card-photo" /><div className="pv-day-card-body"><div className="pv-recgroup-eyebrow">Day {index + 1}{day.date ? ` · ${dateLabel(day.date)}` : ''}</div><h3 className="pv-day-head">{day.t}</h3>{day.m && <p className="pv-day-meta">{day.m}</p>}{day.highlights?.length ? <ul className="pv-bullets">{day.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul> : <p className="pv-day-body">{day.d}</p>}</div></article>
}

export function Itinerary({ bundle, madeFor, coming, status, onRefine, onAsk, onShare, footer, bookingAction }: ItineraryProps) {
  const p = bundle.plan
  const { choices: saved, setChoices } = useStore()
  const [preview, setPreview] = useState<Record<string, number>>({})
  const isSaved = /^[a-f0-9]{64}$/.test(bundle.key)
  const choices = isSaved ? saved[bundle.key] ?? {} : preview
  const [tab, setTab] = useState('Plan')
  const [day, setDay] = useState(-1)
  const [daysOpened, setDaysOpened] = useState(false)
  const [printing, setPrinting] = useState(false)
  const tabs = useRef<HTMLDivElement>(null)
  const dayTabs = useRef<HTMLDivElement>(null)
  const heroName = placeName(bundle.places.hero || p.places?.[0])
  const heroPhoto = usePlacePhoto(heroName)
  const hero = heroPhoto?.url ?? (bundle.places.hero ? cityHero(bundle.places.hero) : undefined)
  const [failedHero, setFailedHero] = useState<string | null>(null)
  const select = (key: string, index: number) => { const next = { ...choices, [key]: index }; if (isSaved) setChoices(bundle.key, next); else setPreview(next) }
  const go = (next: string, scroll = true) => { setTab(next); if (next === 'Days') setDaysOpened(true); if (scroll) tabs.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  useEffect(() => { const before = () => flushSync(() => { setPrinting(true); setDaysOpened(true) }); const after = () => setPrinting(false); window.addEventListener('beforeprint', before); window.addEventListener('afterprint', after); return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) } }, [])
  const changes = [...p.flightOptions.map((g, i) => ({ g, key: `flight-${i}` })), ...p.hotelOptions.map((g, i) => ({ g, key: `stay-${i}` }))].filter(({ key }) => choices[key] > 0).map(({ g, key }) => `${g.label}: ${[g.recommended, ...g.alternatives][choices[key]]?.name}`)
  return <div className="pv-page"><div className="pv-shell"><article className="pv-card">
    <header className="pv-hero" style={hero && failedHero !== hero ? { backgroundImage: `url(${JSON.stringify(hero)})` } : undefined}>
      {hero && <img src={hero} alt="" hidden onError={() => setFailedHero(hero)} />}
      <div className="pv-hero-scrim" /><div className="pv-hero-content"><div className="pv-header"><div className="pv-header-left"><span className="pv-wordmark">TripAgent</span>{madeFor && <span className="pv-madefor">Made for {madeFor}</span>}</div><button className="pv-dlbtn" onClick={() => { flushSync(() => { setPrinting(true); setDaysOpened(true) }); window.print(); setPrinting(false) }}>↓ Download PDF</button></div><h1 className="pv-title">{p.title}</h1><div className="pv-subtitle">{p.sub}</div><p className="pv-summary">{p.lede}</p>{status && <div className="pv-statusline">{status}</div>}{heroPhoto && <div className="pv-photo-credit"><Credit photo={heroPhoto} /></div>}</div>
    </header>
    <div className="pv-body"><div className="pv-tabs" role="tablist" aria-label="Itinerary" ref={tabs}>{['Plan', 'Days', 'Decisions'].map((t, i, all) => <button key={t} id={`tab-${t}`} className={`pv-tab ${tab === t ? 'is-active' : ''}`} role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} tabIndex={tab === t ? 0 : -1} onClick={() => go(t, false)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? all[0] : e.key === 'End' ? all[2] : all[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; go(next, false); document.getElementById(`tab-${next}`)?.focus() } }}>{t}</button>)}</div>
      <section role="tabpanel" id="panel-Plan" aria-labelledby="tab-Plan" hidden={tab !== 'Plan'}>
        <h2 className="pv-section-title">The shape</h2><dl className="pv-deflist">{p.shape.map((r, i) => <div className="pv-defrow" key={i}><dt className="pv-deflabel">{r.k}</dt><dd className="pv-defvalue">{r.v}</dd></div>)}</dl>
        {p.shapeNote && <div className="pv-callout"><strong>{p.shapeNote.t}</strong>{p.shapeNote.b}</div>}
        <h2 className="pv-section-title">Getting there</h2>{p.flightOptions.map((g, i) => <Group key={`flight-${i}`} group={g} kind="flight" chosen={choices[`flight-${i}`] ?? 0} choose={n => select(`flight-${i}`, n)} place="" />)}<Rows rows={p.move} />{!p.flightOptions.length && !p.move.length && <p className="pv-option-detail">Flights or transfers have not been proposed yet. Ask Tara to add the journey from your departure city.</p>}
        <h2 className="pv-section-title">Where you stay</h2>{p.hotelOptions.map((g, i) => <Group key={`stay-${i}`} group={g} kind="stay" chosen={choices[`stay-${i}`] ?? 0} choose={n => select(`stay-${i}`, n)} place={placeName(bundle.places.stays[i]) || g.label.split('·')[0].trim()} />)}<Rows rows={p.stay} />{!p.hotelOptions.length && !p.stay.length && <p className="pv-option-detail">Stays still need to be added to this plan.</p>}
        <h2 className="pv-section-title">What it costs</h2><div className="pv-costtable">{p.allowance.length ? p.allowance.map((r, i) => <div key={i} className={`pv-costrow ${/total/i.test(r.k) ? 'pv-costrow--total' : ''}`}><span>{r.k}</span><span>{r.v}</span></div>) : <p className="pv-option-detail">Prices have not been verified yet.</p>}</div>
        {changes.length > 0 && <div className="pv-callout"><strong>Your choices are saved.</strong>The original cost summary has not been repriced for your selections. The Desk will check the revised total.<button className="pv-text-btn" onClick={() => onRefine(`Please revise my itinerary ${bundle.key} with these saved choices: ${changes.join('; ')}. Keep the same itinerary and confirm the revised pricing basis.`)}>Ask Tara to update this plan</button></div>}
        {bookingAction && <div className="pv-pricing"><button className="pv-cta" onClick={bookingAction.onClick}>{bookingAction.label}</button><p className="pv-costnote">{bookingAction.detail}</p></div>}
        <button className="pv-cta" onClick={() => go('Days')}>See the day-by-day plan</button>
      </section>
      <section role="tabpanel" id="panel-Days" aria-labelledby="tab-Days" hidden={tab !== 'Days'}><h2 className="pv-section-title">{p.days.length} days, paced</h2><div className="pv-subtabs-row"><button className="pv-subtabs-chevron" aria-label="Scroll days left" onClick={() => dayTabs.current?.scrollBy({ left: -180, behavior: 'smooth' })}>‹</button><div className="pv-tabs pv-tabs--sub" ref={dayTabs}>{['All days', ...p.days.map((_, i) => `Day ${i + 1}`)].map((t, i) => <button key={t} className={`pv-tab ${day === i - 1 ? 'is-active' : ''}`} aria-pressed={day === i - 1} onClick={() => setDay(i - 1)}>{t}</button>)}</div><button className="pv-subtabs-chevron" aria-label="Scroll days right" onClick={() => dayTabs.current?.scrollBy({ left: 180, behavior: 'smooth' })}>›</button></div>
        {(daysOpened || printing) && p.days.map((d, i) => <DayCard key={i} day={d} index={i} slug={bundle.places.days[i]} hidden={!printing && day !== -1 && day !== i} />)}
        {p.daysNote && <div className="pv-callout"><strong>{p.daysNote.t}</strong>{p.daysNote.b}</div>}{p.bookOrder.length > 0 && <><h2 className="pv-section-title">Reservations that matter</h2><Rows rows={p.bookOrder.map((r, i) => ({ ...r, m: [r.m, bundle.bookDue[i] && `By ${dateLabel(bundle.bookDue[i]!)}`].filter(Boolean).join(' · ') }))} /></>}
        <button className="pv-cta" onClick={() => go('Decisions')}>Review the decisions</button>
      </section>
      <section role="tabpanel" id="panel-Decisions" aria-labelledby="tab-Decisions" hidden={tab !== 'Decisions'}><h2 className="pv-section-title">Before we book</h2><div className="pv-callout"><strong>{p.gate.t}</strong>{p.gate.b}</div><Sources links={p.gateLinks} />{p.visa && <p className="pv-option-detail">Visa: {p.visa.status.replace(/-/g, ' ')} · {p.visa.note}</p>}{p.visaGuidance && <GuidanceCard guidance={p.visaGuidance} />}
        <h2 className="pv-section-title">Your decisions</h2>{p.bookingActions?.map((a, i) => <section className="pv-decision" key={i}><h3>{a.title}</h3><p>{a.status === 'with-advisor' ? 'With your advisor' : a.status === 'confirmed' ? 'Confirmed preference' : 'For you to decide'}{a.due ? ` · By ${dateLabel(a.due)}` : ''}</p><ul className="pv-bullets">{a.points.map((point, j) => <li key={j}>{point}</li>)}</ul></section>)}<Rows rows={p.decisions} />
        {p.why.length > 0 && <><h2 className="pv-section-title">Why this shape</h2><ul className="pv-bullets">{p.why.map((w, i) => <li key={i}>{w}</li>)}</ul></>}{p.destinationNotes?.map((n, i) => <GuidanceCard key={i} guidance={n} />)}
        {coming.filter(n => n.trip === p.id).length > 0 && <><h2 className="pv-section-title">Coming up</h2><Rows rows={coming.filter(n => n.trip === p.id).map(n => ({ t: n.text, m: dateLabel(n.date) }))} /></>}
      </section>
      <div className="pv-tools"><button className="pv-text-btn" onClick={() => onAsk(`About my itinerary ${bundle.key}: `)}>Ask Tara about this journey</button><button className="pv-text-btn" onClick={onShare}>Share this itinerary</button></div>{footer}<div className="pv-footnote">{p.asof}<br />Nothing is booked, held or paid unless separately confirmed by the Desk.</div>
    </div>
  </article></div></div>
}
