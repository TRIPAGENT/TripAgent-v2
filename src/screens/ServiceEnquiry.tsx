import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Empty, Icon, Sheet, Sig } from '@/components/ui'
import { MeshBackdrop } from '@/components/mesh/MeshBackdrop'
import { DIM_TARA_COLORS, TARA_TUNING } from '@/components/mesh/presets'
import { AIRPORTS, airportLabel, popularAirports, recentAirports, rememberAirport, searchAirports, type Airport } from '@/data/airports'
import {
  COUNTRIES,
  EXTRA_CITIES,
  NATIONALITIES,
  POPULAR_DESTINATIONS,
  POPULAR_NATIONALITIES,
  POPULAR_RESIDENCES,
  suggest,
} from '@/data/places'
import { CITIES } from '@/data/catalogue.generated'
import { useStore } from '@/context/store'
import { fileRequest } from '@/lib/agentClient'

type Kind = 'flights' | 'visas'

interface Field {
  id: string
  label: string
  placeholder: string
  type?: 'text' | 'date' | 'number'
  optional?: boolean
  suggest?: string[]
  /** Fields sharing a `row` sit side by side. */
  row?: string
  /** A long-form text box rather than a single line. */
  multiline?: boolean
  /** Offers the airport menu: popular and recent when empty, suggestions as you type. */
  airport?: boolean
  /** Opens a bottom sheet to type in, with suggestions. */
  picker?: 'nationality' | 'destination' | 'residence'
}

const CITY_NAMES = CITIES.map((c) => c.name)

const uniq = (list: string[]) => [...new Set(list)]
/** What each visa picker offers: its title, what shows before typing, and everything that can match. */
const PICKERS = {
  nationality: { title: 'Passport held', popular: POPULAR_NATIONALITIES, all: NATIONALITIES },
  destination: { title: 'Travelling to', popular: POPULAR_DESTINATIONS, all: uniq([...COUNTRIES, ...CITY_NAMES]) },
  residence: { title: 'Where you live', popular: POPULAR_RESIDENCES, all: uniq([...CITY_NAMES, ...EXTRA_CITIES]) },
} as const

const FORMS: Record<Kind, { number: string; title: string; accent: string; lede: string; fields: Field[] }> = {
  flights: {
    number: '01',
    title: 'Tell us the journey.',
    accent: 'the journey.',
    lede: 'Every cabin, with business and first our speciality. Send the shape of the journey and the Desk comes back with the options and one price.',
    fields: [
      { id: 'from', label: 'From', placeholder: 'Select city', row: 'route', airport: true },
      { id: 'to', label: 'To', placeholder: 'Select city', row: 'route', airport: true },
      { id: 'depart', label: 'Departure', placeholder: '', type: 'date', row: 'dates' },
      { id: 'return', label: 'Return', placeholder: '', type: 'date', optional: true, row: 'dates' },
      { id: 'travellers', label: 'Travellers', placeholder: '2', type: 'number', row: 'party' },
      { id: 'cabin', label: 'Class', placeholder: 'Business', row: 'party' },
      { id: 'notes', label: 'Must haves', placeholder: 'Fixed dates, an airline you prefer, a seat you always take', optional: true, multiline: true },
    ],
  },
  visas: {
    number: '03',
    title: 'Tell us the passport.',
    accent: 'the passport.',
    lede: 'Checked, filed and tracked. Send the detail and the Desk confirms what is required, how long it takes, and what it will cost before anything is filed.',
    fields: [
      { id: 'nationality', label: 'Passport held', placeholder: 'Select nationality', picker: 'nationality' },
      { id: 'destination', label: 'Travelling to', placeholder: 'Country or city', picker: 'destination' },
      { id: 'travel', label: 'Travelling on', placeholder: '', type: 'date' },
      { id: 'travellers', label: 'Applicants', placeholder: '2', type: 'number' },
      { id: 'residence', label: 'Where you live', placeholder: 'City, which sets the consulate', optional: true, picker: 'residence' },
      { id: 'notes', label: 'Anything unusual', placeholder: 'Previous refusals, a renewal, a name change', optional: true },
    ],
  },
}

/**
 * A structured enquiry rather than a brochure.
 *
 * Everything collected here goes to the Desk's inbox, so a person picks it up,
 * and Tara can be opened with the same detail so the member never
 * repeats it. Nothing is priced or promised on this screen: the Desk answers
 * with what can actually be held.
 */
export default function ServiceEnquiry() {
  const { kind } = useParams<{ kind: Kind }>()
  const navigate = useNavigate()
  const { refreshRequests } = useStore()
  const [values, setValues] = useState<Record<string, string>>({})
  const [filed, setFiled] = useState<{ id: string; opening: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sheetField, setSheetField] = useState<string | null>(null)
  const [sheetQuery, setSheetQuery] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const recents = useMemo(() => (openMenu ? recentAirports() : []), [openMenu])

  // Tapping anywhere outside the From / To pair closes the menu.
  useEffect(() => {
    if (!openMenu) return
    const close = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-airport-row]')) setOpenMenu(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [openMenu])

  function pickAirport(id: string, a: Airport) {
    setValues((v) => ({ ...v, [id]: airportLabel(a) }))
    rememberAirport(a)
    setOpenMenu(null)
  }

  /** What the open menu lists for a field's current text. */
  function menuFor(id: string) {
    const val = values[id] ?? ''
    const chosen = AIRPORTS.some((a) => airportLabel(a) === val)
    const q = chosen ? '' : val
    if (q.trim()) return { query: q, matches: searchAirports(q), recent: [] as Airport[], popular: [] as Airport[] }
    const recent = recents
    const popular = popularAirports().filter((a) => !recent.some((r) => r.code === a.code))
    return { query: '', matches: [] as Airport[], recent, popular }
  }

  const form = kind && FORMS[kind] ? FORMS[kind] : null

  const required = useMemo(() => (form ? form.fields.filter((f) => !f.optional) : []), [form])
  // Consecutive fields that share a `row` sit side by side.
  const rows = useMemo(() => {
    const out: Field[][] = []
    for (const f of form ? form.fields : []) {
      const last = out[out.length - 1]
      if (f.row && last && last[0].row === f.row) last.push(f)
      else out.push([f])
    }
    return out
  }, [form])
  const ready = required.every((f) => (values[f.id] ?? '').trim().length > 0)

  // An address we do not keep a counter for. Offer the way out, never a dead end.
  if (!form) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar back="/services" solid />
        <Empty
          icon="info"
          title="We don't have a counter for that."
          body="Flights, stays and visas each have their own form. Anything else goes straight to Tara, and to the Desk behind it."
          action={
            <div className="flex flex-col items-center gap-2">
              <Btn tone="primary" onClick={() => navigate('/services')}>
                See what we handle
              </Btn>
              <Btn tone="ghost" onClick={() => navigate('/concierge')}>
                Ask Tara
              </Btn>
            </div>
          }
        />
      </Screen>
    )
  }

  async function submit() {
    if (!form || !kind) return
    const fields = Object.fromEntries(
      form.fields.map((f) => [f.label, (values[f.id] ?? '').trim()] as const).filter(([, v]) => v),
    )
    const opening = `${kind === 'flights' ? 'Flight enquiry' : 'Visa enquiry'}.\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}`
    setSending(true)
    setError(null)
    try {
      const r = await fileRequest({ type: 'enquiry', kind, fields })
      await refreshRequests()
      setFiled({ id: r.id, opening })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  function continueWithConcierge() {
    if (!filed) return
    // Seed the thread so Tara opens already holding the detail.
    navigate('/concierge', { state: { send: filed.opening, query: filed.opening } })
  }

  if (filed) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar back="/services" solid />
        <section className="flex flex-col items-center px-6 pt-[160px] text-center">
          <span className="c-champagne flex">
            <Icon name="check-circle" size={30} />
          </span>
          <h1 className="t-display-l mt-5">
            With <Sig>the Desk.</Sig>
          </h1>
          <p className="t-body c-ivory-2 mt-4 max-w-quote">
            Reference <span className="t-mono">{filed.id}</span>. The Desk replies the same day, all times IST.
          </p>
          <div className="mt-8 flex w-full flex-col gap-2">
            <Btn tone="primary" block onClick={() => navigate('/status')}>
              See your requests
            </Btn>
            <Btn tone="secondary" block icon="horizon" onClick={continueWithConcierge}>
              Start on options with Tara
            </Btn>
          </div>
        </section>
      </Screen>
    )
  }

  return (
    <Screen tone="dark" tabs={false} flush className="isolate flex min-h-dvh flex-col">
      <MeshBackdrop
        id="enquiry-mesh"
        colors={DIM_TARA_COLORS}
        tuning={TARA_TUNING}
        fallback="radial-gradient(75% 40% at 85% 12%, rgba(70,87,102,.7) 0%, rgba(70,87,102,0) 70%), radial-gradient(85% 40% at 40% 50%, rgba(130,80,43,.7) 0%, rgba(130,80,43,0) 70%), #080605"
      />
      <TopBar
        back="/services"
        solid
        actions={
          <button
            type="button"
            className="k-btn k-btn-commit"
            style={{ height: 44, padding: '0 18px', fontSize: 14 }}
            onClick={() => navigate('/concierge')}
          >
            Tara AI
          </button>
        }
      />

      <section className="flex flex-col gap-3.5 px-6 pt-32">
        <p className="k-eyebrow">{kind === 'flights' ? 'Flights' : 'Visas'}</p>
        <h1 className="t-display-l">
          {form.title.replace(form.accent, '')}
          <Sig>{form.accent}</Sig>
        </h1>
        <p className="t-body c-ivory-2">{form.lede}</p>
      </section>

      <section className="flex flex-col gap-3.5 px-6 pt-10">
        {rows.map((group) => (
          <div key={group[0].id} data-airport-row={group.some((g) => g.airport) ? "" : undefined} className="relative grid gap-3" style={{ gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))` }}>
            {group.map((f) => (
              <div key={f.id} className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={f.id} className="k-field-label flex items-baseline gap-2" style={{ color: 'rgba(242, 237, 228, 0.78)' }}>
                  {f.label}
                  {f.optional && <span className="t-caption" style={{ color: 'rgba(242, 237, 228, 0.5)' }}>optional</span>}
                </label>
                <div
                  className={`k-card flex px-4 ${f.multiline ? 'items-start py-3' : 'items-center'}`}
                  style={{
                    height: f.multiline ? 'auto' : 46,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.10)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
                    WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
                    backdropFilter: 'blur(18px) saturate(1.2)',
                  }}
                >
                  {f.multiline ? (
                    <textarea
                      id={f.id}
                      rows={4}
                      value={values[f.id] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      className="t-body k-glass-input w-full min-w-0"
                      style={{ background: 'transparent', border: 0, outline: 'none', resize: 'none', color: (values[f.id] ?? '') ? '#fff' : '#c3c3c9', colorScheme: 'dark', fontSize: 15, lineHeight: '22px' }}
                    />
                  ) : f.picker ? (
                    <button
                      id={f.id}
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => {
                        setSheetQuery(values[f.id] ?? '')
                        setSheetField(f.id)
                      }}
                      className="t-body flex w-full min-w-0 items-center justify-between gap-2 text-left"
                      style={{ fontSize: 15, color: (values[f.id] ?? '') ? '#fff' : '#c3c3c9' }}
                    >
                      <span className="truncate">{values[f.id] || f.placeholder}</span>
                      <span className="flex shrink-0" style={{ color: '#c3c3c9', marginRight: -4 }}>
                        <Icon name="chevron-down" size={16} />
                      </span>
                    </button>
                  ) : (
                    <>
                      <input
                        id={f.id}
                        type={f.type ?? 'text'}
                        list={f.suggest ? `${f.id}-list` : undefined}
                        value={values[f.id] ?? ''}
                        placeholder={f.placeholder}
                        autoComplete={f.airport ? 'off' : undefined}
                        onFocus={f.airport ? () => setOpenMenu(f.id) : undefined}
                        onChange={(e) => {
                          setValues((v) => ({ ...v, [f.id]: e.target.value }))
                          if (f.airport) setOpenMenu(f.id)
                        }}
                        onKeyDown={
                          f.airport
                            ? (e) => {
                                if (e.key === 'Escape') setOpenMenu(null)
                                if (e.key === 'Enter') {
                                  const first = menuFor(f.id).matches[0]
                                  if (first) {
                                    e.preventDefault()
                                    pickAirport(f.id, first)
                                  }
                                }
                              }
                            : undefined
                        }
                        className="t-body k-glass-input w-full min-w-0"
                        style={{ background: 'transparent', border: 0, outline: 'none', color: (values[f.id] ?? '') ? '#fff' : '#c3c3c9', colorScheme: 'dark', fontSize: 15 }}
                      />
                      {f.airport && (
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`${f.label}: show airports`}
                          aria-expanded={openMenu === f.id}
                          onClick={() => setOpenMenu((o) => (o === f.id ? null : f.id))}
                          className="flex shrink-0 items-center justify-center"
                          style={{ width: 24, height: 24, marginRight: -6, color: '#c3c3c9' }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ transform: openMenu === f.id ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
                {f.suggest && (
                  <datalist id={`${f.id}-list`}>
                    {f.suggest.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                )}
              </div>
            ))}
            {group[0].row === 'route' && group.length === 2 && (
              <button
                type="button"
                aria-label="Swap from and to"
                onClick={() => setValues((v) => ({ ...v, from: v.to ?? '', to: v.from ?? '' }))}
                className="absolute flex items-center justify-center"
                style={{
                  left: '50%',
                  bottom: 10.5,
                  width: 25,
                  height: 25,
                  transform: 'translateX(-50%)',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.55)',
                  background: 'rgba(30,30,34,0.85)',
                  color: '#fff',
                }}
              >
                <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
                </svg>
              </button>
            )}
            {group.map((f) => {
              if (!f.airport) return null
              const isOpen = openMenu === f.id
              const m = menuFor(f.id)
              const item = (a: Airport) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => pickAirport(f.id, a)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  style={{ borderRadius: 10, color: '#fff' }}
                >
                  <span className="min-w-0">
                    <span className="block truncate" style={{ fontSize: 15 }}>{a.city}</span>
                    <span className="block truncate" style={{ fontSize: 12, color: 'rgba(242,237,228,0.6)' }}>
                      {a.name}, {a.country}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, letterSpacing: '0.08em', color: 'var(--champagne, #d8c29a)' }}>{a.code}</span>
                </button>
              )
              const heading = (t: string) => (
                <p key={t} className="px-3 pb-1 pt-2" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.5)' }}>
                  {t}
                </p>
              )
              return (
                <div
                  key={`${f.id}-menu`}
                  role="listbox"
                  aria-hidden={!isOpen}
                  className="absolute left-0 right-0 z-30 overflow-y-auto p-1.5"
                  style={{
                    top: '100%',
                    marginTop: 6,
                    maxHeight: 300,
                    borderRadius: 16,
                    background: 'rgba(22, 20, 20, 0.88)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
                    backdropFilter: 'blur(24px) saturate(1.3)',
                    boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? 'none' : 'translateY(-8px) scale(0.98)',
                    visibility: isOpen ? 'visible' : 'hidden',
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: isOpen
                      ? 'opacity .2s ease, transform .22s cubic-bezier(.2,.8,.2,1)'
                      : 'opacity .16s ease, transform .16s ease, visibility 0s linear .16s',
                  }}
                >
                  {m.query ? (
                    m.matches.length ? (
                      m.matches.map(item)
                    ) : (
                      <p className="px-3 py-3" style={{ fontSize: 14, color: 'rgba(242,237,228,0.6)' }}>
                        No airport matches “{m.query.trim()}”. We'll send it to the Desk as typed.
                      </p>
                    )
                  ) : (
                    <>
                      {m.recent.length > 0 && heading('Recent')}
                      {m.recent.map(item)}
                      {heading('Popular')}
                      {m.popular.map(item)}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      {sheetField && (() => {
        const f = form.fields.find((x) => x.id === sheetField)
        const src = f?.picker ? PICKERS[f.picker] : null
        if (!f || !src) return null
        const q = sheetQuery.trim()
        const matches = q ? suggest([...src.all], q, 10) : []
        const exact = src.all.some((x) => x.toLowerCase() === q.toLowerCase())
        const choose = (v: string) => {
          setValues((prev) => ({ ...prev, [f.id]: v }))
          setSheetField(null)
        }
        const row = (v: string) => (
          <button
            key={v}
            type="button"
            className="flex w-full items-center justify-between py-3.5 text-left"
            style={{ borderBottom: '1px solid var(--line-2)' }}
            onClick={() => choose(v)}
          >
            {v}
            {(values[f.id] ?? '') === v && <Icon name="check" size={18} />}
          </button>
        )
        return (
          <Sheet onClose={() => setSheetField(null)} labelledBy="pick-title">
            <div className="px-6 pb-2 pt-1">
              <h2 id="pick-title" className="t-display-s">
                {src.title}
              </h2>
              <div className="k-field mt-3">
                <Icon name="search" size={20} />
                <input
                  autoFocus
                  value={sheetQuery}
                  onChange={(e) => setSheetQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && q) choose(matches[0] ?? q)
                  }}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  aria-label={src.title}
                />
                {sheetQuery && (
                  <button type="button" aria-label="Clear" className="flex" onClick={() => setSheetQuery('')}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-col">
                {q ? (
                  <>
                    {matches.map(row)}
                    {!exact && (
                      <button type="button" className="py-3.5 text-left" style={{ color: 'var(--champagne, #d8c29a)' }} onClick={() => choose(q)}>
                        Use “{q}”
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="pb-1 pt-3" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.55 }}>
                      Popular
                    </p>
                    {src.popular.map(row)}
                  </>
                )}
              </div>
            </div>
          </Sheet>
        )
      })()}

      <section
        className="sticky bottom-0 z-20 mt-auto flex flex-col items-center gap-3 px-6 pt-8"
        style={{
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(180deg, rgba(8,6,5,0) 0%, rgba(8,6,5,0.78) 45%, rgba(8,6,5,0.92) 100%)',
        }}
      >
        {error && <p className="t-body-s c-amber w-full">{error}</p>}
        <Btn
          tone="primary"
          block
          iconAfter="forward"
          disabled={!ready || sending}
          style={!ready || sending ? { opacity: 0.5 } : undefined}
          onClick={() => void submit()}
        >
          {sending ? 'Sending…' : 'Send to the Desk'}
        </Btn>
      </section>
    </Screen>
  )
}
