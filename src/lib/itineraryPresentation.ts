/** Split legacy prose into readable points without dropping dates or qualifications. */
export function detailPoints(text?: string): string[] {
  return (text ?? '').split(/\n+|\s*[;·]\s*|(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
}
/** Compact hotel comparison clauses; keep parenthetical caveats intact. */
export function hotelPoints(text?: string): string[] {
  return detailPoints(text).flatMap(sentence => {
    const parts: string[] = []; let depth = 0; let start = 0;
    for (let i = 0; i < sentence.length; i++) {
      if (sentence[i] === '(') depth++;
      if (sentence[i] === ')') depth = Math.max(0, depth - 1);
      if (!depth && sentence[i] === ',' && /^\s+[A-Za-z]/.test(sentence.slice(i + 1))) {
        parts.push(sentence.slice(start, i).trim()); start = i + 1;
      }
    }
    parts.push(sentence.slice(start).trim());
    return parts.map(s => s.replace(/^and\s+/i, '')).filter(Boolean);
  });
}
export function hotelName(name: string): string {
  return name.split(/\s[·|—–]\s|,/)[0]!.trim();
}
/** Directions support at most three intermediate stops on mobile browsers. */
export function dayMap(day: { place?: string; stops?: { name: string; query: string }[] }, fallback = ''): { url: string; label: string } | null {
  const stops = (day.stops ?? []).map(s => s.query.trim()).filter(Boolean);
  if (stops.length > 1) {
    // Split long days into routes, preserving every stop rather than silently omitting waypoints.
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', stops[0]!);
    url.searchParams.set('destination', stops[Math.min(4, stops.length - 1)]!);
    if (stops.length > 2) url.searchParams.set('waypoints', stops.slice(1, Math.min(4, stops.length - 1)).join('|'));
    return { url: url.href, label: stops.length > 5 ? 'View stops 1–5 on map' : 'View day’s route on map' };
  }
  const query = stops[0] || day.place || fallback;
  if (!query) return null;
  return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.replace(/-/g, ' '))}`, label: stops.length ? 'View stop on map' : 'View day’s area on map' };
}
export function dayMaps(day: { place?: string; stops?: { name: string; query: string }[] }, fallback = '') {
  const stops = day.stops ?? [];
  if (stops.length <= 5) return [dayMap(day, fallback)].filter((x): x is NonNullable<typeof x> => x !== null);
  const routes = [];
  for (let i = 0; i < stops.length - 1; i += 4) {
    const link = dayMap({ ...day, stops: stops.slice(i, i + 5) }, fallback)!;
    routes.push({ ...link, label: `View stops ${i + 1}–${Math.min(i + 5, stops.length)} on map` });
  }
  return routes;
}
