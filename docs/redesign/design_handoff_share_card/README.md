# Handoff: Live Hunt Share Card (Open Graph / Discord unfurl)

## Overview
When a streamer shares a hunt link (e.g. `goofer.tv/hunt/abc123`) in Discord, Twitter/X, Twitch chat, etc.,
the platform should unfurl a **1200×630 share card** showing **that specific hunt's** live data — its
name, start cost, and bonus count — not a generic logo. This bundle is the design for that card plus the
spec for wiring it to real, per-hunt, updating data.

**The chosen design is `CardMinimal`** (labelled "Minimal" in the canvas). The other two directions
(`CardBroadcast`, `CardScoreboard`) are kept in the files **for reference only** — do not ship them.

## About the Design Files
These are **design references built in HTML** (React via in-browser Babel + plain CSS) — prototypes that show
the intended look, *not* production code to drop in. The work is to **recreate `CardMinimal` inside the
`streamsite` app** (CRA, Tailwind, Firebase, Vercel-style `api/` functions) as a **dynamically-generated OG
image** bound to the hunt being shared, and to wire up the meta tags + regeneration strategy described below.

Treat the HTML/CSS as the source of truth for layout and visual intent; re-express it in whatever renders an
image server-side (see "Implementation").

## Fidelity
**High-fidelity.** Exact size (1200×630), layout, type scale, and colors are specified. Recreate pixel-faithfully.
Note the prototype CSS uses `oklch()`, `color-mix()`, and multi-stop gradients that the recommended renderer
(Satori / `@vercel/og`) **does not support** — hex fallbacks are provided in Design Tokens; you must convert.

---

## The card: `CardMinimal`
Source: `og-cards.jsx` (`CardMinimal`) + `og-cards.css` (`.og`, `.og-min*`). Preview it at true size by opening
`Hunt Tracker Live Card.html`. The canvas (`Hunt Tracker Share Cards.html`) shows the **same template rendered
with two different hunts** — that side-by-side is the whole point: one template, live data swapped in.

### Props (the only things that change per hunt)
```jsx
<CardMinimal
  huntName="Friday Disc Hunt"  // string  — the hunt's title
  start={800}                  // number  — starting cost in dollars (formatted $X,XXX)
  bonusCount={12}              // number  — bonuses logged so far
/>
```
`fmtMoney(n)` → `"$" + n.toLocaleString("en-US")` with no decimals; negatives get a leading `-`.

### Layout (1200×630, flex column, `padding: 56px 64px`)
- **Top row** (`space-between`):
  - Left: a big **LIVE pill** — red dot (16px, with a soft red halo ring) + `LIVE`, pill border + faint red fill,
    uppercase, `letter-spacing: 0.16em`, `font-size: 22px`, `padding: 12px 22px`, `border-radius: 40px`.
  - Right: `GOOFERG · CH 02` in mono, faint, `font-size: 18px`, `letter-spacing: 0.22em`.
- **Center** (`margin: auto 0`):
  - Kicker: `BONUS HUNT · LIVE NOW`, mono, **emerald-bright**, `24px`, `letter-spacing: 0.2em`, `margin-bottom: 20px`.
  - Title: **`{huntName}`**, `font-size: 104px`, `font-weight: 700`, `letter-spacing: -0.035em`, `line-height: 0.94`.
    (Long names: this is the one element that can overflow — see "Edge cases".)
- **Foot row** (`align-items: flex-end`, `space-between`):
  - Stats group (`gap: 34px`): two stat blocks separated by a 1px / 56px-tall divider.
    - Stat = label (`15px`, `letter-spacing: 0.14em`, faint) over value (`52px`, `font-weight: 700`, tabular nums).
    - Block 1 → label `START`, value `{fmtMoney(start)}`.
    - Block 2 → label `BONUSES SO FAR`, value `{bonusCount}`.
  - CTA: `goofer.tv/live →`, mono, `22px`, `font-weight: 600`, dark-emerald text on **emerald** fill,
    `padding: 14px 24px`, `border-radius: 12px`.
- **Background**: diagonal gradient, dark emerald-tinted → near-black → dark purple-tinted (`155deg`).

---

## How it updates based on the hunt being shared

This is the core of the task. A share card is consumed by **crawlers** (Discord, Twitter, Slack, iMessage),
which read `<meta>` tags from the shared URL and fetch an image. So there are two pieces:

### 1. Per-hunt meta tags on the share page
The shared URL is the hunt page, e.g. `/hunt/:huntId`. Render OG/Twitter meta tags **server-side per hunt**, with
the image URL pointing at a generated-image endpoint keyed by `huntId`:

```html
<meta property="og:title"       content="Friday Disc Hunt — LIVE bonus hunt" />
<meta property="og:description" content="$800 start · 12 bonuses · watch live on goofer.tv" />
<meta property="og:image"       content="https://goofer.tv/api/og/abc123?v=1717<bust>" />
<meta property="og:image:width"  content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card"        content="summary_large_image" />
```
CRA renders meta tags client-side, which **crawlers do not execute** — so these meta tags must be emitted by a
**server/edge function or prerender** for `/hunt/:huntId` (a small Vercel/edge function that reads the hunt from
Firestore and returns HTML with the right tags). Don't rely on `react-helmet` for the crawler path.

### 2. The image endpoint — `api/og/[huntId].js`
A serverless/edge function that **reads the hunt by id from Firestore** and renders the card to a PNG.
Recommended: **`@vercel/og`** (Satori) — it takes JSX and returns a PNG at the edge, no headless browser.

```jsx
// api/og/[huntId].js  (edge runtime)
import { ImageResponse } from '@vercel/og';
import { getHuntById } from '../../lib/hunts';   // your Firestore read

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const huntId = new URL(req.url).searchParams.get('huntId'); // or path param
  const hunt = await getHuntById(huntId);
  const start = hunt?.startCost ?? 0;
  const bonusCount = (hunt?.bonuses ?? []).length;
  const huntName = hunt?.name ?? 'Bonus Hunt';

  return new ImageResponse(
    /* JSX port of CardMinimal — see "Porting to Satori" */,
    {
      width: 1200, height: 630,
      // Cache: short enough to feel "live", long enough to survive a Discord re-fetch.
      headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=300' },
    }
  );
}
```

`bonusCount` and `start` come straight from the hunt's `bonuses[]` / `startCost` — the same data the tracker
already holds. **No new data model needed**; the card is a pure function of existing hunt fields.

### 3. Making it actually feel "live" (the caching reality)
Crawlers **cache** the unfurled image — this is the part to get right, and to set expectations on:

- **Discord** caches by image URL via its proxy (`images-ext-*.discordapp.net`) and honors `cache-control`
  loosely; a given message's embed is fetched ~once and **won't silently update in an old message**. To force a
  fresh card, the **URL must change**.
- **Strategy — version/bust the image URL** with a token that changes when the hunt changes. Put a `?v=` param on
  `og:image` derived from the hunt's `updatedAt` (or a monotonic `rev` you bump on bonus add / payout entry /
  complete). Same hunt, new data → new URL → new unfurl on the **next** share.
- **Within a single already-posted message**, no platform reliably live-refreshes an embed image. So "live" means:
  *each time the link is shared (or re-shared / re-sent), the card reflects the hunt's current state.* Document this
  expectation; don't promise a ticking card inside an old Discord embed.
- Keep `max-age` short (≈30s) + `stale-while-revalidate` so repeated shares during a live hunt stay current without
  hammering Firestore on every crawl.
- Optional niceties: a Discord bot that **re-posts/edits** the embed at milestones (hunt complete, new top multi),
  or `og:image` `?t=` minute-bucketed so reshares within the same minute hit cache.

### Where the version token comes from
Bump a `rev` (or use `updatedAt`) on the hunt doc in the same `updateHunt({ bonuses })` writes the tracker already
does. The share page reads it and appends `?v={rev}` to `og:image`. That single line is what ties "the hunt
changed" to "the card will be fresh next time it's shared."

---

## Porting `CardMinimal` to Satori / `@vercel/og`
Satori supports a flexbox subset of CSS and **no** `oklch()`, `color-mix()`, CSS variables, or `box-shadow`.
Recreate the markup with inline styles using the **hex tokens below**, and:
- Every container needs an explicit `display: 'flex'` and direction (Satori requires it).
- Replace the red-dot halo (`box-shadow`) with a wrapper div using a translucent red background + the dot centered.
- The multi-stop gradient → `backgroundImage: 'linear-gradient(155deg, #112019 0%, #131218 45%, #1b1426 100%)'`.
- Load the fonts as buffers (`fetch` the `.ttf`/`.otf` and pass via `fonts: [...]`) — Space Grotesk (700) for the
  title/values, JetBrains Mono (500/600) for mono labels & CTA. Webfonts are fine **here** (this renders to a
  static image, so `DESIGN.md`'s no-webfont rule for the app UI doesn't apply to the OG image).
- Tabular numerals: `fontVariantNumeric: 'tabular-nums'` on stat values.

A Puppeteer/Playwright screenshot of the actual HTML card is a fallback if you'd rather keep the exact CSS
(`oklch`, gradients) — but it's heavier (headless Chrome per request) and slower at the edge. Prefer Satori unless
pixel-exact gradients matter more than cost/latency.

## Design Tokens (hex — convert the prototype's oklch/color-mix to these)
| Token | Prototype value | Hex for Satori |
|---|---|---|
| Card bg gradient | `155deg, oklch(0.19 .045 165) → oklch(0.16 .012 280) → oklch(0.18 .05 305)` | `#112019 → #131218 → #1b1426` |
| Emerald (CTA fill, kicker base) | `#10b981` | `#10b981` |
| Emerald bright (kicker text) | `#34d399` | `#34d399` |
| CTA text (on emerald) | `#052e22` | `#052e22` |
| Purple (avatar/community) | `#a855f7` / `#c084fc` | unused on this card |
| Live red | `#f0506e` | `#f0506e` |
| Live red fill | `color-mix(red 12%, transparent)` | `rgba(240,80,110,0.12)` |
| Live red border | `color-mix(red 40%, transparent)` | `rgba(240,80,110,0.40)` |
| Text | `oklch(0.97 .004 280)` | `#f4f3f6` |
| Dim | `oklch(0.72 .012 280)` | `#a9a6b3` |
| Faint (labels) | `oklch(0.55 .013 280)` | `#7a7785` |
| Divider | `color-mix(text 18%, transparent)` | `rgba(244,243,246,0.18)` |

**Type:** Space Grotesk (700 for title/values), JetBrains Mono (500/600 for mono labels, channel id, CTA).
**Type scale (exact px at 1200×630):** title 104 · stat value 52 · kicker 24 · live pill 22 · CTA 22 · channel 18 ·
stat label 15.

## Edge cases & data rules
- **Long hunt names**: the 104px title can overflow two lines. Clamp to 2 lines (`display:flex; flexDirection:column`
  with Satori, or reduce `font-size` to ~84px when `huntName.length > 18`). Verify with `Sunday $2K Sendoff`.
- **`bonusCount` = 0** (hunt just created): show `0`; that's fine — card still reads "LIVE NOW".
- **Hunt not found / private**: return a generic fallback card (no name, `goofer.tv/live →`) with a 200, so the
  unfurl never 404s and breaks the embed.
- **Numbers**: `start` formats as `$X,XXX` (no decimals). `bonusCount` is a bare integer.

## Files in this bundle
- `og-cards.jsx` — **`CardMinimal` is the one to ship** (data-driven via `huntName`/`start`/`bonusCount`).
  `CardBroadcast` + `CardScoreboard` are reference-only alternates.
- `og-cards.css` — full card styling; `.og` + `.og-min*` are the relevant rules.
- `Hunt Tracker Live Card.html` — open this to see the chosen card at true 1200×630.
- `Hunt Tracker Share Cards.html` — design canvas: the chosen card with two different hunts (the "same template,
  live data" demonstration) + the two alternates.
- `design-canvas.jsx` — canvas harness for the above (prototype-only; not for production).

To run locally: open `Hunt Tracker Live Card.html` in a browser (no build step).
