# Going live

TripAgent is two pieces, and they go to two places.

| Piece | What it is | Where it runs | Why there |
|---|---|---|---|
| **The app** (this folder) | The member PWA: static files | **Vercel** | Static hosting and a CDN for ~100 MB of photography |
| **The agent** (`Chatbot_v1/tripagent`) | Sign-in, the desk, Tara, plan pages, Tripsure | **Render** (Singapore, 1 GB disk) | Needs a persistent disk (member memory) and long-running replies — a plan takes up to two minutes. A Mumbai host with a static IP is only needed once Tripsure live rates are switched on |

The agent cannot run on Vercel functions as it stands. Its memory is files on disk, which Vercel does not keep between requests, and a plan takes longer to build than a function comfortably allows.

```
member's phone ──https──▶ app (Vercel)
      │
      └──https──▶ agent (Mumbai, static IP) ──▶ Anthropic (the AI)
                        │                      └▶ Tripsure (rates), from the allow-listed IP
                        └── /ops  the desk's inbox, password-protected
```

## Keys never touch git

- Keys live in two places only: the local env files (`Chatbot_v1/tripagent/.env` and this folder's `.env.local`), and each host's environment settings.
- Both repositories ignore every `.env*` file except `.env.example`, which holds names only.
- `npm install` switches on git hooks in both repositories:
  - A **pre-commit** hook refuses any commit that contains a key: Anthropic, OpenAI, Google, Razorpay, Meta, private keys. It also refuses any value copied from your local env files, which is what catches the Tripsure key.
  - A **pre-push** hook checks everything again before it leaves the machine.
- The app's `npm run build` also scans the built bundle. The browser's Google Maps key is the only key allowed there, because a Maps browser key is public by design.
- To check by hand, run `npm run check:secrets` in either repository.

If a key is ever committed by accident, rotate it at the provider first. Rewriting git history does not un-leak it.

## 1. The agent, on Render

Chosen host: **Render**, using the blueprint the agent package ships
(`Chatbot_v1/tripagent/render.yaml`). One always-on web service, a 1 GB disk for
member memory, Singapore (Render's closest region to India). About $7.25 a month.

Render was chosen over a Mumbai host because Tripsure live rates are **not
connected yet** — the supplier rejected the last rate check — so the static
outbound IP that Tripsure's allow-list needs is not binding today. See
*Moving to Mumbai for Tripsure* below for when it becomes binding.

### Steps

1. Put `Chatbot_v1/tripagent` in its own **private** GitHub repository.
   `npm install` first: it switches on the hooks that refuse to commit a key.
2. In Render: **New → Blueprint → pick that repository.** It reads `render.yaml`.
3. Render asks for **`ANTHROPIC_API_KEY`**. Paste it. It is the only secret you
   have to type; `SESSION_SECRET` and `OPERATOR_KEY` are generated for you.
4. Deploy. First build is about three minutes.
5. Open `https://<service>.onrender.com/health`. It must say
   `{"ok":true,"localOnly":false,"modelReady":true,…}`. `localOnly:false` is the
   one that matters: it means public mode came up.
6. Note the service URL — the app needs it as `VITE_AGENT_URL` in step 2.

### What is already set for you

The `Dockerfile` sets these, so they are not yours to configure:

| Variable | Value | Why it matters |
|---|---|---|
| `PUBLIC_MODE` | `true` | Drops the localhost guard and turns on real sign-in |
| `MEMORY_ROOT` | `/data/memory` | **On the disk.** The default `./memory` would be wiped on every deploy |
| `TZ` | `Asia/Kolkata` | Member days, and the nightly run, are IST days |
| `CITY_IMAGES_ROOT` | `/app/assets/city` | The destination photography bundled with the package |

Render sets `RENDER_EXTERNAL_URL` itself, which the agent uses as `PUBLIC_BASE`,
so itinerary links point at the service without you setting anything.

`render.yaml` pins `APP_ORIGINS` to `https://app.tripagent.vip`. The agent refuses
cross-origin calls from anywhere else, so if the app's domain ever changes, this
must change with it — scheme and host, no trailing slash, no path.

The server refuses to start in public mode without `SESSION_SECRET`,
`OPERATOR_KEY` and an https `PUBLIC_BASE`, so a misconfigured deploy fails loudly
rather than coming up half-working.

### The desk

`https://<service>.onrender.com/ops` — user `desk`, password is `OPERATOR_KEY`
from Render → the service → **Environment**. Issue member codes there.

### Moving your existing data across (optional)

The laptop's members and conversations are in `Chatbot_v1/tripagent/memory/`.
Download from the local desk at `http://127.0.0.1:3000/ops` → **Download all
data**, then unpack into `/data/memory` from Render's **Shell** tab. It is
personal data: move it over the shell, never through git or chat. Starting the
online server fresh is also fine.

### Moving to Mumbai for Tripsure (later)

Tripsure's gateway admits only allow-listed IPs, and a plan can only quote a
payable price from Tripsure. When you are ready:

- Either turn on Render's static outbound IP and have Tripsure allow-list it,
- or move the same Docker image to Lightsail/EC2 in `ap-south-1` with an Elastic
  IP, mount a volume at `/data`, and copy `/data/memory` across.

Then set `TRIPSURE_BASE_URL`, `TRIPSURE_TENANT_ID` and `TRIPSURE_API_KEY`, and run
`npm run tripsure:check` on the host. Until then the app says live rates are not
switched on for a city, and the Desk quotes by hand — which is honest and works.

## 2. The app on Vercel

1. Push this folder to its own GitHub repository (the hooks check it on the way).
2. In Vercel, create a new project from that repository. Vercel picks up the Vite framework, build command and output directory from `vercel.json`.
3. Under **Settings → Environment Variables**, set:

| Variable | Value |
|---|---|
| `VITE_AGENT_URL` | `https://<your-service>.onrender.com` — the URL from step 1.6, https, no trailing slash |
| `VITE_GOOGLE_MAPS_API_KEY` | the browser Maps key |
| `VITE_WHATSAPP_NUMBER` | the Desk's WhatsApp Business number, digits only (optional; empty hides the button) |
| `VITE_ADVISOR_NAME` | the advisor's real name (optional; empty makes the app speak as "the Desk") |
| `VITE_ADVISOR_ROLE` | e.g. `Your travel advisor` |
| `VITE_ADVISOR_CITY` | `Bengaluru` |
| `VITE_ADVISOR_PHONE` | the advisor's direct number, as a member should dial it |
| `VITE_ADVISOR_TRAVELLED` | cities that advisor has actually travelled, comma separated (optional) |

The advisor variables are what turn "the Desk" into a named person on the door, the
membership card and the Desk screen. Leave them empty until a real person is assigned:
the app then says "the Desk", which is true, rather than inventing someone.

4. Deploy, then add the domain (e.g. `app.tripagent.vip`).
5. In **Google Cloud → APIs & Services → Credentials**, add the production domain to the Maps key's HTTP-referrer restrictions: `https://app.tripagent.vip/*`. Today it allows localhost only.

The generated catalogue, photography and city data are committed. Vercel does not need the sourcing engine; re-run `npm run catalogue` locally when the guides change, then commit.

### Sending it as a link

The app ships as a web app first, so the link *is* the product until there is a store
listing. It is an installable PWA:

- **Send `https://app.tripagent.vip`.** It opens in any browser, on any phone, with no
  install and no download.
- **On Android**, Chrome offers "Install app"; the app then opens without browser chrome,
  with its own icon.
- **On iPhone**, Safari installs it from **Share → Add to Home Screen**. iOS gives no
  install prompt, so the app explains the step itself.
- **Offline**, the service worker (`public/sw.js`) serves the shell, the photography and
  the city guides from the last visit. It never caches anything under `/agent`: a member's
  session, requests, quotes and the Concierge are always live, because a stale price or a
  stale request status would be a lie.
- An update is picked up on the next open, never mid-sentence.

Two things to get right on the host, both already set in `vercel.json`:

> **Why `/sw.js` is served `max-age=0, must-revalidate`:** the service worker decides
> what every later visit is allowed to cache, so it must never be served from cache
> itself, or a member can be pinned to a stale build indefinitely. The manifest changes
> rarely but must not be sticky either. (This note lives here because `vercel.json` is
> JSON — it has no comments, and Vercel rejects unknown properties on a header rule.)

- `/sw.js` and `/manifest.webmanifest` must be served from the site root, uncached or
  briefly cached, so an update is actually seen.
- The SPA rewrite must not swallow them — the existing rule already excludes
  `assets/`, `img/` and `data/`; `sw.js` and the manifest are real files and are served
  directly.

## 3. Before the first member

- [ ] `https://<service>.onrender.com/health` answers `{"ok":true,"localOnly":false,"modelReady":true,…}`.
- [ ] `/ops` asks for a password and opens with user `desk` and the `OPERATOR_KEY`.
- [ ] App up on `https://app.tripagent.vip`; sign in with a real code issued from `/ops`.
- [ ] The city map draws — if it does not, the Maps key is not yet allowed on the domain.
- [ ] Ask Tara for an itinerary end to end: it builds, opens, and the Decisions tab shows
      visa guidance, what is still to settle, and the destination notes.
- [ ] Send one itinerary for a price. It appears at `/ops`: release a quote with a real
      payment link, mark it paid, and the app shows "Paid".
- [ ] Someone is watching `/ops` during business hours. Nothing in the app books or charges
      by itself; a request that no one answers just sits there.
- [ ] **Confirm the service worker registers on the real domain.** Open
      `https://app.tripagent.vip` in Chrome → DevTools → **Application → Service Workers**:
      it should show `sw.js` as *activated and running*. This could not be verified
      locally — the embedded browser used during development does not support service
      worker registration at all (a missing script and the real one fail identically), so
      the first real check is on the deployed domain. The file itself is correct: it is
      served from the site root as `text/javascript`, is valid JavaScript, and `vercel.json`
      both excludes it from the SPA rewrite and serves it `max-age=0, must-revalidate`.
      If it does not register, offline and install still need fixing — nothing else does.
- [ ] Install it once on an iPhone (Share → Add to Home Screen) and once on Android
      (Chrome → Install app), and open both with the phone in aeroplane mode.

### Known, and deliberately not blocking

- **Tripsure live rates are not connected.** The supplier rejected the last rate check, so
  the Desk quotes by hand. The app says live rates are not switched on for a city rather
  than inventing a number.
- **Flight inventory is not connected.** Flight choices are provisional, with honest price
  placeholders.
- **WhatsApp is not connected.** `VITE_WHATSAPP_NUMBER` empty hides the button rather than
  linking nowhere.
- **The membership fee is not in the terms.** Membership is free during the launch period,
  and the terms now say the fee is written to you before it ever applies, with nothing
  charged automatically. Put the real figure in `public/data/legal.json` — the terms, the
  fee-covers clause and the refund clause — **before you charge anyone**, and have it read
  by whoever signs off your terms.


The profile supports verified WhatsApp chat with Tara. See [WhatsApp integration](docs/WHATSAPP.md) and configure ACL/Supabase in the backend before enabling it.
