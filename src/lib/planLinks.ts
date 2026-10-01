/** Accept only real opaque itinerary keys; arbitrary web links stay ordinary text. */
export function planKeyFrom(value: string): string | null {
  try {
    const path = new URL(value, 'https://tripagent.invalid').pathname;
    return path.match(/^\/(?:p|journeys)\/([a-f0-9]{64})\/?$/i)?.[1] ?? null;
  } catch { return null; }
}
export function planLinks(text: string): { key: string; url: string }[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+|\/(?:p|journeys)\/[a-f0-9]{64}\b/gi) ?? [];
  return matches.flatMap(raw => {
    const url = raw.replace(/[.,;!?]+$/, '');
    const key = planKeyFrom(url);
    return key ? [{ key, url }] : [];
  });
}
export function withoutPlanLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (all, label: string, url: string) => planKeyFrom(url) ? label : all)
    .replace(/https?:\/\/[^\s<>"')\]]+|\/(?:p|journeys)\/[a-f0-9]{64}\b/gi, raw => planKeyFrom(raw.replace(/[.,;!?]+$/, '')) ? '' : raw)
    .replace(/<\s*>/g, '').trim();
}
