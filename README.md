# TripAgent

A mobile-first PWA for a by-invitation travel house. The app opens on the member
rather than on a catalogue, helps them decide, lets them shape a journey with the
Concierge, and closes it either on a call with the Desk or against a quote the
Desk has released.

The interface is **Nocturne**: warm obsidian, ivory type, cinematic photography
under directional veils, glass controls, one champagne accent for state and for
the single commit action, and a paper register for the documents that carry money.
[DESIGN.md](DESIGN.md) is the system; `src/styles/nocturne.css` is the same
stylesheet the design canvas uses, so the app and the design stay one thing.

## Running it

**To present or try it end to end**, one command builds the production app and hosts it with the agent:

```bash
npm run present          # app http://localhost:4173 · desk http://127.0.0.1:3000/ops
```

[PRESENTATION.md](PRESENTATION.md) is the start-to-end walkthrough, and [DEPLOY.md](DEPLOY.md) covers going live (Vercel for the app, a static-IP host for the agent).

**To develop**, there are two processes: the agent backend, and this front end.

```bash
# 1. the agent backend  (Chatbot_v1/tripagent)
cd ../Chatbot_v1/tripagent && npm install && npm run local      # 127.0.0.1:3000

# 2. this app
npm install
npm run catalogue     # pull destinations + images from the sourcing engine
npm run dev                                                      # localhost:5173
```

Sign in with `EV2410VC`, `RK4821MP` or `AK1987RS`. The development build also offers a "fill the test code" link; production builds do not.

```bash
npm run build          # typecheck + production bundle + a secrets scan of the bundle
npm run lint           # typecheck only
npm run check:secrets  # what git would commit, scanned for keys
```

## Sign-in

Access is by an 8-character code in the shape `AA1234BB`: two letters, four numerals, two letters. The **leading two letters are the member's initials** (`EV2410VC` was issued to Eleanor Vance), and the trailing pair is a check group.

- **The server holds the registry** (`Chatbot_v1/tripagent/memory/_desk/members.json`), not the app. A list of codes and names in the bundle would be readable by anyone.
- `POST /api/session` checks the code and returns a signed 30-day session. Every later call carries it, and the server reads who the member is from the session, never from the request.
- **It fails closed.** A well-formed code that is not on file is refused, and so is anyone at all while the desk cannot be reached. Ten misses in ten minutes locks the door for that client.
- **The desk issues and revokes codes** at `/ops`, or with `npm run member -- issue "First Last" "Private Tier Black"`. A revoked code's sessions stop working at once.

## The flow

| Route | Screen | What it does |
|---|---|---|
| `/signin` | The door | Access code in eight engraved cells, checked by the server → recognition, with the membership card |
| `/onboarding` | Five questions | Pace, dining, lodging, party, occasion |
| `/` | Discover | The member first: the greeting, a live request if there is one, the Concierge, three finite proposals drawn from what they saved, the month at its best, their journeys, what we handle |
| `/map` | The world | All 110 destinations by region; tap a pin for the guide (code-split: the outlines load only here) |
| `/month/:no` | Month guide | The scrubber across twelve months, who is at their best, where it is the right time, the Indian-calendar angle, flights and visas |
| `/city/:slug` | Destination guide | Our take first, the month ribbon, stay / do / eat / after dark as index cards with credentials, live rooms for your dates (Tripsure), the day shape, neighbourhoods, what's on, practical |
| `/city/:slug/map` | On the ground | The guide's addresses on a dark Google map; filters keep pan and zoom |
| `/saved` | Saved | Saved destinations and addresses; the Concierge reads them |
| `/journeys` | Journeys | Upcoming, being shaped, past; the hold clock on a released quote; what the next weeks ask of you; the request ledger |
| `/journeys/:key` | Itinerary | One document: the shape, flights and stays with alternatives in a sheet, what it costs, the days, the decisions |
| `/concierge` | The Concierge | The AI: a proposal rather than an empty box, streamed replies, a watchable build, real dictation where the browser has it |
| `/plan` | Plan viewer | Opens a generated plan page inside the app |
| `/booking-request` | Request to book | Exactly what was chosen, travellers, a note for the Desk, the terms → sent to the Desk |
| `/status` | Where it stands | Each request as the Desk holds it: with the Desk, being priced, price ready, paid — and whether the last poll actually landed |
| `/settlement` | The quote | A letter on paper: every line, the total, the hold clock, cancellation terms; approve and pay through Tripsure's secure link, or on a call |
| `/handover` | WhatsApp | After payment: the member's number goes to the Desk |
| `/desk` | The Desk | Request a call at a chosen time, with the journey attached and a note |
| `/services` | Services | Flights, stays, visas and anything else; enquiry forms go to the Desk |
| `/membership` | Membership | The card, the Desk, what the Concierge knows, requests, the house and its terms, sign out |
| `/legal/:slug` | Terms | Membership terms, privacy and refund of fees, from tripagent.vip; readable signed out |

Every route except `/signin` and `/legal/*` requires a signed-in member. The rooms were renamed in the redesign, so `/wishlist`, `/planner`, `/account` and `/advisor` redirect to their new addresses.

## The desk

A member's booking request, call request, enquiry or WhatsApp handover lands in the desk's inbox at `/ops` on the agent. The inbox is password-protected on the public server, and open on 127.0.0.1 locally.

- **A booking** moves *open → working → quoted → paid*. Only the desk moves it forward.
- **The quote** is the one price a member can pay. It lists every line, the total, how long it is held, the cancellation terms, and the payment link from Tripsure/Razorpay.
- **When the desk marks it paid**, the trip becomes *booked* and its reminders switch on.

The app polls every 15 seconds while a request is on screen. Nothing in it states a price that is not on a quote.

## The agent backend

The chat at `/desk` is the TripAgent agent in `Chatbot_v1/tripagent`. It owns the
voice, the traveller's git-tracked memory, the research tools and the shareable
plan pages. This app is its front end; it does not reimplement any of that.

- **Transport.** Locally the browser reaches the agent through a Vite proxy at
  `/agent` (see `vite.config.ts`), and the agent stays a local-only portal. Deployed,
  `VITE_AGENT_URL` points at the agent's https address; the agent runs in public mode
  and accepts only the origins in `APP_ORIGINS`. See [DEPLOY.md](DEPLOY.md).
- **Identity.** The member's access code is their traveller id, and it is stable
  across devices, which is what makes memory continuous. The server takes it from
  the signed session, never from the request body, so one member cannot read
  another's file.
- **Streaming.** `POST /agent/api/chat/stream` delivers the turn as server-sent
  events. Conversational replies appear token by token; when the model reaches for
  a tool the app shows what it is doing instead — "Building your plan. This can
  take a minute or two." A plan build runs 75–120 seconds, and that used to be a
  dead screen. The non-streaming route remains as a fallback.
- **Replies.** The final event carries `{ messages: string[] }`. When a plan is
  built, three of them arrive together — an introduction, the bare link, and an
  invitation. `src/lib/agentClient.ts` collapses that trio into one release card
  carrying the link, and leaves ordinary conversation as ordinary messages.
- **The catalogue is a tool, not context.** The agent reaches the 110 destinations
  through `where_to_go`, `find_destination` and `get_destination_guide` rather
  than having them injected into every turn — they would not fit in a prompt, and
  most messages never mention a destination. So a question like "we can only
  travel in March, where is good?" is answered from the reviewed library.
- **Plan pages** are self-contained HTML built by the backend, with their own
  stylesheet. `/plan` fetches one and shows it intact in a sandboxed frame rather
  than re-rendering it in the atelier's design language — it is the artefact the
  traveller keeps and forwards, and a second rendering would drift from it.
- **Failure is visible.** The header says `Live` or `Offline sample`, the footer
  says whether memory and sourced research are on, and a failed turn keeps the
  message with a retry rather than vanishing. While the desk is down the app keeps
  probing, so a restarted backend is picked up without a reload.
- **Cost is tracked, but not here.** The backend prices every turn into
  `memory/usage.jsonl` and serves an operator dashboard at
  `127.0.0.1:3000/usage`. That is deliberately not a customer surface and this app
  neither links to nor ships it.

### Changes to the backend

All additive; the portal that ships with the skeleton is unaffected and its six
tests still pass.

- `/api/chat` accepts an optional `displayName`, so a generated page reads "Made
  for Eleanor Vance" rather than "Made for EV2410VC".
- `/api/chat/stream` — the same turn as server-sent events.
- `src/usage/` — per-turn cost ledger, `GET /api/usage`, and the operator
  dashboard at `/usage`.
- The silent `catch` around a failed turn logs the cause; the traveller still sees
  the same generic message.

`src/agent/voice.ts` is untouched, as decided.

## The chrome

The desk used to be dressed in an atelier register — *Bespoke dossier №*, *Atelier
intelligence*, *Telemetry synced*, a named advisor, a destination the live agent
knew nothing about. That has come down to meet the voice.

The reason is not taste. The atelier register cannot hold a caveat: "your dossier
has been updated accordingly" has nowhere to put *four working days, Emirates'
published figure, the ICP publishes none*. The citation layer only reads naturally
in the plain voice. *Telemetry synced* was also claiming a sync that does not
exist — with money on file that is a false statement, not a flourish.

What is left in the header is true: whether the desk is answering, and the docket
reference when one is actually open.

## The catalogue

All destination content comes from the **sourcing engine**
(`tripagent-sourcing-engine`). Nothing in this app is authored by hand: 110
destinations and 12 month guides, each already written and reviewed there.

```bash
npm run catalogue     # pulls content + images out of the engine
```

`scripts/build-catalogue.mjs` reshapes and trims — it never authors. It writes:

| Output | What |
|---|---|
| `src/data/catalogue.generated.ts` | The index every screen needs at once — 110 city summaries with their 12-month verdict, and the 12 month guides. 169 KB, bundled. |
| `public/data/city/<slug>.json` | The full guide — stay / do / eat / after dark with credentials, the day shape, neighbourhoods, what's on, the practical rows. Fetched when a city is opened, never bundled. |
| `public/img/city/<slug>-{card,hero}.jpg` | The engine's photography, resized to 720px and 1400px. |
| `public/img/month/<nn>-{card,hero}.jpg` | The same for the twelve months. |
| `<agent>/data/catalogue.json` | The agent's copy — summaries and the month matrix, no images. |

**The month matrix is the spine.** Every city carries twelve verdicts —
`peak`, `shoulder` or `avoid` — taken from the engine's own `wm2`/`wm1`/`wm0`
tiers. That is what makes "when are you free, we show you where" a lookup rather
than a guess, and it drives the home screen, the month pages and the strip on
each city.

Images are referenced through `cityCard()` / `cityHero()` / `monthCard()` /
`monthHero()` in `src/lib/catalogue.ts`, so moving them to a CDN is one
environment variable (`VITE_IMAGE_CDN_BASE`).

To re-pull after the engine changes, run `npm run catalogue` again. Existing
derivatives are left alone, so it is cheap to re-run.

## Architecture

- **React 18 + Vite + TypeScript**, Tailwind 3, React Router 6.
- **State** is one context in [`src/context/store.tsx`](src/context/store.tsx),
  persisted to `localStorage` under the `tripagent:` prefix. Nothing leaves the
  device yet — every backend call is a seam, listed in
  [INTEGRATION.md](INTEGRATION.md).
- **Design system** is [`src/styles/nocturne.css`](src/styles/nocturne.css) —
  tokens on `:root`, then the `k-*` / `t-*` classes — mirrored for utilities in
  `tailwind.config.js`. The vocabulary is [`src/components/ui.tsx`](src/components/ui.tsx)
  and the chrome is [`src/components/Shell.tsx`](src/components/Shell.tsx). Reach
  for those before writing markup, and see [DESIGN.md](DESIGN.md).
- **Icons** are inline SVG in [`src/components/icons.tsx`](src/components/icons.tsx)
  on a 24px grid at 1.5px. There is no icon font, so no flash of ligature text.
- **Content** is data, not markup, and it is generated rather than written — see
  The catalogue above. Adding a destination is a change in the sourcing engine
  followed by `npm run catalogue`, never a change to a screen.
- **Images** render through `<Plate>` / `<Photo>`, which carry the veils, fall
  back to a quiet obsidian surface if a frame fails, and ask the element itself
  whether it has decoded — a cached photograph can finish before React attaches
  its `onLoad`, and used to keep its shimmer for the rest of the session.
- **The two map screens are code-split.** Between them they carry the world's
  country outlines and the Google Maps loader; they load when a map is opened,
  not when the app does.

## The plan page

The page the agent builds and drops into chat is rendered by the backend
(`src/trip/page.css.ts`), and it now uses this app's tokens — paper and ink, the
single wine-red accent, hairlines, zero radius. Opening the link from the app
should not feel like leaving it.

**Options are one pick and a drawer.** The schema still requires three real
choices per flight and per stay, with reasons, trade-offs and prices, and all
three are still on the page. What changed is the reading order: the recommendation
gets its name, the comparable details, one sentence and the price; the two
alternatives fold into a `<details>` drawer with a line each. Three equal columns
of argument is how a page gets closed without being read.

## Design rules worth keeping

- One italic Bodoni phrase per screen (`<Sig>`), never a formula on every headline.
- Champagne means state, or the one commit action. Never decoration.
- Photography carries the colour; veils are directional, never a flat wash.
- One primary action per screen; at most about three ideas in the first 844px.
- No prices anywhere except on a quote the Desk has released — a product rule,
  not a placeholder — and no named advisor until a real one is assigned.
- Failure is written as hospitality, and never asks a member to restart a server.
- The full system, including the type scale and the voice, is in [DESIGN.md](DESIGN.md).
