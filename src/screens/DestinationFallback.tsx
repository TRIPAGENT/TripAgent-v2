import { useNavigate, useSearchParams } from 'react-router-dom'
import { CITIES, CITY_BY_SLUG } from '@/data/catalogue.generated'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Card, Icon, Photo } from '@/components/ui'
import { cityCard } from '@/lib/catalogue'
import { destinationMatches } from '@/lib/destinationMatches'

export function DestinationFallback({ destination, unavailable = false, onRetry }: { destination: string; unavailable?: boolean; onRetry?: () => void }) {
  const navigate = useNavigate()
  const known = CITY_BY_SLUG[destination]
  const name = known?.name ?? destination.replace(/[-_]+/g, ' ').trim().slice(0, 100)
  const matches = destinationMatches(known?.country ?? name, CITIES, known?.slug)
  const draft = name
    ? `I’d like to explore ${name}. Help me build a destination guide and itinerary with places to stay, things to do and places to eat. Ask me about my dates, departure city, travel party and budget first. Use current web sources where available and make clear what still needs checking.`
    : 'Help me choose a destination and build an itinerary. Ask me about my dates, departure city, travel party and budget first.'

  return (
    <Screen tone="light">
      <TopBar back="/" solid title="Explore somewhere new" />
      <div className="flex flex-col gap-8 px-6 pb-8 pt-28">
        <header className="flex flex-col gap-3">
          <p className="t-label c-ivory-3">Beyond the guidebook</p>
          <h1 className="t-display-l break-words">{name || 'Where would you like to go?'}</h1>
          <p className="t-body c-ivory-2">{unavailable
            ? 'We couldn’t open this guide just now. Try again, or let Tara help shape your trip.'
            : 'We don’t have a published guide here yet. Your journey can still start here.'}</p>
          {onRetry && <Btn tone="secondary" icon="refresh" onClick={onRetry}>Try the guide again</Btn>}
        </header>

        {matches.length > 0 && <section className="flex flex-col gap-3" aria-label="Matching destination guides">
          <h2 className="t-display-s">{known?.country ? `More guides in ${known.country}` : 'You might be looking for'}</h2>
          <p className="t-caption">{known?.country ? 'Other destinations from our collection.' : 'Matches from our published guides.'}</p>
          {matches.map(city => <button key={city.slug} type="button" onClick={() => navigate(`/city/${city.slug}`)} className="k-row flex w-full items-center gap-3 text-left py-3">
            <Photo src={cityCard(city.slug)} alt="" label={city.name} veil="none" radius={12} className="h-16 w-16 shrink-0" />
            <span className="min-w-0 flex-1"><span className="t-title block">{city.name}</span><span className="t-caption block">{city.country}</span></span>
            <Icon name="chevron-right" size={18} />
          </button>)}
        </section>}

        <Card className="flex flex-col gap-4 p-5">
          <Icon name="horizon" size={28} className="c-champagne" />
          <h2 className="t-display-s">Let Tara take it from here.</h2>
          <p className="t-body-s c-ivory-2">Tell Tara when you’d like to go and what you love. She can help shape a guide and a day-by-day journey around you, using web research when available.</p>
          <Btn block onClick={() => navigate('/concierge', { state: { draft } })}>Explore with Tara</Btn>
        </Card>
        <button type="button" className="k-link self-start" onClick={() => navigate('/map')}>Browse our destination map <Icon name="forward" size={16} /></button>
      </div>
    </Screen>
  )
}

export default function DestinationSearch() {
  const [params] = useSearchParams()
  return <DestinationFallback destination={params.get('q') ?? ''} />
}
