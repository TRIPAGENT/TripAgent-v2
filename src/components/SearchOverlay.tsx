import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Photo } from '@/components/ui'
import { CITIES, MONTHS } from '@/data/catalogue.generated'
import { cityCard } from '@/lib/catalogue'
import type { CitySummary } from '@/lib/catalogue'
import { load, save } from '@/lib/storage'

const RECENT_KEY = 'recentSearches'
const RECENT_MAX = 6

const fact = (c: CitySummary, label: string) => {
  const f = c.facts.find((x) => x.label.toLowerCase().includes(label))
  return f ? `${f.value}${f.small ? ` ${f.small}` : ''}` : null
}

/**
 * Full-screen search. It takes over rather than sitting in the page, because the
 * member who already knows where they are going should get there in two taps and
 * see nothing else on the way. Whatever they type, the last row is Tara:
 * the 110 cities we cover are where our guides are, not where we can go.
 */
export function SearchOverlay({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (slug: string) => void
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState<string[]>(() => load<string[]>(RECENT_KEY, []))
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 80)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const term = q.trim().toLowerCase()

  const results = useMemo(() => {
    if (!term) return []
    return CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.country ?? '').toLowerCase().includes(term) ||
        c.tagline.toLowerCase().includes(term),
    ).slice(0, 14)
  }, [term])

  /** With nothing typed, offer what is at its best right now rather than a void. */
  const nowBest = useMemo(() => {
    const i = new Date().getMonth()
    return CITIES.filter((c) => c.months[i] === 'peak').slice(0, 6)
  }, [])

  /** Remember only what the member searched, on this device, under our own prefix. */
  function remember(text: string) {
    const clean = text.trim()
    if (!clean) return
    const next = [clean, ...recent.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX)
    setRecent(next)
    save(RECENT_KEY, next)
  }

  function pick(c: CitySummary) {
    remember(q.trim() || c.name)
    onPick(c.slug)
  }

  function exploreDestination() {
    remember(q)
    onClose()
    navigate(`/destinations?q=${encodeURIComponent(q.trim())}`)
  }

  function askConcierge() {
    remember(q)
    onClose()
    navigate('/concierge', { state: { query: q.trim() } })
  }

  return (
    <div className="app-frame-fixed z-50 flex flex-col" style={{ background: 'var(--ink-0)' }}>
      {/* --------------------------------------------------------- the field */}
      <header
        className="flex items-center gap-4 px-4 pb-3"
        style={{ paddingTop: 'max(54px, calc(env(safe-area-inset-top) + 12px))' }}
      >
        <div className="k-field min-w-0 flex-1" role="search" style={{ height: 52, padding: '0 4px 0 16px', gap: 10 }}>
          <span className="c-ivory-2 flex">
            <Icon name="search" size={20} />
          </span>
          <label htmlFor="search-q" className="sr-only">
            Search destinations and places
          </label>
          <input
            id="search-q"
            ref={input}
            type="text"
            value={q}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !term) return
              if (results.length > 0) pick(results[0])
              else exploreDestination()
            }}
            placeholder="Where would you like to be?"
            style={{ caretColor: 'var(--champagne)' }}
          />
          {q !== '' && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ('')
                input.current?.focus()
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span
                className="c-ivory-2 flex h-[22px] w-[22px] items-center justify-center rounded-full"
                style={{ background: 'var(--ink-4)' }}
              >
                <Icon name="close" size={12} strokeWidth={2.2} />
              </span>
            </button>
          )}
        </div>
        <button type="button" className="k-link h-11 shrink-0" onClick={onClose}>
          Cancel
        </button>
      </header>

      {/* ------------------------------------------------------- the results */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-10 pt-4">
        {term === '' ? (
          <>
            <section className="flex flex-col gap-1.5 px-6">
              <h2 className="t-label c-ivory-3">At their best in {MONTHS[new Date().getMonth()].name}</h2>
              <div className="flex flex-col">
                {nowBest.map((c) => (
                  <Row key={c.slug} c={c} term="" onPick={pick} />
                ))}
              </div>
            </section>

            {recent.length > 0 && (
              <section className="mt-8 flex flex-col gap-3 px-6">
                <h2 className="t-label c-ivory-3">Recent</h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button key={r} type="button" className="k-chip" onClick={() => setQ(r)}>
                      <Icon name="clock" size={14} className="c-ivory-3" />
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            {results.length > 0 && (
              <section className="flex flex-col gap-1.5 px-6">
                <h2 className="t-label c-ivory-3">Destinations</h2>
                <div className="flex flex-col">
                  {results.map((c) => (
                    <Row key={c.slug} c={c} term={term} onPick={pick} />
                  ))}
                </div>
              </section>
            )}

            {results.length === 0 && (
              <div className="flex flex-col gap-3 px-6 pb-6">
                <p className="t-body-s c-ivory-2">No published guide matches this search yet.</p>
                <button type="button" className="k-btn k-btn-secondary" onClick={exploreDestination}>Explore &ldquo;{q.trim()}&rdquo;</button>
              </div>
            )}

            {/* Never a dead end. */}
            <section className={`px-6 ${results.length > 0 ? 'mt-8' : ''}`}>
              <button
                type="button"
                onClick={askConcierge}
                className="k-row w-full gap-3.5 text-left"
                style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}
              >
                <span
                  className="c-champagne flex h-14 w-14 shrink-0 items-center justify-center"
                  style={{
                    borderRadius: 12,
                    background: 'var(--champagne-3)',
                    border: '1px solid var(--champagne-line)',
                  }}
                >
                  <Icon name="horizon" size={24} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-title-s truncate">Ask Tara about &ldquo;{q.trim()}&rdquo;</span>
                  <span className="t-caption">Plan beyond our published guides</span>
                </span>
                <Icon name="chevron-right" size={18} className="c-ivory-3" />
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** A city row, with the part the member has typed picked out in ivory. */
function Row({ c, term, onPick }: { c: CitySummary; term: string; onPick: (c: CitySummary) => void }) {
  const line = [c.country, fact(c, 'from india'), fact(c, 'visa')].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={() => onPick(c)} className="k-row w-full gap-3.5 py-2 text-left">
      <Photo
        src={cityCard(c.slug)}
        alt=""
        label={c.name}
        veil="none"
        radius={12}
        className="h-14 w-14 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-title truncate">
          <Marked text={c.name} term={term} />
        </span>
        {line && <span className="t-caption t-figure truncate">{line}</span>}
      </span>
      <Icon name="chevron-right" size={18} className="c-ivory-3" />
    </button>
  )
}

/** The matched run in ivory, the rest in ivory-2. */
function Marked({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term) : -1
  if (i < 0) return <span className="c-ivory">{text}</span>
  return (
    <>
      {i > 0 && <span className="c-ivory-2">{text.slice(0, i)}</span>}
      <span className="c-ivory">{text.slice(i, i + term.length)}</span>
      <span className="c-ivory-2">{text.slice(i + term.length)}</span>
    </>
  )
}
