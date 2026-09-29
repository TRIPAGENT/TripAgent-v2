import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Headline, Sig } from '@/components/ui'
import { WorldMap } from '@/components/WorldMap'
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
    <Screen tabs={false}>
      <TopBar back="/" solid />

      <header className="px-6 pt-[124px]">
        <Headline size="l">
          The world, <Sig>within reach.</Sig>
        </Headline>
        <p className="t-caption mt-3">
          {CITIES.length} destinations, written and kept current. Tap a pin to open its guide.
        </p>
      </header>

      <div className="mt-8" onClickCapture={() => undefined}>
        <WorldMap />
      </div>

      <p className="t-caption c-ivory-3 mt-8 px-6">
        Somewhere you do not see here? Tara can still open it.{' '}
        <button
          type="button"
          className="k-link k-link-champagne align-baseline"
          onClick={() => navigate('/concierge')}
        >
          Ask
        </button>
      </p>
    </Screen>
  )
}
