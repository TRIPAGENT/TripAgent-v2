import { useEffect, useRef, useState } from 'react'
import { fetchPlacePhotos, type PlacePhoto } from '@/lib/agentClient'
import type { Choice } from '@/lib/plan'
import { hotelName } from '@/lib/itineraryPresentation'

const https = (url?: string) => url && /^https:\/\//i.test(url) ? url : undefined
export function PropertyGallery({ option, place }: { option: Choice; place: string }) {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const name = hotelName(option.name)
  const query = `${name} ${place}`
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<{ query: string; photos: PlacePhoto[] } | null>(null)
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const own = (option.photos?.length ? option.photos : option.photo ? [option.photo] : []).filter(p => https(p.url) && https(p.source) && !failed.includes(p.url)).slice(0, 4)
  const hasCompleteGallery = own.length >= 4
  useEffect(() => {
    if (!root.current) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '120px' })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || hasCompleteGallery) return
    let alive = true
    setIndex(0)
    void fetchPlacePhotos(query, 1200, name).then(photos => { if (alive) setResult({ query, photos }) })
    return () => { alive = false }
  }, [visible, query, name, hasCompleteGallery])
  const photos = [
    ...own.map(p => ({ ...p, google: undefined as PlacePhoto | undefined })),
    ...(result?.query === query ? result.photos : []).map(google => ({ url: google.url, alt: `${name} · property photograph`, caption: 'Property photos · exact room category to confirm', source: https(google.googleMapsUri), google })),
  ].filter((p, i, all) => https(p.url) && !failed.includes(p.url) && all.findIndex(other => other.url === p.url) === i).slice(0, 4)
  const move = (next: number) => track.current?.scrollTo({ left: Math.max(0, Math.min(photos.length - 1, next)) * track.current.clientWidth, behavior: 'smooth' })
  return <div className="pv-gallery" ref={root} role="region" aria-label={`${name} photos`}>
    {photos.length ? <>
      <div className="pv-gallery-track" ref={track} tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(index + (e.key === 'ArrowRight' ? 1 : -1)) } }} onScroll={() => { const el = track.current; if (el?.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth)) }}>
        {photos.map((p, i) => <figure className="pv-gallery-slide" key={p.url} aria-label={`Photo ${i + 1} of ${photos.length}`}>
          <img src={p.url} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(old => [...old, p.url])} />
          <figcaption>{p.caption}{p.source && <> · <a href={p.source} target="_blank" rel="noreferrer">{p.google ? 'Google Maps' : 'Photo source'}</a></>}{p.google?.authors?.map((a, j) => <span key={j}> · {https(a.uri) ? <a href={a.uri} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</span>)}</figcaption>
        </figure>)}
      </div>
      <div className="pv-gallery-controls"><button type="button" onClick={() => move(index - 1)} disabled={index <= 0} aria-label="Previous hotel photo">‹</button><span aria-live="polite">{Math.min(index + 1, photos.length)} / {photos.length}{photos.length > 1 ? ' · Swipe to explore' : ''}</span><button type="button" onClick={() => move(index + 1)} disabled={index >= photos.length - 1} aria-label="Next hotel photo">›</button></div>
    </> : <div className="pv-gallery-empty">{!result || result.query !== query ? 'Loading property photos…' : 'Property photos are unavailable right now.'}</div>}
    <a className="pv-gallery-more" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">View property &amp; more photos ↗</a>
  </div>
}
