# What is pending

Tracked against **TripAgent — integration decisions** (2026-09-22). That doc settled
most of the original list; this one records what is built, what is left, and what is
blocked and on what.

Scope is now transacted bookings with TripAgent as merchant of record.

---

## Done since the decisions doc

| Item | Where |
|---|---|
| **Streaming on the agent turn** (build order 5) | `POST /api/chat/stream` (SSE) + `streamFromAgent` in `src/lib/agentClient.ts`. Text streams token by token; tool-call *starts* stream too, so a plan build says "Building your plan" immediately instead of after 90 seconds. |
| **Quieten the chrome** (build order 6) | Desk header, speaker labels and release card. `voice.ts` untouched. |
| **Fail closed on access codes** | The `'name'` step is deleted from `src/screens/SignIn.tsx`. Unknown well-formed codes are refused. |
| **Cost tracking** (not in the decisions doc; asked for separately) | `src/usage/` in the backend: per-turn ledger at `memory/usage.jsonl`, `GET /api/usage`, operator dashboard at `127.0.0.1:3000/usage`. Operator surface only — not in the traveller app. |
| Backend `displayName`, failed-turn logging | `src/local-app.ts` |
| Desk re-probes a downed backend | `src/screens/Desk.tsx` |
| **Map layer** — 8,069 venues with coordinates, filters, credentials on the pin, save/add | `src/screens/CityMap.tsx` |
| **Practical info as swipeable decks** on a dark band, instead of stacked paragraphs | `src/components/FactCards.tsx` |
| **Service entry points** — hotels by destination, flight and visa enquiry forms that seed the desk | `src/screens/Service*.tsx` |
| **Itinerary lands in the Planner** rather than a separate page | `src/screens/Planner.tsx` |
| **Plan pages re-rendered** so old links pick up the current design | `npm run pages:rerender` |
| Tonal rhythm (`.band-dark`), full-screen search, chat quick-actions removed | across the app |
| **The real catalogue** — 110 destinations, 12 month guides, month×city matrix, and the engine's photography | `npm run catalogue` → `scripts/build-catalogue.mjs` |
| **The catalogue as agent tools** (decisions doc: "a tool it calls rather than context injected on every turn") | `src/tools/catalogue-tools.ts` in the backend |
| **Invented content removed** — the three hand-written cities, the fictional advisors and their stock portraits, the fabricated suites, credits and flight numbers | across the screens |

---

## Done on 25 September

| Item | Where |
|---|---|
| **Server-side members and sessions.** The registry moved off the bundle; the door checks the code on the server and issues a signed session; every member call is scoped to it; guessing is rate-limited | `tripagent/src/desk/members.ts`, `session.ts`, `local-app.ts`; `src/screens/SignIn.tsx`, `src/lib/agentClient.ts` |
| **The operator console** (was item 5). An inbox of booking requests, calls, enquiries and handovers; release a quote (lines, total, hold time, terms, payment link); mark paid; issue and revoke member codes | `tripagent/src/desk/requests.ts`, `ops-page.ts` → `/ops` |
| **The booking path reads the agent's plan** (most of item 4). The request lists the plan's picks, swaps included, with clean names; status, quote and paid are the server's; the Planner's call to action follows the request | `src/screens/BookingRequest.tsx`, `DeskStatus.tsx`, `Settlement.tsx`, `Planner.tsx` |
| **Simulations removed.** No projected savings, 44% progress, "Simulate rate release" or simulated payment | across the booking screens |
| **Terms of this booking**, plus the membership terms, privacy and refund pages from tripagent.vip | `src/components/Terms.tsx`, `/legal/:slug` |
| **Tripsure adapter** (item 3), built and waiting on access | `tripagent/src/tripsure/client.ts`, `GET /api/hotels/rates`, `src/components/LiveRates.tsx` |
| **Deployable.** Public mode with CORS for the app's origin, a Dockerfile for the agent, `vercel.json` for the app, `VITE_AGENT_URL` | DEPLOY.md |
| **Keys kept out of git.** Pre-commit and pre-push secret scans in both repositories; a bundle scan after every build | `scripts/check-secrets.mjs`, `.githooks/` |

---

## 1. Ticketing and payment

A person closes each sale today. The desk attaches a Tripsure/Razorpay payment link to the quote, the member pays there, and the desk marks it paid. That is honest and it works.

Still open:
- **Automating it.** Hosted checkout from the quote, and a payment webhook that marks paid without a person.
- **The ticketing decision.** Ticket at once and refund from margin, or hold. This decides how the improvement window works.

The integration decisions doc recommends option 3 composed with 1.

## 2. Storage

The registry, requests, plans and memory are JSON and markdown on the agent's disk, which is why the agent needs a persistent volume (DEPLOY.md). For the first members that is enough and easy to back up. Move to Postgres when there is more than one agent instance: the `_desk` modules and `memory/store.ts` are the only readers and writers.

## 3. Tripsure

**Blocked on Tripsure, not on code.** The preprod gateway refuses this machine's IP ("not authorized to perform execute-api:Invoke"): it admits allow-listed IPs only. Its Swagger is behind the same gate.

1. Ask Tripsure to allow-list the agent host's static IP, and this laptop (202.83.17.149) for testing.
2. Run `npm run tripsure:check` in the agent. It prints Tripsure's own validation message if the listing body needs adjusting.
3. Once hotels come back, the "Rooms for your dates" block on every city goes live. There is no other change needed.

Still to build after that:
- the `priceCheck` step, so a quote can cite Tripsure's token;
- flights, which run through a separate service (`/flights/search`).

## 4. `TripPlan` as the canonical itinerary

Mostly done: the Planner renders the agent's plan, and the booking path reads it. What is left:

- **Freeze a snapshot at request time.** Today the request stores the component names and the plan key; a later plan edit does not change the request, but the full plan is not copied.
- **Persist directives to the member record.** Today they travel with each request.

## 5. Handover to WhatsApp

The member's number reaches the desk as a request, and the advisor messages from the business number. Automated sending through the skeleton's Meta Cloud adapter (`src/channels/whatsapp.ts`) is not wired.

## 6. Notifications

The app refreshes a request every 15 seconds while it is on screen. There is no push or email yet when a quote is released. Add them together with WhatsApp.

## 7. Named advisors

The desk is "Your advisor" until real people are assigned. The request model has room for an `assignedTo`; a portrait and a name should appear only when they are true.

---

## Cost: the one finding worth acting on

Measured from the ledger, not estimated.

**Nothing is cached.** 92% of all tokens billed so far are uncached input, at
12–17k input tokens *per turn* — roughly $0.06–$0.08 before the traveller has typed
anything, and it grows as their memory does.

The cause is architectural: the profile is rebuilt fresh every turn by design
(`src/memory/profile.ts`), which changes the system prompt every turn and defeats
prompt caching, since caching is a prefix match. The tool definitions and the
stable part of the prompt could still be cached ahead of the volatile profile.

This is the single largest cost lever available and it is not on the build order.
At pilot volumes it is noise; at a few thousand turns a day it is not.

Two smaller ones: the `Oct 14 – 18` plan build burns ~16k output tokens on the tool
input, and a failed turn still bills for everything generated before it failed —
both are visible per-turn in the dashboard.

---

## Images — now real, one thing left

Unsplash is gone. Every image in the app is the sourcing engine's own library,
resized into `public/img/` by `npm run catalogue`: 110 destinations and 12 months,
each at 720px and 1400px, ~56 MB on disk.

What is left is **where they are served from**. They sit in `public/` today, which
is fine locally and wrong in production. Every reference already goes through
`cityCard()` / `cityHero()` / `monthCard()` / `monthHero()`, so pointing them at a
CDN is setting `VITE_IMAGE_CDN_BASE` — no screen changes.

One thing to check before they are public: the backend handoff bundle states that
**image rights still need field-level arbitration** and that all its records are
`publishable=false`. The photography used here comes from the engine's published
site rather than that bundle, so it is a different question — but it is worth
confirming the licence covers app distribution, not just the website.

Still missing for maps: `lat`/`lng`. The sourcing bundle has coordinates on its
records (`lat`, `lon`, with a resolution method and confidence), so the join is
available when the map is built.

---

## Unchanged, still just work

Maps library plus `lat`/`lng` on `Stay` and `Experience`; dark mode variants over
the existing tokens; a CMS behind the `Destination` shape; filling out Amman & Petra
and Udaipur; service worker and manifest icons; screen-reader pass and contrast
audit over white-on-photography; analytics; moderation and rate limiting on both
sides.

Tests: the backend has six passing. The app has none — `isValidCode`,
`nameMatchesCode`, `countdown` and `toChatMessages` are the natural first targets.

Still genuinely undecided, and fine to leave: access-code expiry and single-use
semantics, and whether the revenue model stays markup-only.

Not engineering, but real: merchant-of-record for travel in India can pull in
seller-of-travel registration, IATA/TIDS accreditation, GST and TCS treatment on
tour packages, and refund-protection obligations. Worth a qualified conversation
before item 6 is built.
