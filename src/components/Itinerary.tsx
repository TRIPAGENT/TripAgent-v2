import { useStore } from '@/context/store';
import { useMemo, useRef, useState, type ReactNode } from "react";
import "@/styles/itinerary.css";
import { CITY_BY_SLUG } from "@/data/catalogue.generated";
import { cityCard, cityHero } from "@/lib/catalogue";
import type {
  BookingAction,
  Choice,
  ChoiceGroup,
  DayRow,
  DestinationNote,
  Guidance,
  Nudge,
  PlanBundle,
  Row,
  TripPlan,
} from "@/lib/plan";
import { splitName } from "@/lib/humanize";
import type { PlacePhoto } from "@/lib/agentClient";
import { usePlacePhoto } from "@/lib/usePlacePhoto";
import {
  Btn,
  Disclosure,
  Card,
  Cred,
  GlassChip,
  Icon,
  Photo,
  Sheet,
  Status,
  type StatusTone,
} from "@/components/ui";

/**
 * The itinerary, as the app draws it.
 *
 * One document in three views — Plan, Days, Decisions — over a photograph of the
 * city. Everything on it comes from the plan the backend built: the price
 * strings are printed exactly as they arrive ("Not checked", "Rate to confirm"),
 * because a figure the Desk has not quoted is not a price.
 *
 * The stylesheet is src/styles/itinerary.css, now the app's own rather than a
 * copy of the backend's.
 */

type Tab = "Plan" | "Days" | "Decisions";
const TABS: Tab[] = ["Plan", "Days", "Decisions"];

const firstSentence = (text: string, max = 180) => {
  const t = (text ?? "").trim();
  const cut = t.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t;
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut;
};

/**
 * The backend writes its own day titles, and they usually open with the day
 * already ("Sat 7 · Arrive softly"). Prefixing the formatted date then prints
 * it twice — "Fri 8 Jan · Fri 8 · Land and do nothing clever". So only add the
 * date when the title has not already said it.
 */
function titleCarriesDate(title: string, iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const at = new Date(Date.UTC(y, m - 1, d));
  const weekday = at.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const head = title.slice(0, 24).toLowerCase();
  // "Sat 7", "Sat 7 Jan", or a bare leading day number followed by a separator.
  return (
    head.includes(weekday.toLowerCase()) ||
    new RegExp(`^\\s*${d}\\s*[·.\\-–—]`).test(title)
  );
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

const chipDate = (iso?: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

/** An airport code, only if the backend actually wrote one. Never invented. */
const codeOf = (city?: string) => city?.match(/\b([A-Z]{3})\b/)?.[1] ?? null;

/** A price written as a sentence wraps in the text face instead of overflowing. */
/**
 * A price is set as a figure only when it is one.
 *
 * The backend's price field carries both real amounts ("₹12,40,000", "₹12-17
 * lakh") and honest prose where there is no number yet ("Live fare to confirm",
 * "Rate to confirm", "Not checked"). Setting prose in the 21px display face with
 * `white-space: nowrap` pushed it straight out of the boarding pass. Digits are
 * the test, not length: no digit means it is a sentence, and sentences wrap.
 */
const priceClass = (price: string) => {
  const p = price ?? "";
  const isFigure = /\d/.test(p) && p.length <= 22;
  return `it-price${isFigure ? "" : " it-price--long"}`;
};

/**
 * What the line's own price string says about it. The vocabulary is the
 * backend's; nothing here claims a price that is not on a quote.
 */
function lineState(price?: string): { tone: StatusTone; label: string } | null {
  const p = (price ?? "").trim();
  if (!p) return null;
  if (/^not checked/i.test(p))
    return { tone: "progress", label: "Not checked" };
  if (/to confirm/i.test(p))
    return { tone: "progress", label: "Rate to confirm" };
  if (/on request/i.test(p))
    return { tone: "progress", label: "Quote on request" };
  if (/indicative|estimate|approx|target|from ₹/i.test(p))
    return { tone: "progress", label: "Indicative" };
  return { tone: "ready", label: "Priced" };
}

/** The name, with any "candidate, unverified" note moved into its own small tag. */
function Name({
  raw,
  className = "t-display-s",
}: {
  raw: string;
  className?: string;
}) {
  const { name, unverified } = splitName(raw);
  return (
    <div className="flex flex-col items-start gap-2">
      <h3 className={className}>{name}</h3>
      {unverified ? <Status tone="progress">Rate to confirm</Status> : null}
    </div>
  );
}

/* ------------------------------------------------------------ day stories -- */

const PART_OF_DAY =
  /^(first light|early morning|late morning|mid-?morning|dawn|morning|midday|noon|lunch|early afternoon|afternoon|late afternoon|dusk|sunset|early evening|evening|night|late night|late)\b[\s:,.–-]+/i;

const IS_TRANSFER =
  /\b(chauffeur|chauffeured|private car|car to|transfer|transferred|drive|driven|train|ferry|boat|helicopter|seaplane|fly|flight|nonstop|non-stop|road to|taxi)\b/i;

interface Step {
  part: string | null;
  text: string;
  move: boolean;
}

/**
 * A day arrives as a paragraph. It is read back as a timeline: the part-of-day
 * words the plan already uses become the labels, and a sentence that moves the
 * traveller becomes a connector rather than another bullet. Presentation only —
 * no word is added or removed.
 */
function steps(body?: string): Step[] {
  const text = (body ?? "").trim();
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'“])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const part = s.match(PART_OF_DAY)?.[1] ?? null;
      const rest = part ? s.replace(PART_OF_DAY, "") : s;
      const label = part
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : null;
      return { part: label, text: rest || s, move: IS_TRANSFER.test(s) };
    });
}

/**
 * What to ask Google for, for a given day.
 *
 * Asking for the city alone gives every day in a city the same photograph,
 * which makes a nine-day plan look like one day repeated. The day's own title
 * carries its subject — "Old Town, slowly", "Arrive, settle in" — so the
 * subject is lifted out and paired with the place: "Old Town Zurich".
 *
 * The date prefix and anything after a comma are dropped, because "slowly" and
 * "Tue 12 Oct" are not places. A title that survives to nothing falls back to
 * the city, which is still better than no photograph.
 */
function placeQuery(d: DayRow, cityName?: string | null): string | null {
  const city = cityName ?? d.place ?? null;
  if (!city) return null;
  const subject = d.t
    .replace(/^[^·]*·\s*/, "")  // "Tue 12 Oct · " 
    .split(",")[0]!              // "Old Town, slowly" -> "Old Town"
    .replace(/\b(arrive|settle in|depart|fly home|rest|free|slowly|at leisure)\b/gi, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim();
  // Two words or more is a landmark worth asking for; one is usually a verb.
  return subject.split(/\s+/).filter(Boolean).length >= 2
    ? `${subject} ${city}`
    : city;
}

function DayStory({
  d,
  index,
  image,
  place,
}: {
  d: DayRow;
  index: number;
  image?: string | null;
  place?: string | null;
}) {
  const list = steps(d.d);
  /*
   * A photograph of where the day actually is, when we can get one.
   *
   * The query is the day's own place when the plan names one, and the city
   * otherwise. It is fetched after paint and never awaited: the card draws
   * immediately on the house's photography and upgrades in place if Google
   * answers. Google's attribution is shown whenever its picture is used,
   * because that is the condition of using it.
   */
  const photo = usePlacePhoto(placeQuery(d, place));
  const src = photo?.url ?? image;
  return (
    <article className="k-card overflow-hidden" style={{ borderRadius: 22 }}>
      {src ? (
        <Photo
          src={src}
          alt={photo?.placeName ?? place ?? d.t}
          radius={0}
          className="h-[168px] w-full"
        >
          {/* The place, captioned: a city photograph never stands for the day's rooms. */}
          {place ? (
            <GlassChip className="absolute bottom-3 left-3" icon="pin">
              {place}
            </GlassChip>
          ) : null}
          {photo ? (
            <PhotoCredit photo={photo} />
          ) : null}
        </Photo>
      ) : null}

      <div className="flex flex-col gap-5 p-[18px]">
        <header className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="t-label c-champagne t-figure">Day {index + 1}</p>
            <h2 className="t-display-s">
              {d.date && !titleCarriesDate(d.t, d.date)
                ? `${shortDate(d.date)} · `
                : ""}
              {d.t}
            </h2>
          </div>
          {d.m ? (
            <p className="t-caption c-ivory-3 shrink-0 pb-1">{d.m}</p>
          ) : null}
        </header>

        {list.length > 0 ? (
          <ol className="flex flex-col">
            {list.map((s, i) => (
              <li key={i} className="it-step">
                <span className="it-step-gutter" aria-hidden="true">
                  {s.move ? (
                    <span className="it-move">
                      <Icon name="car" size={12} />
                    </span>
                  ) : (
                    <span className="it-dot" />
                  )}
                  {i < list.length - 1 ? (
                    <span
                      className={`it-thread${s.move ? " it-thread--move" : ""}`}
                    />
                  ) : null}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  {s.part ? <p className="t-mono c-ivory-3">{s.part}</p> : null}
                  <p className={s.move ? "t-caption" : "t-body-s"}>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- the choices - */

/**
 * The flight, drawn as the client's reference draws it: the airline and its
 * chip on top; departure large above its city, the flight numbers and duration
 * over a hairline, arrival large above its city; then a strip carrying the
 * details and the price.
 *
 * A time or an airport code is printed only where the backend supplied one.
 * Most plans arrive with no verified schedule at all, so that is a designed
 * state — the route still reads, and the clock says it is not yet checked.
 */
function Boarding({ o, chip }: { o: Choice; chip: ReactNode }) {
  const f = o.flight;
  const state = o.priceEvidence ? { tone: "progress" as const, label: "Indicative web price" } : lineState(o.price);
  /* A time if the plan wrote one; otherwise the code, if the city carries one. */
  const dep = f?.depTime?.trim() || codeOf(f?.depCity) || null;
  const arr = f?.arrTime?.trim() || codeOf(f?.arrCity) || null;
  const scheduled = Boolean(f?.depTime && f?.arrTime && /^\d{2}:\d{2}$/.test(f.depTime) && /^\d{2}:\d{2}$/.test(f.arrTime));
  const legs = [f?.duration, f?.cabin].filter(Boolean).join(" · ");

  return (
    <>
      <div className="flex flex-col gap-4 px-5 pb-[18px] pt-[18px]">
        <div className="flex items-start justify-between gap-3">
          <Name raw={o.name} className="t-title" />
          <span className="shrink-0">{chip}</span>
        </div>

        {f ? (
          <div className="it-flight-row">
            <div className="min-w-0">
              {scheduled ? (
                <p className="it-time">{dep}</p>
              ) : (
                <p className="t-title-s truncate">{f.depCity}</p>
              )}
              {scheduled && f.depCity ? (
                <p className="it-flight-city truncate">{f.depCity}</p>
              ) : null}
            </div>

            <div className="it-flight-mid">
              {f.flightNos ? (
                <p className="t-mono c-ivory-3 truncate">{f.flightNos}</p>
              ) : null}
              <span className="it-flight-line" aria-hidden="true" />
              {scheduled ? (
                legs ? (
                  <p className="t-mono c-ivory-3 truncate">{legs}</p>
                ) : null
              ) : (
                <p className="t-mono c-ivory-3">Times to confirm</p>
              )}
            </div>

            <div className="min-w-0 text-right">
              {scheduled ? (
                <p className="it-time">{arr}</p>
              ) : (
                <p className="t-title-s truncate">{f.arrCity}</p>
              )}
              {scheduled && f.arrCity ? (
                <p className="it-flight-city truncate">{f.arrCity}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {o.why ? (
          <p className="t-body-s c-ivory-2">{firstSentence(o.why)}</p>
        ) : null}
      </div>

      <div className="it-perf" aria-hidden="true" />

      <div className="it-flight-foot px-5 pb-[18px] pt-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {o.details ? (
            <p className="t-caption t-figure">{o.details}</p>
          ) : !f ? (
            <p className="t-caption c-ivory-3">Schedule to confirm</p>
          ) : null}
          {state ? (
            <span className="self-start">
              <Status tone={state.tone}>{state.label}</Status>
            </span>
          ) : null}
        </div>
        <p className={`${priceClass(o.price)} max-w-[54%] text-right`}>
          {o.price}
          {o.checked ? (
            <span className="t-caption c-ivory-3 ml-2">
              checked {o.checked}
            </span>
          ) : null}
        </p>
      </div>
      <div className="px-5 pb-4"><PriceSource choice={o} /></div>
      {o.inclusions?.length ? (
        <div className="px-5 pb-4">
          <Inclusions list={o.inclusions} />
        </div>
      ) : null}
    </>
  );
}

function PhotoCredit({ photo }: { photo: PlacePhoto }) {
  return <span className="it-credit absolute bottom-2 right-2 max-w-[75%] text-right">
    {photo.googleMapsUri ? <a href={photo.googleMapsUri} target="_blank" rel="noopener noreferrer">Google Maps</a> : 'Google Maps'}
    {photo.authors?.length ? photo.authors.map((a, i) => <span key={`${a.name}-${i}`}> · {a.uri ? <a href={a.uri} target="_blank" rel="noopener noreferrer">{a.name}</a> : a.name}</span>) : photo.attribution !== 'Google Maps' ? ` · ${photo.attribution}` : ''}
  </span>
}
function PriceSource({ choice }: { choice: Choice }) {
  const evidence = choice.priceEvidence
  if (!evidence) return choice.source && /^https?:\/\//.test(choice.source) ? <a className="k-link" href={choice.source} target="_blank" rel="noopener noreferrer">Price source</a> : null
  return <div className="t-caption flex flex-col gap-1">
    <span>{evidence.match === 'exact' ? 'Indicative web price' : 'Public from-rate · not an exact trip quote'} · {evidence.unit}</span>
    <span>{evidence.basis}</span><span>{evidence.terms}</span>
    {/^https?:\/\//.test(evidence.source) && <a className="k-link" href={evidence.source} target="_blank" rel="noopener noreferrer">View price source</a>}
    <span>Checked {evidence.checkedAt.slice(0, 10)} · subject to confirmation</span>
  </div>
}

function StayFace({
  o,
  chip,
  image,
  place,
}: {
  o: Choice;
  chip: ReactNode;
  image: string | null;
  place: string | null;
}) {
  const state = o.priceEvidence ? { tone: "progress" as const, label: "Indicative web price" } : lineState(o.price);
  const hotelName = splitName(o.name).name.split(/[·,]/)[0].trim();
  const photo = usePlacePhoto(`${hotelName}${place ? `, ${place}` : ""}`, hotelName);
  const src = photo?.url ?? image;
  return (
    <>
      {src ? (
        <Photo
          src={src}
          alt={photo?.placeName ?? (place ? `${place} · destination photograph` : "Destination photograph")}
          label={place ?? undefined}
          radius={0}
          className="h-[150px] w-full"
        >
          {/* Captioned with the city, so a city photograph is never read as the hotel. */}
          {photo ? <PhotoCredit photo={photo} /> : place ? (
            <GlassChip className="absolute bottom-3 left-3" icon="pin">
              {place} · destination photograph
            </GlassChip>
          ) : null}
        </Photo>
      ) : null}
      <div className="flex flex-col gap-3.5 p-[18px]">
        <div className="flex items-center justify-between gap-3">
          {chip}
          {state ? <Status tone={state.tone}>{state.label}</Status> : null}
        </div>
        {!image ? <span className="it-index-rule" aria-hidden="true" /> : null}
        <div className="flex flex-col gap-1.5">
          <Name raw={o.name} />
          {o.details ? <p className="t-caption t-figure">{o.details}</p> : null}
        </div>
        {o.why ? (
          <p className="t-body-s c-ivory-2">{firstSentence(o.why)}</p>
        ) : null}
        <Inclusions list={o.inclusions} />
        <p className={priceClass(o.price)}>{o.price}</p>
        <PriceSource choice={o} />
      </div>
    </>
  );
}

/**
 * The small benefits attached to a rate.
 *
 * The agent only marks something `included` when it has evidence for this
 * exact room or cabin; everything else is `requested`. The two are drawn
 * differently and labelled differently, because "breakfast included" is a
 * promise the house is making and "breakfast requested" is one it has not
 * made yet. Collapsing them would be the one lie this app does not tell.
 */
function Inclusions({ list }: { list?: Choice["inclusions"] }) {
  if (!list?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {list.map((inc, i) => {
        const on = inc.status === "included";
        return (
          <li key={`${inc.label}-${i}`}>
            <span
              className="k-status"
              style={
                on
                  ? { background: "rgba(156,197,173,.14)", color: "var(--sage)" }
                  : undefined
              }
              title={on ? "Confirmed for this rate" : "Asked for, not yet confirmed"}
            >
              {inc.label}
              <span className="c-ivory-3" style={{ marginLeft: 2 }}>
                {on ? "included" : "requested"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One decision: what is on the plan now, and a way into the alternatives. The
 * alternatives open as a sheet — a drawer inside the document hid them.
 */
function Group({
  g,
  kind,
  chosen,
  onChoose,
  image,
  place,
}: {
  g: ChoiceGroup;
  kind: "flight" | "stay";
  chosen: number;
  onChoose: (i: number) => void;
  image?: string | null;
  place?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const options = [g.recommended, ...g.alternatives];
  const o = options[chosen] ?? options[0]!;
  const others = options.length - 1;
  const chip =
    chosen === 0 ? (
      <Cred>Our choice</Cred>
    ) : (
      <Status tone="ok">Your choice</Status>
    );
  const [title, ...rest] = g.label.split("·").map((s) => s.trim());
  /*
   * A route reads "Bengaluru → London Heathrow → Bengaluru". Left to itself it
   * breaks after the arrow, stranding it at the end of a line with its city on
   * the next. Binding each arrow to the city that follows it means a line can
   * only end on a place, which is how a route is read aloud.
   */
  const routed = title.replace(/\s*→\s*/g, "\u00A0→\u00A0").replace(/\u00A0→\u00A0/g, " →\u00A0");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="t-title-s">{routed}</p>
        {rest.length > 0 ? (
          <p className="t-caption t-figure">{rest.join(" · ")}</p>
        ) : null}
      </div>

      <article
        className={
          kind === "flight" ? "k-card-raised it-pass" : "k-card overflow-hidden"
        }
        style={{ borderRadius: 22 }}
      >
        {kind === "flight" ? (
          <Boarding o={o} chip={chip} />
        ) : (
          <StayFace
            o={o}
            chip={chip}
            image={image ?? null}
            place={place ?? null}
          />
        )}

        {others > 0 && kind === "flight" ? (
          <div
            className="flex items-center justify-between gap-3 px-5 pb-1"
            style={{ height: 56 }}
          >
            <button
              type="button"
              className="k-link h-11"
              onClick={() => setOpen(true)}
            >
              <Icon name="swap" size={16} />
              {others} other option{others === 1 ? "" : "s"}
            </button>
            <span className="t-caption c-ivory-3 min-w-0 truncate">
              {options
                .filter((_, i) => i !== chosen)
                .map((a) => splitName(a.name).name)
                .join(" · ")}
            </span>
          </div>
        ) : null}
      </article>

      {/* The alternatives sit beside the pick, not behind it: the member can
          compare and swap without leaving the page. The sheet remains, for the
          case each one makes and the trade-off it asks for. */}
      {others > 0 && kind === "stay" ? (
        <section className="flex flex-col gap-2.5 pt-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-label c-ivory-3">Alternatives</p>
            <button
              type="button"
              className="k-link c-ivory-2 h-11"
              onClick={() => setOpen(true)}
            >
              Compare in detail
            </button>
          </div>
          <ul className="k-card px-[18px]">
            {options.map((alt, i) =>
              i === chosen ? null : (
                <li key={alt.name} className="it-alt">
                  <span className="it-alt-mark" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="t-title-s">{splitName(alt.name).name}</p>
                    {alt.details ? (
                      <p className="t-caption c-ivory-3 truncate">
                        {alt.details}
                      </p>
                    ) : null}
                    <p className="t-caption t-figure c-ivory">{alt.price}</p>
                  </div>
                  <Btn
                    tone="ghost"
                    size="sm"
                    className="h-11 shrink-0"
                    aria-label={`Swap to ${splitName(alt.name).name}`}
                    onClick={() => onChoose(i)}
                  >
                    Swap
                  </Btn>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      {open ? (
        <Sheet onClose={() => setOpen(false)} labelledBy={`opts-${g.label}`}>
          <div className="flex flex-col gap-5 px-6 pb-2 pt-4">
            <header className="flex flex-col gap-1">
              <p className="t-caption t-figure">{g.label}</p>
              <h2 id={`opts-${g.label}`} className="t-display-s">
                {kind === "flight"
                  ? "Choose the flight"
                  : "Choose where you stay"}
              </h2>
            </header>

            <ul className="flex flex-col gap-2.5">
              {options.map((alt, i) => {
                const state = lineState(alt.price);
                return (
                  <li
                    key={alt.name}
                    className={`k-card it-option flex flex-col gap-3.5 p-[18px] ${i === chosen ? "it-option--on" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {i === 0 ? (
                        <Cred>Our choice</Cred>
                      ) : (
                        <span className="t-caption c-ivory-3">Alternative</span>
                      )}
                      {i === chosen ? (
                        <Status tone="ready">On your plan</Status>
                      ) : state ? (
                        <Status tone={state.tone}>{state.label}</Status>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Name raw={alt.name} className="t-title" />
                      {alt.details ? (
                        <p className="t-caption">{alt.details}</p>
                      ) : null}
                    </div>
                    <ul className="flex flex-col gap-2">
                      {alt.why ? (
                        <li className="flex items-start gap-2.5">
                          <span className="mt-0.5 shrink-0 c-sage">
                            <Icon
                              name="check"
                              size={16}
                              strokeWidth={1.8}
                              label="In its favour"
                            />
                          </span>
                          <span className="t-body-s">{alt.why}</span>
                        </li>
                      ) : null}
                      {alt.tradeoff ? (
                        <li className="flex items-start gap-2.5">
                          <span className="mt-0.5 shrink-0 c-ivory-3">
                            <Icon
                              name="minus"
                              size={16}
                              strokeWidth={1.8}
                              label="Trade-off"
                            />
                          </span>
                          <span className="t-body-s c-ivory-2">
                            {alt.tradeoff}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                    {alt.inclusions?.length ? (
                      <Inclusions list={alt.inclusions} />
                    ) : null}
                    <div
                      className="flex items-center justify-between gap-3 border-t pt-3"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <span className={priceClass(alt.price)}>{alt.price}</span>
                      {i === chosen ? null : (
                        <Btn
                          tone="ghost"
                          size="sm"
                          className="h-11 shrink-0"
                          onClick={() => {
                            onChoose(i);
                            setOpen(false);
                          }}
                        >
                          Choose
                        </Btn>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="flex flex-col gap-4 pb-4">
              <p className="t-caption c-ivory-3 flex items-start gap-2.5">
                <Icon name="info" size={16} className="mt-px" />
                <span>
                  Changing a quoted line re-opens the quote. The Desk re-checks
                  before anything moves.
                </span>
              </p>
              <Btn tone="primary" block onClick={() => setOpen(false)}>
                Keep {splitName(o.name).name}
              </Btn>
            </footer>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

/**
 * The plain rows the plan also carries — a country-house stay, the ground
 * transfers. The old component hid these whenever there were flight or hotel
 * groups, and a London trip quietly lost both.
 */
function Lines({ rows, icon }: { rows: Row[]; icon: string }) {
  if (rows.length === 0) return null;
  return (
    <Card className="px-4">
      {rows.map((r, i) => (
        <div key={`${r.t}-${i}`} className="k-row items-start py-3.5">
          <span className="c-ivory-2 mt-0.5 shrink-0">
            <Icon name={icon} size={18} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="t-title-s">{r.t}</p>
            {r.m ? <p className="t-caption t-figure">{r.m}</p> : null}
            {r.d ? <p className="t-body-s c-ivory-2">{r.d}</p> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}

function Decisions({ rows }: { rows: Row[] }) {
  return (
    <Card className="px-4">
      {rows.map((r, i) => (
        <div key={`${r.t}-${i}`} className="k-row items-start py-3.5">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="t-title-s">{r.t}</p>
            {r.m ? <p className="t-caption t-figure">{r.m}</p> : null}
            {/* The agent prefers `highlights` where it has them; `d` is the
                older single-paragraph form and still renders beneath. */}
            {r.highlights?.length ? <Points points={r.highlights} /> : null}
            {r.d ? <p className="t-body-s c-ivory-2">{r.d}</p> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------------------------------------------------- agent 0.2.1 pieces --- */

/** What is actually open, said plainly at the top of the tab. */
function openCount(p: TripPlan): string {
  const yours = (p.bookingActions ?? []).filter((a) => a.status === "your-choice").length;
  const desk = (p.bookingActions ?? []).filter((a) => a.status === "with-advisor").length;
  const parts: string[] = [];
  if (yours) parts.push(`${yours} for you`);
  if (desk) parts.push(`${desk} with the Desk`);
  if (!parts.length) return "Nothing is booked until you say so.";
  return `${parts.join(" \u00b7 ")}. Nothing is booked until you say so.`;
}

/** A champagne-bulleted list. The house's one list shape. */
function Points({ points, max }: { points: string[]; max?: number }) {
  const [all, setAll] = useState(false);
  /* Eight bullets of visa detail is reference, not a decision. The first few
     carry the action; the rest are there when someone wants them. */
  const shown = max && !all ? points.slice(0, max) : points;
  const hidden = points.length - shown.length;
  return (
    <>
    <ul className="flex flex-col gap-2">
      {shown.map((b, i) => (
        <li key={`${b}-${i}`} className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-[9px] h-1 w-1 shrink-0 rounded-full"
            style={{ background: "var(--champagne)" }}
          />
          <span className="t-body-s c-ivory-2">{b}</span>
        </li>
      ))}
    </ul>
    {hidden > 0 ? (
      <button type="button" onClick={() => setAll(true)} className="k-link k-link-champagne self-start">
        {hidden} more {hidden === 1 ? "detail" : "details"}
        <Icon name="chevron-down" size={15} />
      </button>
    ) : null}
    </>
  );
}

/** Official sources, as tappable evidence rather than bare links. */
function Sources({ links }: { links: { t: string; u: string }[] }) {
  const safe = links.filter((l) => /^https?:\/\//i.test(l.u));
  if (!safe.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {safe.map((l) => (
        <a
          key={l.u}
          href={l.u}
          target="_blank"
          rel="noopener noreferrer"
          className="k-chip"
          style={{ height: 44 }}
        >
          {l.t}
          <Icon name="arrow-up-right" size={14} />
        </a>
      ))}
    </div>
  );
}

/**
 * A checklist card: the title, its points, its sources, and the date the
 * sources were actually checked. `checked` is never printed as anything other
 * than what it is — a source-check, not a guarantee about the future.
 */
function GuidanceCard({ note, icon, max }: { note: Guidance; icon?: string; max?: number }) {
  return (
    <Card className="flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="it-gate-mark">
            <Icon name={icon} size={20} />
          </span>
        ) : null}
        <h3 className="t-title-s">{note.title}</h3>
      </div>
      <Points points={note.points} max={max} />
      <Sources links={note.sources} />
      {note.checked ? <p className="t-caption c-ivory-3">Sources checked {note.checked}</p> : null}
    </Card>
  );
}

const ACTION_STATUS: Record<BookingAction["status"], { label: string; tone: StatusTone }> = {
  "your-choice": { label: "For you to decide", tone: "alert" },
  "with-advisor": { label: "With the Desk", tone: "progress" },
  confirmed: { label: "Confirmed", tone: "ok" },
};

/**
 * One pending decision. The status is the agent's description of where the
 * decision sits, never a booking state: `confirmed` here does not mean the
 * Desk has held or paid for anything, and the copy never implies it has.
 */
function ActionCard({ action }: { action: BookingAction }) {
  const s = ACTION_STATUS[action.status] ?? ACTION_STATUS["your-choice"];
  return (
    <Card className="flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="t-title-s min-w-0">{action.title}</h3>
        <Status tone={s.tone}>{s.label}</Status>
      </div>
      <Points points={action.points} />
      {action.due ? (
        <p className="t-caption t-figure c-ivory-3">By {shortDate(action.due)}</p>
      ) : null}
    </Card>
  );
}

const VISA_LABEL: Record<NonNullable<TripPlan["visa"]>["status"], string> = {
  pending: "Visa pending",
  confirmed: "Visa confirmed",
  "not-needed": "Visa not required",
  "to-check": "Visa to check",
};

const VISA_TONE: Record<NonNullable<TripPlan["visa"]>["status"], StatusTone> = {
  pending: "alert",
  confirmed: "ok",
  "not-needed": "ok",
  "to-check": "progress",
};

const TOPIC_LABEL: Record<DestinationNote["topic"], string> = {
  weather: "Weather & packing",
  "traditional-dress": "Local traditions",
  style: "What to wear",
  explore: "More to explore",
  practical: "Useful to know",
};

const TOPIC_ICON: Record<DestinationNote["topic"], string> = {
  weather: "sun",
  "traditional-dress": "rosette",
  style: "star",
  explore: "compass",
  practical: "info",
};

/* ------------------------------------------------------------------ screen - */

export interface ItineraryProps {
  bundle: PlanBundle & { plan: TripPlan };
  madeFor?: string;
  coming: Nudge[];
  /** The one state the hero carries, from the request the Desk holds. */
  status?: ReactNode;
  /** Send a message to Tara now (the member's own swaps). */
  onRefine: (message: string) => void;
  /** Open Tara with this text in the composer, unsent. */
  onAsk: (draft: string) => void;
  onShare: () => void;
  footer?: ReactNode;
}

export function Itinerary({
  bundle,
  madeFor,
  coming,
  status,
  onRefine,
  onAsk,
  onShare,
  footer,
}: ItineraryProps) {
  const p = bundle.plan;
  const [tab, setTab] = useState<Tab>("Plan");
  const [day, setDay] = useState<string>("all");
  const top = useRef<HTMLDivElement>(null);

  const { choices: saved, setChoices } = useStore();
  const [previewChoices, setPreviewChoices] = useState<Record<string, number>>({});
  const isSavedPlan = /^[a-f0-9]{64}$/.test(bundle.key);
  const choices = isSavedPlan ? saved[bundle.key] ?? {} : previewChoices;
  const choose = (id: string, i: number) => {
    const next = { ...choices, [id]: i };
    if (isSavedPlan) setChoices(bundle.key, next);
    else setPreviewChoices(next);
  };

  const changed = useMemo(() => {
    const out: string[] = [];
    p.flightOptions.forEach((g, i) => {
      const k = choices[`flight-${i}`] ?? 0;
      if (k)
        out.push(`${g.label}: ${[g.recommended, ...g.alternatives][k]?.name}`);
    });
    p.hotelOptions.forEach((g, i) => {
      const k = choices[`stay-${i}`] ?? 0;
      if (k)
        out.push(`${g.label}: ${[g.recommended, ...g.alternatives][k]?.name}`);
    });
    return out;
  }, [choices, p]);

  const heroName = bundle.places.hero ? CITY_BY_SLUG[bundle.places.hero]?.name ?? bundle.places.hero : p.places?.[0];
  const heroPhoto = usePlacePhoto(heroName);
  const hero = heroPhoto?.url ?? (bundle.places.hero ? cityHero(bundle.places.hero) : null);
  const stayImage = (i: number) =>
    bundle.places.stays[i] ? cityCard(bundle.places.stays[i]!) : null;
  const stayPlace = (i: number) => {
    const slug = bundle.places.stays[i];
    return slug ? (CITY_BY_SLUG[slug]?.name ?? null) : null;
  };
  const dayImage = (i: number) =>
    bundle.places.days[i] ? cityCard(bundle.places.days[i]!) : null;
  const dayPlace = (i: number) => {
    const slug = bundle.places.days[i];
    return slug ? (CITY_BY_SLUG[slug]?.name ?? null) : null;
  };

  // The day rail scrolls a card's width at a time from either chevron.
  const rail = useRef<HTMLDivElement>(null);
  const nudgeRail = (dir: 1 | -1) =>
    rail.current?.scrollBy({ left: dir * 180, behavior: "smooth" });

  const visibleDays =
    day === "all"
      ? p.days.map((d, i) => ({ d, i }))
      : [{ d: p.days[Number(day)]!, i: Number(day) }];
  const tripComing = coming.filter((n) => n.trip === p.id).slice(0, 4);

  const go = (t: Tab) => {
    setTab(t);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="it-doc">
      {/* The city, the title, and the one state that matters. */}
      {/* The title sits beside the photograph rather than inside it, so this
          section carries the obsidian register itself: type over a photograph
          is light-on-dark whichever ground the document is laid on. */}
      <section
        className="k-dark relative"
        style={{ height: 460 }}
        aria-label={p.title}
      >
        <Photo
          src={hero ?? undefined}
          alt={
            bundle.places.hero
              ? `${CITY_BY_SLUG[bundle.places.hero]?.name ?? p.title}`
              : p.title
          }
          label={p.title}
          veil="hero"
          radius={0}
          eager
          className="absolute inset-0 h-full w-full"
        >{heroPhoto && <PhotoCredit photo={heroPhoto} />}</Photo>
        <div className="absolute bottom-7 left-6 right-6 z-[2] flex flex-col items-start gap-2.5">
          {madeFor ? (
            <p className="t-caption c-ivory">Made for {madeFor}</p>
          ) : null}
          <h1 className="t-display-xl">{p.title}</h1>
          {p.sub ? <p className="t-caption t-figure">{p.sub}</p> : null}
          {status ? <div className="mt-1.5">{status}</div> : null}
        </div>
      </section>

      {/* One document, three views. */}
      <div
        ref={top}
        className="px-6 pb-4 pt-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <nav className="it-views" aria-label="Itinerary views" role="tablist">
          {/* The pill slides to the view you chose, rather than the fill jumping. */}
          <span
            className="it-views-pill"
            aria-hidden="true"
            style={{ transform: `translateX(${TABS.indexOf(tab) * 100}%)` }}
          />
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`it-view${tab === t ? " is-on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "Plan" ? (
        <>
          {p.lede ? (
            <p className="t-body c-ivory-2 max-w-lead px-6 pt-7">{p.lede}</p>
          ) : null}

          {/* The gate, before any money. */}
          {p.gate?.t || p.gate?.b ? (
            <section className="px-6 pt-7">
              <aside
                className="it-gate flex flex-col gap-3.5 px-[18px] pb-0.5 pt-[18px]"
                aria-label="Before money moves"
              >
                <div className="flex items-center gap-3">
                  <span className="it-gate-mark">
                    <Icon name="passport" size={20} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="t-label c-amber">Before money moves</p>
                    <h2 className="t-title-s">{p.gate.t}</h2>
                  </div>
                </div>
                <p className="t-body-s c-ivory-2">{p.gate.b}</p>
                <button
                  type="button"
                  onClick={() => go("Decisions")}
                  className="flex h-12 items-center justify-between"
                  style={{
                    borderTop: "1px solid rgba(230,176,113,.2)",
                    color: "var(--amber)",
                    fontWeight: 500,
                    fontSize: 14,
                  }}
                >
                  What is yours to decide
                  <Icon name="forward" size={18} />
                </button>
              </aside>
            </section>
          ) : null}

          {tripComing.length > 0 ? (
            <section className="flex flex-col gap-4 px-6 pt-12">
              <h2 className="t-display-s">Coming up</h2>
              <Card className="flex flex-col gap-3 p-[18px]">
                {tripComing.map((n) => (
                  <div
                    key={`${n.date}-${n.text}`}
                    className="flex flex-col gap-1"
                  >
                    <span className="t-mono c-champagne">
                      {shortDate(n.date)}
                    </span>
                    <span className="t-body-s c-ivory-2">{n.text}</span>
                  </div>
                ))}
              </Card>
            </section>
          ) : null}

          {/* The trip's terms, boxed. "The shape" said nothing to a member
              reading it for the first time; these four lines are the answer to
              "what actually is this trip", so the heading says that instead. */}
          <section className="flex flex-col gap-5 px-6 pt-14">
            <h2 className="t-display-s">At a glance</h2>
            <dl className="it-glance">
              {p.shape.map((r) => (
                <div key={r.k} className="it-defrow">
                  <dt className="t-caption c-ivory-3">{r.k}</dt>
                  <dd className="t-title-s t-figure it-defvalue">{r.v}</dd>
                </div>
              ))}
            </dl>
            {p.shapeNote ? (
              <figure className="flex flex-col gap-4 pt-3">
                <span
                  aria-hidden="true"
                  className="h-px w-7"
                  style={{ background: "var(--champagne)" }}
                />
                <blockquote className="it-thesis">{p.shapeNote.b}</blockquote>
              </figure>
            ) : null}
          </section>

          {p.flightOptions.length > 0 || p.move.length > 0 ? (
            <section className="flex flex-col gap-5 px-6 pt-14">
              <h2 className="t-display-s">Getting there</h2>
              {p.flightOptions.map((g, i) => (
                <Group
                  key={g.label}
                  g={g}
                  kind="flight"
                  chosen={choices[`flight-${i}`] ?? 0}
                  onChoose={(k) => choose(`flight-${i}`, k)}
                />
              ))}
              {/* Ground transfers still belong on the page, flights or no flights. */}
              <Lines rows={p.move} icon="car" />
            </section>
          ) : null}

          {p.hotelOptions.length > 0 || p.stay.length > 0 ? (
            <section className="flex flex-col gap-5 px-6 pt-14">
              <h2 className="t-display-s">Where you stay</h2>
              {p.hotelOptions.map((g, i) => (
                <Group
                  key={g.label}
                  g={g}
                  kind="stay"
                  chosen={choices[`stay-${i}`] ?? 0}
                  onChoose={(k) => choose(`stay-${i}`, k)}
                  image={stayImage(i)}
                  place={stayPlace(i)}
                />
              ))}
              {/* The country-house nights the old component dropped. */}
              <Lines rows={p.stay} icon="stay" />
            </section>
          ) : null}

          {p.allowance.length > 0 ? (
            <section className="flex flex-col gap-5 px-6 pt-14">
              <h2 className="t-display-s">What it costs</h2>
              <article className="it-total flex flex-col gap-4 p-[22px]">
                {/* Label left, figure right, a hairline between, the total last
                    and emphasised. The strings are the backend's, printed exactly. */}
                <dl className="flex flex-col">
                  {p.allowance.map((r, i) => {
                    const total =
                      /total/i.test(r.k) ||
                      (i === p.allowance.length - 1 && p.allowance.length > 2);
                    return (
                      <div
                        key={r.k}
                        className={`it-costrow${total ? " it-costrow--total" : ""}`}
                      >
                        <dt>{r.k}</dt>
                        <dd>{r.v}</dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="t-caption c-ivory-3">
                  Public web prices are indicative. The Desk confirms availability, inclusions and the quote’s validity before booking.
                </p>
              </article>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 px-6 pt-12">
            {changed.length > 0 ? (
              <Btn
                tone="secondary"
                block
                onClick={() =>
                  onRefine(
                    `I've made some changes to "${p.title}". Please rebuild it with:\n${changed.map((c) => `- ${c}`).join("\n")}`,
                  )
                }
              >
                Send my {changed.length} change{changed.length === 1 ? "" : "s"}{" "}
                to the Desk
              </Btn>
            ) : null}
            <Btn tone="ghost" block icon="calendar" onClick={() => go("Days")}>
              See the day-by-day plan
            </Btn>
          </section>
        </>
      ) : null}

      {tab === "Days" ? (
        <>
          <section className="flex flex-col gap-5 px-6 pt-7">
            <h2 className="t-display-s">
              {p.days.length} day{p.days.length === 1 ? "" : "s"}, paced
            </h2>
          </section>

          {p.days.length > 1 ? (
            <div className="it-subrail px-4 pt-5">
              <button
                type="button"
                className="it-subrail-chev"
                aria-label="Earlier days"
                onClick={() => nudgeRail(-1)}
              >
                <Icon name="chevron-left" size={18} />
              </button>
              <div className="it-subrail-track" ref={rail}>
                <button
                  type="button"
                  className={`k-chip shrink-0 ${day === "all" ? "is-on" : ""}`}
                  aria-pressed={day === "all"}
                  onClick={() => setDay("all")}
                >
                  All days
                </button>
                {p.days.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`k-chip t-figure shrink-0 ${day === String(i) ? "is-on" : ""}`}
                    aria-pressed={day === String(i)}
                    onClick={() => setDay(String(i))}
                  >
                    {chipDate(d.date) ?? `Day ${i + 1}`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="it-subrail-chev"
                aria-label="Later days"
                onClick={() => nudgeRail(1)}
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
          ) : null}

          <div key={day} className="flex flex-col gap-3 px-6 pt-6">
            {visibleDays.map(({ d, i }) => (
              <DayStory
                key={i}
                d={d}
                index={i}
                image={dayImage(i)}
                place={dayPlace(i)}
              />
            ))}
          </div>

          {p.daysNote ? (
            <section className="px-6 pt-6">
              <aside
                className="k-card flex items-start gap-3.5 p-[18px]"
                style={{ borderRadius: 22, background: "var(--ink-1)" }}
              >
                <span
                  className="c-ivory-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--ink-3)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Icon name="moon" size={18} />
                </span>
                <div className="flex min-w-0 flex-col gap-1 pt-px">
                  <h2 className="t-title-s">{p.daysNote.t}</h2>
                  <p className="t-body-s c-ivory-2">{p.daysNote.b}</p>
                </div>
              </aside>
            </section>
          ) : null}

          {p.bookOrder.length > 0 ? (
            <section className="flex flex-col gap-5 px-6 pt-14">
              <h2 className="t-display-s">Reservations that matter</h2>
              <ol className="k-card px-[18px]" style={{ borderRadius: 22 }}>
                {p.bookOrder.map((r, i) => (
                  <li
                    key={`${r.t}-${i}`}
                    className="grid py-[18px]"
                    style={{
                      gridTemplateColumns: "26px minmax(0,1fr)",
                      columnGap: 14,
                      borderTop: i === 0 ? undefined : "1px solid var(--line)",
                    }}
                  >
                    <span aria-hidden="true" className="it-numeral">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div
                        className="flex items-center justify-between gap-2"
                        style={{ minHeight: 26 }}
                      >
                        <h3 className="t-title-s">{r.t}</h3>
                        {bundle.bookDue[i] ? (
                          <Status tone="alert">
                            By {shortDate(bundle.bookDue[i]!)}
                          </Status>
                        ) : null}
                      </div>
                      {r.m ? <p className="t-caption t-figure">{r.m}</p> : null}
                      {r.d ? <p className="t-body-s c-ivory-2">{r.d}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "Decisions" ? (
        <>
          {/* Visa and entry first, then what is still open, then reading. The
              order is the agent's own (src/trip/page.ts), so the app and the
              published page say the same things in the same sequence. */}
          {p.visa || p.visaGuidance || p.gate?.t || p.gate?.b ? (
            <section className="flex flex-col gap-5 px-6 pt-7">
              <h2 className="t-display-s">Visa &amp; entry</h2>

              {p.visa ? (
                <div className="flex flex-col items-start gap-2.5">
                  <Status tone={VISA_TONE[p.visa.status]}>{VISA_LABEL[p.visa.status]}</Status>
                  <p className="t-body-s c-ivory-2">{p.visa.note}</p>
                </div>
              ) : null}

              {p.visaGuidance ? (
                <GuidanceCard note={p.visaGuidance} icon="passport" max={3} />
              ) : p.gate?.t || p.gate?.b ? (
                <aside className="it-gate flex flex-col gap-3.5 p-[18px]">
                  <div className="flex items-center gap-3">
                    <span className="it-gate-mark">
                      <Icon name="passport" size={20} />
                    </span>
                    <h3 className="t-title-s">{p.gate.t}</h3>
                  </div>
                  <p className="t-body-s c-ivory-2">{p.gate.b}</p>
                </aside>
              ) : null}

              <Sources links={p.gateLinks} />

              {/* With full guidance above, the gate line is kept as the short
                  cost/summary note rather than repeated as a card. */}
              {p.visaGuidance && (p.gate?.t || p.gate?.b) ? (
                <p className="t-caption c-ivory-3">
                  {p.gate.t}: {p.gate.b}
                </p>
              ) : null}
            </section>
          ) : null}

          {p.bookingActions?.length || p.decisions.length ? (
            <section className="flex flex-col gap-5 px-6 pt-14">
              <div className="flex flex-col gap-1.5">
                <h2 className="t-display-s">Still to settle</h2>
                <p className="t-caption">{openCount(p)}</p>
              </div>
              {p.bookingActions?.length ? (
                <div className="flex flex-col gap-3">
                  {p.bookingActions.map((a, i) => (
                    <ActionCard key={`${a.title}-${i}`} action={a} />
                  ))}
                </div>
              ) : null}
              {p.decisions.length > 0 ? <Decisions rows={p.decisions} /> : null}
            </section>
          ) : (
            <section className="px-6 pt-7">
              <p className="t-body-s c-ivory-2">
                No specific choices are listed yet. Tell Tara what you would prefer before you ask
                the Desk to price it.
              </p>
            </section>
          )}

          {p.destinationNotes?.length ? (
            <section className="flex flex-col gap-2 px-6 pt-12">
              <p className="k-eyebrow">For the journey</p>
              {p.destinationNotes.map((n, i) => (
                <Disclosure
                  key={`${n.title}-${i}`}
                  title={n.title}
                  caption={TOPIC_LABEL[n.topic]}
                  icon={TOPIC_ICON[n.topic]}
                >
                  <GuidanceCard note={n} />
                </Disclosure>
              ))}
            </section>
          ) : null}

          {p.why.length > 0 ? (
            <section className="px-6 pt-2">
              <Disclosure title="Why this shape" icon="info">
                <Points points={p.why} />
              </Disclosure>
            </section>
          ) : null}

          <section className="px-6 pt-12">
            {/* Opens Tara with this in the composer. The member sends it. */}
            <Btn
              tone="ghost"
              block
              icon="horizon"
              onClick={() => onAsk(`About "${p.title}": `)}
            >
              Ask Tara
            </Btn>
          </section>
        </>
      ) : null}

      <div className="flex flex-col gap-4 px-6 pt-12">
        {footer}
        <button
          type="button"
          className="k-link c-ivory-2 self-start"
          onClick={onShare}
        >
          <Icon name="share" size={16} />
          Share this itinerary
        </button>
        {p.asof ? <p className="t-caption c-ivory-3">{p.asof}</p> : null}
      </div>
    </div>
  );
}
