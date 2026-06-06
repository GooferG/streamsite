# Dynamic OG Share Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render per-hunt 1200×630 OG share cards (live-hunt + suggest-link variants) from one parameterized CardMinimal template, and inject them into the crawler unfurl for `/live/:shareId` and `/hunt-suggest/:linkId`.

**Architecture:** One Satori JSX card (`api/og/CardMinimal.js`) driven by a uniform prop shape; two pure prop-mappers (`liveCardProps`/`suggestCardProps`); a shared `render` helper (fonts + `ImageResponse`); two Node OG endpoints reading Firestore via `firebase-admin`; meta-tag injection extended on the existing `live-preview.js` plus a new parallel `hunt-suggest/preview.js`; `vercel.json` rewrite for the suggest unfurl.

**Tech Stack:** `@vercel/og` (Satori, Node runtime), `firebase-admin` (`adminDb`), Vercel serverless functions, Jest (no jest-dom).

**Spec:** `docs/superpowers/specs/2026-06-05-dynamic-share-cards-design.md`
**Visual source of truth:** `docs/redesign/design_handoff_share_card/` (`Hunt Tracker Live Card.html` at true size; hex tokens in `README.md`).

---

## Conventions
- **Test runner:** `npm test -- --watchAll=false --testPathPattern=<name>`. No jest-dom.
- **Server endpoints:** ESM, `import { adminDb } from '../_lib/firebaseAdmin.js'` (path depth varies by folder — `api/og/live/` is three deep, so `../../_lib/`). Set proper `Content-Type`; never 404 an image (return a fallback card with 200).
- **Hex tokens (from handoff):** bg gradient `linear-gradient(155deg, #112019 0%, #131218 45%, #1b1426 100%)`; emerald `#10b981`, emerald-bright `#34d399`, CTA text `#052e22`, live-red `#f0506e`, red-fill `rgba(240,80,110,0.12)`, red-border `rgba(240,80,110,0.40)`, text `#f4f3f6`, dim `#a9a6b3`, faint `#7a7785`, divider `rgba(244,243,246,0.18)`.
- **Type scale (px @1200×630):** title 104 (→84 when name >18 chars), stat value 52, kicker 24, live pill 22, CTA 22, channel 18, stat label 15.
- **Commit style:** short imperative subject, NO `Co-Authored-By` trailer.

## File Structure
**Create:**
- `api/og/fonts/SpaceGrotesk-Bold.ttf`, `api/og/fonts/JetBrainsMono-Medium.ttf`, `api/og/fonts/JetBrainsMono-SemiBold.ttf` — committed font files.
- `api/og/render.js` — load fonts (module-cached) + `ImageResponse(jsx, {width, height, fonts, headers})`.
- `api/og/CardMinimal.js` — variant-agnostic Satori JSX from uniform props.
- `api/og/cardProps.js` — `liveCardProps(mirror)`, `suggestCardProps(intake, hunt)`.
- `api/og/live/[shareId].js` — live card endpoint.
- `api/og/suggest/[linkId].js` — suggest card endpoint.
- `api/hunt-suggest/preview.js` — suggest-link crawler unfurl (mirrors live-preview.js).
- `api/og/__tests__/cardProps.test.js` — prop-mapper tests.

**Modify:**
- `api/_lib/livePreviewFormat.js` — `injectOgTags` gains optional `image`; add `buildImageUrl`.
- `api/live-preview.js` — pass `shareId` + `updatedAt` to `injectOgTags`.
- `src/__tests__/livePreviewFormat.test.js` — extend for image injection + `buildImageUrl`.
- `package.json` — add `@vercel/og`.
- `vercel.json` — suggest rewrite + font `includeFiles`.

---

## Task 1: Add @vercel/og + fail-fast PNG render validation

**Files:**
- Modify: `package.json`
- Create (temporary): `api/og/_smoke.js`

This task de-risks the whole feature: confirm `@vercel/og` renders a PNG in a Node serverless function on our setup BEFORE building the card. If it fails, STOP and report — we pivot to Playwright.

- [ ] **Step 1: Install the dependency**

Run: `npm install @vercel/og`
Expected: adds `@vercel/og` to `package.json` dependencies, no peer-dep errors that block install.

- [ ] **Step 2: Create a smoke endpoint**

Create `api/og/_smoke.js`:

```javascript
import { ImageResponse } from '@vercel/og';

// Temporary smoke test: proves @vercel/og renders a PNG in a Node function.
// Deleted at the end of Task 1.
export default function handler() {
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#131218', color: '#34d399', fontSize: 64,
        },
        children: 'OG OK',
      },
    },
    { width: 1200, height: 630 }
  );
}
```

- [ ] **Step 3: Validate it renders (Node import + ImageResponse construct)**

Since `vercel dev` may not be available, validate the import + that `ImageResponse` constructs without throwing, via a Node script:

Run:
```bash
node --input-type=module -e "import('@vercel/og').then(async m => { const r = await import('./api/og/_smoke.js'); const out = r.default(); console.log('ImageResponse OK:', out && out.constructor && out.constructor.name); }).catch(e => { console.error('OG FAILED:', e.message); process.exit(1); })"
```
Expected: prints `ImageResponse OK: ...` (a Response-like object) with exit 0.
If it throws (e.g. native binary / WASM load failure in Node), STOP — report BLOCKED with the error; the spec's fallback is Playwright.

- [ ] **Step 4: Confirm the production build still passes with the new dep**

Run: `npm run build`
Expected: Compiled successfully (the client bundle doesn't import `@vercel/og`; this just confirms the install didn't break anything).

- [ ] **Step 5: Delete the smoke endpoint**

Run: `git rm -f api/og/_smoke.js 2>/dev/null || rm -f api/og/_smoke.js`
(It was never committed; just remove the file.)

- [ ] **Step 6: Commit the dependency**

```bash
git add package.json package-lock.json
git commit -m "build(og): add @vercel/og for dynamic share cards"
```

---

## Task 2: Bundle fonts + vercel.json includeFiles

**Files:**
- Create: `api/og/fonts/SpaceGrotesk-Bold.ttf`, `api/og/fonts/JetBrainsMono-Medium.ttf`, `api/og/fonts/JetBrainsMono-SemiBold.ttf`
- Modify: `vercel.json`

- [ ] **Step 1: Download the font files**

Fetch the TTFs from Google Fonts' GitHub mirrors (stable raw URLs):

Run:
```bash
mkdir -p api/og/fonts
curl -fsSL -o api/og/fonts/SpaceGrotesk-Bold.ttf "https://github.com/google/fonts/raw/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf"
curl -fsSL -o api/og/fonts/JetBrainsMono-Medium.ttf "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
curl -fsSL -o api/og/fonts/JetBrainsMono-SemiBold.ttf "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
```
NOTE: JetBrains Mono ships as a single variable font (`JetBrainsMono[wght].ttf`); Satori reads a variable font fine but pins a weight via the `weight` field in the `fonts` array. So downloading the same variable file twice (Medium/SemiBold names) is acceptable — OR simpler: download it once as `JetBrainsMono-Variable.ttf` and reference it for both weights. If you prefer the simpler path, fetch one file:
```bash
curl -fsSL -o api/og/fonts/JetBrainsMono-Variable.ttf "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
```
Use whichever you fetched consistently in Task 4's `render.js`. Verify each file is non-empty:

Run: `ls -la api/og/fonts/`
Expected: each `.ttf` is tens-to-hundreds of KB (not 0 bytes / not an HTML error page).

- [ ] **Step 2: Sanity-check the files are real fonts**

Run: `file api/og/fonts/*.ttf 2>/dev/null || head -c 4 api/og/fonts/SpaceGrotesk-Bold.ttf | xxd`
Expected: TrueType signature (`\x00\x01\x00\x00`) or `file` reports "TrueType Font" — NOT "HTML document" (which would mean the curl fetched a 404 page).

- [ ] **Step 3: Add includeFiles to vercel.json**

Update `vercel.json` to ensure the font files ship with the og functions. Current content:
```json
{
  "rewrites": [
    { "source": "/live/:shareId", "destination": "/api/live-preview" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/award-watchtime", "schedule": "*/5 * * * *" }
  ]
}
```
Replace with (adds `functions.includeFiles` for the og endpoints; rewrite for suggest is added in Task 6):
```json
{
  "functions": {
    "api/og/live/[shareId].js": { "includeFiles": "api/og/fonts/**" },
    "api/og/suggest/[linkId].js": { "includeFiles": "api/og/fonts/**" }
  },
  "rewrites": [
    { "source": "/live/:shareId", "destination": "/api/live-preview" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/award-watchtime", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 4: Commit fonts + config**

```bash
git add api/og/fonts vercel.json
git commit -m "build(og): bundle Satori fonts + includeFiles config"
```

---

## Task 3: Pure prop-mappers (cardProps.js)

**Files:**
- Create: `api/og/cardProps.js`
- Test: `api/og/__tests__/cardProps.test.js`

Pure functions mapping a mirror / intake+hunt into the uniform card-prop shape. No Satori, no Firestore — fully unit-testable.

Uniform card-prop shape:
```js
{
  variant: 'live' | 'suggest',
  pill: { text, tone },           // tone: 'live' (red) | 'open' (green)
  kicker,                          // string
  huntName,                       // string
  statA: { label, value },        // strings
  statB: { label, value },
  cta,                            // string
}
```

- [ ] **Step 1: Write the failing tests**

Create `api/og/__tests__/cardProps.test.js`:

```javascript
import { liveCardProps, suggestCardProps } from '../cardProps';

describe('liveCardProps', () => {
  test('maps mirror name/startBalance/bonuses to the live card shape', () => {
    const p = liveCardProps({ name: 'Friday Disc Hunt', startBalance: 800, bonuses: [{}, {}, {}] });
    expect(p.variant).toBe('live');
    expect(p.huntName).toBe('Friday Disc Hunt');
    expect(p.pill).toEqual({ text: 'LIVE', tone: 'live' });
    expect(p.statA).toEqual({ label: 'START', value: '$800' });
    expect(p.statB).toEqual({ label: 'BONUSES SO FAR', value: '3' });
    expect(p.cta).toBe('goofer.tv/live →');
    expect(p.kicker).toBe('BONUS HUNT · LIVE NOW');
  });

  test('handles missing/zero fields with a generic fallback', () => {
    const p = liveCardProps(null);
    expect(p.huntName).toBe('Bonus Hunt');
    expect(p.statA.value).toBe('$0');
    expect(p.statB.value).toBe('0');
  });

  test('formats large start balances with commas, no decimals', () => {
    expect(liveCardProps({ startBalance: 12500 }).statA.value).toBe('$12,500');
  });
});

describe('suggestCardProps', () => {
  const intake = { huntName: 'Friday Disc Hunt' };
  const hunt = {
    suggestions: [
      { person: 'Ana', slots: [{ name: 'A' }, { name: 'B' }] },
      { person: 'Bo', slots: [{ name: 'C' }] },
    ],
  };

  test('maps intake name + hunt suggestions to picks-in / callers', () => {
    const p = suggestCardProps(intake, hunt);
    expect(p.variant).toBe('suggest');
    expect(p.huntName).toBe('Friday Disc Hunt');
    expect(p.pill).toEqual({ text: 'OPEN', tone: 'open' });
    expect(p.statA).toEqual({ label: 'PICKS IN', value: '3' }); // 2 + 1 slots
    expect(p.statB).toEqual({ label: 'CALLERS', value: '2' });  // 2 people
    expect(p.cta).toBe('goofer.tv · drop yours →');
    expect(p.kicker).toBe('SUGGEST SLOTS · OPEN');
  });

  test('falls back when there is no active hunt', () => {
    const p = suggestCardProps({ huntName: 'X' }, null);
    expect(p.huntName).toBe('X');
    expect(p.statA.value).toBe('0');
    expect(p.statB.value).toBe('0');
  });

  test('uses a generic name when intake lacks one', () => {
    expect(suggestCardProps(null, null).huntName).toBe('Bonus Hunt');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=cardProps`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `api/og/cardProps.js`**

```javascript
// api/og/cardProps.js
// Pure mappers: data doc -> uniform CardMinimal prop shape. No Satori, no
// Firestore — unit-testable in isolation.

function fmtMoney(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return '$' + safe.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function liveCardProps(mirror) {
  const huntName = (mirror?.name || '').trim() || 'Bonus Hunt';
  const start = fmtMoney(mirror?.startBalance);
  const bonusCount = Array.isArray(mirror?.bonuses) ? mirror.bonuses.length : 0;
  return {
    variant: 'live',
    pill: { text: 'LIVE', tone: 'live' },
    kicker: 'BONUS HUNT · LIVE NOW',
    huntName,
    statA: { label: 'START', value: start },
    statB: { label: 'BONUSES SO FAR', value: String(bonusCount) },
    cta: 'goofer.tv/live →',
  };
}

export function suggestCardProps(intake, hunt) {
  const huntName = (intake?.huntName || '').trim() || 'Bonus Hunt';
  const suggestions = Array.isArray(hunt?.suggestions) ? hunt.suggestions : [];
  const totalPicks = suggestions.reduce(
    (n, p) => n + (Array.isArray(p?.slots) ? p.slots.length : 0),
    0
  );
  const peopleCount = suggestions.length;
  return {
    variant: 'suggest',
    pill: { text: 'OPEN', tone: 'open' },
    kicker: 'SUGGEST SLOTS · OPEN',
    huntName,
    statA: { label: 'PICKS IN', value: String(totalPicks) },
    statB: { label: 'CALLERS', value: String(peopleCount) },
    cta: 'goofer.tv · drop yours →',
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=cardProps`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/og/cardProps.js api/og/__tests__/cardProps.test.js
git commit -m "feat(og): pure card-prop mappers for live + suggest variants"
```

---

## Task 4: CardMinimal Satori JSX + render helper

**Files:**
- Create: `api/og/CardMinimal.js`
- Create: `api/og/render.js`

No unit test (Satori output is a binary image; validated manually + by the endpoint tasks). The card is a pure function returning a Satori element tree.

- [ ] **Step 1: Implement `api/og/CardMinimal.js`**

Satori needs every container to declare `display: 'flex'` + a direction. This returns a plain element tree (the `{ type, props }` shape `ImageResponse` accepts) so no JSX transform is required in the function file.

```javascript
// api/og/CardMinimal.js
// Variant-agnostic 1200x630 share card as a Satori element tree. Driven entirely
// by the uniform props from cardProps.js. Hex tokens per the design handoff.
const C = {
  bg: 'linear-gradient(155deg, #112019 0%, #131218 45%, #1b1426 100%)',
  emerald: '#10b981',
  emeraldBright: '#34d399',
  ctaText: '#052e22',
  liveRed: '#f0506e',
  redFill: 'rgba(240,80,110,0.12)',
  redBorder: 'rgba(240,80,110,0.40)',
  greenFill: 'rgba(16,185,129,0.12)',
  greenBorder: 'rgba(16,185,129,0.40)',
  text: '#f4f3f6',
  dim: '#a9a6b3',
  faint: '#7a7785',
  divider: 'rgba(244,243,246,0.18)',
};

const div = (style, children) => ({ type: 'div', props: { style, children } });
const span = (style, children) => ({ type: 'span', props: { style, children } });

function Stat({ label, value }) {
  return div(
    { display: 'flex', flexDirection: 'column', gap: 8 },
    [
      span({ fontSize: 15, letterSpacing: '0.14em', color: C.faint, fontFamily: 'JetBrains Mono', textTransform: 'uppercase' }, label),
      span({ fontSize: 52, fontWeight: 700, color: C.text, fontFamily: 'Space Grotesk', fontVariantNumeric: 'tabular-nums' }, value),
    ]
  );
}

export default function CardMinimal(p) {
  const live = p.pill.tone === 'live';
  const pillFill = live ? C.redFill : C.greenFill;
  const pillBorder = live ? C.redBorder : C.greenBorder;
  const pillDot = live ? C.liveRed : C.emerald;
  const titleSize = (p.huntName || '').length > 18 ? 84 : 104;

  return div(
    {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '56px 64px', backgroundImage: C.bg, color: C.text,
      fontFamily: 'Space Grotesk',
    },
    [
      // Top row
      div(
        { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        [
          div(
            {
              display: 'flex', alignItems: 'center', gap: 14,
              border: `1px solid ${pillBorder}`, background: pillFill,
              borderRadius: 40, padding: '12px 22px',
            },
            [
              div({ display: 'flex', width: 16, height: 16, borderRadius: 8, background: pillDot }, []),
              span({ fontSize: 22, letterSpacing: '0.16em', color: C.text, fontFamily: 'JetBrains Mono', fontWeight: 600, textTransform: 'uppercase' }, p.pill.text),
            ]
          ),
          span({ fontSize: 18, letterSpacing: '0.22em', color: C.faint, fontFamily: 'JetBrains Mono' }, 'GOOFERG · CH 02'),
        ]
      ),
      // Center
      div(
        { display: 'flex', flexDirection: 'column', margin: 'auto 0' },
        [
          span({ fontSize: 24, letterSpacing: '0.2em', color: C.emeraldBright, fontFamily: 'JetBrains Mono', marginBottom: 20, textTransform: 'uppercase' }, p.kicker),
          span({ display: 'flex', fontSize: titleSize, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 0.94, color: C.text }, p.huntName),
        ]
      ),
      // Foot row
      div(
        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
        [
          div(
            { display: 'flex', alignItems: 'center', gap: 34 },
            [
              Stat(p.statA),
              div({ display: 'flex', width: 1, height: 56, background: C.divider }, []),
              Stat(p.statB),
            ]
          ),
          div(
            {
              display: 'flex', background: C.emerald, color: C.ctaText,
              fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 22,
              padding: '14px 24px', borderRadius: 12,
            },
            p.cta
          ),
        ]
      ),
    ]
  );
}
```

- [ ] **Step 2: Implement `api/og/render.js`**

```javascript
// api/og/render.js
import { ImageResponse } from '@vercel/og';
import { readFileSync } from 'fs';
import { join } from 'path';
import CardMinimal from './CardMinimal.js';

// Load fonts once per cold start. Files ship with the function via vercel.json
// includeFiles. If a read fails, we render without that font (Satori default)
// rather than erroring the image.
let FONTS = null;
function loadFonts() {
  if (FONTS) return FONTS;
  const dir = join(process.cwd(), 'api', 'og', 'fonts');
  const tryRead = (file) => {
    try { return readFileSync(join(dir, file)); } catch { return null; }
  };
  const grotesk = tryRead('SpaceGrotesk-Bold.ttf');
  // JetBrains Mono variable file covers both weights (see Task 2).
  const mono = tryRead('JetBrainsMono-Variable.ttf') || tryRead('JetBrainsMono-Medium.ttf');
  const fonts = [];
  if (grotesk) fonts.push({ name: 'Space Grotesk', data: grotesk, weight: 700, style: 'normal' });
  if (mono) {
    fonts.push({ name: 'JetBrains Mono', data: mono, weight: 500, style: 'normal' });
    fonts.push({ name: 'JetBrains Mono', data: mono, weight: 600, style: 'normal' });
  }
  FONTS = fonts;
  return fonts;
}

const HEADERS = {
  'content-type': 'image/png',
  'cache-control': 'public, max-age=30, stale-while-revalidate=300',
};

export function renderCard(props) {
  const fonts = loadFonts();
  return new ImageResponse(CardMinimal(props), {
    width: 1200,
    height: 630,
    fonts,
    headers: HEADERS,
  });
}
```

IMPORTANT: The path in `render.js` uses `process.cwd()` + `api/og/fonts`. If Task 2 downloaded the single variable file, name it `JetBrainsMono-Variable.ttf` to match the `tryRead` above. If you downloaded weight-named files instead, adjust the `tryRead` names here to match what's on disk. Keep the two consistent.

- [ ] **Step 3: Commit**

```bash
git add api/og/CardMinimal.js api/og/render.js
git commit -m "feat(og): CardMinimal Satori template + render helper"
```

---

## Task 5: Live card endpoint + og:image injection

**Files:**
- Create: `api/og/live/[shareId].js`
- Modify: `api/_lib/livePreviewFormat.js`
- Modify: `api/live-preview.js`
- Test: `src/__tests__/livePreviewFormat.test.js`

- [ ] **Step 1: Extend the injectOgTags test (failing)**

In `src/__tests__/livePreviewFormat.test.js`, update the import to add `buildImageUrl`, extend the sample html to include image tags, and add assertions. Replace the import line and add a new describe block:

Update import (line 3-6):
```javascript
import {
  buildDescription,
  injectOgTags,
  buildImageUrl,
} from '../../api/_lib/livePreviewFormat.js';
```

Add to the `injectOgTags` sample html (so there's an image tag to replace) — change the `html` const to also include:
```javascript
    '<meta property="og:image" content="https://goofer.tv/homepage-share.jpg" />' +
    '<meta property="og:image:width" content="1537" />' +
    '<meta property="og:image:height" content="1074" />' +
    '<meta name="twitter:image" content="https://goofer.tv/homepage-share.jpg" />' +
```

Add a new describe block:
```javascript
describe('buildImageUrl', () => {
  test('builds a versioned og image url for a kind + id', () => {
    expect(buildImageUrl('live', 'abc', 1717000000000)).toBe(
      'https://goofer.tv/api/og/live/abc?v=1717000000000'
    );
  });
  test('omits the version param when no version given', () => {
    expect(buildImageUrl('suggest', 'xyz')).toBe(
      'https://goofer.tv/api/og/suggest/xyz'
    );
  });
});

describe('injectOgTags — image', () => {
  const htmlWithImg =
    '<title>Goofer Live</title>' +
    '<meta property="og:title" content="GooferG" />' +
    '<meta property="og:description" content="x" />' +
    '<meta property="og:url" content="https://goofer.tv" />' +
    '<meta property="og:image" content="https://goofer.tv/homepage-share.jpg" />' +
    '<meta property="og:image:width" content="1537" />' +
    '<meta property="og:image:height" content="1074" />' +
    '<meta name="twitter:image" content="https://goofer.tv/homepage-share.jpg" />' +
    '<meta name="twitter:title" content="GooferG" />' +
    '<meta name="twitter:description" content="x" />';

  test('replaces og:image + twitter:image and sets 1200x630 when image given', () => {
    const out = injectOgTags(htmlWithImg, {
      title: 'T', description: 'D', url: 'https://goofer.tv/live/abc',
      image: 'https://goofer.tv/api/og/live/abc?v=1',
    });
    expect(out).toContain('<meta property="og:image" content="https://goofer.tv/api/og/live/abc?v=1" />');
    expect(out).toContain('<meta name="twitter:image" content="https://goofer.tv/api/og/live/abc?v=1" />');
    expect(out).toContain('<meta property="og:image:width" content="1200" />');
    expect(out).toContain('<meta property="og:image:height" content="630" />');
  });

  test('leaves image tags untouched when no image given (back-compat)', () => {
    const out = injectOgTags(htmlWithImg, {
      title: 'T', description: 'D', url: 'https://goofer.tv/live/abc',
    });
    expect(out).toContain('<meta property="og:image" content="https://goofer.tv/homepage-share.jpg" />');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- --watchAll=false --testPathPattern=livePreviewFormat`
Expected: FAIL — `buildImageUrl` not exported + image assertions fail.

- [ ] **Step 3: Extend `api/_lib/livePreviewFormat.js`**

Add `buildImageUrl` and extend `injectOgTags` to handle an optional `image`. Add the export:
```javascript
const SITE = 'https://goofer.tv';

// Versioned OG image URL for a card endpoint. kind = 'live' | 'suggest'.
export function buildImageUrl(kind, id, version) {
  const base = `${SITE}/api/og/${kind}/${encodeURIComponent(id)}`;
  return version != null && version !== '' ? `${base}?v=${version}` : base;
}
```

Change the `injectOgTags` signature to accept `image` and, when present, replace image tags + dimensions. Update the function:
```javascript
export function injectOgTags(html, { title, description, url, image }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${t}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${d}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${u}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${t}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${d}" />`);
  if (image) {
    const img = escapeHtml(image);
    out = out
      .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${img}" />`)
      .replace(/<meta property="og:image:secure_url" content="[^"]*" \/>/, `<meta property="og:image:secure_url" content="${img}" />`)
      .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${img}" />`)
      .replace(/<meta property="og:image:width" content="[^"]*" \/>/, `<meta property="og:image:width" content="1200" />`)
      .replace(/<meta property="og:image:height" content="[^"]*" \/>/, `<meta property="og:image:height" content="630" />`)
      .replace(/<meta property="og:image:type" content="[^"]*" \/>/, `<meta property="og:image:type" content="image/png" />`);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watchAll=false --testPathPattern=livePreviewFormat`
Expected: PASS (existing + new).

- [ ] **Step 5: Wire the image URL into live-preview.js**

In `api/live-preview.js`, the `try` block builds `title`/`description`/`url`. Add the image and pass it. Find:
```javascript
    const url = `${SITE}/live/${encodeURIComponent(shareId)}`;
    html = injectOgTags(html, { title, description, url });
```
Replace with:
```javascript
    const url = `${SITE}/live/${encodeURIComponent(shareId)}`;
    const image = buildImageUrl('live', shareId, mirror?.updatedAt);
    html = injectOgTags(html, { title, description, url, image });
```
And add `buildImageUrl` to the import at the top:
```javascript
import { buildDescription, injectOgTags, buildImageUrl } from './_lib/livePreviewFormat.js';
```

- [ ] **Step 6: Implement `api/og/live/[shareId].js`**

```javascript
// api/og/live/[shareId].js
import { adminDb } from '../../_lib/firebaseAdmin.js';
import { renderCard } from '../render.js';
import { liveCardProps } from '../cardProps.js';

// Dynamic OG card for a live-shared hunt. Reads the public shared_hunts mirror.
// Always returns a 200 image — a 404 would break the unfurl embed.
export default async function handler(req) {
  // shareId from the path: /api/og/live/<shareId>
  const path = (req.url || '').split('?')[0];
  const shareId = decodeURIComponent(path.replace(/^.*\/og\/live\//, '').replace(/\/$/, ''));

  let mirror = null;
  try {
    if (shareId) {
      const snap = await adminDb.doc(`shared_hunts/${shareId}`).get();
      if (snap.exists) mirror = snap.data();
    }
  } catch {
    /* fall through to fallback card */
  }
  return renderCard(liveCardProps(mirror));
}
```

NOTE on the handler signature: our other functions use `(req, res)`. `@vercel/og`'s `ImageResponse` is a `Response` object — returning it works on Vercel's Node runtime for functions that `return` a Response. If the deployed runtime requires the `(req, res)` style, the fallback is to pipe: `const r = renderCard(...); res.setHeader(...); res.status(200).send(Buffer.from(await r.arrayBuffer()))`. Verify which the runtime accepts during the live-unfurl manual check; prefer the `return Response` form.

- [ ] **Step 7: Build + commit**

Run: `npm run build`
Expected: Compiled successfully.

```bash
git add api/og/live api/_lib/livePreviewFormat.js api/live-preview.js src/__tests__/livePreviewFormat.test.js
git commit -m "feat(og): live hunt share card + og:image injection"
```

---

## Task 6: Suggest card endpoint + suggest unfurl + rewrite

**Files:**
- Create: `api/og/suggest/[linkId].js`
- Create: `api/hunt-suggest/preview.js`
- Modify: `vercel.json`

- [ ] **Step 1: Implement `api/og/suggest/[linkId].js`**

```javascript
// api/og/suggest/[linkId].js
import { adminDb } from '../../_lib/firebaseAdmin.js';
import { renderCard } from '../render.js';
import { suggestCardProps } from '../cardProps.js';

// Dynamic OG card for a suggestion-intake link. Reads the intake -> owner's
// active hunt (admin creds). Always 200.
export default async function handler(req) {
  const path = (req.url || '').split('?')[0];
  const linkId = decodeURIComponent(path.replace(/^.*\/og\/suggest\//, '').replace(/\/$/, ''));

  let intake = null;
  let hunt = null;
  try {
    if (linkId) {
      const intakeSnap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
      if (intakeSnap.exists) {
        intake = intakeSnap.data();
        const activeSnap = await adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`).get();
        if (activeSnap.exists) hunt = activeSnap.data();
      }
    }
  } catch {
    /* fall through to fallback card */
  }
  return renderCard(suggestCardProps(intake, hunt));
}
```

- [ ] **Step 2: Implement `api/hunt-suggest/preview.js`**

Mirror `api/live-preview.js`. It fetches the SPA shell, reads the intake (+ active hunt for counts), injects title/description/image, returns the shell.

```javascript
// api/hunt-suggest/preview.js
import { adminDb } from '../_lib/firebaseAdmin.js';
import { injectOgTags, buildImageUrl } from '../_lib/livePreviewFormat.js';

const SITE = 'https://goofer.tv';

async function fetchIndexHtml() {
  const r = await fetch(`${SITE}/index.html`, { headers: { 'User-Agent': 'goofer-suggest-preview' } });
  if (!r.ok) throw new Error(`index fetch ${r.status}`);
  return r.text();
}

export default async function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  const linkId = decodeURIComponent(path.replace(/^\/hunt-suggest\//, '').replace(/\/$/, ''));

  let html;
  try {
    html = await fetchIndexHtml();
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(200)
      .send(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${SITE}/hunt-suggest/${encodeURIComponent(linkId)}"></head><body></body></html>`
      );
  }

  try {
    if (!linkId) throw new Error('no linkId');
    const intakeSnap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
    if (!intakeSnap.exists) throw new Error('not found');
    const intake = intakeSnap.data();

    let totalPicks = 0;
    let peopleCount = 0;
    let version = intake.updatedAt;
    try {
      const activeSnap = await adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`).get();
      if (activeSnap.exists) {
        const hunt = activeSnap.data();
        const suggestions = Array.isArray(hunt.suggestions) ? hunt.suggestions : [];
        peopleCount = suggestions.length;
        totalPicks = suggestions.reduce((n, p) => n + (Array.isArray(p?.slots) ? p.slots.length : 0), 0);
        if (version == null) version = hunt.updatedAt;
      }
    } catch {
      /* counts stay 0 */
    }

    const huntName = intake.huntName || 'Bonus hunt';
    const title = `Suggest slots for ${huntName} — GooferG`;
    const parts = [];
    if (totalPicks > 0) parts.push(`${totalPicks} ${totalPicks === 1 ? 'pick' : 'picks'} in`);
    if (peopleCount > 0) parts.push(`${peopleCount} ${peopleCount === 1 ? 'caller' : 'callers'}`);
    parts.push('drop yours on goofer.tv');
    const description = parts.join(' · ');
    const url = `${SITE}/hunt-suggest/${encodeURIComponent(linkId)}`;
    // Minute-bucket fallback so the card still busts cache if no updatedAt exists.
    const v = version != null ? version : Math.floor(Date.now() / 60000);
    const image = buildImageUrl('suggest', linkId, v);
    html = injectOgTags(html, { title, description, url, image });
  } catch {
    /* unmodified shell */
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).send(html);
}
```

NOTE: `Date.now()` is fine here (server request time; this file is a serverless handler, not a workflow script).

- [ ] **Step 3: Add the suggest rewrite to vercel.json**

Add a rewrite (BEFORE the catch-all) so crawlers hitting `/hunt-suggest/:linkId` get the preview. Update the `rewrites` array:
```json
  "rewrites": [
    { "source": "/live/:shareId", "destination": "/api/live-preview" },
    { "source": "/hunt-suggest/:linkId", "destination": "/api/hunt-suggest/preview" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
```
(Keep the `functions` and `crons` blocks from Task 2 unchanged.)

- [ ] **Step 4: Build + commit**

Run: `npm run build`
Expected: Compiled successfully.

Run: `npm test -- --watchAll=false --testPathPattern="livePreviewFormat|cardProps"`
Expected: PASS.

```bash
git add api/og/suggest api/hunt-suggest/preview.js vercel.json
git commit -m "feat(og): suggest-link share card + crawler unfurl"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full suite**

Run: `CI=true npm test -- --watchAll=false`
Expected: all pass.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Compiled successfully, no new warnings.

- [ ] **Step 3: Manual unfurl validation (requires deploy or `vercel dev`)**

This step needs a deployed preview or `vercel dev` (Satori + the rewrites don't run under plain `npm start`). If available:
- Hit `/api/og/live/<a real shareId>` → returns a 1200×630 PNG showing the hunt name/start/bonuses.
- Hit `/api/og/suggest/<a real linkId>` → PNG with picks-in/callers.
- Paste `/live/<shareId>` and `/hunt-suggest/<linkId>` into a Discord test channel → unfurl shows the card.
- Confirm a bad id renders the generic fallback card (not a broken image), HTTP 200.
- Verify long name (`Sunday $2K Sendoff`) doesn't overflow (drops to 84px).

If `vercel dev`/deploy is NOT available in this environment, mark this step as deferred-to-deploy and note it in the report — the unit-tested pieces (cardProps, injectOgTags, buildImageUrl) plus the build passing are the automated gate; the Satori visual + crawler behavior is verified on the next Vercel deploy.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A && git commit -m "chore(og): share card verification" || echo "nothing to commit"
```

---

## Self-review notes (for the executor)
- **Spec coverage:** renderer/Satori → Tasks 1,4; fonts bundled → Task 2; cardProps mappers → Task 3; CardMinimal variant template → Task 4; live endpoint + injection → Task 5; suggest endpoint + preview + rewrite → Task 6; freshness (`updatedAt` / minute-bucket fallback) → Tasks 5,6; always-200 fallback → Tasks 5,6; edge cases (long name, zero counts) → Tasks 3,4.
- **Fail-fast:** Task 1 validates `@vercel/og` before any card work; STOP + report if it can't render in Node.
- **Naming consistency:** `liveCardProps`/`suggestCardProps` (Task 3) used by endpoints (Tasks 5,6); `renderCard` (Task 4) used by both endpoints; `buildImageUrl(kind, id, version)` (Task 5) used by live-preview (5) + suggest preview (6); uniform card-prop shape identical across cardProps ↔ CardMinimal.
- **Font filename consistency:** Task 2's downloaded filename MUST match `render.js`'s `tryRead` names (Task 4 Step 2 calls this out). The variable-file path names it `JetBrainsMono-Variable.ttf`.
- **Runtime caveat:** the og endpoints `return` a `Response` (ImageResponse); Task 5 Step 6 documents the `(req,res)` pipe fallback if the runtime needs it — resolve during manual validation.
- **Manual step honesty:** Satori visual + Discord unfurl can't run in CI/`npm start`; Task 7 Step 3 defers those to a Vercel deploy and says so explicitly rather than faking a pass.
