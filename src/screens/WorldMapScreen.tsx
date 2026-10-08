import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Headline, Sig } from '@/components/ui'
// import { WorldMap } from '@/components/WorldMap' // the previous map, kept for reference
import WorldMapDark from '@/components/worldmap/WorldMap'
import { CITIES } from '@/data/catalogue.generated'

/**
 * Every destination the house covers, on one map. It used to sit halfway down
 * the home screen, under the month rails, where it read as a widget. It is a
 * room of its own: the member opens it to see the shape of what is possible,
 * taps a pin, and is in the guide.
 */
export default function WorldMapScreen() {
  const navigate = useNavigate()

  return (
    <Screen tabs={false} flush className="flex min-h-dvh flex-col">
      <TopBar
        back="/"
        solid
        actions={
          <button
            type="button"
            className="k-btn k-btn-commit"
            style={{ height: 44, padding: '0 18px', fontSize: 14 }}
            onClick={() => navigate('/concierge')}
          >
            Talk to Tara
          </button>
        }
      />

      <header className="px-6 pt-[124px]">
        <Headline size="l">
          The world, <Sig>within reach.</Sig>
        </Headline>
        <p className="t-caption mt-3">
          {CITIES.length} destinations, written and kept current. Tap a pin to open its guide.
        </p>
      </header>

      {/* Previous map:
      <div className="mt-8 flex flex-1 flex-col" onClickCapture={() => undefined}>
        <WorldMap fill />
      </div>
      */}

      {/* The dark world map fills its parent, so the parent is given the rest of the screen. */}
      <div className="wm-dark relative mt-6 flex-1" style={{ minHeight: 420 }}>
        <div className="absolute inset-0 flex flex-col">
          <WorldMapDark
            onNavigate={(href) => navigate(href)}
            getCityHref={(slug) => `/city/${slug}`}
            resolveImage={(path) => `/img/map/${path.split('?')[0].split('/').pop()!.replace(/\.[a-z]+$/i, '')}.webp`}
          />
        </div>
      </div>
    </Screen>
  )
}
