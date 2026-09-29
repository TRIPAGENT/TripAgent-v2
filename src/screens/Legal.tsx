import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Eyebrow, Icon } from '@/components/ui'
import { DESK } from '@/data/members'

interface LegalPage {
  heading: string
  eyebrow: string
  standfirst: string
  updated: string
  nodes: ({ kind: 'heading' | 'paragraph'; html: string } | { kind: 'list'; items: string[] })[]
}

/**
 * Membership terms, privacy and refunds: the house's own published text, taken
 * from tripagent.vip by `npm run catalogue`. The markup is reduced to bold and
 * mail links at build time, so it is safe to render as given.
 */
export default function Legal() {
  const { slug = 'terms' } = useParams()
  const [page, setPage] = useState<LegalPage | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/data/legal.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((all: Record<string, LegalPage> | null) => !cancelled && setPage(all?.[slug] ?? null))
      .catch(() => !cancelled && setPage(null))
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <Screen tone="light" tabs={false}>
      <TopBar back solid />

      {page === undefined ? (
        <p className="t-caption c-ivory-3 px-6 pt-[200px] text-center">Opening…</p>
      ) : page === null ? (
        <div className="flex flex-col items-center px-8 pt-[180px] text-center">
          <span className="c-ivory-3 flex">
            <Icon name="document" size={28} />
          </span>
          <p className="t-display-m mt-6">Not on this device yet.</p>
          <p className="t-caption mt-3 max-w-quote">
            Write to{' '}
            <a href={`mailto:${DESK.email}`} className="c-champagne underline underline-offset-4">
              {DESK.email}
            </a>{' '}
            and the Desk will send it to you the same day.
          </p>
        </div>
      ) : (
        <article className="flex flex-col gap-3.5 px-6 pb-4 pt-32">
          <Eyebrow>{page.eyebrow}</Eyebrow>
          <h1 className="t-display-l">{page.heading}</h1>
          {page.standfirst && <p className="t-body c-ivory-2">{page.standfirst}</p>}
          {page.updated && <p className="t-caption c-ivory-3">{page.updated}</p>}

          <div className="mt-6 flex flex-col gap-4">
            {page.nodes.map((n, i) =>
              n.kind === 'list' ? (
                <ul key={i} className="flex flex-col gap-2 pl-1">
                  {n.items.map((it, j) => (
                    <li key={j} className="t-body-s c-ivory-2 flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[9px] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: 'var(--champagne)' }}
                      />
                      <span dangerouslySetInnerHTML={{ __html: it }} />
                    </li>
                  ))}
                </ul>
              ) : n.kind === 'heading' ? (
                <h2 key={i} className="t-display-s pt-4" dangerouslySetInnerHTML={{ __html: n.html }} />
              ) : (
                <p key={i} className="t-body c-ivory-2" dangerouslySetInnerHTML={{ __html: n.html }} />
              ),
            )}
          </div>

          <p
            className="t-caption c-ivory-3 mt-10 pt-5"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            {DESK.operator}
          </p>
        </article>
      )}
    </Screen>
  )
}
