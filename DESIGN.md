# Nocturne — the design system

The app and the design canvas share one stylesheet: [`src/styles/nocturne.css`](src/styles/nocturne.css)
is the same file the artboards link as `kit.css`. Change a token there and both move.

## The direction, in a paragraph

Two grounds, cinematic full-bleed photography with directional veils, glass controls
floating over imagery, and **one** champagne accent reserved for state and for the
single commit action. **Obsidian** carries arrival, photography and the Concierge;
**ivory** carries the lists, the documents and the things a member acts on. Display
type is **Fraunces**, used only for moments; all working text is **Jost**. Two
families, never a third — codes and clocks fall back to a system mono stack, which
is a utility rather than a brand face.

## Tonal rhythm — the two registers

An app held at one tone all the way down has no composition. Pale throughout, it
reads as a form; dark throughout, it reads as a void. The house alternates, and
which ground a screen sits on is a statement about what that screen is for:

| Obsidian | Ivory |
|---|---|
| The arrival sequence: door, welcome, the five questions | Every screen inside the app |
| All chrome — the tab bar, the dock, Tara's composer | Discover below its hero, City, Month |
| Every photograph, everywhere | Journeys, Saved, Membership, the Desk |
| Statement bands, the membership card, the member's own words | The itinerary, the quote, Services, legal |

Whole screens no longer flip between the two. Once a member is through the
door, the ground is ivory everywhere and obsidian does three jobs: **chrome**,
**photography** and **punctuation**. That is what keeps the chat and the
itinerary it produces reading as one product rather than two.

Mechanically this is **one** system, not two. `.k-light` re-declares the tokens —
`--ink-*`, `--ivory-*`, `--line*`, `--champagne*`, the status hues, glass and
shadow — so every `k-*` and `t-*` component re-tones on its own and no screen's
markup changes. `<Screen tone="light">` is the whole call site. `.k-dark` re-asserts
obsidian, so a dark band can sit inside a light screen.

Three rules follow from that:

1. **A photograph is always obsidian.** `.k-light .k-photo` re-asserts the dark
   tokens, so type over an image stays light-on-dark whichever ground it is laid on.
   Where a title sits *beside* a photograph as a sibling rather than inside it, that
   wrapper carries `k-dark` itself — the itinerary hero does this.
2. **A control on a photograph is glass in both registers.** An opaque white disc
   over an image reads as a consumer app.
3. **Chrome is obsidian on both grounds.** The tab bar, the dock and Tara's
   composer carry `k-dark` themselves. They are single floating objects a
   member learns the position of, not parts of the page they happen to be over
   — and a 72%-black capsule over ivory is a grey smear with unreadable labels.
4. **Only literals need correcting.** Anything written as a token re-tones for free;
   the short correction block at the foot of `nocturne.css` exists solely for the
   handful of components that hard-code a tone (the primary fill, the composer, the
   neutral status pill).

The accent deepens to `#8A6A3A` on ivory so it still holds 4.9:1, and the status
hues invert in lightness rather than changing hue. The membership card and the seal
keep their own metal in both registers — that is what makes them read as objects
rather than as panels.

The previous system was an editorial website inside a phone frame: stacked full-width
bands, an eyebrow-rule-headline formula repeated 24 times, zero radius everywhere, one
shadow, Material Symbols, and three chrome layers at the bottom of every screen. What
replaced it is app grammar — cards, sheets, segmented controls, a floating tab bar —
with the photography doing the emotional work.

## Tokens

All tokens are CSS custom properties on `:root` in `nocturne.css`. Tailwind mirrors
them in `tailwind.config.js` for utility classes.

| Role | Token | Value |
|---|---|---|
| Ground | `--ink-0` … `--ink-4` | `#0A0A0B` `#111112` `#17171A` `#202023` `#2A2A2E` |
| Text | `--ivory` / `--ivory-2` / `--ivory-3` | `#F2EDE4` / 74% / 56% |
| Hairlines | `--line` / `--line-2` | ivory at 10% / 18% |
| Accent | `--champagne` / `--champagne-2` | `#D8C29A` / `#B99B6B` |
| Document | `--paper` / `--paper-ink` / `--paper-ink-2` / `--paper-accent` | `#F4EFE6` / `#191613` / `#5E574E` / `#8A6A3A` |
| Status | `--sage` / `--amber` / `--rose` | `#9CC5AD` / `#E6B071` / `#E58C7B` |

Contrast: ivory on ink-0 is ~17:1, ivory-2 ~9:1, ivory-3 ~5.6:1, paper-ink-2 on paper
~5.6:1. Nothing in the system sits below 4.5:1. Status colours differ in lightness as
well as hue, so they are not distinguished by colour alone.

**The accent has one job.** Champagne means *state* (price ready, our choice, at its
best, live) or *the one commit action* on a screen. It is never decoration, and never
fills more than one button per screen.

## Type scale

| Class | Face | Size / line | Use |
|---|---|---|---|
| `t-display-xxl` | Fraunces 400 | 50/54 | A hero moment: the door, a greeting |
| `t-display-xl` | Fraunces 400 | 41/45 | Screen hero titles over photography |
| `t-display-l` | Fraunces 400 | 34/39 | Large titles of sub-screens |
| `t-display-m` | Fraunces 400 | 27/33 | Card hero titles, the quote total |
| `t-display-s` | Fraunces 500 | 22/29 | Section titles |
| `t-title` / `t-title-s` | Jost 500 | 17/22 · 15/20 | Card and row titles |
| `t-body` / `t-body-s` | Jost | 16/24 · 14/21 | Body |
| `t-caption` | Jost | 13/18, ivory-2 | Metadata |
| `t-label` | Jost 500 | 12/16, .14em caps | Small section labels |
| `t-mono` | system mono | 12/16 | References, codes, times |

Fraunces is the face from the itinerary reference, carried into the app: a higher-
contrast, chunkier serif with a true drawn italic rather than a slanted roman, which
matters because the accent device below leans on that italic. It is heavier than
Cormorant at the same size, so the whole scale came down a step when it landed.

### The italic accent device — the brand's signature move

Every display headline is set in ivory except **one phrase**, which is italic and in
the champagne accent. That phrase carries the emotional payload of the sentence.

- Someone who travels *with* you.
- Good evening, *Eleanor.*
- The world, *within reach.*
- You bring the *why.* We handle the *how.*

The rules: exactly one italic phrase per headline; it is the last one to three words,
or the object of the sentence, **never the first word**; never italicise a whole
headline; never put the accent colour on a non-italic word. `<Sig>` renders it, and
`.t-italic` carries both the italic and the colour, so it cannot drift. On paper
surfaces it becomes `--paper-accent` automatically. `.t-italic-plain` exists for an
italic that is *not* the accent — a quotation, a tagline — so the two never collide.

## Layout

- Phone measure: content capped at 480px and centred (`<Screen>` does this).
- Side gutter 24px (`px-6`). Rails start at the gutter and bleed off the right edge.
- Rhythm: 48px between sections, 56px after a hero, 20px header→content, 12px between cards.
- Radii: cards 18–20px, sheets 28px top, pills 999px, the membership card 18px.
- Top bars sit at `max(54px, safe-area + 12px)`; the tab bar floats 20px from the bottom
  and scrolling content leaves 132px of clearance.
- Touch targets ≥ 44px. Nothing smaller than 11px, labels 12px, body 16px.

## Components

`src/components/ui.tsx` is the vocabulary: `Btn` `IconBtn` `Chip` `GlassChip` `Cred`
`Status` `Card` `Paper` `Photo` `Plate` `Rail` `Sheet` `Seal` `Horizon` `Track` `Field`
`Empty` `Headline` `Sig` `SectionHead` `Divider` `Band` `Clamp` `Disclosure`
`AgentMark` `Icon`.

`src/components/Shell.tsx` is the chrome: `Screen` `TopBar` `Dock` `TabBar`.

`src/components/icons.tsx` is the icon set — inline SVG on a 24px grid, 1.5px stroke,
drawn to sit beside Geist. There is no icon font, so no flash of ligature text. Material
Symbols names from the old code are aliased onto the new glyphs.

Notable materials, all in `nocturne.css`:

- `.k-glass` / `.k-glass-strong` — controls over photography.
- `.k-veil-top` / `.k-veil-bottom` / `.k-veil-card` — directional legibility veils.
  Never a flat wash over a whole photograph.
- `.k-light` / `.k-dark` — the two grounds; see Tonal rhythm above.
- `.k-paper` — the document register.
- `.k-metal` — the membership card as an object.
- `.k-sweep` — the Concierge's signature light while it works.

## Photography

- Cards are cut at 1080px (q80), heroes at 1600px (q82), from the sourcing engine's
  2560px originals. Never upscaled. Re-cut with `npm run images`.
- Anything with text over it uses `<Photo>`, which carries the veils.
- There are no photographs of individual hotels or restaurants. Venues are drawn as
  typographic index cards; a city photograph beside a stay is captioned with the city,
  so it never implies it is the hotel.

## Voice

British English, literate, restrained, specific. Short.

The AI is **Tara**. The people are **the Desk**, signed "— The Desk, Bengaluru".
There is no named advisor until a real one is assigned, and the app never invents one.

Tara's name always travels with the `AI` mark (`<AgentMark>`), because the house
sells access to people and the one thing it cannot afford is a member believing a
person wrote what a model wrote. Tara shapes; the Desk books, holds and prices.
Tara takes no pronoun — the copy says "Tara", never "she" or "it".

Honest states are the brand's moral core and survive every redesign:

- No price appears anywhere except on a released quote. "Rate to confirm",
  "Quote on request", "Indicative until the Desk quotes it. Once quoted, it holds."
- Never claim a sync, a hold, a verification or a response time that has not happened.
- Failure is written as hospitality, not as a system message, and never asks a member
  to restart a server.

Retired words: Wishlist, Planner, Atelier, "Plan with AI", "AI Concierge", "the Concierge",
"on record".

## It ships as a web app

TripAgent goes out as a link before it goes to an app store, so the link is the
product. It is an installable PWA:

- `public/manifest.webmanifest` — standalone display, obsidian theme, maskable icon,
  and shortcuts straight to the Concierge and to Journeys.
- `public/sw.js` — caches the shell, the photography and the city guides, and
  **never** caches anything under `/agent`. A member's session, requests, quotes and
  the Concierge are always live, because a stale price or a stale request status
  would be a lie, and that is the one thing this app does not do.
- `src/lib/pwa.ts` — registers the worker in production only, and holds the install
  prompt so the app can offer it in its own words. iOS gives no prompt, so the app
  explains Share → Add to Home Screen instead.

Assume a member may open it from a home screen with no browser chrome, and may be
offline. Every screen has to survive both.

## Density

A guide holds far more than anyone reads in a sitting. Two components carry the
policy, and screens should reach for them before they reach for more prose:

- `<Clamp>` shows a paragraph's opening and folds the rest behind one tap. It
  only offers the control when the text actually overflows.
- `<Disclosure>` turns a section into a heading with a glyph and a count. The
  lower half of a city page — where to base yourself, what is on, what to know
  on the ground — is reference, not reading, and is closed by default.

Nothing is deleted by either; the page simply ends somewhere a member can reach.

## The travel profile

The five questions asked once at the door describe the **traveller**, not a trip:
what travel is for, the landscape they return to, who is usually along, the pace
they are happiest at, and where the night settles. They are ordered by how much
each narrows a suggestion, two of the five are answered from photographs, and
`company` seeds the default party size. A trip's own dates, party and budget are
asked for on the request that needs them — never here.
