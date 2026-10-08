# WorldMap — portable export

Interactive world map: real country borders, 11 region tabs (click a tab, or a
region on the map, to zoom in), city dots with a photo hover card, and a
World-view entrance animation. **Auto-cycle is included** — on load it steps
through the regions on a timer (World → region → World → next region …) and
stops for good the moment the visitor picks a region themselves.
**No scroll-driven cycling / sticky scrolling** — that lived in a separate
wrapper (`StickyWorldMap`) which is not part of this export.

## Files

```
WorldMap.tsx                  the component (self-contained)
WorldMap.module.css           its styles (CSS Modules)
d3-geo-projection.d.ts        tiny type shim for d3-geo-projection
world-map.vars.css            default values for the CSS variables it uses (optional)
data/world-countries-50m.json Natural Earth 50m borders (TopoJSON, via world-atlas) – 148 KB
data/map-tabs.json            the 11 regions: countries + each region's cities (lat/lon) – 31 KB
data/map-cities.json          per-city name / country / image path for the hover cards – 9 KB
```

## Install

```bash
npm i d3-geo d3-geo-projection topojson-client
npm i -D @types/topojson-client @types/topojson-specification
```
Needs React 18+, a bundler that handles CSS Modules and JSON imports (Vite,
Next, CRA…), and `"resolveJsonModule": true` in tsconfig. `d3-geo-projection.d.ts`
must be inside your tsconfig `include`.

## Use

```tsx
import WorldMap from "./world-map/WorldMap";
import "./world-map/world-map.vars.css"; // only if you don't define the tokens yourself

// The map fills its parent: give the parent a height (it is not fixed-size).
<div style={{ height: 640 }}>
  <WorldMap />
</div>
```

Optional props:

| prop | default | what it does |
|---|---|---|
| `resolveImage(path)` | identity | map a raw image path (`/img/cities/paris.jpg?v=3`) to the URL you actually serve |
| `getCityHref(slug)` | `/city-<slug>` | where a city dot / card goes |
| `onNavigate(href)` | full page load | called instead of a page load on click — pass your router's `navigate` |
| `activeTabOverride` | – | drive the active region from outside (this also turns the auto-cycle off) |
| `worldRevealKey` | – | bump to replay the World-view entrance animation |

React Router example: `<WorldMap onNavigate={(href) => navigate(href)} getCityHref={(s) => `/cities/${s}`} />`

## Things to change for your project

- **City photos are NOT included** (≈81 MB at full size in the original). The
  hover cards and city dots read `image` from `data/map-cities.json`, e.g.
  `/img/cities/paris.jpg?v=3`. Serve those files, or use `resolveImage` to
  point at your CDN. A city with no image still works (dot only).
- **Cities / regions:** edit `data/map-tabs.json` (region → `countries` names
  as they appear in the topology, and `cities` with `slug`, `name`, `lat`,
  `lon`) and `data/map-cities.json` (same slugs → `name`, `country`, `image`).
  `WORLD_ANCHOR_SLUGS` and `REGION_POP_ORDER` near the top of `WorldMap.tsx`
  must reference slugs / region keys that exist in your data.
- **Auto-cycle timing:** the `cycle` effect near the top of the component
  (1 s before starting, 2 s per region, 1 s on World between regions).
  Delete that `useEffect` to switch auto-cycle off.
- **Styling tokens:** colours/fonts come from the CSS variables in
  `world-map.vars.css`. Dark mode keys off `:root[data-theme="dark"]`.
