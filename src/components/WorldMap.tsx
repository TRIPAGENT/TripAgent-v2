import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { geoContains, geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { Icon } from '@/components/ui'
import { CITIES } from '@/data/catalogue.generated'
import { useStore } from '@/context/store'
import type { CitySummary } from '@/lib/catalogue'

/**
 * "The world, within reach." — every destination we cover, on a map you can play
 * with. Pick a region and it flies there; drag, pinch or scroll to wander; tap a
 * pin and you are in that city's guide.
 *
 * The countries are projected once and never again. Zooming animates the SVG's
 * viewBox, so it stays smooth on a phone, and every line is drawn with a
 * non-scaling stroke so the hairlines stay hairlines at any zoom. Pins and labels
 * sit in an HTML layer above, positioned from the current view, so text is
 * always crisp and the same size.
 */

const W = 1000
const H = 520

/**
 * The map's own styles, in Nocturne's tokens.
 *
 * They live with the component rather than in the shared stylesheet: this is the
 * only thing that draws them, and land, pins and glass controls only make sense
 * together.
 */
const REGIONS = [
  'North America',
  'South America',
  'Western Europe',
  'Southern Europe',
  'Alpine & Central Europe',
  'Northern Europe',
  'Middle East',
  'Africa',
  'India',
  'South Asia & Indian Ocean',
  'South-East Asia',
  'East Asia',
  'Oceania',
]
const SHORT: Record<string, string> = {
  'Alpine & Central Europe': 'Alpine Europe',
  'South Asia & Indian Ocean': 'Indian Ocean',
  'South-East Asia': 'SE Asia',
}

type View = { x: number; y: number; w: number; h: number }

const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [W - 8, H - 8],
  ],
  { type: 'Sphere' },
)
const project = (c: CitySummary): [number, number] | null =>
  c.lat == null || c.lon == null ? null : (projection([c.lon, c.lat]) as [number, number])

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function WorldMap() {
  const navigate = useNavigate()
  const { setActiveCity } = useStore()
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 420 })
  const [countries, setCountries] = useState<Feature<Geometry>[] | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [view, setView] = useState<View>({ x: 0, y: 0, w: W, h: H })
  const viewRef = useRef(view)
  viewRef.current = view
  const anim = useRef<number | null>(null)

  // The outlines are the heaviest thing on the page; load them only when needed.
  useEffect(() => {
    let cancelled = false
    import('world-atlas/countries-50m.json').then((m) => {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo = (m.default ?? m) as any
      const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection
      setCountries(fc.features.filter((f) => f.id !== '010')) // Antarctica adds nothing here
    })
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cities = useMemo(
    () =>
      CITIES.map((c) => ({ c, p: project(c) })).filter((x): x is { c: CitySummary; p: [number, number] } => !!x.p),
    [],
  )

  const paths = useMemo(() => {
    if (!countries) return null
    const path = geoPath(projection)
    // Which region each country belongs to, by the cities we have in it.
    return countries.map((f, i) => {
      const regions = new Set<string>()
      for (const { c } of cities) {
        if (c.region && c.lon != null && c.lat != null && geoContains(f, [c.lon, c.lat])) regions.add(c.region)
      }
      return { id: `${f.id ?? 'x'}-${i}`, d: path(f) ?? '', regions }
    })
  }, [countries, cities])

  /** Fit a projected box into the container, keeping its aspect, with breathing room. */
  const fit = useCallback(
    (x0: number, y0: number, x1: number, y1: number): View => {
      const aspect = size.w / Math.max(1, size.h)
      // Compact regions (the Alps, the Gulf) are zoomed in close enough that their
      // names fit; labels hang to the right of the pin, so leave room on that side.
      let w = Math.max(x1 - x0, 26) * 1.25 + 14
      let h = Math.max(y1 - y0, 18) * 1.25 + 10
      if (w / h > aspect) h = w / aspect
      else w = h * aspect
      return { x: (x0 + x1) / 2 - w * 0.42, y: (y0 + y1) / 2 - h / 2, w, h }
    },
    [size],
  )

  /**
   * The world, sized to be legible on a phone: the inhabited band fills the
   * height, centred where most of the catalogue is (Europe to Asia). On a wide
   * screen the whole width fits; on a phone you drag west for the Americas.
   */
  const worldView = useCallback((): View => {
    const aspect = size.w / Math.max(1, size.h)
    const top = (projection([0, 72]) as [number, number])[1]
    const bottom = (projection([0, -50]) as [number, number])[1]
    // Never closer than ~60% of the world's width, so the first view still reads
    // as "the world" and the region labels have room.
    let w = Math.min(W, Math.max(W * 0.6, (bottom - top) * aspect))
    let h = w / aspect
    if (h < bottom - top) {
      h = bottom - top
      w = Math.min(W, h * aspect)
    }
    const cx = w >= W * 0.98 ? W / 2 : (projection([52, 0]) as [number, number])[0]
    const x = Math.min(Math.max(cx - w / 2, 0), W - w)
    return { x, y: (top + bottom) / 2 - h / 2, w, h }
  }, [size])

  const flyTo = useCallback((to: View, ms = 750) => {
    if (anim.current) cancelAnimationFrame(anim.current)
    const from = viewRef.current
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const k = ease(t)
      setView({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k,
      })
      if (t < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [])

  // Start on the world, and re-fit whenever the container changes shape.
  useEffect(() => {
    if (region) {
      const pts = cities.filter((x) => x.c.region === region).map((x) => x.p)
      flyTo(fit(Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))), 0)
    } else setView(worldView())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h])

  function pickRegion(r: string | null) {
    setRegion(r)
    if (!r) return flyTo(worldView())
    const pts = cities.filter((x) => x.c.region === r).map((x) => x.p)
    flyTo(fit(Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))))
  }

  /* ---------------------------------------------------------- gestures --- */

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(0)

  const zoomAt = (factor: number, sx: number, sy: number) => {
    const v = viewRef.current
    const w = Math.min(W * 1.4, Math.max(28, v.w / factor))
    const h = w * (v.h / v.w)
    const px = v.x + (sx / size.w) * v.w
    const py = v.y + (sy / size.h) * v.h
    setView({ x: px - (sx / size.w) * w, y: py - (sy / size.h) * h, w, h })
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (anim.current) cancelAnimationFrame(anim.current)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
    moved.current = 0
    if (!touched) setTouched(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const now = local(e)
    const pts = [...pointers.current.values()]
    if (pointers.current.size === 1) {
      const v = viewRef.current
      moved.current += Math.abs(now.x - prev.x) + Math.abs(now.y - prev.y)
      setView({ ...v, x: v.x - ((now.x - prev.x) / size.w) * v.w, y: v.y - ((now.y - prev.y) / size.h) * v.h })
    } else if (pointers.current.size === 2) {
      const other = pts.find((p) => p !== prev)!
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(now.x - other.x, now.y - other.y)
      moved.current += 10
      if (before > 0) zoomAt(after / before, (now.x + other.x) / 2, (now.y + other.y) / 2)
    }
    pointers.current.set(e.pointerId, now)
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
  }

  function onWheel(e: React.WheelEvent) {
    const p = local(e)
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y)
    if (!touched) setTouched(true)
  }

  // The page must not scroll while the map is being pinched or wheeled.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const stop = (ev: WheelEvent) => ev.preventDefault()
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  }, [])

  /* ------------------------------------------------------------ overlay --- */

  const toScreen = (p: [number, number]) => ({
    x: ((p[0] - view.x) / view.w) * size.w,
    y: ((p[1] - view.y) / view.h) * size.h,
  })
  const zoomed = view.w < W * 0.5
  const visible = cities.filter(({ p }) => {
    const s = toScreen(p)
    return s.x > -20 && s.x < size.w + 20 && s.y > -20 && s.y < size.h + 20
  })

  // Greedy label placement: a label is shown only if it does not collide with one
  // already placed. The dot always shows; the name appears as you zoom in enough
  // to give it room.
  const labelled = new Set<string>()
  if (zoomed) {
    const placed: { x: number; y: number; w: number }[] = []
    // In a region, only its own cities are named; neighbours stay as quiet dots.
    const order = region ? visible.filter((x) => x.c.region === region) : visible
    // Every pin is an obstacle too, so a name never runs underneath a neighbour's dot.
    const dots = visible.map(({ c, p }) => ({ slug: c.slug, ...toScreen(p) }))
    for (const { c, p } of order) {
      const s = toScreen(p)
      const w = c.name.length * 6.6 + 10
      const clearOfDots = dots.every((d) => d.slug === c.slug || Math.abs(d.y - s.y) > 10 || d.x < s.x + 4 || d.x > s.x + w + 4)
      if (clearOfDots && placed.every((q) => Math.abs(q.y - s.y) > 15 || s.x + w < q.x || q.x + q.w < s.x)) {
        placed.push({ x: s.x, y: s.y, w })
        labelled.add(c.slug)
      }
    }
  }

  // At world scale Europe's four regions sit on top of each other, so they share
  // one label; the tabs still reach each of them.
  const EUROPE = ['Western Europe', 'Southern Europe', 'Alpine & Central Europe', 'Northern Europe']
  const regionLabels = useMemo(() => {
    const groups: { label: string; regions: string[] }[] = [
      { label: 'Europe', regions: EUROPE },
      ...REGIONS.filter((r) => !EUROPE.includes(r)).map((r) => ({ label: SHORT[r] ?? r, regions: [r] })),
    ]
    return groups
      .map((g) => {
        const pts = cities.filter((x) => x.c.region && g.regions.includes(x.c.region)).map((x) => x.p)
        if (!pts.length) return null
        return {
          ...g,
          p: [pts.reduce((a, b) => a + b[0], 0) / pts.length, pts.reduce((a, b) => a + b[1], 0) / pts.length] as [number, number],
          n: pts.length,
          box: [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))] as const,
        }
      })
      .filter(Boolean) as { label: string; regions: string[]; p: [number, number]; n: number; box: readonly [number, number, number, number] }[]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  function openCity(c: CitySummary) {
    setActiveCity(c.slug)
    navigate(`/city/${c.slug}`)
  }

  return (
    <div className="wm">
      <div className="wm-tabs" role="group" aria-label="Regions">
        <button
          type="button"
          onClick={() => pickRegion(null)}
          aria-pressed={region === null}
          className={`k-chip shrink-0 ${region === null ? 'is-on' : ''}`}
        >
          World
        </button>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pickRegion(r)}
            aria-pressed={region === r}
            className={`k-chip shrink-0 ${region === r ? 'is-on' : ''}`}
          >
            {SHORT[r] ?? r}
          </button>
        ))}
      </div>

      <div
        ref={box}
        className="wm-box"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          const p = local(e)
          zoomAt(2, p.x, p.y)
        }}
      >
        {!paths && <div className="wm-loading">Drawing the world…</div>}
        <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="wm-svg" aria-label="Map of the destinations we cover">
          {paths?.map((c) => {
            const on = region ? c.regions.has(region) : c.regions.size > 0
            return (
              <path
                key={c.id}
                d={c.d}
                className={on ? (region ? 'wm-land wm-land--active' : 'wm-land wm-land--covered') : 'wm-land'}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>

        <div className="wm-overlay">
          {!zoomed &&
            (() => {
              // Biggest regions claim their space first; a label that would sit on
              // another is left off — the tabs above still reach every region.
              const placed: { x: number; y: number; w: number }[] = []
              return [...regionLabels].sort((a, b) => b.n - a.n).filter((g) => {
                const s = toScreen(g.p)
                const w = g.label.length * 9 + 26
                if (s.x - w / 2 < 4 || s.x + w / 2 > size.w - 4) return false
                const ok = placed.every((q) => Math.abs(q.y - s.y) > 20 || Math.abs(q.x - s.x) > (q.w + w) / 2)
                if (ok) placed.push({ x: s.x, y: s.y, w })
                return ok
              })
            })().map((g) => {
              const s = toScreen(g.p)
              return (
                <button
                  key={g.label}
                  type="button"
                  className="wm-region"
                  style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (g.regions.length === 1) return pickRegion(g.regions[0])
                    setRegion(null)
                    flyTo(fit(...g.box))
                  }}
                >
                  {g.label}
                  <span>{g.n}</span>
                </button>
              )
            })}

          {visible.map(({ c, p }) => {
            const s = toScreen(p)
            const inRegion = !region || c.region === region
            return (
              <button
                key={c.slug}
                type="button"
                aria-label={`Open ${c.name}`}
                title={c.name}
                className={`wm-pin${inRegion ? '' : ' is-far'}${zoomed ? '' : ' is-small'}`}
                style={{ transform: `translate(${s.x}px, ${s.y}px)` }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (moved.current > 8) return
                  openCity(c)
                }}
              >
                <i />
                {labelled.has(c.slug) && <span>{c.name}</span>}
              </button>
            )
          })}
        </div>

        <div className="wm-controls" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.6, size.w / 2, size.h / 2)}>
            <Icon name="plus" size={18} />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.6, size.w / 2, size.h / 2)}>
            <Icon name="minus" size={18} />
          </button>
          <button type="button" aria-label="Whole world" onClick={() => pickRegion(null)}>
            <Icon name="globe" size={18} />
          </button>
        </div>

        {!touched && <div className="wm-hint">Tap a pin to open the city</div>}

      </div>
    </div>
  )
}
