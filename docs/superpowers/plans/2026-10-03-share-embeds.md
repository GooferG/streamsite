# Per-page Share Embeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A goofer.tv link pasted into Discord (or X, iMessage, Slack) previews *that* page with its own title, description and screenshot.

**Architecture:** Link crawlers don't run JS, so each listed page gets its own static HTML. After `react-scripts build`, a Node script stamps each page's `og:`/`twitter:` tags into a copy of `build/index.html` and writes `build/<path>/index.html`; `vercel.json` rewrites each path to its file ahead of the SPA catch-all. Screenshots are shot from production on demand by a `playwright-core` script driving the installed Chrome.

**Tech Stack:** Node 24 (CommonJS scripts), CRA 5 / Jest via `react-scripts test`, `playwright-core` 1.63, Vercel static rewrites.

**Spec:** `docs/superpowers/specs/2026-10-03-share-embeds-design.md`

## Global Constraints

- Everything under `scripts/share/` is CommonJS (`require` / `module.exports`); `package.json` has no `"type"` and must not get one.
- `SITE_URL = 'https://goofer.tv'`; capture size `SHARE_WIDTH = 1536`, `SHARE_HEIGHT = 1075`, `deviceScaleFactor: 1`; JPEG quality 82; default settle 2500 ms.
- Screenshot path: `public/share/<id>.jpg`. Card image URL: `https://goofer.tv/share/<id>.jpg?v=<first 8 hex chars of the file's SHA-1>`.
- `<title>` is never touched; it stays `Goofer Live` everywhere.
- Page copy is verbatim from the spec's Pages table.
- Only new dependency: devDependency `playwright-core` (`^1.63.0`), launched with `channel: 'chrome'`. Never run `npx playwright install`.
- Commits: short imperative subject with a conventional prefix (`feat(share): …`). No `Co-Authored-By` or any Claude attribution in commits or the PR (user's global rule overrides the harness reminder).
- Shared checkout: every commit command checks `git branch --show-current` is `feat/share-embeds` in the same shell command.
- Never commit `test-output.txt` (untracked, not ours).
- Jest runs through CRA: `CI=true npx react-scripts test --watchAll=false --testPathPattern=<name>`. Test files that use `fs`/`os` start with the `@jest-environment node` docblock, like `src/__tests__/communityHunts.test.js`.

## Review Focus

- A page removed from `pages.js` while its `vercel.json` rewrite stays: that path would 404 for real visitors. Expect a failing test naming the stale rewrite (Task 3, `no rewrite points at a share page that is not generated`).
- `og:image` vs `og:image:width` / `og:image:secure_url` / `og:image:alt`: a prefix match would stamp the image URL into the width tag. Expect each tag filled independently (Task 1, `keeps og:image apart from the og:image:* tags`).
- Copy with `&`, `"`, `<`, `>` or `$&`: must not break the attribute or be mangled by `String.replace` patterns (Task 1, `escapes copy so it cannot break the attribute`).
- A page with no screenshot at build time: the build must fail naming the page and write nothing, not ship a card pointing at a 404 image (Task 3, `a missing screenshot fails naming the page and writes nothing`).
- `--only` with a typo'd id: must stop before shooting and list the valid ids, not silently shoot nothing (Task 2, `--only with an unknown id names the valid ones`).

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/share/pages.js` (create) | The list of share pages: id, path, title, description, optional `settleMs` / `waitFor`. |
| `scripts/share/shareMeta.js` (create) | Constants (`SITE_URL`, size) and the pure `applyShareMeta(html, meta)`. |
| `scripts/share/shoot.js` (create) | `npm run share:shots`: exported `parseShootArgs`, plus a `main` that drives Chrome and writes `public/share/*.jpg`. |
| `scripts/share/write-pages.js` (create) | Post-build: exported `writeSharePages(buildDir, pages)`, plus a `main` for `build/`. |
| `public/share/*.jpg` (create, 14 files) | The screenshots. |
| `public/index.html` (modify) | Template defaults become the home card. |
| `public/homepage-share.jpg` (delete) | Replaced by `public/share/home.jpg`. |
| `vercel.json` (modify) | One rewrite per non-root share page above the catch-all. |
| `package.json` (modify) | `build` chain, `share:shots` script, `playwright-core` devDependency. |
| `src/__tests__/shareMeta.test.js` (create) | `applyShareMeta` + page-list invariants. |
| `src/__tests__/shareShoot.test.js` (create) | `parseShootArgs`. |
| `src/__tests__/sharePages.test.js` (create) | `writeSharePages` + repo wiring (rewrites, screenshots, template). |
| `CLAUDE.md` (modify) | Command + gotcha for share cards. |

---

### Task 1: Page list and `applyShareMeta`

**Files:**
- Create: `scripts/share/pages.js`
- Create: `scripts/share/shareMeta.js`
- Test: `src/__tests__/shareMeta.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `require('./pages').SHARE_PAGES`: `Array<{ id: string, path: string, title: string, description: string, settleMs?: number, waitFor?: string }>`, home first with `path: '/'`.
  - `require('./shareMeta')`: `SITE_URL` (`'https://goofer.tv'`), `SHARE_WIDTH` (1536), `SHARE_HEIGHT` (1075), `applyShareMeta(html: string, meta: { title, description, url, image, imageWidth, imageHeight }): string`. Throws `Error` whose message contains the missing tag's key.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/shareMeta.test.js`:

```js
/**
 * @jest-environment node
 */
import { applyShareMeta } from '../../scripts/share/shareMeta';
import { SHARE_PAGES } from '../../scripts/share/pages';

// Shaped like CRA's minified build/index.html head.
const TEMPLATE = [
  '<head>',
  '<meta name="description" content="old"/>',
  '<meta property="og:title" content="old"/>',
  '<meta property="og:description" content="old"/>',
  '<meta property="og:url" content="old"/>',
  '<meta property="og:type" content="website"/>',
  '<meta property="og:image" content="old"/>',
  '<meta property="og:image:secure_url" content="old"/>',
  '<meta property="og:image:type" content="image/jpeg"/>',
  '<meta property="og:image:width" content="1"/>',
  '<meta property="og:image:height" content="1"/>',
  '<meta property="og:image:alt" content="old"/>',
  '<meta name="twitter:card" content="summary_large_image"/>',
  '<meta name="twitter:title" content="old"/>',
  '<meta name="twitter:description" content="old"/>',
  '<meta name="twitter:image" content="old"/>',
  '<meta name="twitter:image:alt" content="old"/>',
  '<title>Goofer Live</title>',
  '</head>',
].join('');

const META = {
  title: 'Store · GooferG',
  description: 'Spend your watch-time tickets.',
  url: 'https://goofer.tv/store',
  image: 'https://goofer.tv/share/store.jpg?v=0123abcd',
  imageWidth: 1536,
  imageHeight: 1075,
};

// content="" of the one tag whose attr exactly equals key (the closing quote
// keeps og:image from matching og:image:width).
function contentOf(html, attr, key) {
  const tag = html.match(new RegExp(`<meta[^>]*\\b${attr}="${key}"[^>]*>`));
  if (!tag) return undefined;
  const content = tag[0].match(/content="([^"]*)"/);
  return content ? content[1] : undefined;
}

describe('applyShareMeta', () => {
  test('fills every card tag', () => {
    const html = applyShareMeta(TEMPLATE, META);
    expect(contentOf(html, 'name', 'description')).toBe(META.description);
    expect(contentOf(html, 'property', 'og:title')).toBe(META.title);
    expect(contentOf(html, 'property', 'og:description')).toBe(META.description);
    expect(contentOf(html, 'property', 'og:url')).toBe(META.url);
    expect(contentOf(html, 'property', 'og:image:alt')).toBe(META.description);
    expect(contentOf(html, 'name', 'twitter:title')).toBe(META.title);
    expect(contentOf(html, 'name', 'twitter:description')).toBe(META.description);
    expect(contentOf(html, 'name', 'twitter:image')).toBe(META.image);
    expect(contentOf(html, 'name', 'twitter:image:alt')).toBe(META.description);
  });

  test('keeps og:image apart from the og:image:* tags', () => {
    const html = applyShareMeta(TEMPLATE, META);
    expect(contentOf(html, 'property', 'og:image')).toBe(META.image);
    expect(contentOf(html, 'property', 'og:image:secure_url')).toBe(META.image);
    expect(contentOf(html, 'property', 'og:image:width')).toBe('1536');
    expect(contentOf(html, 'property', 'og:image:height')).toBe('1075');
    expect(contentOf(html, 'property', 'og:image:type')).toBe('image/jpeg');
  });

  test('leaves the tab title and fixed tags alone', () => {
    const html = applyShareMeta(TEMPLATE, META);
    expect(html).toContain('<title>Goofer Live</title>');
    expect(contentOf(html, 'property', 'og:type')).toBe('website');
    expect(contentOf(html, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  test('escapes copy so it cannot break the attribute', () => {
    const html = applyShareMeta(TEMPLATE, {
      ...META,
      description: 'Hunts & "battles" <live> $& more',
    });
    expect(contentOf(html, 'property', 'og:description')).toBe(
      'Hunts &amp; &quot;battles&quot; &lt;live&gt; $&amp; more'
    );
    expect(html.match(/<meta/g)).toHaveLength(16);
  });

  test('matches tags whatever the attribute order or closing style', () => {
    const template = TEMPLATE.replace(
      '<meta property="og:title" content="old"/>',
      '<meta content="old" property="og:title" />'
    );
    const html = applyShareMeta(template, META);
    expect(contentOf(html, 'property', 'og:title')).toBe(META.title);
  });

  test('throws naming the tag the template is missing', () => {
    const template = TEMPLATE.replace('<meta name="twitter:image" content="old"/>', '');
    expect(() => applyShareMeta(template, META)).toThrow('twitter:image');
  });
});

describe('SHARE_PAGES', () => {
  test('ids and paths are unique and home is /', () => {
    const ids = SHARE_PAGES.map((p) => p.id);
    const paths = SHARE_PAGES.map((p) => p.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(SHARE_PAGES.find((p) => p.id === 'home').path).toBe('/');
  });

  test('every page has a clean path, a title and a description', () => {
    for (const page of SHARE_PAGES) {
      expect(page.id).toMatch(/^[a-z0-9-]+$/);
      expect(page.path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/);
      expect(page.title.trim()).not.toBe('');
      expect(page.description.trim()).not.toBe('');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=shareMeta`
Expected: FAIL, `Cannot find module '../../scripts/share/shareMeta'`.

- [ ] **Step 3: Write `scripts/share/pages.js`**

```js
// Pages that get their own link-preview card (Discord, X, iMessage, Slack).
// write-pages.js stamps each one's og:/twitter: tags into build/<path>/index.html,
// and each needs a screenshot at public/share/<id>.jpg (npm run share:shots).
// Adding a page: list it here, add its vercel.json rewrite above the catch-all,
// then shoot it. Unlisted routes get the home card.
// settleMs / waitFor are capture hints for shoot.js.
const SHARE_PAGES = [
  {
    id: 'home',
    path: '/',
    title: 'GooferG',
    description: 'Late-night variety streams, bonus hunts, clips and more.',
  },
  {
    id: 'schedule',
    path: '/schedule',
    title: 'Schedule · GooferG',
    description: "When the tube's on. The weekly stream schedule.",
  },
  {
    id: 'vods',
    path: '/vods',
    title: 'Vods · GooferG',
    description: 'Past broadcasts and the best clips, for when you missed it.',
  },
  {
    id: 'about',
    path: '/about',
    title: 'About · GooferG',
    description: "Who's behind the glasses.",
  },
  {
    id: 'gaming',
    path: '/gaming',
    title: 'Gaming · GooferG',
    description: "What's being played and what's in the library.",
  },
  {
    id: 'gear',
    path: '/gear',
    title: 'Gear · GooferG',
    description: 'The setup: every piece of kit you see on stream.',
  },
  {
    id: 'gamba',
    path: '/gamba',
    title: 'Gamba · GooferG',
    description: 'Leaderboard, bonus hunts, battles and the slot picker. Pick a channel.',
  },
  {
    id: 'leaderboard',
    path: '/gamba/leaderboard',
    title: 'Leaderboard · GooferG',
    description: 'Live wager race standings for code BEAN on Rainbet.',
    settleMs: 4000,
  },
  {
    id: 'hunts',
    path: '/gamba/hunts',
    title: 'Hunts · GooferG',
    description: 'Live bonus hunts and the prediction round. Call the total.',
    settleMs: 4000,
  },
  {
    id: 'bonus-battle',
    path: '/gamba/bonus-battle',
    title: 'Bonus Battle · GooferG',
    description: 'Bonus buys, head to head.',
  },
  {
    id: 'wheel',
    path: '/gamba/wheel',
    title: 'Slot Picker · GooferG',
    description: "Can't pick a slot? Spin for one.",
  },
  {
    id: 'store',
    path: '/store',
    title: 'Store · GooferG',
    description: 'Spend your watch-time tickets.',
  },
  {
    id: 'giveaway',
    path: '/giveaway',
    title: 'Giveaway · GooferG',
    description: 'Live giveaways. Type the keyword in chat to enter.',
  },
  {
    id: 'suggest',
    path: '/suggest',
    title: 'Suggest · GooferG',
    description: 'Pitch a game or slot for the stream.',
  },
];

module.exports = { SHARE_PAGES };
```

- [ ] **Step 4: Write `scripts/share/shareMeta.js`**

```js
// Stamps one page's link-preview card into the built index.html.
// <title> is left alone on purpose: crawlers read og:title, and a per-page
// <title> would go stale after in-app navigation.

const SITE_URL = 'https://goofer.tv';
const SHARE_WIDTH = 1536;
const SHARE_HEIGHT = 1075;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// [attribute, key, value] for every tag a card fills in.
function cardTags(meta) {
  return [
    ['name', 'description', meta.description],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', meta.url],
    ['property', 'og:image', meta.image],
    ['property', 'og:image:secure_url', meta.image],
    ['property', 'og:image:width', meta.imageWidth],
    ['property', 'og:image:height', meta.imageHeight],
    ['property', 'og:image:alt', meta.description],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', meta.image],
    ['name', 'twitter:image:alt', meta.description],
  ];
}

function applyShareMeta(html, meta) {
  return cardTags(meta).reduce((out, [attr, key, value]) => {
    // The closing quote after the key keeps og:image from matching og:image:width.
    const tagPattern = new RegExp(`<meta\\b[^>]*\\b${attr}="${escapeRegExp(key)}"[^>]*>`);
    const match = tagPattern.exec(out);
    if (!match || !/\bcontent="[^"]*"/.test(match[0])) {
      throw new Error(`<meta ${attr}="${key}" content="…"> is missing from the template`);
    }
    // Function replacements so "$&" in copy is never read as a pattern.
    const filled = match[0].replace(/\bcontent="[^"]*"/, () => `content="${escapeAttr(value)}"`);
    return out.slice(0, match.index) + filled + out.slice(match.index + match[0].length);
  }, html);
}

module.exports = { SITE_URL, SHARE_WIDTH, SHARE_HEIGHT, applyShareMeta };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=shareMeta`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "feat/share-embeds" ] && git add scripts/share/pages.js scripts/share/shareMeta.js src/__tests__/shareMeta.test.js && git commit -m "feat(share): page list and og tag stamping"
```

---

### Task 2: Screenshot script and the first image set

**Files:**
- Create: `scripts/share/shoot.js`
- Create: `public/share/<id>.jpg` × 14 (generated)
- Modify: `package.json` (`scripts.share:shots`, devDependency `playwright-core`)
- Test: `src/__tests__/shareShoot.test.js`

**Interfaces:**
- Consumes: `SHARE_PAGES` from `scripts/share/pages.js`; `SITE_URL`, `SHARE_WIDTH`, `SHARE_HEIGHT` from `scripts/share/shareMeta.js`.
- Produces: `require('./shoot').parseShootArgs(argv: string[], pages = SHARE_PAGES): { base: string, pages: Page[] }`; files `public/share/<id>.jpg` for every page id.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/shareShoot.test.js`:

```js
/**
 * @jest-environment node
 */
import { parseShootArgs } from '../../scripts/share/shoot';

const PAGES = [
  { id: 'home', path: '/' },
  { id: 'store', path: '/store' },
  { id: 'hunts', path: '/gamba/hunts' },
];

describe('parseShootArgs', () => {
  test('defaults to every page on goofer.tv', () => {
    expect(parseShootArgs([], PAGES)).toEqual({ base: 'https://goofer.tv', pages: PAGES });
  });

  test('--only picks pages, kept in list order', () => {
    const { pages } = parseShootArgs(['--only=hunts, store'], PAGES);
    expect(pages.map((p) => p.id)).toEqual(['store', 'hunts']);
  });

  test('--only with an unknown id names the valid ones', () => {
    expect(() => parseShootArgs(['--only=store,shop'], PAGES)).toThrow(
      'Unknown page id(s): shop. Valid: home, store, hunts'
    );
  });

  test('--only with nothing after it is an error', () => {
    expect(() => parseShootArgs(['--only='], PAGES)).toThrow('--only needs');
  });

  test('--base drops trailing slashes', () => {
    expect(parseShootArgs(['--base=http://localhost:3000/'], PAGES).base).toBe(
      'http://localhost:3000'
    );
  });

  test('--base must be an http(s) URL', () => {
    expect(() => parseShootArgs(['--base=goofer.tv'], PAGES)).toThrow('--base must be');
  });

  test('unknown flags are errors', () => {
    expect(() => parseShootArgs(['--dry'], PAGES)).toThrow('Unknown argument: --dry');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=shareShoot`
Expected: FAIL, `Cannot find module '../../scripts/share/shoot'`.

- [ ] **Step 3: Install `playwright-core` and add the script entry**

Run: `npm install --save-dev playwright-core@^1.63.0`
Expected: `package.json` devDependencies gains `"playwright-core": "^1.63.0"`; no browser download happens.

Then in `package.json` `scripts`, add after `"build"`:

```json
    "share:shots": "node scripts/share/shoot.js",
```

- [ ] **Step 4: Write `scripts/share/shoot.js`**

```js
// Screenshots each share page on the live site for its link-preview card.
//   npm run share:shots                          every page from https://goofer.tv
//   npm run share:shots -- --only=store,hunts    just those ids
//   npm run share:shots -- --base=http://localhost:3000
// Drives the installed Google Chrome through playwright-core (nothing downloads).
// Commit the JPGs; the build hashes them into each card's ?v= so Discord refetches.
const fs = require('fs');
const path = require('path');
const { SHARE_PAGES } = require('./pages');
const { SITE_URL, SHARE_WIDTH, SHARE_HEIGHT } = require('./shareMeta');

const OUT_DIR = path.resolve(__dirname, '../../public/share');
const DEFAULT_SETTLE_MS = 2500;
const HIDE_SCROLLBARS = 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}';

function parseShootArgs(argv, pages = SHARE_PAGES) {
  let base = SITE_URL;
  let only = null;
  for (const arg of argv) {
    if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else if (arg.startsWith('--only=')) {
      only = arg
        .slice('--only='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  base = base.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) {
    throw new Error(`--base must be an http(s) URL, got "${base}"`);
  }
  if (!only) return { base, pages };
  if (only.length === 0) throw new Error('--only needs at least one page id');
  const unknown = only.filter((id) => !pages.some((p) => p.id === id));
  if (unknown.length) {
    throw new Error(
      `Unknown page id(s): ${unknown.join(', ')}. Valid: ${pages.map((p) => p.id).join(', ')}`
    );
  }
  return { base, pages: pages.filter((p) => only.includes(p.id)) };
}

async function main() {
  const { base, pages } = parseShootArgs(process.argv.slice(2));
  const { chromium } = require('playwright-core');

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch (err) {
    throw new Error(
      `Couldn't start Google Chrome (playwright-core uses the installed one).\n${err.message}`
    );
  }

  const context = await browser.newContext({
    viewport: { width: SHARE_WIDTH, height: SHARE_HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  // Skip the power-on gate, the static flip and the welcome sign-on.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('gg_tv_powered', '1');
      window.localStorage.setItem('gg_welcome_seen', '1');
      window.sessionStorage.setItem('tvIntroPlayed', '1');
    } catch {
      // storage blocked: the intro may show in this shot
    }
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const failed = [];
  for (const page of pages) {
    const url = base + page.path;
    const tab = await context.newPage();
    try {
      // Not 'networkidle': Firestore's long-poll keeps the network busy.
      await tab.goto(url, { waitUntil: 'load', timeout: 60000 });
      await tab.addStyleTag({ content: HIDE_SCROLLBARS });
      await tab.evaluate(() => document.fonts.ready);
      if (page.waitFor) await tab.waitForSelector(page.waitFor, { timeout: 15000 });
      await tab.waitForTimeout(page.settleMs ?? DEFAULT_SETTLE_MS);
      const file = path.join(OUT_DIR, `${page.id}.jpg`);
      await tab.screenshot({ path: file, type: 'jpeg', quality: 82 });
      const kb = Math.round(fs.statSync(file).size / 1024);
      console.log(`  ${page.id.padEnd(13)} ${url} -> public/share/${page.id}.jpg (${kb} KB)`);
    } catch (err) {
      failed.push(page.id);
      console.error(`  ${page.id.padEnd(13)} FAILED: ${err.message.split('\n')[0]} (old image kept)`);
    } finally {
      await tab.close();
    }
  }
  await browser.close();

  if (failed.length) {
    console.error(`\n${failed.length} failed: ${failed.join(', ')}. Re-run with --only=${failed.join(',')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { parseShootArgs };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=shareShoot`
Expected: PASS, 7 tests.

- [ ] **Step 6: Shoot the first image set**

Run: `npm run share:shots`
Expected: 14 lines `<id> https://goofer.tv/<path> -> public/share/<id>.jpg (NNN KB)`, no FAILED lines, exit 0.

- [ ] **Step 7: Look at every image**

Open each `public/share/*.jpg` (Read tool shows images). Each must show the page itself with the nav bar: no black power-on tube, no TV static, no welcome overlay, no centred `Loading…` fallback, no blank content area. If one is mid-load, give that page a larger `settleMs` (or a `waitFor` selector for its main content) in `scripts/share/pages.js` and re-run `npm run share:shots -- --only=<id>`. Re-check that image.

- [ ] **Step 8: Commit**

```bash
[ "$(git branch --show-current)" = "feat/share-embeds" ] && git add scripts/share/shoot.js scripts/share/pages.js src/__tests__/shareShoot.test.js package.json package-lock.json public/share && git commit -m "feat(share): screenshot script and first share images"
```

---

### Task 3: Build step, rewrites and template

**Files:**
- Create: `scripts/share/write-pages.js`
- Modify: `package.json` (`scripts.build`)
- Modify: `vercel.json` (rewrites)
- Modify: `public/index.html:8-28` (meta tags)
- Delete: `public/homepage-share.jpg`
- Modify: `CLAUDE.md` (Commands, Misc, Gotchas)
- Test: `src/__tests__/sharePages.test.js`

**Interfaces:**
- Consumes: `SHARE_PAGES`; `applyShareMeta`, `SITE_URL`, `SHARE_WIDTH`, `SHARE_HEIGHT`; the 14 JPGs from Task 2.
- Produces: `require('./write-pages').writeSharePages(buildDir: string, pages = SHARE_PAGES): string[]` (paths written). Throws before writing anything if a screenshot is missing (message names the ids).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/sharePages.test.js`:

```js
/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeSharePages } from '../../scripts/share/write-pages';
import { SHARE_PAGES } from '../../scripts/share/pages';
import vercel from '../../vercel.json';

const ROOT = path.resolve(__dirname, '../..');

const PAGES = [
  { id: 'home', path: '/', title: 'GooferG', description: 'Home copy.' },
  {
    id: 'leaderboard',
    path: '/gamba/leaderboard',
    title: 'Leaderboard · GooferG',
    description: 'Board copy.',
  },
];

const tempDirs = [];
afterAll(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

// A fake build/ using the real template, with the given screenshot bytes.
function makeBuild(images) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'share-build-'));
  tempDirs.push(dir);
  fs.copyFileSync(path.join(ROOT, 'public', 'index.html'), path.join(dir, 'index.html'));
  fs.mkdirSync(path.join(dir, 'share'));
  Object.entries(images).forEach(([id, bytes]) => {
    fs.writeFileSync(path.join(dir, 'share', `${id}.jpg`), bytes);
  });
  return dir;
}

const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const ogImage = (html) => html.match(/property="og:image" content="([^"]*)"/)[1];

describe('writeSharePages', () => {
  test('writes a card per page, nested paths included, home over the template', () => {
    const dir = makeBuild({ home: 'aaa', leaderboard: 'bbb' });
    writeSharePages(dir, PAGES);
    const home = read(dir, 'index.html');
    const board = read(dir, 'gamba', 'leaderboard', 'index.html');
    expect(home).toContain('property="og:url" content="https://goofer.tv/"');
    expect(board).toContain('property="og:url" content="https://goofer.tv/gamba/leaderboard"');
    expect(board).toContain('property="og:title" content="Leaderboard · GooferG"');
    expect(board).toContain('<title>Goofer Live</title>');
    expect(ogImage(home)).toMatch(/^https:\/\/goofer\.tv\/share\/home\.jpg\?v=[0-9a-f]{8}$/);
    expect(ogImage(board)).toMatch(/^https:\/\/goofer\.tv\/share\/leaderboard\.jpg\?v=[0-9a-f]{8}$/);
  });

  test('the image version changes when the screenshot does', () => {
    const a = makeBuild({ home: 'one', leaderboard: 'x' });
    const b = makeBuild({ home: 'two', leaderboard: 'x' });
    writeSharePages(a, PAGES);
    writeSharePages(b, PAGES);
    expect(ogImage(read(a, 'index.html'))).not.toBe(ogImage(read(b, 'index.html')));
  });

  test('a missing screenshot fails naming the page and writes nothing', () => {
    const dir = makeBuild({ home: 'aaa' });
    const before = read(dir, 'index.html');
    expect(() => writeSharePages(dir, PAGES)).toThrow('leaderboard');
    expect(fs.existsSync(path.join(dir, 'gamba'))).toBe(false);
    expect(read(dir, 'index.html')).toBe(before);
  });
});

describe('repo wiring', () => {
  const { rewrites } = vercel;
  const catchAll = rewrites.findIndex((r) => r.destination === '/index.html');

  test('every non-root share page has a rewrite above the catch-all', () => {
    expect(catchAll).toBeGreaterThan(-1);
    const wrong = SHARE_PAGES.filter((p) => p.path !== '/')
      .filter((p) => {
        const i = rewrites.findIndex((r) => r.source === p.path);
        return i === -1 || i > catchAll || rewrites[i].destination !== `${p.path}/index.html`;
      })
      .map((p) => p.path);
    expect(wrong).toEqual([]);
  });

  test('no rewrite points at a share page that is not generated', () => {
    const paths = new Set(SHARE_PAGES.map((p) => p.path));
    const stale = rewrites
      .filter((r, i) => i !== catchAll && r.destination.endsWith('/index.html'))
      .filter((r) => !paths.has(r.destination.replace(/\/index\.html$/, '')))
      .map((r) => r.source);
    expect(stale).toEqual([]);
  });

  test('every share page has its screenshot', () => {
    const missing = SHARE_PAGES.filter(
      (p) => !fs.existsSync(path.join(ROOT, 'public', 'share', `${p.id}.jpg`))
    ).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  test('the template card is the home screenshot', () => {
    const html = read(ROOT, 'public', 'index.html');
    expect(html).toContain('content="https://goofer.tv/share/home.jpg"');
    expect(html).toContain('property="og:image:width" content="1536"');
    expect(html).not.toContain('homepage-share.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=sharePages`
Expected: FAIL, `Cannot find module '../../scripts/share/write-pages'`.

- [ ] **Step 3: Write `scripts/share/write-pages.js`**

```js
// Post-build: one HTML file per share page, each carrying its own og:/twitter:
// card. Link crawlers (Discord, X, iMessage, Slack) don't run JS, so the card has
// to be in the static HTML; vercel.json rewrites each path to its file.
// Runs from `npm run build` after react-scripts build.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SHARE_PAGES } = require('./pages');
const { applyShareMeta, SITE_URL, SHARE_WIDTH, SHARE_HEIGHT } = require('./shareMeta');

function imageVersion(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
}

function writeSharePages(buildDir, pages = SHARE_PAGES) {
  // Read once up front: the home card overwrites index.html.
  const template = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
  const imageFor = (page) => path.join(buildDir, 'share', `${page.id}.jpg`);

  const missing = pages.filter((page) => !fs.existsSync(imageFor(page)));
  if (missing.length) {
    throw new Error(
      `missing screenshot for ${missing.map((p) => `${p.id} (public/share/${p.id}.jpg)`).join(', ')}; run npm run share:shots`
    );
  }

  // Render every card before writing any, so a bad template writes nothing.
  const cards = pages.map((page) => ({
    file: path.join(buildDir, ...page.path.split('/').filter(Boolean), 'index.html'),
    html: applyShareMeta(template, {
      title: page.title,
      description: page.description,
      url: SITE_URL + page.path,
      image: `${SITE_URL}/share/${page.id}.jpg?v=${imageVersion(imageFor(page))}`,
      imageWidth: SHARE_WIDTH,
      imageHeight: SHARE_HEIGHT,
    }),
  }));

  cards.forEach(({ file, html }) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  });
  return cards.map(({ file }) => file);
}

if (require.main === module) {
  try {
    const written = writeSharePages(path.resolve(__dirname, '../../build'));
    console.log(`share pages: wrote ${written.length} cards`);
  } catch (err) {
    console.error(`share pages: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { writeSharePages };
```

- [ ] **Step 4: Run the writeSharePages tests**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=sharePages`
Expected: the three `writeSharePages` tests PASS. `repo wiring` still FAILS on rewrites (every non-root path listed) and the template test. The screenshot test passes, since Task 2 committed the images.

- [ ] **Step 5: Add the rewrites to `vercel.json`**

Replace the whole file with:

```json
{
  "rewrites": [
    { "source": "/schedule", "destination": "/schedule/index.html" },
    { "source": "/vods", "destination": "/vods/index.html" },
    { "source": "/about", "destination": "/about/index.html" },
    { "source": "/gaming", "destination": "/gaming/index.html" },
    { "source": "/gear", "destination": "/gear/index.html" },
    { "source": "/gamba", "destination": "/gamba/index.html" },
    { "source": "/gamba/leaderboard", "destination": "/gamba/leaderboard/index.html" },
    { "source": "/gamba/hunts", "destination": "/gamba/hunts/index.html" },
    { "source": "/gamba/bonus-battle", "destination": "/gamba/bonus-battle/index.html" },
    { "source": "/gamba/wheel", "destination": "/gamba/wheel/index.html" },
    { "source": "/store", "destination": "/store/index.html" },
    { "source": "/giveaway", "destination": "/giveaway/index.html" },
    { "source": "/suggest", "destination": "/suggest/index.html" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/watchtime-tick", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 6: Make the template's card the home card**

In `public/index.html`, replace lines 8–28 (from `<meta name="description"` through `twitter:image:alt`) with:

```html
    <meta name="description" content="Late-night variety streams, bonus hunts, clips and more." />

    <!-- Link previews (Discord, X, iMessage, Slack). These are the home card and
         the template: scripts/share/write-pages.js stamps each share page's own
         values in at build time (scripts/share/pages.js). -->
    <meta property="og:title" content="GooferG" />
    <meta property="og:description" content="Late-night variety streams, bonus hunts, clips and more." />
    <meta property="og:url" content="https://goofer.tv/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="GooferG" />
    <meta property="og:image" content="https://goofer.tv/share/home.jpg" />
    <meta property="og:image:secure_url" content="https://goofer.tv/share/home.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1536" />
    <meta property="og:image:height" content="1075" />
    <meta property="og:image:alt" content="Late-night variety streams, bonus hunts, clips and more." />

    <!-- Twitter / X card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="GooferG" />
    <meta name="twitter:description" content="Late-night variety streams, bonus hunts, clips and more." />
    <meta name="twitter:image" content="https://goofer.tv/share/home.jpg" />
    <meta name="twitter:image:alt" content="Late-night variety streams, bonus hunts, clips and more." />
```

Leave `<title>Goofer Live</title>` as is.

- [ ] **Step 7: Delete the old share image**

Run: `git grep -n "homepage-share" -- . ':!docs'`
Expected: no matches (Step 6 removed the only reference). If anything else references it, point it at `/share/home.jpg`.

Run: `git rm -q public/homepage-share.jpg`

- [ ] **Step 8: Chain the build**

In `package.json` `scripts`, change `"build"` to:

```json
    "build": "react-scripts build && node scripts/share/write-pages.js",
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=share`
Expected: PASS, 3 suites (`shareMeta`, `shareShoot`, `sharePages`), 22 tests.

- [ ] **Step 10: Build and inspect the output**

Run: `npm run build`
Expected: ends with `share pages: wrote 14 cards`.

Run:

```bash
for f in build/index.html build/store/index.html build/gamba/leaderboard/index.html; do echo "== $f"; grep -oE '<meta (property|name)="(og:title|og:url|og:image|og:image:width)" content="[^"]*"' "$f"; grep -oE '<title>[^<]*</title>|/static/js/main\.[0-9a-f]+\.js' "$f"; done; ls build/gamba
```

Expected: each file shows its own `og:title` / `og:url`, `og:image` `https://goofer.tv/share/<id>.jpg?v=<8 hex>`, width `1536`, `<title>Goofer Live</title>`, and the same `main.<hash>.js` bundle. `build/gamba` holds `index.html` plus the four tool folders.

- [ ] **Step 11: Document it in `CLAUDE.md`**

Under `## Commands`, after the `npm run build` line, add:

```markdown
- `npm run share:shots` — re-shoots the link-preview screenshots (`public/share/<id>.jpg`) from goofer.tv with the installed Chrome via `playwright-core` (`--only=store,hunts`, `--base=http://localhost:3000`). Commit the JPGs. `npm run build` chains `scripts/share/write-pages.js`, which fails the build if one is missing.
```

Under `### Misc`, replace the line `` - `vercel.json` rewrites everything except `/api/*` to `index.html` for SPA routing. `` with:

```markdown
- `vercel.json` rewrites everything except `/api/*` to `index.html` for SPA routing, after one rewrite per share page (`/store` → `/store/index.html`, see Share cards in Gotchas).
```

Under `## Gotchas`, add:

```markdown
- Share cards: link crawlers don't run JS, so per-page Discord/X/iMessage previews live in static HTML. `scripts/share/pages.js` lists the pages and copy; after `react-scripts build`, `scripts/share/write-pages.js` writes `build/<path>/index.html` with that page's `og:`/`twitter:` tags (image `?v=` is the screenshot's hash, so a re-shoot busts Discord's cache). Each non-root page needs a `vercel.json` rewrite above the catch-all; `src/__tests__/sharePages.test.js` fails on a missing or stale one (a stale rewrite 404s real visitors). `<title>` is not per-page. Unlisted routes get the home card.
```

- [ ] **Step 12: Commit**

```bash
[ "$(git branch --show-current)" = "feat/share-embeds" ] && git add scripts/share/write-pages.js src/__tests__/sharePages.test.js vercel.json package.json public/index.html CLAUDE.md && git commit -m "feat(share): per-page share cards at build time"
```

(`git rm` already staged the deleted `public/homepage-share.jpg`; the commit includes it.)

---

### Task 4: Ship and verify

**Files:** none changed (verification and PR only).

**Interfaces:**
- Consumes: the branch from Tasks 1–3. Vercel project `streamsite-g5q2` (`prj_eSgAvx8vddSaBbpuIfgO1DmkeDjz`), team `team_nveSvPBZjMHWflbgUAF1GMl2`; preview URLs are behind Vercel SSO, so fetch them with the Vercel MCP `web_fetch_vercel_url` tool, not curl.
- Produces: an open PR; verified preview; post-merge production check.

- [ ] **Step 1: Run the full test suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: all suites pass. If a non-share suite fails, re-run just that suite with `--testPathPattern=<name>`; this branch doesn't touch `src/` outside `src/__tests__/share*`, so a failure there predates it. Note it in the PR body instead of fixing unrelated code.

- [ ] **Step 2: Push**

```bash
[ "$(git branch --show-current)" = "feat/share-embeds" ] && git push -u origin feat/share-embeds
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --head feat/share-embeds --title "feat: per-page Discord share cards" --body "$(cat <<'EOF'
## What

Links to goofer.tv pages now preview *that* page in Discord / X / iMessage / Slack instead of always showing the home card.

- `scripts/share/pages.js`: 14 pages (home, schedule, vods, about, gaming, gear, gamba hub + 4 tools, store, giveaway, suggest) with title + description.
- `npm run share:shots`: screenshots each page on goofer.tv with the installed Chrome (`playwright-core`) into `public/share/<id>.jpg`.
- `npm run build` now runs `scripts/share/write-pages.js` after the CRA build: writes `build/<path>/index.html` with that page's `og:`/`twitter:` tags. Image URLs carry `?v=<hash>` so re-shoots bust Discord's cache. Missing screenshot = failed build.
- `vercel.json`: one rewrite per page above the SPA catch-all. A test fails on a missing or stale rewrite.
- `<title>` is unchanged; unlisted routes keep the home card.

Spec: `docs/superpowers/specs/2026-10-03-share-embeds-design.md`

## Verify after merge

`curl -s -A Discordbot https://goofer.tv/store | grep -o 'og:[a-z:_]*" content="[^"]*"'`, then paste a few links in Discord.
EOF
)"
```

Expected: PR URL printed. No Claude attribution line in the body.

- [ ] **Step 4: Verify the preview deployment**

With the Vercel MCP: `list_deployments` for project `prj_eSgAvx8vddSaBbpuIfgO1DmkeDjz` (team `team_nveSvPBZjMHWflbgUAF1GMl2`), take the newest deployment for branch `feat/share-embeds`, wait for `READY`. Check its build events/logs contain `share pages: wrote 14 cards` (proves Vercel runs `npm run build`). Then `web_fetch_vercel_url` on:
- `<preview>/store`: `og:title` `Store · GooferG`, `og:image` `https://goofer.tv/share/store.jpg?v=…`.
- `<preview>/gamba/leaderboard`: its own card, and the page HTML references `/static/js/main.…js`.
- `<preview>/terms`: the home card (`og:title` `GooferG`).
- `<preview>/share/store.jpg`: an image response.

If the build log lacks the line, the project overrides its build command: report to the user (fix is in Vercel project settings, Build Command = `npm run build`), don't merge.

- [ ] **Step 5: Hand off, then check production after the user merges**

Tell the user the PR is ready. After they merge and production deploys:

```bash
curl -s -A Discordbot https://goofer.tv/store | grep -o 'og:[a-z:_]*" content="[^"]*"'
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://goofer.tv/share/store.jpg
```

Expected: store's card tags; `200 image/jpeg`. Ask the user to paste `https://goofer.tv/store` and `https://goofer.tv/gamba/leaderboard` in Discord.

- [ ] **Step 6: Reset local to main**

```bash
git switch main && git pull --ff-only
```
