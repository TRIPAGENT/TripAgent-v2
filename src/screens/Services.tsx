import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Icon, Photo } from '@/components/ui'
import { SERVICES } from '@/data/catalogue.generated'
import { brandImage } from '@/lib/catalogue'
import { serviceFace } from '@/lib/services'

/* The house's words for each counter live in one place; only the photograph's
   description is particular to this screen. */

const ALT: Record<string, string> = {
  Flights: 'A dark, hushed business-class cabin, light falling from an oval window',
  Hotels: 'A suite in warm afternoon light, soft sofas and a window over the rooftops',
  Visas: 'A traveller unfolding a paper map, face hidden behind it',
}

/**
 * What the house handles. Three counters, each into a real request — and a
 * fourth door for everything else, because three things is not the whole of
 * what a member asks for.
 */
export default function Services() {
  const navigate = useNavigate()
  const [ask, setAsk] = useState('')

  function askTheConcierge() {
    const query = ask.trim()
    navigate('/concierge', query ? { state: { query } } : undefined)
  }

  return (
    <Screen tone="light" tabs={false}>
      <TopBar
        back="/"
        solid
        actions={
          <button
            type="button"
            aria-label="Speak to the Desk"
            className="k-icon-btn k-icon-btn-solid"
            onClick={() => navigate('/desk')}
          >
            <Icon name="phone" size={20} />
          </button>
        }
      />

      <section className="flex flex-col gap-3.5 px-6 pt-32">
        <h1 className="t-display-l">
          What we <em className="t-italic">handle</em>
        </h1>
        <p className="t-body c-ivory-2 max-w-[330px]">
          We would rather promise less and hold it than quote well and revise.
        </p>
      </section>

      <section aria-label="Services" className="flex flex-col gap-4 px-6 pt-10">
        {SERVICES.map((s) => {
          const face = serviceFace(s.heading, s.image)
          return (
            <Photo
              key={s.heading}
              src={brandImage(face.image)}
              alt={ALT[s.heading] ?? face.name}
              label={face.name}
              radius={24}
              className="h-[300px] w-full"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <button
                type="button"
                className="absolute inset-0 z-[1]"
                aria-label={`${face.name}: ${face.action}`}
                onClick={() => navigate(face.route)}
              />
              <div className="pointer-events-none absolute inset-x-5 bottom-5 z-[2] flex flex-col items-start gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <p className="t-caption">{face.eyebrow || s.number}</p>
                    <h2 className="t-display-m">{face.name}</h2>
                  </div>
                  <p className="t-body-s c-ivory-2">{s.body}</p>
                </div>
                <span className="k-btn k-btn-secondary k-btn-sm">
                  {face.action}
                  <Icon name="forward" size={16} />
                </span>
              </div>
            </Photo>
          )
        })}
      </section>

      {/* The fourth door: whatever it is. */}
      <section className="px-6 pt-14">
        <article
          className="k-card-raised overflow-hidden"
          aria-labelledby="else-title"
          style={{ borderRadius: 24 }}
        >
          <Photo
            src={brandImage('champagne')}
            alt="Champagne poured into rows of coupes in warm, low light"
            label="Anything else"
            radius={0}
            veil="none"
            className="h-[140px] w-full"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-full"
              style={{
                background:
                  'linear-gradient(0deg, var(--ink-3) 0%, rgba(32,32,35,.78) 32%, rgba(32,32,35,.2) 72%, rgba(32,32,35,0) 100%)',
              }}
            />
            <h2 id="else-title" className="t-display-m absolute inset-x-5 bottom-3 z-[2]">
              Anything else
            </h2>
          </Photo>

          <div className="flex flex-col gap-3 px-4 pb-5 pt-4">
            <form
              className="k-composer"
              style={{ height: 56, padding: '0 6px 0 18px', background: 'var(--ink-2)', boxShadow: 'none' }}
              onSubmit={(e) => {
                e.preventDefault()
                askTheConcierge()
              }}
            >
              <label htmlFor="else-note" className="sr-only">
                Tell Tara what you need
              </label>
              <input
                id="else-note"
                type="text"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Tell Tara what you need"
                className="min-w-0 flex-1"
                style={{ height: 44, background: 'transparent', border: 0, outline: 'none' }}
              />
              <button
                type="submit"
                aria-label="Ask Tara"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--ivory)', color: 'var(--ink-0)' }}
              >
                <Icon name="send" size={20} />
              </button>
            </form>
            <p className="t-caption px-1">
              A table that isn&rsquo;t taking bookings, a car at the airstrip, a gift sent ahead.
            </p>
          </div>
        </article>
      </section>

      {/* Signed, as a letter from the house would be. */}
      <footer className="flex flex-col items-center gap-5 px-6 pt-14 text-center">
        <div className="flex flex-col items-center gap-3">
          <span
            aria-hidden="true"
            className="relative flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 24%, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 48%), linear-gradient(160deg, #2A2A2E 0%, #141416 56%, #1B1B1E 100%)',
              border: '1px solid var(--champagne-line)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10), 0 10px 24px rgba(0,0,0,.5)',
            }}
          >
            <span
              className="absolute rounded-full"
              style={{ inset: 3, border: '1px solid rgba(216,194,154,.22)' }}
            />
            <span
              className="k-engrave c-champagne relative"
              style={{ fontFamily: 'var(--f-display)', fontWeight: 500, fontSize: 15, letterSpacing: '0.08em' }}
            >
              TA
            </span>
          </span>
          <p className="t-caption">— The Desk, Bengaluru</p>
        </div>
        <p className="t-caption c-ivory-3">Nothing is booked or charged by asking.</p>
      </footer>
    </Screen>
  )
}
