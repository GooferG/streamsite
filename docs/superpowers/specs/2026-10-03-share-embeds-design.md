# Per-page share embeds

Date: 2026-10-03
Branch: `feat/share-embeds`

## Goal

A goofer.tv link pasted into Discord (or X, iMessage, Slack) shows a preview of
*that* page: linking the store shows the store, linking a Gamba tool shows that
tool. Today every link shows the same home card.

## Why it doesn't work today

Link crawlers don't run JavaScript; they read the static HTML. `vercel.json`
rewrites every non-API path to the one `index.html`, so every URL carries the
same `og:` / `twitter:` tags and the same `homepage-share.jpg`.

## Decisions

- **Image style:** real screenshots of each page, framed like the current
  `homepage-share.jpg` (a plain viewport capture, ~1536×1075).
- **Capture:** an on-demand script shoots the live production site. Images show
  whatever is live at capture time; re-run when a page changes.
- **Serving:** approach A — pre-built HTML per page at build time. Rejected: edge
  middleware and bot-only API rewrites (both depend on a user-agent list and run
  per request).
- **Scope:** main pages, the Gamba hub + tools, and viewer features. Everything
  else keeps the default card.
- **Out of scope:** per-page `document.title` during in-app navigation; live
  data rendered into images; a per-battle image for `/battle/:ownerId`; the
  trailing-slash variants (`/store/` falls back to the default card).

## Pages

One list, `scripts/share/pages.js` (CommonJS so the Node build script and Jest
both load it). Each entry: `{ id, path, title, description }`, plus optional
capture hints `settleMs` and `waitFor` (CSS selector). The image is always
`public/share/<id>.jpg`.

| id | path | title | description |
|---|---|---|---|
| home | `/` | GooferG | Late-night variety streams, bonus hunts, clips and more. |
| schedule | `/schedule` | Schedule · GooferG | When the tube's on. The weekly stream schedule. |
| vods | `/vods` | Vods · GooferG | Past broadcasts and the best clips, for when you missed it. |
| about | `/about` | About · GooferG | Who's behind the glasses. |
| gaming | `/gaming` | Gaming · GooferG | What's being played and what's in the library. |
| gear | `/gear` | Gear · GooferG | The setup: every piece of kit you see on stream. |
| gamba | `/gamba` | Gamba · GooferG | Leaderboard, bonus hunts, battles and the slot picker. Pick a channel. |
| leaderboard | `/gamba/leaderboard` | Leaderboard · GooferG | Live wager race standings for code BEAN on Rainbet. |
| hunts | `/gamba/hunts` | Hunts · GooferG | Live bonus hunts and the prediction round. Call the total. |
| bonus-battle | `/gamba/bonus-battle` | Bonus Battle · GooferG | Bonus buys, head to head. |
| wheel | `/gamba/wheel` | Slot Picker · GooferG | Can't pick a slot? Spin for one. |
| store | `/store` | Store · GooferG | Spend your watch-time tickets. |
| giveaway | `/giveaway` | Giveaway · GooferG | Live giveaways. Type the keyword in chat to enter. |
| suggest | `/suggest` | Suggest · GooferG | Pitch a game or slot for the stream. |

Image alt text reuses the description. Every unlisted route (admin, `/me`,
callbacks, OBS overlays, `/terms`, `/battle/:ownerId`, `/gear-interactive`,
`/gamba/equity`) gets the home card, as today.

## Build and serving

### `scripts/share/shareMeta.js`

Pure CommonJS module.

- `applyShareMeta(html, meta)` where `meta` is
  `{ title, description, url, image, imageWidth, imageHeight }`. Replaces the
  `content` of: `description`, `og:title`,
  `og:description`, `og:url`, `og:image`, `og:image:secure_url`,
  `og:image:width`, `og:image:height`, `og:image:alt`, `twitter:title`,
  `twitter:description`, `twitter:image`, `twitter:image:alt`. Values are
  HTML-escaped (`&`, `"`, `<`, `>`). `<title>` is left alone: crawlers read
  `og:title`, and a per-page `<title>` would go stale after in-app navigation.
- Throws, naming the tag, if any expected tag is missing from the template, so
  template drift fails the build instead of shipping a half-filled card.
- Also exports `SITE_URL = 'https://goofer.tv'` and the capture size
  (`SHARE_WIDTH = 1536`, `SHARE_HEIGHT = 1075`), shared with the shooter.

### `scripts/share/write-pages.js`

Runs after the CRA build.

1. Read `build/index.html` once (the template).
2. For each page: read `build/share/<id>.jpg` (CRA copies `public/`), take the
   first 8 hex chars of its SHA-1 as a version, and build
   `https://goofer.tv/share/<id>.jpg?v=<hash>`. The hash means Discord fetches
   a re-shot image instead of reusing its cached one.
3. `applyShareMeta` with the page's title, description, canonical URL
   (`SITE_URL + path`, `/` for home) and image.
4. Write `build<path>/index.html`; the home entry overwrites `build/index.html`
   itself, so the default card for unlisted routes is the hashed home card.
5. Exit non-zero if any image is missing or `applyShareMeta` throws.

`public/index.html` keeps the home values as template defaults (pointing at
`share/home.jpg`, 1536×1075) so `npm start` stays sensible. `homepage-share.jpg`
is deleted.

### `package.json`

- `"build": "react-scripts build && node scripts/share/write-pages.js"`.
- `"share:shots": "node scripts/share/shoot.js"`.
- devDependency `playwright-core`.
- Verify the Vercel project has no build-command override (it must run
  `npm run build`, or the write step never runs).

### `vercel.json`

One rewrite per non-root page, above the existing catch-all, e.g.
`{ "source": "/store", "destination": "/store/index.html" }`. Explicit so it
doesn't rely on Vercel's directory-index resolution. `crons` unchanged.

Real visitors get the same app: the per-page HTML only differs in `<head>`, and
CRA's asset paths are absolute (`/static/js/...`), so nested folders load fine.
No collisions: `public/about/` and `public/brand/` contain only images.

## Screenshot script

`scripts/share/shoot.js`, run as `npm run share:shots`.

- `playwright-core`, `chromium.launch({ channel: 'chrome' })`: uses the
  installed Chrome, nothing downloaded; clear error if Chrome isn't found.
- Context: viewport `SHARE_WIDTH × SHARE_HEIGHT`, `deviceScaleFactor: 1`,
  `colorScheme: 'dark'`, `reducedMotion: 'reduce'`.
- Init script sets `localStorage.gg_tv_powered = '1'`,
  `localStorage.gg_welcome_seen = '1'`, `sessionStorage.tvIntroPlayed = '1'`:
  no power-on gate, static flip or welcome overlay.
- Per page: `goto(base + path, { waitUntil: 'load' })`, hide scrollbars with an
  injected style, await `document.fonts.ready`, wait for `waitFor` if set, then
  `settleMs` (default 2500). Not `networkidle`: Firestore's long-poll keeps the
  network busy and it would hang.
- JPEG, quality 82, to `public/share/<id>.jpg`; prints each file and size.
- Flags: `--base=<url>` (default `https://goofer.tv`), `--only=<id,id>`.
- Signed out, so the staff control room never appears.

## Testing

`src/__tests__/sharePages.test.js` (Jest, loads the CommonJS modules):

- `applyShareMeta` sets every listed tag and leaves `<title>` alone; escapes
  `&` and quotes; throws on a missing tag.
- Page ids and paths are unique; home is `/`.
- Every non-root page has a `vercel.json` rewrite to `<path>/index.html` that
  comes before the catch-all.
- Every page has `public/share/<id>.jpg`.

Manual:

- `npm run build`, then inspect `build/store/index.html`,
  `build/gamba/leaderboard/index.html` and `build/index.html`.
- After merge: `curl -A Discordbot https://goofer.tv/store` shows the store tags;
  paste links in Discord to see the embeds.

## Rollout

Feature branch `feat/share-embeds` off `main`, PR for the user to merge. The
first image set is shot from production, which already runs the On Air nav
(PR #39). Re-run `npm run share:shots` and commit whenever a page's look
changes.
