import { useEffect, useState } from 'react'
import MeshGradientCanvas, { type MeshTuning } from './MeshGradientCanvas'
import type { CSSProperties } from 'react'

// A fine film grain, so the soft colour fields read as printed light rather than
// flat vector blur (and so the dark end of the gradient does not band).
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`

/**
 * A mesh gradient behind a screen's content, inside the phone column.
 *
 * It is fixed to the viewport, so it stays put while the page scrolls. It sits
 * at z-index -1, so the screen it is rendered in must be its own stacking
 * context (`isolate` on <Screen>) or it falls behind the screen's background.
 * The layer carries a static gradient of its own, which is what shows with
 * reduced motion, before WebGL starts, or where WebGL is unavailable.
 */
export function MeshBackdrop({
  id,
  colors,
  tuning,
  fallback,
}: {
  id: string
  colors: CSSProperties
  tuning: MeshTuning
  fallback: string
}) {
  const [still, setStill] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setStill(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])

  return (
    <div aria-hidden="true" className="app-frame-fixed pointer-events-none" style={{ zIndex: -1, background: fallback }}>
      {!still && <MeshGradientCanvas id={id} colors={colors} tuning={tuning} />}
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.07, mixBlendMode: 'overlay' }} />
    </div>
  )
}
