// Copied from tripagent/src/trip/humanize.ts by npm run catalogue — edit it there.
/**
 * Text clean-up applied when a plan is rendered — to the shared page and to the
 * app's copy of the plan alike (mirrored in the app's src/lib/humanize.ts).
 *
 * Em dashes read as machine-written in quantity, and the agent reaches for them
 * constantly. They become a comma, or a colon where one introduces a list. The
 * stored plan is untouched; this is presentation only.
 */
export function humanize(text: string): string {
  return text
    .replace(/\s*—\s*$/g, "")
    .replace(/^\s*—\s*/g, "")
    .replace(/\s+—\s+/g, ", ")
    .replace(/(\w)—(\w)/g, "$1, $2")
    .replace(/\s*—\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*,\s*/g, "(");
}

/** Deep-copies a plan, humanizing every string that is not a URL or an id. */
export function humanizePlan<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    if (/^(https?:|\/)/.test(value) || key === "id" || key === "u" || key === "src" || key === "source") return value;
    return humanize(value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => humanizePlan(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, humanizePlan(v, k)])) as T;
  }
  return value;
}

/**
 * "The Marylebone (candidate — rate and availability unverified)" → the name,
 * plus a short state. Verification is shown as its own small tag, so the doubt
 * attaches to the rate rather than to the hotel.
 */
export function splitName(raw: string): { name: string; unverified: boolean } {
  const paren = raw.match(/^(.*?)\s*\(([^)]*(?:candidate|unverified|not checked|to verify|to confirm)[^)]*)\)\s*$/i);
  if (paren) return { name: paren[1]!.trim(), unverified: true };
  const tail = raw.match(/^(.*?)\s*[,—-]\s*(?:unverified|candidate)\b.*$/i);
  if (tail) return { name: tail[1]!.trim(), unverified: true };
  return { name: raw.trim(), unverified: false };
}
