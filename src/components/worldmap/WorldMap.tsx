import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { geoPath, geoCentroid, geoArea } from "d3-geo";
import { geoMiller } from "d3-geo-projection";
import { feature, merge } from "topojson-client";
import type { Topology, GeometryCollection, GeometryObject } from "topojson-specification";
import worldTopology from "./data/world-countries-50m.json";
import mapTabsData from "./data/map-tabs.json";
import citiesInfo from "./data/map-cities.json";
import { Icon } from "@/components/icons";
import styles from "./WorldMap.module.css";

// ---- data shapes (data/map-tabs.json, data/map-cities.json) ----
interface MapCity {
  slug: string;
  name: string;
  lat: number;
  lon: number;
}
interface MapTab {
  key: string;
  label: string;
  // Country names exactly as they appear in world-countries-50m.json
  // (topojson properties.name).
  countries: string[];
  cities: MapCity[];
}
interface MapTabsData {
  world: MapTab;
  regions: MapTab[];
}
// What the hover card / city dots show for each city. `image` is a raw asset
// path (e.g. /img/cities/paris.jpg) — see the `resolveImage` prop.
interface MapCityInfo {
  name: string;
  country: string | null;
  image: string | null;
}

const { world: WORLD_TAB, regions: REGION_TABS } = mapTabsData as MapTabsData;
// slug -> { name, country, image } for every city on the map.
const CITIES = citiesInfo as unknown as Record<string, MapCityInfo>;

// Real country borders (Natural Earth 50m resolution via the world-atlas npm
// package, public domain).
//
// World view: every serviced country (the 52 names across map-tabs.
// generated.json's 11 region tabs — India included, no longer a special
// case) gets its own plain outline; everything else is dissolved into one
// undemarcated background shape. Nothing inside a country is shown — the
// old per-zone sub-country splitting and per-shape size-inflation hack are
// both gone along with the "zone" concept itself: navigation happens via
// the tab bar, not by clicking individual map shapes.
const VIEW_W = 980;
const ANTARCTICA_ID = "010";

// These two tabs' World-view name label is hidden — their computed
// centroid lands somewhere that doesn't read well for a label (their own
// shape is fragmented across several small, spread-out countries, unlike
// e.g. Africa's one solid landmass), while the shape itself (outline +
// hover fill) stays exactly as-is.
// Region names in the World view are glass pills over the map (as on the old map), not text
// drawn in the SVG, so the SVG labels are off.
const SHOW_SVG_REGION_LABELS = false;
// Manual nudge (in projected map units, at the un-zoomed World scale) on
// top of the computed centroid, for a tab whose real geographic center
// still isn't where the label should sit — SE Asia's own centroid lands
// on the mainland (overlapping East Asia's own label), when the open
// water between the mainland and the archipelago reads better.
const LABEL_POSITION_OFFSET: Record<string, { dx: number; dy: number }> = {
  "southeast-asia": { dx: 39, dy: -1 },
};

// Oceania (far east) and North America (far west, once exclaves are
// stripped — see splitMainlandAndExclaves below) sit close enough to the map's edge
// that centering them can pan past where any content was ever drawn,
// exposing blank canvas. Rather than fight that with padding math (every
// attempt either broke centering or spiralled — see the conversation this
// was built from), this draws a genuine wrapped duplicate of the whole
// map shifted a full VIEW_W to either side — geographically correct,
// since the map really does wrap at the antimeridian — so panning into
// that space reveals real content instead of nothing. The scale/centering
// formulas below are completely unchanged by this; it's purely extra
// rendering plus a wider viewBox to show it.

// FIT TO THE SCREEN. The map is drawn at the width of its container (1 unit =
// 1 css px), so the whole world fits the width and every region is framed
// inside the area left under the chip row, with these margins (px). The old
// per-tab zoom multipliers and pan biases are no longer used.
const TAB_BAR_PX = 52;
// How soft the map looks behind the region chips (blur radius in px).
const ROW_BLUR = 7;
const FIT_PAD_X = 16;
const FIT_PAD_TOP = 8;
const FIT_PAD_BOTTOM = 20;
const REGION_FIT = 0.94;
// Regions that read better a little closer than a plain fit (still centred).
const TAB_ZOOM: Record<string, number> = {
  europe: 2.5,
  "middle-east": 2.5,
  americas: 1.55,
  india: 3, // South Asia (doubled from 1.5)
  "east-asia": 3, // doubled from 1.5
  "southeast-asia": 3, // doubled from 1.5
  oceania: 2,
  africa: 2,
};
// World view shows region names only; the photo anchors belong to the region views.
const SHOW_WORLD_ANCHORS = false;
// No hover or "featured" preview cards on cities: a tap simply opens the city.
const SHOW_CITY_CARDS = false;
// Region views mark every city with a photo anchor, drawn this much larger than
// the original hover bubble so the picture can be read at phone size.
const CITY_MARKER_SCALE = 1.45;
// How much the photo circles grow with the free zoom, as a fraction of the map's own
// growth. 0 = they stay one size on screen however far you zoom (the original
// behaviour), so neighbouring cities pull apart and a cluster splits as you zoom in.
const CIRCLE_GROWTH = 0;
// Two cities merge into one numbered cluster while they sit closer than this many
// circle-diameters on screen.
const CLUSTER_GAP = 1.1;

type CountryProps = { name: string };
const countryName = (g: GeometryObject<CountryProps>) => (g as { properties: CountryProps }).properties.name;

// Everything here is drawn fill:none/stroke-only (see WorldMap.module.css),
// so there's no need for d3's default Polygon clipping behavior, which
// closes a ring cut by the antimeridian with a synthetic edge running
// straight along the clip boundary (needed to keep a FILLED shape's area
// correct, but for us it just draws an unwanted vertical line through
// Russia/Fiji, the only two countries in this data that cross ±180). A
// LineString/MultiLineString gets clipped into open, disconnected pieces
// instead — no synthetic closing edge — so converting every ring here from
// a Polygon to the equivalent MultiLineString before it reaches path()
// removes the artifact for those two countries and is a no-op for
// everyone else (a closed ring stroked as an open line looks identical).
function toStrokeGeometry(geom: GeoJSON.Geometry): GeoJSON.Geometry {
  if (geom.type === "Polygon") return { type: "MultiLineString", coordinates: geom.coordinates };
  if (geom.type === "MultiPolygon") return { type: "MultiLineString", coordinates: geom.coordinates.flat() };
  return geom;
}
function asStrokeFeature(f: GeoJSON.Feature): GeoJSON.Feature {
  return { ...f, geometry: toStrokeGeometry(f.geometry) };
}

// World view shows ONE dissolved shape PER REGION TAB (not one shape for
// the whole world) — India/Nepal/Bhutan merge into a single South Asia
// silhouette, Kenya/Tanzania merge into a single Africa silhouette, with
// no border between countries inside the same tab. A tab's countries
// aren't always one contiguous landmass though (Africa's Egypt sits far
// from its Kenya/Tanzania cluster; these tabs are grouped by trip-planning
// footprint, not strict geography) — in that case each disconnected
// cluster (and any genuine island) still renders as its own separate
// piece, same as real islands do; that's expected, not a bug to merge
// away. Individual country borders (India vs Nepal vs Bhutan) only show
// up once a specific tab is zoomed into, via tabCountryShapes below.
//
// Some unserviced countries sit almost entirely inside a single tab's own
// landmass (Bolivia inside Peru/Brazil/Argentina; Belgium inside the
// Western Europe cluster; Lesotho inside South Africa) — merging just the
// serviced countries leaves a real notch/bite along that border, which
// reads as a leftover internal boundary even though it's accurate. These
// get folded into their surrounding tab's merge purely so the outline is
// one clean shape — they're still not "serviced" (no cities, no tab of
// their own, no dimming distinction), just visually absorbed.
//
// That "≥50% of its own border" test only catches a country tucked
// directly against the tab's own shape — it doesn't reach a *chain* of
// unserviced countries bridging two serviced ones that are otherwise far
// apart (Egypt to Kenya/Tanzania across Sudan/Ethiopia/Uganda, none of
// which border enough of Africa's own countries to individually qualify).
// For Africa specifically the whole mainland is meant to read as one
// continuous continent regardless, so this lists every other mainland
// African country in this dataset to always fold in, on top of whatever
// the enclosure test already catches — extend this map if another tab
// (e.g. Europe, Asia) turns out to need the same treatment.
const CONTINENT_FILL: Record<string, string[]> = {
  africa: [
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cameroon",
    "Central African Rep.",
    "Chad",
    "Congo",
    "Côte d'Ivoire",
    "Dem. Rep. Congo",
    "Djibouti",
    "Eq. Guinea",
    "Eritrea",
    "eSwatini",
    "Ethiopia",
    "Gabon",
    "Gambia",
    "Ghana",
    "Guinea",
    "Guinea-Bissau",
    "Lesotho",
    "Liberia",
    "Libya",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mozambique",
    "Namibia",
    "Niger",
    "Nigeria",
    "Rwanda",
    "Senegal",
    "Sierra Leone",
    "Somalia",
    "Somaliland",
    "S. Sudan",
    "Sudan",
    "Togo",
    "Tunisia",
    "Uganda",
    "W. Sahara",
    "Zambia",
    "Zimbabwe",
  ],
  // Argentina/Brazil/Peru (+ the already-enclosed Bolivia/Paraguay/
  // Uruguay) leave the whole northern bulge of the continent
  // (Venezuela/Colombia/Ecuador/Guyana/Suriname) as a notch — none of
  // those individually meet the enclosure test either, same reasoning as
  // Africa above. Chile is the same story for a different reason: most of
  // its own border is Pacific coastline, not a shared land border, so it
  // never crosses the 50% threshold even though it runs the entire length
  // of the continent.
  // (The one Americas tab now spans both continents; this list is its South American fill.)
  americas: ["Colombia", "Venezuela", "Ecuador", "Guyana", "Suriname", "Chile"],
};
function geometryPoints(geom: GeoJSON.Geometry): GeoJSON.Position[] {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  const pts: GeoJSON.Position[] = [];
  for (const poly of polys) for (const ring of poly) for (const p of ring) pts.push(p);
  return pts;
}
const pointKey = (p: GeoJSON.Position) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
function ringPointSet(geom: GeoJSON.Geometry): Set<string> {
  return new Set(geometryPoints(geom).map(pointKey));
}
// A country is "enclosed" by a tab once at least this fraction of its own
// border coordinates exactly coincide with that tab's dissolved outline.
const ENCLOSURE_FRACTION = 0.5;

// A few countries carry distant overseas territories in this map data
// (France's polygon includes French Guiana in South America and Réunion
// in the Indian Ocean; the USA's includes the Aleutian chain stretching
// almost to the antimeridian) that would otherwise show up as stray
// shapes far from the rest of their tab and skew that tab's own bounds.
// Earlier this used a generic "largest piece wins, anything more than N°
// away is an exclave" heuristic — but several tabs (Africa, Middle East)
// are deliberately made of widely-separated countries with no shared
// landmass at all, which that heuristic would wrongly treat as exclaves
// of each other. An explicit list of the actual known trouble spots
// avoids that: only pieces that fall in one of these boxes get pulled
// out, everything else in a tab is kept no matter how far apart. Each
// entry is also scoped to the one tab it's actually extracted FROM
// (fromTab) — a bounding box alone isn't precise enough: South America's
// own Brazil/Peru/Argentina merge happens to include a couple of small
// river-island fragments that fall inside the same rough longitude/
// latitude window as French Guiana, and without the fromTab scope those
// got wrongly pulled out of South America's own shape too.
type KnownExclave = { fromTab: string; label: string; tab?: string; matchLon: [number, number]; matchLat: [number, number] };
const KNOWN_EXCLAVES: KnownExclave[] = [
  // French Guiana is genuinely South American — reattributed there
  // instead of just discarded (matched by centroid, since none of these
  // datasets name exclaves individually).
  { fromTab: "europe", label: "French Guiana", tab: "americas", matchLon: [-60, -50], matchLat: [-5, 10] },
  // Réunion (Indian Ocean) and the Aleutian chain (which straddles the
  // antimeridian, hence two boxes) aren't reattributed anywhere — just
  // dropped, same as before.
  { fromTab: "europe", label: "Réunion", matchLon: [54, 56], matchLat: [-22, -20] },
  { fromTab: "americas", label: "Aleutian Islands", matchLon: [165, 180], matchLat: [50, 56] },
  { fromTab: "americas", label: "Aleutian Islands", matchLon: [-180, -165], matchLat: [50, 56] },
];

function polyBBoxCentroid(poly: GeoJSON.Position[][]): { cx: number; cy: number } {
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of poly[0] as [number, number][]) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { cx: (minLon + maxLon) / 2, cy: (minLat + maxLat) / 2 };
}

function extractKnownExclaves(
  geom: GeoJSON.Geometry,
  candidates: KnownExclave[]
): {
  rest: GeoJSON.Geometry;
  extracted: { poly: GeoJSON.Position[][]; match: KnownExclave }[];
} {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : null;
  if (!polys) return { rest: geom, extracted: [] };
  const kept: typeof polys = [];
  const extracted: { poly: GeoJSON.Position[][]; match: KnownExclave }[] = [];
  for (const poly of polys) {
    const { cx, cy } = polyBBoxCentroid(poly);
    const match = candidates.find((k) => cx >= k.matchLon[0] && cx <= k.matchLon[1] && cy >= k.matchLat[0] && cy <= k.matchLat[1]);
    if (match) extracted.push({ poly, match });
    else kept.push(poly);
  }
  return { rest: { type: "MultiPolygon", coordinates: kept }, extracted };
}

// World-view destination anchors — a small, deliberately curated set of
// already-serviced cities shown directly on the World view (before any
// region is selected), so the map reads as a destination atlas instead of
// a bare outline. Every slug here must already exist in both
// cities.generated.json (for its hero image/tagline/country) AND some
// region's own `cities` list in map-tabs.generated.json (for lat/lon) —
// filtered against both below, not assumed; an entry that stops matching
// either silently drops out rather than rendering broken.
const WORLD_ANCHOR_SLUGS = ["paris", "london", "new-york", "dubai", "tokyo", "santorini"];

// World-view entrance sequence: each SERVICED REGION's own geographic
// shape pops in as one complete group, west→east, then the curated
// destination anchors fade in together once the last region has settled —
// see .regionReveal/.worldMarkersReveal in WorldMap.module.css. Order here
// is the explicit west→east list from the brief, not derived from
// geometry, but it's exactly REGION_TABS' own keys (map-tabs.generated.
// json) — nothing invented.
const REGION_POP_ORDER = [
  "americas",
  "europe",
  "africa",
  "middle-east",
  "india", // REGION_TABS' own key for the "South Asia" tab (map-tabs.generated.json)
  "east-asia",
  "southeast-asia",
  "oceania",
];
const REGION_POP_STEP_MS = 120;
const REGION_POP_DURATION_S = 0.6;
// Anchors wait for the last region to finish before fading in together
// (see WORLD_ANCHOR_SLUGS below) — one collective fade, not per-marker.
const WORLD_MARKERS_DELAY_S = ((REGION_POP_ORDER.length - 1) * REGION_POP_STEP_MS) / 1000 + REGION_POP_DURATION_S;

// Floating hover card size (4:3), in the same locally-scaled coordinate space
// as the dot/anchor it floats above, so it renders at a constant apparent size
// regardless of zoom. GAP keeps it clear of the dot's own hit area.
const HOVER_CARD_W = 220;
const HOVER_CARD_H = 165;
const HOVER_CARD_GAP = 14;

// A small card floating directly above a city marker: the city photo as the
// background, white city + country text over it. Always mounted, with
// visibility as a pure opacity transition. Not an <a> itself (it sits inside
// the marker's own link) — opens the city via `onOpen` instead.
function CityHoverCard({
  slug,
  fallbackName,
  visible,
  isFeatured,
  flipBelow,
  imageSrc,
  onOpen,
}: {
  slug: string;
  fallbackName: string;
  visible: boolean;
  // True only for the region's own featured/default city (its first marker).
  isFeatured: boolean;
  // True when the dot sits too close to the top edge for the card to fit
  // above it — renders below the dot instead.
  flipBelow: boolean;
  imageSrc: string | null;
  onOpen: () => void;
}) {
  const cityData = CITIES[slug];
  const name = cityData?.name ?? fallbackName;
  const country = cityData?.country ?? null;

  return (
    <foreignObject
      x={-HOVER_CARD_W / 2}
      y={flipBelow ? HOVER_CARD_GAP : -HOVER_CARD_GAP - HOVER_CARD_H}
      width={HOVER_CARD_W}
      height={HOVER_CARD_H}
      // pointer-events none on the foreignObject itself, not just its
      // content, so its large invisible box can't swallow hovers; the
      // visible card re-enables them on itself (.hoverCardVisible).
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <div
        // @ts-expect-error — xmlns on an HTML element inside <foreignObject>
        xmlns="http://www.w3.org/1999/xhtml"
        onClick={onOpen}
        role="link"
        tabIndex={-1}
        className={`${styles.hoverCard} ${styles.hoverCardImg} ${visible ? styles.hoverCardVisible : ""}`}
      >
        {imageSrc && <img className={styles.hoverCardImgBg} src={imageSrc} alt="" />}
        <div className={styles.hoverCardImgScrim} />
        {isFeatured && <div className={styles.hoverCardImgFeature}>Featured</div>}
        <div className={styles.hoverCardImgLocation}>
          <div className={styles.hoverCardImgCity}>{name}</div>
          {country && <div className={styles.hoverCardImgCountry}>{country}</div>}
        </div>
      </div>
    </foreignObject>
  );
}

export default function WorldMap({
  activeTabOverride,
  worldRevealKey,
  resolveImage,
  getCityHref,
  onNavigate,
}: {
  // Maps a city's raw image path (data/map-cities.json, e.g.
  // "/img/cities/paris.jpg") to the URL actually served in your project.
  // Default: use the path as-is.
  resolveImage?: (path: string) => string;
  // Where a city marker / hover card goes. Default: `/city-<slug>`.
  getCityHref?: (slug: string) => string;
  // Called instead of a full page load when a city is clicked (wire this to
  // your router's navigate). Default: normal link / window.location.assign.
  onNavigate?: (href: string) => void;
  // Externally-driven tab (e.g. StickyWorldMap's scroll-cycling) — when set,
  // this replaces both the click-driven tab bar's own state AND the built-in
  // demo auto-cycle below, so the two don't fight over `activeTab`. Omit for
  // the map's normal standalone behavior (tab-bar clicks + demo auto-cycle).
  activeTabOverride?: string;
  // Bumped by a parent (StickyWorldMap) each time the World-view entrance
  // animation should replay — on becoming sticky, and each time scrolling
  // back into World from a region while still pinned. Folded into the
  // World-view reveal groups' own React key below to force a fresh mount
  // (a CSS animation doesn't replay just because its class stays applied to
  // the same, already-animated DOM node).
  worldRevealKey?: number;
} = {}) {
  const [activeTab, setActiveTab] = useState(activeTabOverride ?? WORLD_TAB.key);
  const cityHref = (slug: string) => (getCityHref ? getCityHref(slug) : `/city-${slug}`);
  const imageUrl = (path: string | null | undefined) => (path ? (resolveImage ? resolveImage(path) : path) : null);
  const openCity = (slug: string) => {
    if (onNavigate) onNavigate(cityHref(slug));
    else window.location.assign(cityHref(slug));
  };
  const onCityLinkClick = (slug: string) => (e: ReactMouseEvent) => {
    if (!onNavigate) return; // plain link — let the browser follow it
    e.preventDefault();
    onNavigate(cityHref(slug));
  };
  // Connects three otherwise-separate elements — a region's shape on the
  // map, its name label, and its tab-bar button — so hovering ANY one of
  // them highlights all three together. Native CSS :hover can't reach
  // across to a sibling that isn't a DOM neighbor (the tab bar button
  // lives nowhere near the map's own <g>), so this tracks it as state
  // instead and applies the SAME highlight classes from both directions.
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  // Set on a city marker's own hover/focus (see activeCityMarkers
  // rendering), cleared on leave. Not navigation state: clicking a marker
  // still navigates; this only drives which marker's own floating
  // CityHoverCard is shown.
  // City hover/preview cards are switched off (see SHOW_CITY_CARDS); nothing sets this now.
  const hoveredCity = null as string | null;
  // One free camera: a map point q is drawn at (x, y) + k * q. Dragging, pinching, the wheel,
  // double-tap and the +/− buttons all move it directly, anywhere in the world. A region tab
  // animates it to that region's fit; and when it is moved by hand, the selected tab follows
  // whichever region is in the middle of the screen (World when zoomed right out).
  const [cam, setCam] = useState({ k: 1, x: 0, y: 0 });
  const camRef = useRef(cam);
  const animRef = useRef<number | null>(null);
  const fromGestureRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // (The old extra layer of "manual zoom on top of the region fit" is folded into the camera.)
  const manualZoom = 1;
  const pan = { x: 0, y: 0 };
  const [dragging, setDragging] = useState(false);
  const draggedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // The scrolling row of region chips; the active one is kept in view as the map moves.
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const row = tabScrollRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    if (!row || !chip) return;
    row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
  }, [activeTab]);
  
  // Standalone demo auto-cycle. Once the visitor picks a region themselves
  // (tab bar or clicking a region on the map) it stops for good and every
  // pending step is cancelled — otherwise the next scheduled step would
  // yank the map away from what they just chose.
  const userPickedRef = useRef(false);
  const cycleTimersRef = useRef<number[]>([]);
  const stopCycle = () => {
    userPickedRef.current = true;
    cycleTimersRef.current.forEach((id) => window.clearTimeout(id));
    cycleTimersRef.current = [];
  };
  const pickTab = (key: string) => {
    stopCycle();
    setActiveTab(key);
  };
  const commitCam = (c: { k: number; x: number; y: number }) => {
    camRef.current = c;
    setCam(c);
  };
  const cancelAnim = () => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  };
  // Glide the camera to a target (a tab's fit) over about 0.8s.
  const animateTo = (to: { k: number; x: number; y: number }) => {
    cancelAnim();
    const from = camRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 800);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      commitCam({ k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  };
  // The middle of the map area (below the chip row): where "which region am I looking at" is read.
  const centreOfView = () => {
    const top = TAB_BAR_PX + FIT_PAD_TOP;
    const area = Math.max(120, (H || viewH) - top - FIT_PAD_BOTTOM);
    return { x: W / 2, y: top + area / 2 };
  };
  // The map can wander well past its edges (it wraps), but not clean out of sight.
  // How far from the middle of the world the view may roam grows with the zoom: right out at
  // the world fit it is pinned to the middle, and from about twice that it is free.
  const clampCam = (c: { k: number; x: number; y: number }) => {
    const mid = centreOfView();
    const f = Math.max(0, Math.min(1, (c.k - kMinCam) / kMinCam));
    const qx = Math.max(W / 2 - f * W, Math.min(W / 2 + f * W, (mid.x - c.x) / c.k));
    const qy = Math.max(viewH / 2 - f * viewH * 0.6, Math.min(viewH / 2 + f * viewH * 0.6, (mid.y - c.y) / c.k));
    return { k: c.k, x: mid.x - qx * c.k, y: mid.y - qy * c.k };
  };
  // After a hand move, the selected tab follows the region under the middle of the screen.
  const syncTabToCam = (c: { k: number; x: number; y: number }) => {
    let next = WORLD_TAB.key;
    if (c.k >= kCities) {
      const mid = centreOfView();
      const qx = (mid.x - c.x) / c.k;
      const qy = (mid.y - c.y) / c.k;
      let best = activeTabRef.current;
      let bestD = Infinity;
      for (const [key, b] of Object.entries(regionBounds)) {
        const bx = (b.x0 + b.x1) / 2;
        const by = (b.y0 + b.y1) / 2;
        for (const off of [-W, 0, W]) {
          // a small preference for the region already selected keeps the tab from flickering
          const d = Math.hypot(qx - (bx + off), qy - by) * (key === activeTabRef.current ? 0.85 : 1);
          if (d < bestD) {
            bestD = d;
            best = key;
          }
        }
      }
      next = best;
    }
    if (next !== activeTabRef.current) {
      fromGestureRef.current = true;
      setActiveTab(next);
    }
  };
  // Zoom by `factor`, keeping the map point under (sx, sy) — canvas px — where it is.
  const zoomAt = (factor: number, sx: number, sy: number) => {
    cancelAnim();
    const c = camRef.current;
    const k = Math.min(kMaxCam, Math.max(kMinCam, c.k * factor));
    const r = k / c.k;
    const next = clampCam({ k, x: sx - (sx - c.x) * r, y: sy - (sy - c.y) * r });
    commitCam(next);
    syncTabToCam(next);
  };
  const panBy = (dx: number, dy: number) => {
    cancelAnim();
    const c = camRef.current;
    const next = clampCam({ k: c.k, x: c.x + dx, y: c.y + dy });
    commitCam(next);
    syncTabToCam(next);
  };
  const zoomBy = (factor: number) => {
    stopCycle();
    const mid = centreOfView();
    zoomAt(factor, mid.x, mid.y);
  };

  // Pointer gestures. One finger drags; two fingers pinch (and drag together);
  // a quick second tap zooms in on the spot. Listeners sit on the window for the
  // length of a gesture so a plain tap still reaches a city's link, while a drag
  // that moved is swallowed by onClickCapture on the <svg>.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const movedRef = useRef(0);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onWinMove = (ev: PointerEvent) => {
    const pts = pointersRef.current;
    const prev = pts.get(ev.pointerId);
    if (!prev) return;
    const now = localPoint(ev);
    if (pts.size === 1) {
      const dx = now.x - prev.x;
      const dy = now.y - prev.y;
      movedRef.current += Math.abs(dx) + Math.abs(dy);
      if (movedRef.current > 6) {
        draggedRef.current = true;
        setDragging(true);
        panBy(dx, dy);
      }
    } else if (pts.size >= 2) {
      const other = [...pts.entries()].find(([id]) => id !== ev.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(now.x - other.x, now.y - other.y);
      const midPrev = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      const midNow = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
      movedRef.current += 10;
      draggedRef.current = true;
      setDragging(true);
      panBy(midNow.x - midPrev.x, midNow.y - midPrev.y);
      if (before > 0) zoomAt(after / before, midNow.x, midNow.y);
    }
    pts.set(ev.pointerId, now);
  };
  const onWinUp = (ev: PointerEvent) => {
    const pts = pointersRef.current;
    const p = pts.get(ev.pointerId);
    pts.delete(ev.pointerId);
    if (pts.size > 0) return;
    window.removeEventListener("pointermove", winHandlers.current.move);
    window.removeEventListener("pointerup", winHandlers.current.up);
    window.removeEventListener("pointercancel", winHandlers.current.up);
    setDragging(false);
    if (p && ev.type === "pointerup" && !draggedRef.current && movedRef.current < 6) {
      const t = performance.now();
      const last = lastTapRef.current;
      if (last && t - last.t < 320 && Math.hypot(p.x - last.x, p.y - last.y) < 28) {
        zoomAt(2, p.x, p.y);
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { t, x: p.x, y: p.y };
      }
    }
    window.setTimeout(() => (draggedRef.current = false), 60);
  };
  // Stable listener identities that always call the latest render's handlers.
  const latestHandlers = useRef({ move: onWinMove, up: onWinUp, wheel: (_e: WheelEvent) => {} });
  latestHandlers.current.move = onWinMove;
  latestHandlers.current.up = onWinUp;
  latestHandlers.current.wheel = (e: WheelEvent) => {
    stopCycle();
    cancelAnim();
    const p = localPoint(e);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  };
  const winHandlers = useRef({
    move: (e: PointerEvent) => latestHandlers.current.move(e),
    up: (e: PointerEvent) => latestHandlers.current.up(e),
  });
  const onMapPointerDown = (e: React.PointerEvent) => {
    stopCycle();
    cancelAnim();
    if (pointersRef.current.size === 0) {
      movedRef.current = 0;
      draggedRef.current = false;
      window.addEventListener("pointermove", winHandlers.current.move);
      window.addEventListener("pointerup", winHandlers.current.up);
      window.addEventListener("pointercancel", winHandlers.current.up);
    }
    pointersRef.current.set(e.pointerId, localPoint(e.nativeEvent));
  };
  // The scroll wheel zooms the map instead of scrolling the page.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      latestHandlers.current.wheel(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (activeTabOverride) return; // externally controlled — skip the built-in demo auto-cycle
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!userPickedRef.current) fn();
      }, ms);
      cycleTimersRef.current.push(id);
    };
    // Every region in tab order, then back to World, then round again. Each step
    // holds 4s on a region and 3s on World (2s longer than before).
    const sequence = [...REGION_TABS.map((t) => t.key), WORLD_TAB.key];
    const dwell = (key: string) => (key === WORLD_TAB.key ? 3000 : 4000);
    let step = 0;
    const advance = () => {
      const key = sequence[step % sequence.length];
      step++;
      setActiveTab(key);
      later(advance, dwell(key));
    };
    later(advance, dwell(WORLD_TAB.key));
    return () => {
      cycleTimersRef.current.forEach((id) => window.clearTimeout(id));
      cycleTimersRef.current = [];
    };
  }, [activeTabOverride]);

  useEffect(() => {
    if (activeTabOverride) setActiveTab(activeTabOverride);
  }, [activeTabOverride]);

  // The <svg>'s viewBox covers the map's FULL height (viewH below), but
  // .canvas crops that to a fixed shorter box via CSS + preserveAspectRatio
  // "slice" (see WorldMap.module.css) — so the height that's actually on
  // screen, in viewBox units, is shorter than viewH by whatever the crop
  // ratio is. Fitting a region against the full viewH (as an earlier pass
  // did) sized it against space that isn't visible, which is what cut off
  // India's south — this measures the real visible box instead.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 0 && h > 0) setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Gates the marker pop-in (see .revealed in WorldMap.module.css) on the
  // map actually being scrolled into view — it mounts immediately with the
  // rest of the homepage, well below the fold, so triggering the reveal on
  // mount alone would almost always finish playing before anyone scrolls
  // down to see it. Fires once and disconnects: this is "has the section
  // been seen yet", not a repeating scroll-position watcher, so nothing is
  // left running after that first entry.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || revealed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [revealed]);

  // The drawing width: the container's own width in px (980 until it is measured).
  const W = box?.w ?? VIEW_W;
  const H = box?.h ?? 0;

  const { backgroundD, tabFillD, tabShapes, tabLabelPos, tabCountryShapes, viewH, regionBounds, cityProjector } = useMemo(() => {
    const topology = worldTopology as unknown as Topology;
    const countries = topology.objects.countries as GeometryCollection<CountryProps>;
    const servicedNames = new Set(WORLD_TAB.countries);

    const nonAntarctic = countries.geometries.filter((g) => String(g.id) !== ANTARCTICA_ID);
    const backgroundGeomsAll = nonAntarctic.filter((g) => !servicedNames.has(countryName(g)));
    const servicedGeoms = nonAntarctic.filter((g) => servicedNames.has(countryName(g)));
    const geomsByName = new Map(nonAntarctic.map((g) => [countryName(g), g]));

    // First pass: merge each tab's own serviced countries alone, purely to
    // find which unserviced countries are enclosed by exactly one of them
    // (see the geometryPoints/ENCLOSURE_FRACTION comment above).
    const tabGeomsByKey: Record<string, GeometryObject<CountryProps>[]> = {};
    const tabPointSets: Record<string, Set<string>> = {};
    for (const tab of REGION_TABS) {
      const tabGeoms = servicedGeoms.filter((g) => tab.countries.includes(countryName(g)));
      if (tabGeoms.length === 0) continue;
      tabGeomsByKey[tab.key] = tabGeoms;
      tabPointSets[tab.key] = ringPointSet(merge(topology, tabGeoms as unknown as Parameters<typeof merge>[1]));
    }
    const enclosedGeomsByTab: Record<string, GeometryObject<CountryProps>[]> = {};
    const enclosedNames = new Set<string>();
    for (const g of backgroundGeomsAll) {
      const pts = geometryPoints((feature(topology, g) as GeoJSON.Feature).geometry);
      if (pts.length === 0) continue;
      let bestKey: string | null = null;
      let bestFrac = 0;
      for (const [key, set] of Object.entries(tabPointSets)) {
        const matched = pts.filter((p) => set.has(pointKey(p))).length;
        const frac = matched / pts.length;
        if (frac > bestFrac) {
          bestFrac = frac;
          bestKey = key;
        }
      }
      if (bestKey && bestFrac >= ENCLOSURE_FRACTION) {
        (enclosedGeomsByTab[bestKey] ??= []).push(g);
        enclosedNames.add(countryName(g));
      }
    }
    // Explicit continent fill (see CONTINENT_FILL above) — added on top of
    // whatever the enclosure test already caught, for tabs like Africa
    // where a whole chain of unserviced countries bridges two serviced
    // ones without any single one being individually "enclosed".
    for (const [tabKey, names] of Object.entries(CONTINENT_FILL)) {
      for (const name of names) {
        if (enclosedNames.has(name)) continue;
        const g = geomsByName.get(name);
        if (!g) continue;
        (enclosedGeomsByTab[tabKey] ??= []).push(g);
        enclosedNames.add(name);
      }
    }
    // Folded-in countries are dropped from the background so they aren't
    // also drawn separately with their own (now-redundant) border.
    const backgroundGeoms = backgroundGeomsAll.filter((g) => !enclosedNames.has(countryName(g)));
    const backgroundFeatures = backgroundGeoms.map((g) => feature(topology, g) as GeoJSON.Feature);

    // Those folded-in countries still need to render SOMEWHERE once their
    // own tab is the active one — the tab's blob (which is where they'd
    // otherwise show, dissolved in) gets swapped out for individual
    // country shapes then (see tabCountryFeatures below), so without this
    // they'd vanish from the map entirely instead of staying as faint
    // background context, unlike every other tab's surroundings.
    const tabFillFeatures: Record<string, GeoJSON.Feature> = {};
    for (const [tabKey, geoms] of Object.entries(enclosedGeomsByTab)) {
      if (geoms.length === 0) continue;
      tabFillFeatures[tabKey] = {
        type: "Feature",
        properties: {},
        geometry: merge(topology, geoms as unknown as Parameters<typeof merge>[1]),
      };
    }

    // Second pass: each region tab's own countries, PLUS any countries
    // enclosed by it above, dissolved into one shape (see the
    // KNOWN_EXCLAVES comment above) before fitting/projecting, so a stray
    // exclave (French Guiana, the Aleutians) doesn't skew the whole
    // world's own fit bounds any more than it skews its tab's.
    const reassignedByTab: Record<string, { feature: GeoJSON.Feature; label: string }[]> = {};
    const tabRestFeatures: { key: string; feature: GeoJSON.Feature }[] = [];
    for (const tab of REGION_TABS) {
      const tabGeoms = tabGeomsByKey[tab.key];
      if (!tabGeoms || tabGeoms.length === 0) continue;
      const mergeInput = [...tabGeoms, ...(enclosedGeomsByTab[tab.key] ?? [])];
      const merged = merge(topology, mergeInput as unknown as Parameters<typeof merge>[1]);
      const { rest, extracted } = extractKnownExclaves(
        merged,
        KNOWN_EXCLAVES.filter((k) => k.fromTab === tab.key)
      );
      tabRestFeatures.push({ key: tab.key, feature: { type: "Feature", properties: {}, geometry: rest } });
      for (const ex of extracted) {
        if (!ex.match.tab) continue;
        (reassignedByTab[ex.match.tab] ??= []).push({
          feature: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: ex.poly } },
          label: ex.match.label,
        });
      }
    }
    const allReassigned = Object.entries(reassignedByTab).flatMap(([tabKey, feats]) =>
      feats.map((f, i) => ({ key: `${tabKey}-exclave-${i}`, tabKey, feature: f.feature }))
    );

    // Individual per-country shapes (real, un-dissolved borders) for each
    // tab's own countries — World view (and every OTHER tab, while one is
    // zoomed in) uses the merged blob above instead, but the ACTIVE tab
    // switches to these once selected, per the "only zooming into a tab
    // reveals its countries' own borders" design. Known exclaves are
    // stripped the same way as the merged version (so e.g. the USA's own
    // shape here doesn't include the Aleutian sliver) — the extracted
    // piece isn't re-collected here since the tab-level merge above
    // already produced it once; instead a reassigned piece (French Guiana)
    // is folded into the TARGET tab's own country list below.
    const tabCountryFeatures: Record<string, { key: string; feature: GeoJSON.Feature }[]> = {};
    for (const tab of REGION_TABS) {
      const tabGeoms = tabGeomsByKey[tab.key];
      if (!tabGeoms) continue;
      const candidates = KNOWN_EXCLAVES.filter((k) => k.fromTab === tab.key);
      tabCountryFeatures[tab.key] = tabGeoms.map((g) => {
        const f = feature(topology, g) as GeoJSON.Feature;
        const { rest } = extractKnownExclaves(f.geometry, candidates);
        return { key: countryName(g), feature: { ...f, geometry: rest } };
      });
    }
    for (const r of allReassigned) {
      (tabCountryFeatures[r.tabKey] ??= []).push({ key: r.key, feature: r.feature });
    }

    // Miller cylindrical: stays fully rectangular (straight meridians and
    // parallels, no curved edges like Natural Earth) but — unlike plain
    // equirectangular — stretches high-latitude land vertically, so Russia/
    // Canada/Greenland keep recognizable shapes instead of looking flattened.
    // `fitWidth` (not `fitSize`) so the projection scales uniformly and
    // keeps its true aspect ratio — `fitSize` stretches non-uniformly to
    // fill an exact box, which is what was squishing the map top-to-bottom.
    const allForFit = {
      type: "FeatureCollection",
      features: [...tabRestFeatures.map((t) => t.feature), ...allReassigned.map((r) => r.feature), ...backgroundFeatures],
    } as const;
    const projection = geoMiller().fitWidth(W, allForFit as unknown as GeoJSON.FeatureCollection);
    const path = geoPath(projection);
    const [[, y0], [, y1]] = path.bounds(allForFit as unknown as GeoJSON.FeatureCollection);
    const viewH = Math.ceil(y1 - y0);

    const background = merge(topology, backgroundGeoms as unknown as Parameters<typeof merge>[1]);
    const backgroundD = path(toStrokeGeometry(background)) ?? "";

    const tabFillD: Record<string, string> = Object.fromEntries(
      Object.entries(tabFillFeatures).map(([tabKey, f]) => [tabKey, path(asStrokeFeature(f)) ?? ""])
    );

    const tabShapes = [
      ...tabRestFeatures.map((t) => ({ key: t.key, tabKey: t.key, d: path(asStrokeFeature(t.feature)) ?? "" })),
      ...allReassigned.map((r) => ({ key: r.key, tabKey: r.tabKey, d: path(asStrokeFeature(r.feature)) ?? "" })),
    ];

    // Where each region's name label sits in World view — the real
    // (area-weighted) geographic centroid of its own dissolved shape, not
    // a bounding-box center: a bbox center falls badly outside the actual
    // landmass for an elongated or irregular shape (South America's bbox
    // center, weighted by its long thin Patagonian tail, landed south of
    // the continent's real bulk; Oceania's landed off Tasmania instead of
    // inside Australia). geoCentroid computes this on the ORIGINAL lon/lat
    // geometry (weighted by true spherical area) rather than in already-
    // projected coordinates, then that one point is projected directly —
    // the same approach cityProjector uses for a city's own point below.
    //
    // For a tab whose countries aren't one contiguous landmass (Middle
    // East: Turkey, Jordan, the Gulf states — hundreds of km apart with
    // nothing of its own in between), centroid-of-everything falls in the
    // GAP between pieces, on neither of them. Centroid-of-the-LARGEST-
    // piece-only avoids that generally, not just for this one tab.
    const tabLabelPos: Record<string, { x: number; y: number }> = {};
    for (const t of tabRestFeatures) {
      const geom = t.feature.geometry;
      const centroidSource: GeoJSON.Feature =
        geom.type === "MultiPolygon" && geom.coordinates.length > 1
          ? (() => {
              let largest = geom.coordinates[0];
              let largestArea = -Infinity;
              for (const poly of geom.coordinates) {
                const a = geoArea({ type: "Polygon", coordinates: poly });
                if (a > largestArea) {
                  largestArea = a;
                  largest = poly;
                }
              }
              return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: largest } };
            })()
          : (t.feature as unknown as GeoJSON.Feature);
      const [lon, lat] = geoCentroid(centroidSource);
      const projected = projection([lon, lat]);
      let x: number, y: number;
      if (projected) {
        [x, y] = projected;
      } else {
        // geoCentroid can only fail to project for a truly degenerate
        // shape (none of ours) — falls back to the plain bbox center.
        const [[bx0, by0], [bx1, by1]] = path.bounds(t.feature as unknown as GeoJSON.Feature);
        x = (bx0 + bx1) / 2;
        y = (by0 + by1) / 2;
      }
      const offset = LABEL_POSITION_OFFSET[t.key];
      const offsetScale = W / VIEW_W;
      tabLabelPos[t.key] = { x: x + (offset?.dx ?? 0) * offsetScale, y: y + (offset?.dy ?? 0) * offsetScale };
    }

    const tabCountryShapes: Record<string, { key: string; d: string }[]> = Object.fromEntries(
      Object.entries(tabCountryFeatures).map(([tabKey, feats]) => [
        tabKey,
        feats.map((f) => ({ key: f.key, d: path(asStrokeFeature(f.feature)) ?? "" })),
      ])
    );

    // Zoom-fit bounding box per region tab, in the same projected
    // coordinate space as everything above — turning these into actual
    // zoom transforms needs the real visible aspect ratio (measured from
    // the DOM, see visibleAspect), so that step happens separately below.
    //
    // Fit to where the tab's own CITIES actually are, not the full
    // country landmass — North America's serviced cities all sit between
    // Vancouver and Mexico City, but Canada's own shape stretches to the
    // Arctic; fitting the full country bounds would zoom out to fit all
    // that empty land and shrink the part anyone's actually visiting.
    // Padded so cities aren't flush against the frame edge; falls back to
    // the full dissolved shape's bounds for the rare tab with no cities.
    const CITY_BOUNDS_PADDING_FRACTION = 0.25;
    const CITY_BOUNDS_MIN_PADDING = 40;
    const regionBounds: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
    for (const t of tabRestFeatures) {
      const tabCities = REGION_TABS.find((r) => r.key === t.key)?.cities ?? [];
      let cx0 = Infinity,
        cy0 = Infinity,
        cx1 = -Infinity,
        cy1 = -Infinity;
      for (const city of tabCities) {
        const p = projection([city.lon, city.lat]);
        if (!p) continue;
        const [x, y] = p;
        if (x < cx0) cx0 = x;
        if (x > cx1) cx1 = x;
        if (y < cy0) cy0 = y;
        if (y > cy1) cy1 = y;
      }
      if (cx0 <= cx1 && cy0 <= cy1) {
        const padX = Math.max((cx1 - cx0) * CITY_BOUNDS_PADDING_FRACTION, CITY_BOUNDS_MIN_PADDING);
        const padY = Math.max((cy1 - cy0) * CITY_BOUNDS_PADDING_FRACTION, CITY_BOUNDS_MIN_PADDING);
        regionBounds[t.key] = { x0: cx0 - padX, y0: cy0 - padY, x1: cx1 + padX, y1: cy1 + padY };
      } else {
        const [[bx0, by0], [bx1, by1]] = path.bounds(t.feature as unknown as GeoJSON.Feature);
        regionBounds[t.key] = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
      }
    }

    // Cities are plain [lon, lat] points (see MapCity), projected directly
    // with the same projection rather than going through path() — no
    // geometry to trace, just a coordinate.
    const cityProjector = (lon: number, lat: number) => projection([lon, lat]);

    return { backgroundD, tabFillD, tabShapes, tabLabelPos, tabCountryShapes, viewH, regionBounds, cityProjector };
  }, [W]);

  // World-view anchors (see WORLD_ANCHOR_SLUGS above) — resolved against
  // the real per-region city list (for lat/lon, projected the same way
  // activeCityMarkers projects its own cities) and real CityData (for the
  // image/name shown). Only ever computed once, same as the projection
  // itself.
  const worldAnchors = useMemo(() => {
    const bySlug = new Map(REGION_TABS.flatMap((t) => t.cities.map((c) => [c.slug, c])));
    return WORLD_ANCHOR_SLUGS.map((slug) => {
      const city = bySlug.get(slug);
      const cityData = CITIES[slug];
      if (!city || !cityData?.image) return null;
      const p = cityProjector(city.lon, city.lat);
      if (!p) return null;
      return { key: slug, slug, name: cityData.name ?? city.name, x: p[0], y: p[1], image: cityData.image };
    })
      .filter((a): a is { key: string; slug: string; name: string; x: number; y: number; image: string } => a !== null)
      // West → east reveal order (see the pop-in stagger below) — sorted by
      // each anchor's own projected x, not declaration order, so it stays
      // correct regardless of what order WORLD_ANCHOR_SLUGS lists them in.
      .sort((a, b) => a.x - b.x);
  }, [cityProjector]);

  // Applied to a <g> wrapping all paths (a plain CSS `transform` — not an
  // animated viewBox, which doesn't transition natively). World = identity.
  // Falls back to the full viewH (pre-measurement, briefly) so nothing
  // throws before the first ResizeObserver callback lands.
  //
  // preserveAspectRatio="xMidYMin slice" (see the <svg> below) scales the
  // viewBox uniformly by whichever ratio is LARGER — container-width/VB_W
  // or container-height/viewH — so it always fully covers the container,
  // cropping whichever axis has room to spare. Which axis "wins" depends
  // on how the container's own aspect ratio (visibleAspect) compares to
  // the viewBox's (VB_W/viewH): a container relatively WIDER than the
  // viewBox crops height (visible height < viewH, the case this used to
  // assume unconditionally); a container relatively NARROWER than the
  // viewBox — true for most normal browser widths once WRAP_BUFFER made
  // the viewBox this wide — instead crops width and shows the FULL
  // height uncropped. Getting this wrong (as an earlier version did, by
  // always assuming the width-cropped case) understates how much height
  // is actually visible and throws off the vertical centering below.
  const { tabScales, tabTranslateY, tabTranslateX } = useMemo(() => {
    // The frame the map has to fit: the container, less the chip row on top and
    // a margin all round. Units are px (the drawing is W wide, H tall).
    const areaX = FIT_PAD_X;
    const areaW = W - FIT_PAD_X * 2;
    const areaY = TAB_BAR_PX + FIT_PAD_TOP;
    const areaH = Math.max(120, (H || viewH) - areaY - FIT_PAD_BOTTOM);
    const centreX = areaX + areaW / 2;
    const centreY = areaY + areaH / 2;

    // World: the whole map, as large as fits, centred in the frame.
    const worldScale = Math.min(areaW / W, areaH / viewH);
    const transforms: Record<string, string> = {
      [WORLD_TAB.key]: `translate(${centreX - (W / 2) * worldScale} ${centreY - (viewH / 2) * worldScale}) scale(${worldScale})`,
    };
    const scales: Record<string, number> = { [WORLD_TAB.key]: worldScale };
    const translateYs: Record<string, number> = { [WORLD_TAB.key]: centreY - (viewH / 2) * worldScale };
    const translateXs: Record<string, number> = { [WORLD_TAB.key]: centreX - (W / 2) * worldScale };

    // A region: its whole bounding box, as large as fits, centred in the frame.
    for (const [key, b] of Object.entries(regionBounds)) {
      const boxW = b.x1 - b.x0;
      const boxH = b.y1 - b.y0;
      const scale = REGION_FIT * (TAB_ZOOM[key] ?? 1) * Math.min(areaW / boxW, areaH / boxH);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      const tx = centreX - cx * scale;
      const ty = centreY - cy * scale;
      transforms[key] = `translate(${tx} ${ty}) scale(${scale})`;
      scales[key] = scale;
      translateYs[key] = ty;
      translateXs[key] = tx;
    }
    void transforms;
    return { tabScales: scales, tabTranslateY: translateYs, tabTranslateX: translateXs };
  }, [regionBounds, W, H, viewH]);

  // Each tab's camera: where it sits when that tab is chosen.
  const fits = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(tabScales).map((key) => [key, { k: tabScales[key], x: tabTranslateX[key], y: tabTranslateY[key] }]),
      ) as Record<string, { k: number; x: number; y: number }>,
    [tabScales, tabTranslateX, tabTranslateY],
  );
  // Zoom limits: no further out than the whole world; a good way in past the closest region.
  const kMinCam = fits[WORLD_TAB.key]?.k ?? 1;
  const kMaxCam = Math.max(...Object.values(fits).map((f) => f.k), 1) * 2.5;
  // From this zoom up, the map shows cities (and per-country shapes) instead of region pills.
  const kCities =
    0.85 *
    Math.min(...Object.entries(fits).filter(([key]) => key !== WORLD_TAB.key).map(([, f]) => f.k), Infinity);

  // Fit the map when it is first measured, and again if the screen is resized.
  useEffect(() => {
    const f = fits[activeTabRef.current];
    if (box && f) {
      cancelAnim();
      commitCam(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fits, box?.w, box?.h]);
  // Choosing a tab (or the auto-cycle choosing one) glides the camera to its fit. A tab that
  // changed because the camera was moved by hand is left alone: the camera is already there.
  useEffect(() => {
    if (fromGestureRef.current) {
      fromGestureRef.current = false;
      return;
    }
    const f = fits[activeTab];
    if (!box || !f) return;
    animateTo(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const isZoomedIn = cam.k >= kCities;
  // Markers (city dots + labels) sit inside the same scaled/transformed
  // <g> as everything else (so they pan/zoom in lockstep and land in
  // whichever wrapped-duplicate copy is actually visible) — each one
  // counter-scales by 1/activeScale so it stays a constant screen size
  // instead of growing with the zoom.
  const activeScale = cam.k;
  const activeTranslateY = cam.y;
  const activeTranslateX = cam.x;
  // The photo circles grow with the free zoom (about 12px of radius at 1x), while the
  // names stay one size; this is how far each name steps out to clear its bigger circle.
  const circleScale = 1 + (manualZoom - 1) * CIRCLE_GROWTH;
  const circleGrow = 12 * (circleScale - 1);

  // Hover cards normally float ABOVE their dot (see CityHoverCard), but
  // that clips against the canvas's own top edge for a dot near the top of
  // whatever region is currently framed (Hanoi in SE Asia, say) — .canvas
  // has overflow:hidden, so the card's own top just gets cut off. Below
  // this one fixed line (in final, post-region-fit viewBox units — the
  // same space a marker's own on-screen position is computed in, so it
  // compares correctly across every tab's own independent zoom/pan, not
  // just SE Asia's) a dot's card renders above as usual; at or above it,
  // the card flips to render below the dot instead. Calibrated off Ho Chi
  // Minh City's own position within SE Asia's fit specifically (measured
  // here via the exact same projector/fit math used to place every other
  // marker, not eyeballed from a screenshot) — chosen as a real dot that
  // sits close to, without being right at, the top edge.
  const CARD_FLIP_THRESHOLD_Y = useMemo(() => {
    const seaCities = REGION_TABS.find((t) => t.key === "southeast-asia")?.cities ?? [];
    const hcmc = seaCities.find((c) => c.slug === "ho-chi-minh-city");
    if (!hcmc) return -Infinity; // never flip if the reference city is ever renamed/removed
    const p = cityProjector(hcmc.lon, hcmc.lat);
    if (!p) return -Infinity;
    const scale = tabScales["southeast-asia"] ?? 1;
    const ty = tabTranslateY["southeast-asia"] ?? 0;
    return p[1] * scale + ty;
  }, [cityProjector, tabScales, tabTranslateY]);

  // Some tabs span a huge area (Southern Europe runs Lisbon to Budapest to
  // Santorini) while also containing cities only tens of km apart (Milan/
  // Lake Como/Venice) — no single zoom level can both fit the whole tab
  // AND keep those close-together labels from overlapping. Rather than
  // shoving a crowded label straight down and away from its own dot, this
  // tries a ring of candidate positions actually around the dot (right,
  // corners, above, below, left) and picks the first that doesn't overlap
  // an already-placed label, so a label always stays right next to the
  // city it names. Dots themselves are never moved — only which side the
  // label sits on. Distances are compared in "projected units ×
  // activeScale", which tracks final on-screen pixel distance (the
  // counter-scale on each marker's own <g> cancels activeScale for its
  // own size, so a label offset in local units stays a constant screen
  // size — comparing candidate positions the same way, scaled up by
  // activeScale, keeps both sides of the check in the same units).
  const LABEL_CHAR_W = 6.3;
  const LABEL_PAD = 6;
  const LABEL_H = 13;
  // Preference order: straight right first (the default, most legible),
  // then the corners, then straight up/down, then left — a label anchored
  // "end" (left-of-dot) is read last since it's the least natural.
  const LABEL_CANDIDATES: { dx: number; dy: number; anchor: "start" | "middle" | "end" }[] = [
    { dx: 17, dy: 4, anchor: "start" },
    { dx: 11, dy: 24, anchor: "start" },
    { dx: 11, dy: -10, anchor: "start" },
    { dx: 0, dy: 26, anchor: "middle" },
    { dx: 0, dy: -17, anchor: "middle" },
    { dx: -17, dy: 4, anchor: "end" },
    { dx: -11, dy: 24, anchor: "end" },
    { dx: -11, dy: -10, anchor: "end" },
  ];
  const DOT_CLEARANCE = 14;
  const LABEL_EDGE = 6; // px kept clear between a label and the screen edge
  const activeCityMarkers = useMemo(() => {
    if (!isZoomedIn) return [];
    const cities = REGION_TABS.flatMap((t) => t.cities);
    const Hc = H || viewH;
    const projected = cities.map((city) => {
      const p = cityProjector(city.lon, city.lat);
      if (!p) return null;
      // Only cities on (or just off) the screen are drawn.
      const px = p[0] * activeScale + activeTranslateX;
      const py = p[1] * activeScale + activeTranslateY;
      if (px < -90 || px > W + 90 || py < -90 || py > Hc + 90) return null;
      return { city, x: p[0], y: p[1], sx: p[0] * activeScale, sy: p[1] * activeScale };
    });
    // Every OTHER city's dot is a no-go zone for a label from the start —
    // without this, a label could win a "doesn't overlap any label" check
    // while still landing right on top of a nearby city's dot, reading as
    // if it names that city instead (Phuket's label ending up on
    // Langkawi's dot, two cities apart on the map). A city's own dot is
    // excluded from its own check below, since every candidate sits right
    // next to it by design.
    const dotRects = projected.map((p) =>
      p ? { x0: p.sx - DOT_CLEARANCE, x1: p.sx + DOT_CLEARANCE, y0: p.sy - DOT_CLEARANCE, y1: p.sy + DOT_CLEARANCE } : null
    );
    const placedLabelRects: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const markers: {
      key: string;
      slug: string;
      name: string;
      x: number;
      y: number;
      labelDx: number;
      labelDy: number;
      anchor: "start" | "middle" | "end";
      showLabel: boolean;
    }[] = [];
    projected.forEach((p, i) => {
      if (!p) return;
      const { city, x, y, sx, sy } = p;
      const textW = city.name.length * LABEL_CHAR_W + LABEL_PAD;

      const rectFor = (c: (typeof LABEL_CANDIDATES)[number]) => {
        const cx = sx + c.dx + (c.anchor === "start" ? textW / 2 : c.anchor === "end" ? -textW / 2 : 0);
        const cy = sy + c.dy - LABEL_H / 2;
        return { x0: cx - textW / 2, x1: cx + textW / 2, y0: cy, y1: cy + LABEL_H };
      };
      const obstacles = [...dotRects.filter((_, j) => j !== i), ...placedLabelRects].filter(
        (q): q is { x0: number; x1: number; y0: number; y1: number } => q !== null
      );
      // A label that would run off the screen edge counts as a collision too.
      const offScreen = (r: ReturnType<typeof rectFor>) => r.x0 + activeTranslateX < LABEL_EDGE || r.x1 + activeTranslateX > W - LABEL_EDGE;
      const overlaps = (r: ReturnType<typeof rectFor>) =>
        offScreen(r) || obstacles.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);

      // The first spot that is clear of every other marker and label, and on
      // screen. If there is none, the name is left off (the photo still opens
      // the city) rather than printed over its neighbours.
      let chosen = LABEL_CANDIDATES[0];
      let chosenRect = rectFor(chosen);
      let showLabel = false;
      for (const candidate of LABEL_CANDIDATES) {
        const rect = rectFor(candidate);
        if (!overlaps(rect)) {
          chosen = candidate;
          chosenRect = rect;
          showLabel = true;
          break;
        }
      }
      if (showLabel) placedLabelRects.push(chosenRect);
      markers.push({
        key: city.slug,
        slug: city.slug,
        name: city.name,
        x,
        y,
        labelDx: chosen.dx,
        labelDy: chosen.dy,
        anchor: chosen.anchor,
        showLabel,
      });
    });
    // Sorted by x for the pop-in stagger below (west → east) — done AFTER
    // the label-collision pass above, which must run in the cities' own
    // declared order (it's what tabCities.forEach already used), not
    // reordered by this.
    return markers.slice().sort((a, b) => a.x - b.x);
  }, [isZoomedIn, activeScale, activeTranslateX, activeTranslateY, W, H, viewH, cityProjector]);

  // The region's own featured city — whichever of its cities is also one
  // of World view's curated anchors (WORLD_ANCHOR_SLUGS), the same
  // "iconic destination" pick rather than a separate one; falling back to
  // the westernmost city (activeCityMarkers is sorted west→east) only for
  // a region with none of its own cities on that list.
  const regionFeaturedSlug = useMemo(
    () => activeCityMarkers.find((c) => WORLD_ANCHOR_SLUGS.includes(c.slug))?.slug ?? activeCityMarkers[0]?.slug,
    [activeCityMarkers]
  );

  // The featured city's card (and its anchor-style bubble, in place of the
  // plain dot — see activeCityMarkers rendering below) shows automatically
  // for a few seconds right after switching into a region, as an entrance
  // highlight — then goes back to being just like every other city,
  // responding only to actual hover from then on. Resets on every tab
  // switch, not just mount.
  const [showFeaturedIntro, setShowFeaturedIntro] = useState(true);
  useEffect(() => {
    setShowFeaturedIntro(true);
    const t = setTimeout(() => setShowFeaturedIntro(false), 2500);
    return () => clearTimeout(t);
  }, [activeTab]);

  // West→east delay for a serviced region's own group (see REGION_POP_ORDER
  // above) — every REGION_TABS key appears in that list, so the fallback
  // only matters if map-tabs.generated.json ever adds a region without
  // updating it too.
  const regionPopDelay = (tabKey: string) => {
    const idx = REGION_POP_ORDER.indexOf(tabKey);
    return `${(idx >= 0 ? idx : 0) * (REGION_POP_STEP_MS / 1000)}s`;
  };

  // Marker clustering. Cities that would overlap at the current zoom merge into one
  // stack with a count; zooming in (or tapping the stack) splits them apart again.
  const clusters = (() => {
    if (!isZoomedIn) return [] as { items: typeof activeCityMarkers; x: number; y: number }[];
    const screenPerUnit = activeScale * manualZoom;
    const gap = CLUSTER_GAP * 2 * 8 * CITY_MARKER_SCALE * circleScale;
    const out: { items: typeof activeCityMarkers; x: number; y: number }[] = [];
    for (const m of activeCityMarkers) {
      const hit = out.find((c) => Math.hypot(c.x - m.x, c.y - m.y) * screenPerUnit < gap);
      if (hit) {
        hit.items.push(m);
        const n = hit.items.length;
        hit.x += (m.x - hit.x) / n;
        hit.y += (m.y - hit.y) / n;
      } else {
        out.push({ items: [m], x: m.x, y: m.y });
      }
    }
    return out;
  })();
  const singleSlugs = new Set(clusters.filter((c) => c.items.length === 1).map((c) => c.items[0].slug));
  const multiClusters = clusters.filter((c) => c.items.length > 1);

  // Where each cluster's list of names goes. Biggest cluster first; each list tries the
  // side with room, then the other, then steps up or down a line at a time, until it
  // is clear of the lists already placed and of the screen edges.
  const clusterNames = (() => {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const lineH = 13;
    const Hc = H || viewH;
    const toScreen = (x: number, y: number) => ({
      x: W / 2 + pan.x + manualZoom * (x * activeScale + activeTranslateX - W / 2),
      y: Hc / 2 + pan.y + manualZoom * (y * activeScale + activeTranslateY - Hc / 2),
    });
    // Already in the way: every photo circle (single or stack) and every single city's name.
    for (const m of activeCityMarkers) {
      const q = toScreen(m.x, m.y);
      const r = singleSlugs.has(m.slug) ? 14 * circleScale : 0;
      if (r) placed.push({ x0: q.x - r, x1: q.x + r, y0: q.y - r, y1: q.y + r });
      if (singleSlugs.has(m.slug) && m.showLabel) {
        const w = m.name.length * LABEL_CHAR_W + 6;
        const base = q.y + 4 + (m.labelDy > 10 ? m.labelDy + circleGrow : m.labelDy < 0 ? m.labelDy - circleGrow : m.labelDy);
        const dx = m.anchor === "start" ? m.labelDx + circleGrow : m.anchor === "end" ? m.labelDx - circleGrow : m.labelDx;
        const x0 = m.anchor === "start" ? q.x + dx : m.anchor === "end" ? q.x + dx - w : q.x + dx - w / 2;
        placed.push({ x0, x1: x0 + w, y0: base - 11, y1: base + 3 });
      }
    }
    for (const c of multiClusters) {
      const q = toScreen(c.x, c.y);
      const r = 24 * circleScale;
      placed.push({ x0: q.x - r, x1: q.x + r, y0: q.y - r, y1: q.y + r });
    }
    return multiClusters
      .map((c, idx) => ({ c, idx }))
      .sort((a, b) => b.c.items.length - a.c.items.length)
      .map(({ c, idx }) => {
        const sx = W / 2 + pan.x + manualZoom * (c.x * activeScale + activeTranslateX - W / 2);
        const sy = Hc / 2 + pan.y + manualZoom * (c.y * activeScale + activeTranslateY - Hc / 2);
        const names = [...c.items].sort((a, b) => a.y - b.y);
        const w = Math.max(...names.map((m) => m.name.length)) * LABEL_CHAR_W + 8;
        const h = names.length * lineH;
        const gapX = 26 * circleScale + circleGrow;
        const preferred: "start" | "end" = sx > W * 0.55 ? "end" : "start";
        const sides: ("start" | "end")[] = preferred === "start" ? ["start", "end"] : ["end", "start"];
        let pick: { side: "start" | "end"; off: number; x0: number; x1: number; y0: number; y1: number } | null = null;
        search: for (let k = 0; k < 14; k++) {
          for (const off of k === 0 ? [0] : [k * lineH, -k * lineH]) {
            for (const side of sides) {
              const x0 = side === "start" ? sx + gapX : sx - gapX - w;
              const x1 = x0 + w;
              const y0 = sy + off - h / 2;
              const y1 = y0 + h;
              if (x0 < 4 || x1 > W - 4) continue;
              if (placed.every((q) => x1 <= q.x0 || x0 >= q.x1 || y1 <= q.y0 || y0 >= q.y1)) {
                pick = { side, off, x0, x1, y0, y1 };
                break search;
              }
            }
          }
        }
        if (!pick) {
          const x0 = preferred === "start" ? sx + gapX : sx - gapX - w;
          pick = { side: preferred, off: 0, x0, x1: x0 + w, y0: sy - h / 2, y1: sy + h / 2 };
        }
        placed.push(pick);
        return { c, idx, names, side: pick.side, off: pick.off };
      });
  })();

  // World-view region names, the old map's way: a glass pill at a fixed size over each
  // region (no count). Biggest region first; a pill that would overlap one already
  // placed, or run off the screen, is left off - the chips above still reach every region.
  const regionPills = (() => {
    if (isZoomedIn) return [] as { key: string; label: string; x: number; y: number }[];
    const Hc = H || viewH;
    const placed: { x: number; y: number; w: number }[] = [];
    return REGION_TABS.map((t) => ({ t, p: tabLabelPos[t.key] }))
      .filter((q) => q.p)
      .sort((a, b) => b.t.cities.length - a.t.cities.length)
      .map(({ t, p }) => ({
        key: t.key,
        label: t.label,
        x: W / 2 + pan.x + manualZoom * (p.x * activeScale + activeTranslateX - W / 2),
        y: Hc / 2 + pan.y + manualZoom * (p.y * activeScale + activeTranslateY - Hc / 2),
      }))
      .filter((g) => {
        const w = g.label.length * 6.4 + 20;
        if (g.x - w / 2 < 4 || g.x + w / 2 > W - 4) return false;
        const ok = placed.every((q) => Math.abs(q.y - g.y) > 17 || Math.abs(q.x - g.x) > (q.w + w) / 2 + 2);
        if (ok) placed.push({ x: g.x, y: g.y, w });
        return ok;
      });
  })();

  const mapBody = (
    <>
      <path
        className={`${styles.background} ${isZoomedIn ? styles.dimmed : ""}`}
        d={backgroundD}
        vectorEffect="non-scaling-stroke"
      />
      {/* The active tab's own folded-in countries (see tabFillFeatures
          above) — Sudan/Chad/Nigeria/etc for Africa — normally show as
          part of its dissolved blob, but that blob is swapped out for
          individual country shapes once the tab is active, so without
          this they'd disappear instead of staying visible as faint
          background context like every other tab's surroundings do. */}
      {isZoomedIn && tabFillD[activeTab] && (
        <path className={styles.background} d={tabFillD[activeTab]} vectorEffect="non-scaling-stroke" />
      )}
      {tabShapes.map((c) => {
        // A tab's own merged blob (key === tabKey, vs a reassigned exclave
        // piece like French Guiana) is swapped out for its real,
        // un-dissolved country shapes below once that tab is the active
        // one — World view, and every other (dimmed) tab, still use the
        // blob.
        const isBlob = c.key === c.tabKey;
        if (isBlob && isZoomedIn && c.tabKey === activeTab) return null;
        const isActive = isZoomedIn && c.tabKey === activeTab;
        const isOtherDimmed = isZoomedIn && c.tabKey !== activeTab;
        const shapePath = (
          <path
            className={`${styles.country} ${isActive ? styles.active : ""} ${isOtherDimmed ? styles.dimmed : ""}`}
            d={c.d}
            vectorEffect="non-scaling-stroke"
          />
        );
        // World view only: hovering a region's shape tints it (and its
        // name, when shown) together, via the shared .regionGroup wrapper
        // — no group at all for a reassigned exclave piece like French
        // Guiana, or once zoomed into any tab, since there's nothing to
        // hover-highlight there. The label itself is separately withheld
        // for a couple of tabs (HIDDEN_LABEL_TABS) whose shape doesn't
        // read well with a name on it, but the hover-fill still applies.
        // A reassigned exclave piece (French Guiana), or any tab once
        // zoomed in, renders plain/static — no pop-in — since the west→east
        // reveal is a World-view-only entrance; it shouldn't replay every
        // time the scroll-driven cycle (or a click) switches regions.
        if (!isBlob || isZoomedIn)
          return (
            <g key={c.key}>
              {shapePath}
            </g>
          );
        const label = SHOW_SVG_REGION_LABELS ? tabLabelPos[c.tabKey] : null;
        const tabInfo = REGION_TABS.find((t) => t.key === c.tabKey);
        return (
          <g
            key={c.key}
            className={`${styles.regionGroup} ${hoveredTab === c.tabKey ? styles.regionHovered : ""}`}
            onMouseEnter={() => setHoveredTab(c.tabKey)}
            onMouseLeave={() => setHoveredTab((k) => (k === c.tabKey ? null : k))}
            onClick={() => pickTab(c.tabKey)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") pickTab(c.tabKey);
            }}
          >
            {/* The region's own complete geographic group (shape + name)
                pops in together as one unit — see .regionReveal in
                WorldMap.module.css — independent of this outer group's own
                hover/click handling, which stays attached at rest. Keyed on
                worldRevealKey so a bump forces a fresh mount, replaying the
                animation (see the prop's own comment above). */}
            <g
              key={worldRevealKey}
              className={styles.regionReveal}
              style={{ "--pop-delay": regionPopDelay(c.tabKey) } as CSSProperties}
            >
              {shapePath}
              {label &&
                tabInfo &&
                (() => {
                  // Multi-word names wrap onto their own line per word (every
                  // current multi-word label happens to be exactly two words)
                  // so the label reads as a compact block rather than a wide
                  // strip that overlaps a neighbouring region's own name —
                  // centered vertically on the region's centroid regardless
                  // of line count via the dy offsets below, not just stacked
                  // downward from it.
                  const words = tabInfo.label.split(" ");
                  return (
                    <text
                      className={styles.regionLabel}
                      x={label.x}
                      y={label.y}
                      textAnchor="middle"
                      vectorEffect="non-scaling-stroke"
                    >
                      {words.map((word, i) => (
                        <tspan key={i} x={label.x} dy={i === 0 ? `${-(words.length - 1) * 0.55}em` : "1.1em"}>
                          {word}
                        </tspan>
                      ))}
                    </text>
                  );
                })()}
            </g>
          </g>
        );
      })}
      {isZoomedIn &&
        (tabCountryShapes[activeTab] ?? []).map((c) => (
          <path
            key={`active-country-${c.key}`}
            className={`${styles.country} ${styles.active}`}
            d={c.d}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      {/* Labels paint first (SVG has no z-index — later-drawn elements sit
          on top of earlier ones), so every dot and its hover preview
          square below always show up above every city's name, not just
          its own. */}
      {activeCityMarkers.filter((m) => m.showLabel && singleSlugs.has(m.slug)).map((m) => (
        <g key={`label-${m.key}`} transform={`translate(${m.x} ${m.y}) scale(${1 / (activeScale * manualZoom)})`}>
          <text className={styles.cityLabel} x={m.anchor === "start" ? m.labelDx + circleGrow : m.anchor === "end" ? m.labelDx - circleGrow : m.labelDx} y={4 + (m.labelDy > 10 ? m.labelDy + circleGrow : m.labelDy < 0 ? m.labelDy - circleGrow : m.labelDy)} textAnchor={m.anchor}>
            {m.name}
          </text>
        </g>
      ))}
      {/* A cluster keeps its cities' names: a short list beside the stack, one name per
          line, top to bottom as the cities lie on the map, on whichever side has room. */}
      {clusterNames.map(({ c, idx, names, side, off }) => {
        const lineH = 13;
        const first = (-(names.length - 1) * lineH) / 2 + 4 + off;
        return (
          <g
            key={`cluster-names-${idx}`}
            transform={`translate(${c.x} ${c.y}) scale(${1 / (activeScale * manualZoom)})`}
          >
            {/* A list that had to move away from its stack is tied back to it. */}
            {off !== 0 && (
              <line
                x1={0}
                y1={0}
                x2={(side === "start" ? 1 : -1) * (26 * circleScale + circleGrow - 4)}
                y2={off}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {names.map((m, k) => (
              <text
                key={m.slug}
                className={styles.cityLabel}
                x={(side === "start" ? 1 : -1) * (26 * circleScale + circleGrow)}
                y={first + k * lineH}
                textAnchor={side}
              >
                {m.name}
              </text>
            ))}
          </g>
        );
      })}
      {/* Dots painted last (in this pass), so they always sit above every
          label and every other city's dot. The hover-triggering handlers
          live on this outer <g>, not the dot's own Link, since the card's
          clickable area (a plain div, not a nested Link — see
          CityHoverCard) sits alongside it rather than inside it. Each
          marker's own floating hover card is deliberately NOT rendered
          here, in the same pass as its dot — with every marker painted in
          one interleaved loop, a LATER city's dot would paint on top of an
          EARLIER city's still-open card (SVG has no z-index, only document
          order). All cards render together afterward, in their own
          separate pass below, so a card always sits above every dot. */}
      {activeCityMarkers.filter((m) => singleSlugs.has(m.slug)).map((m) => {
        const heroImage = imageUrl(CITIES[m.slug]?.image);
        // A city with a photograph is always drawn as its photo anchor; only one
        // without falls back to the plain dot.
        const showAnchorBubble = Boolean(heroImage);
        return (
          <g
            key={m.key}
          >
            <a href={cityHref(m.slug)} onClick={onCityLinkClick(m.slug)} className={styles.cityMarker}>
              {/* Region view: dots render plain/static, no pop-in — that
                  entrance is World-view only (see the regionReveal comment
                  above), so it doesn't replay on every region switch. */}
              <g transform={`translate(${m.x} ${m.y}) scale(${circleScale / (activeScale * manualZoom)})`}>
                {/* Invisible, larger than the visible dot — the visible r=5
                    circle keeps a consistent apparent size across zoom levels
                    (the 1/activeScale counter-scale above), which at a region's
                    typical zoom shrinks its actual on-screen hit area to just
                    a couple of CSS pixels, far too small to reliably hover.
                    This sits on top purely for pointer events, at a fixed
                    multiple of the visible radius so it never grows large
                    enough to overlap a neighboring city's own dot. */}
                <circle r={24} fill="transparent" stroke="none" />
                <circle
                  className={`${styles.cityDot} ${showAnchorBubble ? styles.cityDotHidden : ""}`}
                  r={5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Swaps in for the plain dot on hover, OR briefly for the
                    featured city right after switching tabs (see
                    showFeaturedIntro) — same ring+image "anchor" styling
                    World view uses for its own curated markers
                    (.anchorRing/.anchorImage), so it reads as one
                    consistent marker language across both views. */}
                {heroImage && (
                  <g
                    className={`${styles.cityAnchorMarker} ${showAnchorBubble ? styles.cityAnchorMarkerVisible : ""}`}
                    transform={`scale(${CITY_MARKER_SCALE})`}
                  >
                    <circle className={styles.cityOutline} r={8} vectorEffect="non-scaling-stroke" />
                    <clipPath id={`cityAnchorClip-${m.key}`}>
                      <circle r={8} />
                    </clipPath>
                    <image
                      href={heroImage}
                      x={-8}
                      y={-8}
                      width={16}
                      height={16}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#cityAnchorClip-${m.key})`}
                      className={styles.anchorImage}
                    />
                  </g>
                )}
              </g>
            </a>
          </g>
        );
      })}
      {/* Clusters: up to three photo circles stacked with an offset, and the number of
          cities they stand for. A tap zooms in on the stack, which splits it. */}
      {multiClusters.map((c, ci) => {
        const photos = c.items.slice(0, 3);
        // The photos sit close together around the cluster's centre: side by side for two,
        // a small triangle for three or more. Each circle just overlaps its neighbours.
        const spots =
          photos.length === 2
            ? [
                [-6, 0],
                [6, 0],
              ]
            : [
                [0, -7],
                [-7, 5],
                [7, 5],
              ];
        const sx = W / 2 + pan.x + manualZoom * (c.x * activeScale + activeTranslateX - W / 2);
        const sy = (H || viewH) / 2 + pan.y + manualZoom * (c.y * activeScale + activeTranslateY - (H || viewH) / 2);
        return (
          <g
            key={`cluster-${ci}-${c.items.map((m) => m.slug).join("-")}`}
            transform={`translate(${c.x} ${c.y}) scale(${circleScale / (activeScale * manualZoom)})`}
            role="button"
            tabIndex={0}
            aria-label={`${c.items.length} destinations here. Zoom in.`}
            style={{ cursor: "pointer" }}
            onClick={() => {
              stopCycle();
              zoomAt(2, sx, sy);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                stopCycle();
                zoomAt(2, sx, sy);
              }
            }}
          >
            <g transform={`scale(${CITY_MARKER_SCALE})`}>
              <circle r={22} fill="transparent" stroke="none" />
              {photos.map((m, k) => {
                const img = imageUrl(CITIES[m.slug]?.image);
                const [ox, oy] = spots[k];
                return (
                  <g key={m.slug} transform={`translate(${ox} ${oy})`}>
                    <clipPath id={`clusterClip-${ci}-${k}`}>
                      <circle r={8} />
                    </clipPath>
                    {img ? (
                      <image
                        href={img}
                        x={-8}
                        y={-8}
                        width={16}
                        height={16}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#clusterClip-${ci}-${k})`}
                      />
                    ) : (
                      <circle r={8} fill="#1c1813" />
                    )}
                    <circle className={styles.cityOutline} r={8} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
              {/* The count: an opaque disc in the middle, on top of the photos. */}
              <g>
                <circle
                  r={7.5}
                  fill="#F2EDE4"
                  stroke="#FFFFFF"
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  textAnchor="middle"
                  y={3.4}
                  fontFamily="var(--fr, sans-serif)"
                  fontSize={9.5}
                  fontWeight={700}
                  fill="#0A0A0B"
                  style={{ pointerEvents: "none" }}
                >
                  {c.items.length}
                </text>
              </g>
            </g>
          </g>
        );
      })}
      {/* Hover cards — one shared pass, painted after every dot above (see
          the comment there) so a card is never covered by another city's
          own dot. Shown automatically for the region's own featured city
          (see regionFeaturedSlug) for a few seconds right after switching
          into this tab (showFeaturedIntro), or for whichever city IS
          hovered — otherwise nothing shows by default, same as every other
          city, once that intro window has passed. */}
      {SHOW_CITY_CARDS && activeCityMarkers.map((m) => {
        const isRegionFeatured = m.slug === regionFeaturedSlug;
        const cardVisible = (isRegionFeatured && showFeaturedIntro && !hoveredCity) || hoveredCity === m.slug;
        const flipBelow = m.y * activeScale + activeTranslateY < CARD_FLIP_THRESHOLD_Y;
        return (
          <g key={`card-${m.key}`} transform={`translate(${m.x} ${m.y}) scale(${1 / (activeScale * manualZoom)})`}>
            <CityHoverCard
              slug={m.slug}
              fallbackName={m.name}
              visible={cardVisible}
              isFeatured={isRegionFeatured}
              flipBelow={flipBelow}
              imageSrc={imageUrl(CITIES[m.slug]?.image)}
              onOpen={() => openCity(m.slug)}
            />
          </g>
        );
      })}
      {/* Premium destination anchors — World view only (see worldAnchors
          above); a deliberately small, curated set, not every serviced
          city, so the map reads as an edited destination atlas rather than
          the full (much busier) region-view marker set. Fade in together,
          ONE beat after the last region's own group finishes settling
          (WORLD_MARKERS_DELAY_S) — not staggered per marker, so the
          sequence reads as "regions, then destinations" rather than more
          points popping individually. Remounts (and so replays) each time
          World view is (re)entered, since these only render at all while
          !isZoomedIn. */}
      {SHOW_WORLD_ANCHORS && !isZoomedIn && (
        <g
          key={worldRevealKey}
          className={styles.worldMarkersReveal}
          style={{ "--pop-delay": `${WORLD_MARKERS_DELAY_S}s` } as CSSProperties}
        >
          {/* Anchors painted here; their hover cards render in a separate
              pass afterward (same reasoning as the region-view dots
              above) so a card is never covered by another anchor's own
              icon. */}
          {worldAnchors.map((a) => (
            <g
              key={`anchor-${a.key}`}
            >
              <a href={cityHref(a.slug)} onClick={onCityLinkClick(a.slug)} className={styles.worldAnchor}>
                <g transform={`translate(${a.x} ${a.y})`}>
                  {/* .anchorScale's own hover transform stays independent of
                      the collective entrance fade above. */}
                  <g className={styles.anchorScale}>
                    {/* Invisible, slightly larger than the ring — the link's
                        own bounding box spans both this icon and its label
                        below, so hovering its geometric center can land in
                        the empty gap between them and miss both; this keeps
                        the actual icon itself comfortably hoverable. */}
                    <circle r={14} fill="transparent" stroke="none" />
                    <circle className={styles.anchorRing} r={11} vectorEffect="non-scaling-stroke" />
                    <clipPath id={`anchorClip-${a.key}`}>
                      <circle r={8} />
                    </clipPath>
                    <image
                      href={imageUrl(a.image) ?? undefined}
                      x={-8}
                      y={-8}
                      width={16}
                      height={16}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#anchorClip-${a.key})`}
                      className={styles.anchorImage}
                    />
                    <text className={styles.anchorLabel} x={0} y={25} textAnchor="middle">
                      {a.name}
                    </text>
                  </g>
                </g>
              </a>
            </g>
          ))}
          {/* No default here (unlike region view) — World only shows a card
              while actively hovering an anchor. */}
          {worldAnchors.map((a) => (
            <g key={`anchor-card-${a.key}`} transform={`translate(${a.x} ${a.y})`}>
              <CityHoverCard
                slug={a.slug}
                fallbackName={a.name}
                visible={hoveredCity === a.slug}
                isFeatured={false}
                flipBelow={a.y * activeScale + activeTranslateY < CARD_FLIP_THRESHOLD_Y}
                imageSrc={imageUrl(a.image)}
                onOpen={() => openCity(a.slug)}
              />
            </g>
          ))}
        </g>
      )}
    </>
  );

  return (
    <div className={styles.mapArea}>
      <div className={`${styles.canvas} ${revealed ? styles.revealed : ""}`} ref={canvasRef}>
        <div className={styles.tabs} role="tablist" aria-label="Map region">
          <button
            type="button"
            role="tab"
            aria-selected={WORLD_TAB.key === activeTab}
            onClick={() => pickTab(WORLD_TAB.key)}
          >
            {WORLD_TAB.label}
          </button>
          <div className={styles.tabScroll} ref={tabScrollRef}>
            {REGION_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                data-tab={tab.key}
                aria-selected={tab.key === activeTab}
                onClick={() => pickTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <svg
          className={styles.map}
          viewBox={`0 0 ${W} ${H || viewH}`}
          preserveAspectRatio="xMinYMin meet"
          role="img"
          aria-label="World map of the regions TripAgent covers"
          style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onMapPointerDown}
          onClickCapture={(e) => {
            if (draggedRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {/* Extra zoom on top of the region fit below (see manualZoom
              above) — a plain outer transform around the viewBox's own
              center, so it composes with activeTransform instead of
              replacing/duplicating its fit math. */}
          <g
            id="wm-map-layer"
            className={styles.manualZoomGroup}
            style={{ transition: "none" }}
          >
            <g
              className={styles.zoomGroup}
              transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}
              style={{ transition: "none" }}
            >
              <g
                transform={`translate(${-W} 0)`}
                aria-hidden="true"
                className={isZoomedIn ? undefined : styles.wrapGhost}
              >
                {mapBody}
              </g>
              {mapBody}
              <g
                transform={`translate(${W} 0)`}
                aria-hidden="true"
                className={isZoomedIn ? undefined : styles.wrapGhost}
              >
                {mapBody}
              </g>
            </g>
          </g>
          {/* The frosted strip behind the region chips, drawn inside the map so it blurs
              everywhere (CSS backdrop-filter does not blur an SVG behind it in every
              browser): a solid ground, then the whole map layer again, blurred, clipped
              to the strip. The chips and their translucent fill sit on top, in HTML. */}
          <defs>
            <filter id="wm-row-blur" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={TAB_BAR_PX + 24}>
              <feGaussianBlur stdDeviation={ROW_BLUR} edgeMode="duplicate" />
            </filter>
            <clipPath id="wm-row-clip">
              <rect x={0} y={0} width={W} height={TAB_BAR_PX} />
            </clipPath>
          </defs>
          <g clipPath="url(#wm-row-clip)" pointerEvents="none" aria-hidden="true">
            <rect x={0} y={0} width={W} height={TAB_BAR_PX} style={{ fill: "var(--ink-0, #0a0a0b)" }} />
            <use href="#wm-map-layer" filter="url(#wm-row-blur)" />
          </g>
        </svg>
        {regionPills.map((g) => (
          <button
            key={g.key}
            type="button"
            className={styles.regionPill}
            style={{ transform: `translate(${g.x}px, ${g.y}px) translate(-50%, -50%)` }}
            onClick={() => pickTab(g.key)}
          >
            {g.label}
          </button>
        ))}
        <div className={styles.zoomControls} role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom in" disabled={cam.k >= kMaxCam * 0.999} onClick={() => zoomBy(1.6)}>
            <Icon name="plus" size={15} />
          </button>
          <span className={styles.zoomDivider} aria-hidden="true" />
          <button type="button" aria-label="Zoom out" disabled={cam.k <= kMinCam * 1.001} onClick={() => zoomBy(1 / 1.6)}>
            <Icon name="minus" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
