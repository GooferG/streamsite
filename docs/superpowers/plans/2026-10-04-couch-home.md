# The couch (home rebuild) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild home (`/`) as "the couch": an illustrated living room where every object is a link that the camera zooms into, with a TV reel, a gamba laptop, a phone layout, an intro pull-back and the art and reel pipelines behind them.

**Architecture:** A site-level `CameraProvider` (outside the per-route `ErrorBoundary`) owns the static overlay and the camera moves (Web Animations API, transforms only). The couch follows the repo's pure-model pattern: `couchCopy.js` + `couchModel.js` turn one plain input object into doors, TV, laptop and reel state; presentational components render that; `Couch.js` wires the camera; `useCouchData.js` gathers live data; `couchFixtures.js` feeds dev fixtures and tests. Art positions come from the room's generated layout (`src/components/couch/rooms/90s.json`); rooms, seasonal themes, toys and the window are data in that layout, behaviour stays in code.

**Tech Stack:** React 19, react-router-dom 7 (declarative), CRA 5 / Jest (react-router mapped to `src/test/reactRouterDomStub.js`), Tailwind 3 with the `onair` tokens, Firebase Firestore, Vercel functions, ComfyUI (local, for art), ffmpeg (local, for the reel).

**Spec:** `docs/superpowers/specs/2026-10-04-couch-home-design.md`

## Global Constraints

- Branch `feat/couch-home`. **Nothing is pushed and no PR opens until the owner has play-tested on localhost (`npm start`, http://localhost:3000) and signed off** (Task 24).
- Other sessions switch branches in this checkout: every commit command checks the branch first: `[ "$(git branch --show-current)" = feat/couch-home ] && git commit …`.
- Commit messages: short imperative, `feat(home): …` / `test(home): …` / `docs(home): …`. **Never** add `Co-Authored-By` or any Claude attribution.
- Copy follows PRODUCT.md voice rules: no em dashes, no "X, not Y", sentence case, none of the listed AI-tell words.
- `src/components/couch/` and `src/components/camera/` use On Air tokens only: no `rgba(`, no 6-digit hex, no bare `rounded` (fixtures excepted). Raw colours live only in `src/index.css`.
- Mono labels are `${MONO}` with `tracking-[0.15em]` or more on the same line; nothing below 10px (`text-[0.625rem]`); no `font-semibold`; Bricolage weights 500/700/800 only.
- `font-onair-marker` only at 15px or larger, size set on the same line, using one of `text-[0.9375rem]`, `text-[1.0625rem]`, `text-[1.25rem]`.
- Only the TV casts light, and only while live. Glow tokens (`shadow-onair-live`, `-led`, …) only through `StatusLight`.
- Every animation is `motion-safe:` or gated on `prefersReducedMotion()`.
- Toys and dressing are `aria-hidden`, pointer and touch only, never in the tab order and never on a door. Toys light themselves only (art plus an opacity flicker), never with a glow token.
- Room art lives in `public/couch/<room>/` (today `90s`); its layout in `src/components/couch/rooms/<room>.json`.
- At most two new Firestore listeners on home (the prediction round and the live giveaway), each `limit(1)`.
- Budgets: plate 1280/1920/2560 at most 90/150/250 KB; cutouts at most 40 KB; reel loop at most 600 KB; reel (AV1 + posters) at most 4 MB; posters at most 30 KB.
- Fixtures load only behind `process.env.NODE_ENV !== 'production'` (webpack drops them).
- Tests: `npm test -- --watchAll=false --testPathPattern=<pattern>`. CRA resets mocks before each test, so arm `jest.fn` implementations inside `beforeEach` or the test. No jest-dom: assert with `toBeTruthy()`, `toBeNull()`, `getAttribute`, `textContent`.
- jsdom has no `matchMedia`, `ResizeObserver` or `Element.prototype.animate`; code guards for all three.

## Review Focus

- **Back after a door:** pressing Back to home after going through a door pulls the camera back exactly once; a later visit to `/` by the nav does not replay it (tests in Task 5 and Task 16).
- **Rapid or double clicks:** a second door click while the camera is moving does nothing; only one navigation happens (tests in Task 5 and Task 16).
- **A viewer outside Arizona near midnight:** day words follow the viewer's calendar ("tomorrow" vs a weekday), never Goofer's (test in Task 7).
- **The stream ends while watching inside the TV:** the frame closes and the room is usable again, without errors (test in Task 16).
- **Autoplay refused, reduced motion or Save-Data:** the TV falls back to stills (or one held still) and never throws or stalls (tests in Task 11 and Task 10).

---

## File map

| File | Responsibility |
| --- | --- |
| `src/components/camera/cameraMath.js` | Pure geometry: percent rects, zoom transform, cover box, view rect |
| `src/routes/loaders.js` | One `import()` per lazy page; `prefetchRoute(href)` |
| `src/test/reactRouterDomStub.js` | (modify) history stack, `state`, `key`, `useNavigationType` |
| `src/components/onAir/StaticNoise.js` | Shared channel-change static (Monitor, TV, camera) |
| `src/components/camera/CameraProvider.js` | Camera context: goThrough, enterInPlace, pullBack, hold, takeReturn, growFrom, shrinkInto |
| `src/components/camera/CameraStatic.js` | Full-viewport static under the nav |
| `src/components/camera/useDoor.js` | Link props: native modifier clicks, camera on plain click, prefetch on intent |
| `src/components/couch/couchCopy.js` | Every sentence and the time/money words |
| `src/components/couch/rooms/90s.json` / `couchLayout.js` | The room: measured positions, names, screen skin, window, toys, theme art; layout helpers |
| `src/components/couch/themes.js`, `Dressing.js` | Theme calendar, copy and art lookup; theme dressing layers |
| `src/components/couch/Toy.js`, `RoomToys.js` | Pokeable toys |
| `src/components/couch/moon.js`, `RoomWindow.js` | Tonight's moon; the window's night, blinds and window toys |
| `src/components/couch/couchModel.js` | `buildCouch(input)` and its pieces |
| `src/components/couch/couchFixtures.js` | Dev fixtures (also the tests' inputs) |
| `src/components/couch/reel.js`, `useTvReel.js` | Reel order and mode; manifest fetch |
| `src/components/couch/CouchTv.js` | TV screen: waiting, live, reel, GSN flip |
| `src/components/couch/LaptopScreen.js` | Hunt, prediction round, screensaver |
| `src/components/couch/useCouchStage.js` | Measures the room, cover box, `zoomFor(rect)` |
| `src/components/couch/RoomDoors.js`, `DoorTiles.js`, `TvCrop.js`, `CouchFront.js` | Room and phone presentation |
| `src/components/couch/TvFrame.js`, `Couch.js` | Watch mode and the camera wiring |
| `src/components/couch/useLastVisit.js`, `useLiveGiveaway.js`, `useSteamGames.js`, `useCouchData.js` | Live data |
| `src/pages/HomePage.js`, `src/App.js`, `src/components/WelcomeSignOn.js` | (modify) wiring |
| `src/index.css`, `tailwind.config.js` | (modify) couch CSS, screensaver keyframes |
| `api/steam-games.js`, `src/setupProxy.js` | (modify) CDN caching, dev proxy |
| `scripts/couch-art/comfy-tools.mjs`, `frame.py`, `measure.py` | Art pipeline |
| `scripts/tv-reel/build.mjs`, `reel.json` | Reel pipeline |

---

### Task 1: Camera geometry

**Files:**
- Create: `src/components/camera/cameraMath.js`
- Test: `src/components/camera/__tests__/cameraMath.test.js`

**Interfaces:**
- Produces: `ZOOM_FILL = 0.9`, `MAX_ZOOM = 3.5`, `REST = { scale: 1, x: 0, y: 0 }`, `pctRect(box, [x,y,w,h]) → rect`, `zoomTransform(stage, target, view, { fill, max }) → { scale, x, y }`, `toCss(zoom) → string`, `coverBox({ width, height }, aspect, [fx, fy]) → { width, height, left, top }`, `viewRect(win, navH) → rect`. A rect is `{ x, y, width, height }` in viewport px.

- [ ] **Step 1: Write the failing test**

```js
import { MAX_ZOOM, REST, coverBox, pctRect, toCss, viewRect, zoomTransform } from '../cameraMath';

const mapped = (stage, z, p) => ({ x: stage.x + z.x + z.scale * p.x, y: stage.y + z.y + z.scale * p.y });

test('pctRect turns percent of a box into pixels', () => {
  expect(pctRect({ x: 10, y: 20, width: 200, height: 100 }, [50, 10, 25, 50])).toEqual({ x: 110, y: 30, width: 50, height: 50 });
});

test('zoomTransform centres the target in the view and fills 90% of its tighter side', () => {
  const stage = { x: 0, y: 57, width: 1600, height: 900 };
  const target = pctRect(stage, [40, 30, 20, 25]);
  const view = { x: 0, y: 57, width: 1600, height: 843 };
  const z = zoomTransform(stage, target, view);
  expect(z.scale).toBeCloseTo(0.9 * Math.min(1600 / 320, 843 / 225), 5);
  const centre = mapped(stage, z, { x: target.x - stage.x + target.width / 2, y: target.y - stage.y + target.height / 2 });
  expect(centre.x).toBeCloseTo(800, 5);
  expect(centre.y).toBeCloseTo(57 + 843 / 2, 5);
});

test('zoomTransform never passes the cap', () => {
  const stage = { x: 0, y: 0, width: 1000, height: 600 };
  const z = zoomTransform(stage, { x: 500, y: 300, width: 10, height: 10 }, { x: 0, y: 0, width: 1000, height: 600 });
  expect(z.scale).toBe(MAX_ZOOM);
});

test('toCss writes translate then scale', () => {
  expect(toCss({ scale: 2, x: -10, y: 5.5 })).toBe('translate(-10px, 5.5px) scale(2)');
  expect(toCss(REST)).toBe('translate(0px, 0px) scale(1)');
});

test('coverBox fills a wide container edge to edge without exposing the top', () => {
  expect(coverBox({ width: 1600, height: 800 }, 16 / 9, [51, 43])).toEqual({ width: 1600, height: 900, left: 0, top: 0 });
});

test('coverBox on a tall container centres the focal point horizontally', () => {
  const b = coverBox({ width: 1000, height: 1000 }, 16 / 9, [51, 43]);
  expect(b.height).toBe(1000);
  expect(b.left).toBeCloseTo(500 - 0.51 * b.width, 5);
  expect(b.top).toBe(0);
});

test('coverBox at 21:9 keeps the art covering the container', () => {
  const c = { width: 2100, height: 900 };
  const b = coverBox(c, 16 / 9, [50, 50]);
  expect(b.width).toBe(2100);
  expect(b.top).toBeLessThanOrEqual(0);
  expect(b.top + b.height).toBeGreaterThanOrEqual(c.height);
});

test('viewRect is the window under the nav', () => {
  expect(viewRect({ innerWidth: 1280, innerHeight: 800 }, 57)).toEqual({ x: 0, y: 57, width: 1280, height: 743 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=cameraMath`
Expected: FAIL, "Cannot find module '../cameraMath'".

- [ ] **Step 3: Write the implementation**

```js
// Camera geometry for the couch (spec: The camera). Pure: rects in, numbers
// out. A rect is { x, y, width, height } in viewport pixels. A zoom is
// { scale, x, y }, applied as translate(x, y) scale(scale) with
// transform-origin 0 0 on the element being moved.

export const ZOOM_FILL = 0.9;
export const MAX_ZOOM = 3.5;
export const REST = Object.freeze({ scale: 1, x: 0, y: 0 });

// [x, y, w, h] in percent of `box`, as a rect in the box's coordinates.
export function pctRect(box, [px, py, pw, ph]) {
  return {
    x: box.x + (px / 100) * box.width,
    y: box.y + (py / 100) * box.height,
    width: (pw / 100) * box.width,
    height: (ph / 100) * box.height,
  };
}

// The zoom that centres `target` (a rect inside `stage`, both measured at
// rest) in `view` and fills `fill` of its tighter side, capped at `max`.
export function zoomTransform(stage, target, view, { fill = ZOOM_FILL, max = MAX_ZOOM } = {}) {
  const scale = Math.min(max, fill * Math.min(view.width / target.width, view.height / target.height));
  const cx = target.x - stage.x + target.width / 2;
  const cy = target.y - stage.y + target.height / 2;
  return {
    scale,
    x: view.x + view.width / 2 - (stage.x + cx * scale),
    y: view.y + view.height / 2 - (stage.y + cy * scale),
  };
}

export const toCss = ({ scale, x, y }) => `translate(${x}px, ${y}px) scale(${scale})`;

// Size a box of `aspect` (width / height) to cover `container`, with the focal
// point [fx, fy] (percent of the box) as near the centre as the edges allow.
export function coverBox(container, aspect, [fx, fy]) {
  const width = Math.max(container.width, container.height * aspect);
  const height = width / aspect;
  const place = (want, lowest) => Math.min(0, Math.max(lowest, want));
  return {
    width,
    height,
    left: place(container.width / 2 - (fx / 100) * width, container.width - width),
    top: place(container.height / 2 - (fy / 100) * height, container.height - height),
  };
}

// What a zoom fills: the window under the fixed nav.
export const viewRect = (win, navH) => ({ x: 0, y: navH, width: win.innerWidth, height: win.innerHeight - navH });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=cameraMath`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/camera/cameraMath.js src/components/camera/__tests__/cameraMath.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): camera geometry for the couch"
```

---

### Task 2: Shared page loaders and prefetch

**Files:**
- Create: `src/routes/loaders.js`
- Modify: `src/App.js:42-67` (six `lazy()` lines)
- Test: `src/routes/__tests__/loaders.test.js`

**Interfaces:**
- Produces: `PAGE_LOADERS` (object of `() => import(...)`, keys `schedule vods about gaming store giveaway`), `routeKey(href) → string|null`, `prefetchRoute(href) → Promise<void>` (never rejects), `__resetPrefetchForTests()`.

- [ ] **Step 1: Write the failing test**

```js
import { PAGE_LOADERS, __resetPrefetchForTests, prefetchRoute, routeKey } from '../loaders';

beforeEach(() => __resetPrefetchForTests());

test('routeKey reads the first path segment', () => {
  expect(routeKey('/gamba/hunts?fixture=open')).toBe('gamba');
  expect(routeKey('/vods')).toBe('vods');
  expect(routeKey('/')).toBeNull();
  expect(routeKey('https://twitch.tv/GooferG')).toBeNull();
});

test('prefetchRoute starts a page chunk once', async () => {
  const spy = jest.spyOn(PAGE_LOADERS, 'vods').mockResolvedValue({ default: () => null });
  const a = prefetchRoute('/vods');
  const b = prefetchRoute('/vods?tape=1');
  expect(a).toBe(b);
  await a;
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test('eager pages and external links resolve without loading anything', async () => {
  const spy = jest.spyOn(PAGE_LOADERS, 'vods');
  await prefetchRoute('/gamba/hunts');
  await prefetchRoute('https://twitch.tv/GooferG');
  await prefetchRoute('/');
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

test('a failed load is retried on the next prefetch and never rejects', async () => {
  const spy = jest
    .spyOn(PAGE_LOADERS, 'store')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ default: () => null });
  await expect(prefetchRoute('/store')).resolves.toBeUndefined();
  await prefetchRoute('/store');
  expect(spy).toHaveBeenCalledTimes(2);
  spy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=routes/__tests__/loaders`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

`src/routes/loaders.js`:

```js
// One loader per lazily loaded public page, shared by App's lazy() routes and
// the couch's doors: hovering a door starts the same chunk the route needs.
// Home and Gamba are eager and have no loader.
export const PAGE_LOADERS = {
  schedule: () => import('../pages/SchedulePage'),
  vods: () => import('../pages/VodsPage'),
  about: () => import('../pages/AboutPage'),
  gaming: () => import('../pages/GamingPage'),
  store: () => import('../pages/StorePage'),
  giveaway: () => import('../pages/GiveawayPage'),
};

const started = new Map();

// "/gamba/hunts?x" -> "gamba"; "/" and external links -> null.
export function routeKey(href) {
  if (typeof href !== 'string' || !href.startsWith('/')) return null;
  return href.split(/[?#]/)[0].split('/')[1] || null;
}

// Starts (once) the chunk for `href`'s page. A failed load is forgotten so the
// next hover retries; the returned promise never rejects.
export function prefetchRoute(href) {
  const key = routeKey(href);
  if (!key || !PAGE_LOADERS[key]) return Promise.resolve();
  if (!started.has(key)) {
    started.set(
      key,
      PAGE_LOADERS[key]().then(
        () => undefined,
        () => {
          started.delete(key);
        }
      )
    );
  }
  return started.get(key);
}

export function __resetPrefetchForTests() {
  started.clear();
}
```

In `src/App.js`, add `import { PAGE_LOADERS } from './routes/loaders';` under the other imports and replace these six lines:

```js
const SchedulePage = lazy(PAGE_LOADERS.schedule);
const VodsPage = lazy(PAGE_LOADERS.vods);
const AboutPage = lazy(PAGE_LOADERS.about);
const GamingPage = lazy(PAGE_LOADERS.gaming);
const StorePage = lazy(PAGE_LOADERS.store);
const GiveawayPage = lazy(PAGE_LOADERS.giveaway);
```

(`lazy` needs a function returning the import promise; `PAGE_LOADERS.x` is exactly that, and webpack dedupes the chunk with the door's prefetch.)

- [ ] **Step 4: Run tests**

Run: `npm test -- --watchAll=false --testPathPattern=routes/__tests__/loaders`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/loaders.js src/routes/__tests__/loaders.test.js src/App.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): share lazy page loaders so doors can prefetch"
```

---

### Task 3: Router stub with history, state and navigation type

**Files:**
- Modify: `src/test/reactRouterDomStub.js` (`DEFAULT_LOCATION`, `parseTo`, `MemoryRouter`, exports)
- Test: `src/test/__tests__/reactRouterDomStub.test.js`

**Interfaces:**
- Produces (test-only): `MemoryRouter` keeps a history stack; `useNavigate()(to, { state, replace })`, `useNavigate()(-1)` pops; `useLocation()` has `state` and `key` (`'default'` for the first entry, then `k1`, `k2`…); `useNavigationType()` returns `'POP' | 'PUSH' | 'REPLACE'`.

- [ ] **Step 1: Write the failing test**

```js
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom';

let nav;
function Probe() {
  const loc = useLocation();
  const type = useNavigationType();
  nav = useNavigate();
  return <p data-testid="probe">{`${loc.pathname}|${JSON.stringify(loc.state)}|${type}|${loc.key}`}</p>;
}
const probe = () => screen.getByTestId('probe').textContent;

test('push carries state and a fresh key; back pops to the previous entry', () => {
  render(<MemoryRouter initialEntries={['/']}><Probe /></MemoryRouter>);
  expect(probe()).toBe('/|null|POP|default');
  act(() => nav('/vods', { state: { from: 'tapes' } }));
  expect(probe()).toBe('/vods|{"from":"tapes"}|PUSH|k1');
  act(() => nav(-1));
  expect(probe()).toBe('/|null|POP|default');
});

test('replace swaps the current entry', () => {
  render(<MemoryRouter initialEntries={['/']}><Probe /></MemoryRouter>);
  act(() => nav('/', { state: { watch: true } }));
  act(() => nav('/', { replace: true, state: null }));
  expect(probe()).toBe('/|null|REPLACE|k2');
  act(() => nav(-1));
  expect(probe()).toBe('/|null|POP|default');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=reactRouterDomStub`
Expected: FAIL (`useNavigationType` is not a function).

- [ ] **Step 3: Write the implementation**

In `src/test/reactRouterDomStub.js` replace `DEFAULT_LOCATION`, `parseTo` and `MemoryRouter`, and add the navigation-type context and export:

```js
const DEFAULT_LOCATION = { pathname: '/', search: '', hash: '', state: null, key: 'default' };
const LocationContext = React.createContext(DEFAULT_LOCATION);
const NavigationTypeContext = React.createContext('POP');

function parseTo(to) {
  const path = typeof to === 'string' ? to : (to && to.pathname) || '/';
  const [pathname, search = ''] = path.split('?');
  return { ...DEFAULT_LOCATION, pathname, search: search ? `?${search}` : '' };
}

const NavigateContext = React.createContext(null);

// In-memory router with a history stack: navigate(to, { state, replace })
// pushes or replaces, navigate(-1) pops. Location carries state and a key.
function MemoryRouter({ children, initialEntries }) {
  const keys = React.useRef(0);
  const [hist, setHist] = React.useState(() => ({
    entries: [parseTo(initialEntries && initialEntries[0])],
    index: 0,
    action: 'POP',
  }));
  const navigate = React.useCallback((to, opts = {}) => {
    setHist((h) => {
      if (typeof to === 'number') {
        const index = Math.max(0, Math.min(h.entries.length - 1, h.index + to));
        return { ...h, index, action: 'POP' };
      }
      keys.current += 1;
      const entry = { ...parseTo(to), state: opts.state ?? null, key: `k${keys.current}` };
      if (opts.replace) {
        const entries = h.entries.slice();
        entries[h.index] = entry;
        return { entries, index: h.index, action: 'REPLACE' };
      }
      const entries = [...h.entries.slice(0, h.index + 1), entry];
      return { entries, index: entries.length - 1, action: 'PUSH' };
    });
  }, []);
  return React.createElement(
    NavigateContext.Provider,
    { value: navigate },
    React.createElement(
      NavigationTypeContext.Provider,
      { value: hist.action },
      React.createElement(LocationContext.Provider, { value: hist.entries[hist.index] }, children)
    )
  );
}
```

Add to `module.exports`: `useNavigationType: () => React.useContext(NavigationTypeContext),`. Leave `Link`, `Navigate`, `Routes`, `Route` as they are.

- [ ] **Step 4: Run the stub test and the whole suite (other tests use the stub)**

Run: `npm test -- --watchAll=false --testPathPattern=reactRouterDomStub` → PASS (2 tests).
Run: `npm test -- --watchAll=false` → all suites PASS. If a suite relied on `navigate(-1)` being a no-op, make that test navigate explicitly instead; do not weaken the stub.

- [ ] **Step 5: Commit**

```bash
git add src/test/reactRouterDomStub.js src/test/__tests__/reactRouterDomStub.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "test(home): router stub keeps history, state and navigation type"
```

---

### Task 4: Shared static noise

**Files:**
- Create: `src/components/onAir/StaticNoise.js`
- Modify: `src/components/onAir/Monitor.js:17-35` (move `NOISE` and `Static` out)
- Test: `src/components/onAir/__tests__/StaticNoise.test.js`

**Interfaces:**
- Produces: `StaticNoise({ className = '', style, testId = 'onair-static' })` (default export), `NOISE` (named). Monitor keeps rendering `data-testid="onair-static"`.

- [ ] **Step 1: Write the failing test**

```js
import { render, screen } from '@testing-library/react';
import StaticNoise from '../StaticNoise';

test('static is decorative and takes a test id, class and style', () => {
  render(<StaticNoise testId="tv-static" className="absolute inset-0" style={{ top: 57 }} />);
  const el = screen.getByTestId('tv-static');
  expect(el.getAttribute('aria-hidden')).toBe('true');
  expect(el.className).toMatch(/absolute inset-0/);
  expect(el.style.top).toBe('57px');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=StaticNoise` → FAIL (module not found).

- [ ] **Step 3: Write the implementation**

`src/components/onAir/StaticNoise.js`:

```js
// Channel-change static: the noise and rolling band the Monitor, the couch TV
// and the camera's cut all share. Decorative, so aria-hidden.
export const NOISE = {
  backgroundImage:
    'repeating-radial-gradient(circle at 17% 32%, #fff 0 1px, #000 1px 2px, #777 2px 3px), repeating-conic-gradient(#222 0 7deg, #ddd 7deg 9deg, #555 9deg 15deg)',
  backgroundSize: '97px 89px, 61px 53px',
  filter: 'contrast(1.6) grayscale(1)',
};

export default function StaticNoise({ className = '', style, testId = 'onair-static' }) {
  return (
    <div
      className={`pointer-events-none overflow-hidden bg-[#07060a] ${className}`}
      style={style}
      data-testid={testId}
      aria-hidden="true"
    >
      <div className="absolute inset-[-20%] animate-onair-static opacity-[0.85]" style={NOISE} />
      <div className="absolute inset-x-0 h-[30%] animate-onair-roll bg-gradient-to-b from-transparent via-white/[0.35] to-transparent" />
    </div>
  );
}
```

In `Monitor.js`: delete the local `NOISE` constant and the `Static` function body, add `import StaticNoise from './StaticNoise';`, and define:

```js
function Static() {
  return <StaticNoise className="absolute inset-0 z-[5]" />;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --watchAll=false --testPathPattern="StaticNoise|Monitor|onAirContract"` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/onAir/StaticNoise.js src/components/onAir/Monitor.js src/components/onAir/__tests__/StaticNoise.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "refactor(onair): share the channel-change static"
```

---

### Task 5: Camera provider

**Files:**
- Create: `src/components/camera/CameraProvider.js`, `src/components/camera/CameraStatic.js`
- Modify: `src/index.css` (append the camera static classes)
- Test: `src/components/camera/__tests__/CameraProvider.test.js`

**Interfaces:**
- Consumes: `REST`, `toCss`, `zoomTransform` (Task 1); `prefetchRoute` (Task 2); `StaticNoise` (Task 4); `prefersReducedMotion` from `src/components/onAir/useChannelSwitch.js`; `NAV_H` from `src/components/nav/navMetrics.js`; `useNavigate`, `useLocation`, `useNavigationType` (Task 3).
- Produces:
  - `export default function CameraProvider({ children, timings = TIMINGS })`
  - `export function useCamera()` → `{ busy, goThrough, enterInPlace, pullBack, hold, takeReturn, growFrom, shrinkInto }` or `null` outside a provider
  - `export const TIMINGS = { zoom: 650, cut: 520, staticIn: 120, minHold: 250, maxHold: 1500, tuneOut: 300, pull: 700, introPull: 1100, fade: 150, grow: 650 }`
  - `goThrough({ stage: HTMLElement, zoom, href, doorId, state }) → Promise`
  - `enterInPlace({ stage, zoom, state }) → Promise` (zooms, cuts, then `navigate(currentPath, { state })`)
  - `pullBack({ stage, zoom, duration, withStatic = true }) → Promise`
  - `hold({ stage, zoom })` (sets the transform instantly)
  - `takeReturn() → doorId | null` (once, only on a POP back to `/` from the last door's path)
  - `growFrom({ rect, src, href, doorId, view }) → Promise`, `shrinkInto({ rect, src, view }) → Promise` (phone)

- [ ] **Step 1: Write the failing test**

```js
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import CameraProvider, { useCamera } from '../CameraProvider';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));

const ZERO = { zoom: 0, cut: 0, staticIn: 0, minHold: 0, maxHold: 0, tuneOut: 0, pull: 0, introPull: 0, fade: 0, grow: 0 };
let cam;
let nav;
function Harness() {
  cam = useCamera();
  nav = useNavigate();
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}|${JSON.stringify(loc.state)}`}</p>;
}
const renderCam = (timings = ZERO) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={timings}>
        <Harness />
      </CameraProvider>
    </MemoryRouter>
  );
const where = () => screen.getByTestId('where').textContent;
const ZOOM = { scale: 2, x: -10, y: -20 };

afterEach(() => {
  delete window.matchMedia;
  delete Element.prototype.animate;
});

test('goThrough leaves the stage at the zoom, navigates and clears the static', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  expect(where()).toBe('/vods|null');
  expect(stage.style.transform).toBe('translate(-10px, -20px) scale(2)');
  expect(screen.queryByTestId('camera-static')).toBeNull();
});

test('a second door while the camera is moving is ignored', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() =>
    Promise.all([
      cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }),
      cam.goThrough({ stage, zoom: ZOOM, href: '/store', doorId: 'remote' }),
    ])
  );
  expect(where()).toBe('/vods|null');
});

test('reduced motion fades instead of zooming', async () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderCam({ ...ZERO, fade: 1 });
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  expect(where()).toBe('/vods|null');
  const keyframes = Element.prototype.animate.mock.calls.map(([kf]) => kf[0]);
  expect(keyframes.some((k) => 'transform' in k)).toBe(false);
  expect(stage.style.transform).toBe('');
});

test('Back from the door it went through hands that door back once', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  act(() => nav(-1));
  expect(where()).toBe('/|null');
  expect(cam.takeReturn()).toBe('tapes');
  expect(cam.takeReturn()).toBeNull();
});

test('arriving home by a push is not a return', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  act(() => nav('/'));
  expect(cam.takeReturn()).toBeNull();
});

test('pullBack ends at rest without static', async () => {
  renderCam();
  const stage = document.createElement('div');
  cam.hold({ stage, zoom: ZOOM });
  expect(stage.style.transform).toBe('translate(-10px, -20px) scale(2)');
  await act(() => cam.pullBack({ stage, zoom: ZOOM }));
  expect(stage.style.transform).toBe('');
  expect(screen.queryByTestId('camera-static')).toBeNull();
});

test('enterInPlace keeps the path and sets the state', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.enterInPlace({ stage, zoom: ZOOM, state: { watch: true } }));
  expect(where()).toBe('/|{"watch":true}');
});

test('growFrom grows a ghost, navigates and removes it', async () => {
  renderCam();
  await act(() =>
    cam.growFrom({ rect: { x: 10, y: 400, width: 120, height: 80 }, src: '/couch/cut-tapes.webp', href: '/vods', doorId: 'tapes', view: { x: 0, y: 57, width: 390, height: 787 } })
  );
  expect(where()).toBe('/vods|null');
  expect(screen.queryByTestId('camera-ghost')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=CameraProvider` → FAIL (module not found).

- [ ] **Step 3: Write `CameraStatic.js`**

```js
import StaticNoise from '../onAir/StaticNoise';
import { NAV_H } from '../nav/navMetrics';

// The camera's cut: full-width static under the nav. 'in' fades up, 'hold' is
// already up, 'out' fades away (classes in index.css).
const PHASE = { in: 'camera-static-in', hold: '', out: 'camera-static-out' };

export default function CameraStatic({ phase }) {
  if (!phase || phase === 'off') return null;
  return (
    <StaticNoise
      testId="camera-static"
      className={`fixed inset-x-0 bottom-0 z-40 ${PHASE[phase]}`}
      style={{ top: NAV_H }}
    />
  );
}
```

- [ ] **Step 4: Write `CameraProvider.js`**

```js
import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { prefetchRoute } from '../../routes/loaders';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import CameraStatic from './CameraStatic';
import { REST, toCss, zoomTransform } from './cameraMath';

// The site's one camera (spec: The camera). It sits above the per-route
// ErrorBoundary so a move survives the page swap: zoom into a door, cut to
// static, change the page under it, tune in. Only transforms move.
export const TIMINGS = {
  zoom: 650,
  cut: 520,
  staticIn: 120,
  minHold: 250,
  maxHold: 1500,
  tuneOut: 300,
  pull: 700,
  introPull: 1100,
  fade: 150,
  grow: 650,
};
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';
const EASE_OUT = 'cubic-bezier(0.25, 1, 0.5, 1)';
// Mirrors tailwind's signal-lock keyframes: the page settling as it tunes in.
const SIGNAL_LOCK = [
  { transform: 'translateY(-14px)' },
  { transform: 'translateY(6px)', offset: 0.3 },
  { transform: 'translateY(-2px)', offset: 0.55 },
  { transform: 'translateY(0)' },
];

const CameraContext = createContext(null);
export const useCamera = () => useContext(CameraContext);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raf = (cb) =>
  typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(cb) : setTimeout(cb, 16);
const frames = (n) => new Promise((resolve) => (n <= 0 ? resolve() : raf(() => frames(n - 1).then(resolve))));
const basePath = (href) => href.split(/[?#]/)[0];

function setTransform(el, zoom) {
  if (el) el.style.transform = zoom === REST ? '' : toCss(zoom);
}

// One transform tween, committed as an inline style when it ends.
function move(el, from, to, duration, easing) {
  if (!el) return Promise.resolve();
  if (!duration || typeof el.animate !== 'function') {
    setTransform(el, to);
    return Promise.resolve();
  }
  const anim = el.animate([{ transform: toCss(from) }, { transform: toCss(to) }], { duration, easing, fill: 'forwards' });
  return anim.finished.then(
    () => {
      setTransform(el, to);
      anim.cancel();
    },
    () => setTransform(el, to)
  );
}

function fade(el, duration) {
  if (!el || !duration || typeof el.animate !== 'function') return Promise.resolve();
  return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }).finished.catch(() => {});
}

export default function CameraProvider({ children, timings = TIMINGS }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const [staticPhase, setStaticPhase] = useState('off');
  const [ghost, setGhost] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const ghostRef = useRef(null);
  const lastDoor = useRef(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  // How we arrived at the current entry, recorded once per location key during
  // render so a page's mount effect (which runs before ours) can read it.
  const seen = useRef({ key: location.key, path: location.pathname, arrived: null });
  if (seen.current.key !== location.key) {
    seen.current = { key: location.key, path: location.pathname, arrived: { from: seen.current.path, type: navType } };
  }

  const api = useMemo(() => {
    const t = timings;
    const start = () => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      return true;
    };
    const finish = () => {
      busyRef.current = false;
      setBusy(false);
    };

    async function tuneIn() {
      await wait(t.minHold);
      await frames(2);
      const main = document.getElementById('main');
      if (main && typeof main.animate === 'function' && !prefersReducedMotion()) {
        main.animate(SIGNAL_LOCK, { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      }
      setStaticPhase('out');
      await wait(t.tuneOut);
      setStaticPhase('off');
    }

    // Zoom `el` from rest to `zoom`, bring the static up near the end, wait for
    // the page chunk (bounded), then run `go` under the static and tune in.
    async function zoomAndCut(el, zoom, duration, load, go) {
      const zooming = move(el, REST, zoom, duration, EASE_IN);
      await wait(t.cut);
      setStaticPhase('in');
      await Promise.all([zooming, wait(t.staticIn)]);
      await Promise.race([load, wait(t.maxHold)]);
      go();
      await tuneIn();
    }

    return {
      async goThrough({ stage, zoom, href, doorId, state }) {
        if (!start()) return;
        try {
          const load = prefetchRoute(href);
          lastDoor.current = { doorId, path: basePath(href) };
          if (prefersReducedMotion()) {
            await fade(stage, t.fade);
            navigate(href, { state });
            return;
          }
          await zoomAndCut(stage, zoom, t.zoom, load, () => navigate(href, { state }));
        } finally {
          finish();
        }
      },

      async enterInPlace({ stage, zoom, state }) {
        if (!start()) return;
        try {
          const path = locationRef.current.pathname;
          if (prefersReducedMotion()) {
            navigate(path, { state });
            return;
          }
          await zoomAndCut(stage, zoom, t.zoom, Promise.resolve(), () => navigate(path, { state }));
        } finally {
          finish();
        }
      },

      async pullBack({ stage, zoom, duration, withStatic = true }) {
        if (!start()) return;
        try {
          if (prefersReducedMotion()) {
            setTransform(stage, REST);
            return;
          }
          setTransform(stage, zoom);
          if (withStatic) {
            setStaticPhase('hold');
            await frames(1);
            setStaticPhase('out');
          }
          await move(stage, zoom, REST, duration ?? t.pull, EASE_OUT);
        } finally {
          if (withStatic) setStaticPhase('off');
          finish();
        }
      },

      hold({ stage, zoom }) {
        setTransform(stage, zoom);
      },

      takeReturn() {
        const arrived = seen.current.arrived;
        const door = lastDoor.current;
        if (!door || !arrived || arrived.type !== 'POP') return null;
        if (locationRef.current.pathname !== '/' || arrived.from !== door.path) return null;
        lastDoor.current = null;
        return door.doorId;
      },

      async growFrom({ rect, src, href, doorId, view }) {
        if (!start()) return;
        try {
          const load = prefetchRoute(href);
          lastDoor.current = { doorId, path: basePath(href) };
          if (prefersReducedMotion()) {
            navigate(href);
            return;
          }
          setGhost({ src, rect, transform: '' });
          await frames(1);
          const zoom = zoomTransform(rect, rect, view, { max: 6 });
          await zoomAndCut(ghostRef.current, zoom, t.grow, load, () => {
            navigate(href);
            setGhost(null);
          });
        } finally {
          finish();
        }
      },

      async shrinkInto({ rect, src, view }) {
        if (!start()) return;
        try {
          if (prefersReducedMotion()) return;
          const zoom = zoomTransform(rect, rect, view, { max: 6 });
          setGhost({ src, rect, transform: toCss(zoom) });
          setStaticPhase('hold');
          await frames(1);
          setStaticPhase('out');
          await move(ghostRef.current, zoom, REST, t.pull, EASE_OUT);
        } finally {
          setGhost(null);
          setStaticPhase('off');
          finish();
        }
      },
    };
  }, [navigate, timings]);

  const value = useMemo(() => ({ ...api, busy }), [api, busy]);
  const ghostStyle = ghost && {
    left: ghost.rect.x,
    top: ghost.rect.y,
    width: ghost.rect.width,
    height: ghost.rect.height,
    transform: ghost.transform || undefined,
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
      {ghost &&
        (ghost.src ? (
          <img
            ref={ghostRef}
            src={ghost.src}
            alt=""
            aria-hidden="true"
            data-testid="camera-ghost"
            className="pointer-events-none fixed z-[38] origin-top-left object-contain"
            style={ghostStyle}
          />
        ) : (
          <div
            ref={ghostRef}
            aria-hidden="true"
            data-testid="camera-ghost"
            className="pointer-events-none fixed z-[38] origin-top-left rounded-onair-card bg-onair-surface-4"
            style={ghostStyle}
          />
        ))}
      <CameraStatic phase={staticPhase} />
    </CameraContext.Provider>
  );
}
```

- [ ] **Step 5: Append the static classes to `src/index.css`**

```css
/* The camera's cut (src/components/camera). */
.camera-static-in {
  animation: camera-static-in 120ms ease-out both;
}
.camera-static-out {
  animation: camera-static-out 300ms ease-in both;
}
@keyframes camera-static-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes camera-static-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- --watchAll=false --testPathPattern=CameraProvider` → PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/camera/CameraProvider.js src/components/camera/CameraStatic.js src/components/camera/__tests__/CameraProvider.test.js src/index.css
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): site camera with static cut, return and phone moves"
```

---

### Task 6: Door links

**Files:**
- Create: `src/components/camera/useDoor.js`
- Test: `src/components/camera/__tests__/useDoor.test.js`

**Interfaces:**
- Consumes: `prefetchRoute` (Task 2).
- Produces: `isPlainClick(event) → boolean`; `useDoor(href, onGo) → { href, onClick, onPointerEnter, onFocus, onTouchStart }`. `onGo(anchorElement)` runs on a plain primary click or Enter, after `preventDefault()`.

- [ ] **Step 1: Write the failing test**

```js
import { fireEvent, render, screen } from '@testing-library/react';
import useDoor from '../useDoor';

const mockPrefetch = jest.fn();
jest.mock('../../../routes/loaders', () => ({ prefetchRoute: (...a) => mockPrefetch(...a) }));

function Door({ onGo }) {
  return (
    <a {...useDoor('/vods', onGo)} data-testid="door">
      Tapes
    </a>
  );
}

test('a plain click hands the anchor to onGo and stops the browser', () => {
  const onGo = jest.fn();
  render(<Door onGo={onGo} />);
  const a = screen.getByTestId('door');
  const notPrevented = fireEvent.click(a, { button: 0 });
  expect(notPrevented).toBe(false);
  expect(onGo).toHaveBeenCalledWith(a);
  expect(a.getAttribute('href')).toBe('/vods');
});

test('modifier and middle clicks stay native', () => {
  const onGo = jest.fn();
  render(<Door onGo={onGo} />);
  const a = screen.getByTestId('door');
  expect(fireEvent.click(a, { button: 0, ctrlKey: true })).toBe(true);
  expect(fireEvent.click(a, { button: 0, metaKey: true })).toBe(true);
  expect(fireEvent.click(a, { button: 1 })).toBe(true);
  expect(onGo).not.toHaveBeenCalled();
});

test('hover, focus and touch start loading the page', () => {
  render(<Door onGo={() => {}} />);
  const a = screen.getByTestId('door');
  fireEvent.pointerEnter(a);
  fireEvent.focus(a);
  fireEvent.touchStart(a);
  expect(mockPrefetch).toHaveBeenCalledTimes(3);
  expect(mockPrefetch).toHaveBeenCalledWith('/vods');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=useDoor` → FAIL.

- [ ] **Step 3: Write the implementation**

```js
import { useCallback } from 'react';
import { prefetchRoute } from '../../routes/loaders';

export function isPlainClick(e) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

// Props for a door's <a> (spec rule: Doors Are Links). Modifier and middle
// clicks and "open in new tab" stay native; a plain click (or Enter) hands the
// anchor to onGo. Hover, focus and touch start loading the page's chunk.
export default function useDoor(href, onGo) {
  const prefetch = useCallback(() => {
    prefetchRoute(href);
  }, [href]);
  const onClick = useCallback(
    (e) => {
      if (!onGo || !isPlainClick(e)) return;
      e.preventDefault();
      onGo(e.currentTarget);
    },
    [onGo]
  );
  return { href, onClick, onPointerEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
}
```

- [ ] **Step 4: Run tests** → `npm test -- --watchAll=false --testPathPattern=useDoor` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/camera/useDoor.js src/components/camera/__tests__/useDoor.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): door links keep native clicks and prefetch on intent"
```

---

### Task 7: The couch's sentences

**Files:**
- Create: `src/components/couch/couchCopy.js`
- Test: `src/components/couch/__tests__/couchCopy.test.js`

**Interfaces:**
- Consumes: `formatMoney` (`src/utils/money.js`), `calendarDay` (`src/utils/scheduleTime.js`).
- Produces: `plural`, `untilWords(ms)`, `shortUntil(ms)`, `lengthWords(seconds)`, `dayWord(ms, now, timeZone)`, `partOfDay(ms, timeZone)`, `whenAired(ms, now, timeZone)`, `money(value, currency)`, `multiplier(x)`, and `COPY` with builders `tvWaiting tvLive tvNext tvDay tvLate tvNothing noteOpen laptopHunt laptopOpen laptopLocked laptopLastHunt laptopIdle tapes tapesNone guide guideDay guideLate guideLoading guideNone games gamesNone remote photo`, each returning `{ kicker, teaser, sentence }`.

- [ ] **Step 1: Write the failing test**

```js
import { COPY, dayWord, lengthWords, multiplier, shortUntil, untilWords, whenAired } from '../couchCopy';

const AZ = 'America/Phoenix';
const NOW = Date.parse('2026-10-04T17:00:00Z'); // Sunday 10:00 AM in Arizona
const H = 3600000;

test('untilWords and shortUntil', () => {
  expect(untilWords(25 * H)).toBe('1 day 1 hour');
  expect(untilWords(3 * H + 5 * 60000)).toBe('3 hours 5 minutes');
  expect(untilWords(2 * 86400000)).toBe('2 days');
  expect(untilWords(12 * 60000)).toBe('12 minutes');
  expect(untilWords(20000)).toBe('under a minute');
  expect(shortUntil(3 * 86400000 + 4 * H)).toBe('3d 4h');
  expect(shortUntil(5 * H + 12 * 60000)).toBe('5h 12m');
});

test('lengthWords reads a stream length', () => {
  expect(lengthWords(4 * 3600 + 37 * 60 + 20)).toBe('4 hours 37');
  expect(lengthWords(2 * 3600)).toBe('2 hours');
  expect(lengthWords(52 * 60)).toBe('52 minutes');
});

test('day words follow the viewer calendar, not Arizona', () => {
  // Mon 11 AM in Arizona is Tue 12 AM in Dhaka, where "now" is still Sunday 11 PM.
  const mondayAz = Date.parse('2026-10-05T18:00:00Z');
  expect(dayWord(mondayAz, NOW, AZ)).toBe('tomorrow');
  expect(dayWord(mondayAz, NOW, 'Asia/Dhaka')).toBe('Tuesday');
  expect(dayWord(NOW, NOW, AZ)).toBe('today');
});

test('whenAired', () => {
  expect(whenAired(Date.parse('2026-10-02T03:00:00Z'), NOW, AZ)).toBe('Thursday night');
  expect(whenAired(Date.parse('2026-10-04T05:00:00Z'), NOW, AZ)).toBe('Last night');
  expect(whenAired(Date.parse('2026-10-04T15:30:00Z'), NOW, AZ)).toBe('This morning');
});

test('multiplier', () => {
  expect(multiplier(1240)).toBe('1,240x');
  expect(multiplier(48.5)).toBe('48.5x');
});

test('the sentences', () => {
  expect(COPY.tvNext({ title: 'Bonus Hunt Time!', day: 'tomorrow', clock: '11:00 AM' }).sentence).toBe(
    'Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time!'
  );
  expect(COPY.tvNext({ title: 'Slots', day: 'Monday', clock: '11:00 AM' }).teaser).toBe('Back Mon 11:00 AM');
  expect(COPY.laptopHunt({ opened: 14, total: 23, back: 412 }).sentence).toBe(
    'A hunt is running. 14 of 23 bonuses opened, $412 back so far.'
  );
  expect(COPY.laptopLastHunt({ paid: 412, start: 600, best: { multi: 1240, slot: 'Sugar Rush 1000' } }).sentence).toBe(
    'Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000.'
  );
  expect(COPY.tapes({ title: 'Win Wednesdays', when: 'Thursday night', length: '4 hours 37' }).sentence).toBe(
    'You missed Win Wednesdays. Thursday night, 4 hours 37.'
  );
  expect(COPY.guide({ title: 'Bonus Hunt Time!', day: 'Monday', clock: '11:00 AM', until: '1 day 1 hour' }).sentence).toBe(
    'Next up: Bonus Hunt Time! on Monday at 11:00 AM, in 1 day 1 hour.'
  );
  expect(COPY.noteOpen({ keyword: '!goof', prize: '$25.00 bonus buy' }).sentence).toBe(
    "Giveaway's open. Type !goof in chat for a $25.00 bonus buy."
  );
  expect(COPY.laptopOpen({ guesses: 1 }).sentence).toBe('Predictions are open. 1 guess in so far. Guess the payout before it locks.');
});

test('every sentence keeps the voice rules', () => {
  const samples = [
    COPY.tvWaiting(), COPY.tvLive({ viewers: 214 }), COPY.tvNext({ title: 'X', day: 'today', clock: '9:00 PM' }),
    COPY.tvDay({ title: 'X', day: 'Monday' }), COPY.tvLate({ title: 'X' }), COPY.tvNothing(),
    COPY.noteOpen({ keyword: 'goof' }), COPY.laptopHunt({ opened: 1, total: 1, back: 5 }), COPY.laptopOpen({ guesses: 0 }),
    COPY.laptopLocked(), COPY.laptopLastHunt({ paid: 5 }), COPY.laptopIdle({ resetsIn: H }), COPY.laptopIdle({ resetsIn: null }),
    COPY.tapes({ title: 'X', when: 'Tonight' }), COPY.tapesNone(), COPY.guideDay({ title: 'X', day: 'today' }),
    COPY.guideLate({ title: 'X' }), COPY.guideLoading(), COPY.guideNone(), COPY.games({ name: 'X', hours: 0 }),
    COPY.gamesNone({ category: 'Slots' }), COPY.remote(), COPY.photo(),
  ];
  for (const { kicker, teaser, sentence } of samples) {
    for (const s of [kicker, teaser, sentence]) {
      expect(s).not.toMatch(/—/);
      expect(s).not.toMatch(/, not /i);
      expect(s).not.toMatch(/\b(leverage|harness|utilize|seamless|robust|unlock|delve|elevate|empower)\b/i);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=couchCopy` → FAIL.

- [ ] **Step 3: Write the implementation**

```js
import { formatMoney } from '../../utils/money';
import { calendarDay } from '../../utils/scheduleTime';

// Every sentence the couch says (spec: Sentences). Station-break voice: plain
// full sentences with live data in them, under PRODUCT.md's voice rules (no
// em dashes, no "X, not Y", sentence case). Each builder returns
// { kicker, teaser, sentence }: the label's mono kicker, its short teaser and
// the sentence it opens up to.

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const stop = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clip = (s, max = 18) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const shortDay = (day) => (day === 'today' || day === 'tomorrow' ? day : day.slice(0, 3));
const onDay = (day) => (day === 'today' || day === 'tomorrow' ? day : `on ${day}`);

// "1 day 1 hour", "3 hours 5 minutes", "12 minutes", "under a minute".
export function untilWords(ms) {
  const total = Math.floor(ms / 60000);
  if (total < 1) return 'under a minute';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d) return h ? `${plural(d, 'day')} ${plural(h, 'hour')}` : plural(d, 'day');
  if (h) return m ? `${plural(h, 'hour')} ${plural(m, 'minute')}` : plural(h, 'hour');
  return plural(m, 'minute');
}

// "3d 4h", "5h 12m", "12m": label-sized.
export function shortUntil(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${total % 60}m`;
  return `${total % 60}m`;
}

// A stream's length: "4 hours 37", "2 hours", "52 minutes".
export function lengthWords(seconds) {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return plural(m, 'minute');
  return m ? `${plural(h, 'hour')} ${m}` : plural(h, 'hour');
}

// The day a moment falls on, on the viewer's calendar: "today", "tomorrow",
// "yesterday" or the weekday.
export function dayWord(ms, now, timeZone) {
  const diff = calendarDay(ms, timeZone) - calendarDay(now, timeZone);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(ms);
}

// "night" from 6 PM to 5 AM, "afternoon" from noon, otherwise "morning".
export function partOfDay(ms, timeZone) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(ms));
  if (hour >= 18 || hour < 5) return 'night';
  return hour >= 12 ? 'afternoon' : 'morning';
}

// When a stream aired: "Tonight", "Last night", "Yesterday afternoon", "Thursday night".
export function whenAired(ms, now, timeZone) {
  const day = dayWord(ms, now, timeZone);
  const part = partOfDay(ms, timeZone);
  if (day === 'today') return part === 'night' ? 'Tonight' : `This ${part}`;
  if (day === 'yesterday') return part === 'night' ? 'Last night' : `Yesterday ${part}`;
  return `${cap(day)} ${part}`;
}

export const money = (value, currency) => formatMoney(value, currency || null, { decimals: 0 });

export function multiplier(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return n >= 100 ? `${Math.round(n).toLocaleString('en-US')}x` : `${n.toFixed(1)}x`;
}

export const COPY = {
  tvWaiting: () => ({ kicker: 'TV', teaser: 'Tuning in', sentence: "Checking whether Goofer's on." }),
  tvLive: ({ viewers }) => ({
    kicker: 'TV',
    teaser: viewers != null ? `On now · ${viewers}` : 'On now',
    sentence: "Goofer's live right now. Lean in to watch.",
  }),
  tvNext: ({ title, day, clock }) => ({
    kicker: 'TV',
    teaser: `Back ${shortDay(day)} ${clock}`,
    sentence: `Off the air. Back ${day} at ${clock} for ${stop(title)}`,
  }),
  tvDay: ({ title, day }) => ({ kicker: 'TV', teaser: `Back ${shortDay(day)}`, sentence: `Off the air. Back ${day} for ${stop(title)}` }),
  tvLate: ({ title }) => ({ kicker: 'TV', teaser: 'Running late', sentence: `${title} should be on by now. Give him a minute.` }),
  tvNothing: () => ({ kicker: 'TV', teaser: 'Off air', sentence: 'Off the air. Nothing on the books yet.' }),

  noteOpen: ({ keyword, prize }) => ({
    kicker: 'Note',
    teaser: `Type ${keyword}`,
    sentence: `Giveaway's open. Type ${keyword} in chat${prize ? ` for a ${prize}` : ''}.`,
  }),

  laptopHunt: ({ opened, total, back, currency }) => ({
    kicker: 'Laptop',
    teaser: total ? `Hunt ${opened}/${total}` : 'Hunt live',
    sentence: total
      ? `A hunt is running. ${opened} of ${plural(total, 'bonus', 'bonuses')} opened, ${money(back, currency)} back so far.`
      : 'A hunt is running.',
  }),
  laptopOpen: ({ guesses }) => ({
    kicker: 'Laptop',
    teaser: 'Predictions open',
    sentence: `Predictions are open. ${guesses ? `${plural(guesses, 'guess', 'guesses')} in so far. ` : ''}Guess the payout before it locks.`,
  }),
  laptopLocked: () => ({ kicker: 'Laptop', teaser: 'Predictions locked', sentence: 'Predictions are locked. The hunt decides it now.' }),
  laptopLastHunt: ({ paid, start, currency, best }) => ({
    kicker: 'Laptop',
    teaser: best ? `Best hit ${multiplier(best.multi)}` : 'Last hunt',
    sentence: `Last hunt paid ${money(paid, currency)}${start ? ` on ${money(start, currency)}` : ''}.${
      best ? ` Best hit: ${multiplier(best.multi)} on ${best.slot}.` : ''
    }`,
  }),
  laptopIdle: ({ resetsIn }) => ({
    kicker: 'Laptop',
    teaser: resetsIn ? `Resets in ${shortUntil(resetsIn)}` : 'Gamba',
    sentence: resetsIn ? `The leaderboard resets in ${untilWords(resetsIn)}.` : 'The gamba tools live here.',
  }),

  tapes: ({ title, when, length }) => ({
    kicker: 'Tapes',
    teaser: clip(title, 22),
    sentence: `You missed ${stop(title)} ${when}${length ? `, ${length}` : ''}.`,
  }),
  tapesNone: () => ({ kicker: 'Tapes', teaser: 'Nothing new', sentence: 'No tapes yet. Check back after the next stream.' }),

  guide: ({ title, day, clock, until }) => ({
    kicker: 'TV guide',
    teaser: `${cap(shortDay(day))} ${clock}`,
    sentence: `Next up: ${title} ${onDay(day)} at ${clock}, in ${until}.`,
  }),
  guideDay: ({ title, day }) => ({ kicker: 'TV guide', teaser: cap(shortDay(day)), sentence: `Next up: ${title} ${onDay(day)}.` }),
  guideLate: ({ title }) => ({ kicker: 'TV guide', teaser: 'Running late', sentence: `Next up: ${title}, due now.` }),
  guideLoading: () => ({ kicker: 'TV guide', teaser: 'Tuning in', sentence: 'Checking the guide.' }),
  guideNone: () => ({ kicker: 'TV guide', teaser: 'This week', sentence: 'Nothing on the books yet. The guide has the week.' }),

  games: ({ name, hours, category }) => ({
    kicker: 'Games',
    teaser: hours ? `${clip(name)} · ${hours}h` : clip(name),
    sentence: `Lately: ${name}${hours ? `, ${plural(hours, 'hour')} in two weeks` : ''}.${category ? ` Last streamed: ${stop(category)}` : ''}`,
  }),
  gamesNone: ({ category }) => ({
    kicker: 'Games',
    teaser: 'Gaming',
    sentence: `His game library and the wheel.${category ? ` Last streamed: ${stop(category)}` : ''}`,
  }),

  remote: () => ({ kicker: 'Remote', teaser: 'GSN', sentence: 'Flip to the Goofer Shopping Network. Spend your tickets.' }),
  photo: () => ({ kicker: 'Photo', teaser: 'The host', sentence: 'Who is this guy?' }),
};
```

- [ ] **Step 4: Run tests** → `npm test -- --watchAll=false --testPathPattern=couchCopy` → PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/couch/couchCopy.js src/components/couch/__tests__/couchCopy.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): the couch's sentences in station-break voice"
```

---

### Task 8: Layout file on the test plate

**Files:**
- Create: `src/components/couch/rooms/90s.json`, `src/components/couch/couchLayout.js`, `public/couch/90s/test-room-1280.webp`
- Test: `src/components/couch/__tests__/couchLayout.test.js`

**Interfaces:**
- Produces: `ROOMS`, `ROOM_ID`, `ROOM` (`{ id, screen, names }`), `SCREEN_CLASS`, `LAYOUT` (the room JSON: `{ final, room, art: { width, height, focal, plate, empty }, screens: { tv, laptop }, doors: { [id]: { rect, anchor, cutout?, cases? } }, window: { glass, blinds?, cord?, skyline? }, toys: [], themes: {}, phoneCrop }`, all positions `[x, y, w, h]` or `[x, y]` in percent of the art), `SAFE`, `ART_ASPECT`, `DOOR_IDS`, `insideSafe(rect)`, `plateSrc(plateMap)`, `plateSrcSet(plateMap)`, `pctStyle(rect)`, `within(outer, inner)`, `cropStyle(rect)`, `rectAspect(rect)`, `center(rect)`.

- [ ] **Step 1: Make the temporary plate**

The test render from brainstorming is at `C:/Users/luizm/AppData/Local/Temp/claude/c--Users-luizm-Desktop-Software-Engineer-StreamingSite/a9759305-9106-4f56-a326-bc6d0d6c6fe3/scratchpad/couch/room-cartoon-1.png` (1368×760). If it is gone, re-run the Z-Image + Qwen commands in `scripts/gsn-art/README.md` with the prompts from Task 21 Step 1 and take any seed.

```bash
mkdir -p public/couch/90s
python scripts/gsn-art/to_webp.py "<path>/room-cartoon-1.png" public/couch/90s/test-room-1280.webp 1280 711 120
```

Expected: `public/couch/90s/test-room-1280.webp: 1280x711 q.. ..KB`.

- [ ] **Step 2: Write `src/components/couch/rooms/90s.json` (measured on the test render; laptop, remote and photo borrow the phone, controller and poster)**

```json
{
  "final": false,
  "room": {
    "id": "90s",
    "screen": "crt",
    "names": { "tv": "TV", "note": "Note", "laptop": "Laptop", "tapes": "Tapes", "guide": "TV guide", "games": "Games", "remote": "Remote", "photo": "Photo" }
  },
  "art": {
    "width": 1280,
    "height": 711,
    "focal": [50.8, 43.4],
    "plate": { "1280": "/couch/90s/test-room-1280.webp" },
    "empty": null
  },
  "screens": {
    "tv": [41.37, 31.32, 18.93, 24.21],
    "laptop": [62.6, 88.9, 7.9, 4.6]
  },
  "doors": {
    "tv": { "rect": [39, 27.5, 23.75, 34.4], "anchor": [50.9, 27.5] },
    "note": { "rect": [38.2, 24.2, 5.6, 9.6], "anchor": [41, 24.2] },
    "laptop": { "rect": [62.1, 88.3, 8.9, 5.8], "anchor": [66.5, 88.3] },
    "tapes": { "rect": [35.4, 68.7, 24, 11.7], "anchor": [41, 68.7] },
    "guide": { "rect": [43.1, 84.5, 15.65, 10.1], "anchor": [50.9, 84.5] },
    "games": { "rect": [60.9, 65.8, 7.6, 14.8], "anchor": [64.7, 65.8] },
    "remote": { "rect": [31.25, 83.8, 11, 9.9], "anchor": [36.7, 83.8] },
    "photo": { "rect": [17.9, 0, 14.9, 26.4], "anchor": [25.3, 4] }
  },
  "window": { "glass": [74.4, 0, 25.6, 56] },
  "toys": [],
  "themes": {},
  "phoneCrop": [30.5, 20, 40, 54]
}
```

- [ ] **Step 3: Write the failing test**

```js
import fs from 'fs';
import path from 'path';
import { DOOR_IDS, LAYOUT, ROOM, SCREEN_CLASS, center, cropStyle, insideSafe, plateSrc, plateSrcSet, within } from '../couchLayout';

const PUBLIC = path.resolve(__dirname, '../../../../public');

test('every door has a rect and an anchor, and both screens exist', () => {
  for (const id of DOOR_IDS) {
    expect(LAYOUT.doors[id].rect).toHaveLength(4);
    expect(LAYOUT.doors[id].anchor).toHaveLength(2);
  }
  expect(LAYOUT.screens.tv).toHaveLength(4);
  expect(LAYOUT.screens.laptop).toHaveLength(4);
  expect(LAYOUT.phoneCrop).toHaveLength(4);
});

// Every '/couch/…' string anywhere in the layout: plates, cutouts, toys, window, themes.
const srcs = (node) => {
  if (typeof node === 'string') return node.startsWith('/couch/') ? [node] : [];
  return node && typeof node === 'object' ? Object.values(node).flatMap(srcs) : [];
};

test('every image the layout names is in public/', () => {
  const files = srcs(LAYOUT);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect([f, fs.existsSync(path.join(PUBLIC, f))]).toEqual([f, true]);
});

test('the room names its objects, its screen skin and its window', () => {
  expect(ROOM.id).toBe('90s');
  expect(SCREEN_CLASS).toBe('couch-crt');
  for (const id of DOOR_IDS) expect(typeof ROOM.names[id]).toBe('string');
  expect(LAYOUT.window.glass).toHaveLength(4);
});

test('the final art keeps every door inside the safe area', () => {
  if (!LAYOUT.final) return;
  for (const id of DOOR_IDS) expect(insideSafe(LAYOUT.doors[id].rect)).toBe(true);
});

test('helpers', () => {
  expect(insideSafe([20, 20, 10, 10])).toBe(true);
  expect(insideSafe([5, 20, 10, 10])).toBe(false);
  expect(plateSrcSet({ 1920: '/b.webp', 1280: '/a.webp' })).toBe('/a.webp 1280w, /b.webp 1920w');
  expect(plateSrc({ 1280: '/a.webp', 1920: '/b.webp', 2560: '/c.webp' })).toBe('/b.webp');
  expect(plateSrc({ 1280: '/a.webp' })).toBe('/a.webp');
  expect(within([10, 10, 20, 40], [15, 20, 10, 10])).toEqual([25, 25, 50, 25]);
  expect(cropStyle([25, 50, 50, 25])).toMatchObject({ width: '200%', height: '400%', left: '-50%', top: '-200%' });
  expect(center([10, 20, 30, 40])).toEqual([25, 40]);
});
```

- [ ] **Step 4: Run it to see it fail** → `npm test -- --watchAll=false --testPathPattern=couchLayout` → FAIL (module not found).

- [ ] **Step 5: Write `couchLayout.js`**

```js
import room90s from './rooms/90s.json';

// Where everything sits in the art, in percent of the plate (spec rules: Art
// Is Measured, Rooms Are Swappable). A room is its art plus this measured
// layout: the art step writes rooms/<id>.json from the masks and nothing is
// hand-tuned in components. `final` is false while the page runs on the test
// plate, so the safe-area check waits for the real art.
export const ROOMS = { '90s': room90s };
export const ROOM_ID = '90s';
export const LAYOUT = ROOMS[ROOM_ID];
export const ROOM = LAYOUT.room;
// The screens' dressing for this room's era (couch-crt for the 90s).
export const SCREEN_CLASS = `couch-${ROOM.screen}`;
export const SAFE = { x: [12.5, 87.5], y: [12, 88] };
export const ART_ASPECT = LAYOUT.art.width / LAYOUT.art.height;
export const DOOR_IDS = ['tv', 'note', 'laptop', 'tapes', 'guide', 'games', 'remote', 'photo'];

export function insideSafe([x, y, w, h]) {
  return x >= SAFE.x[0] && x + w <= SAFE.x[1] && y >= SAFE.y[0] && y + h <= SAFE.y[1];
}

const widths = (map) => Object.keys(map).map(Number).sort((a, b) => a - b);

export const plateSrcSet = (map) => widths(map).map((w) => `${map[w]} ${w}w`).join(', ');

export function plateSrc(map) {
  const ws = widths(map);
  return map[ws.find((w) => w >= 1920) ?? ws[ws.length - 1]];
}

export const pctStyle = ([x, y, w, h]) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

// `inner` re-expressed in percent of `outer` (both in percent of the art).
export function within([ox, oy, ow, oh], [ix, iy, iw, ih]) {
  return [((ix - ox) / ow) * 100, ((iy - oy) / oh) * 100, (iw / ow) * 100, (ih / oh) * 100];
}

// Style for an <img> of the whole art, inside an overflow-hidden box, so that
// `rect` fills the box.
export function cropStyle([x, y, w, h]) {
  return {
    position: 'absolute',
    maxWidth: 'none',
    width: `${10000 / w}%`,
    height: `${10000 / h}%`,
    left: `${(-x / w) * 100}%`,
    top: `${(-y / h) * 100}%`,
  };
}

// A rect's width / height in the art's pixels.
export const rectAspect = ([, , w, h]) => (w * LAYOUT.art.width) / (h * LAYOUT.art.height);

export const center = ([x, y, w, h]) => [x + w / 2, y + h / 2];
```

- [ ] **Step 6: Run tests** → PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/couch/rooms/90s.json src/components/couch/couchLayout.js src/components/couch/__tests__/couchLayout.test.js public/couch/90s/test-room-1280.webp
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): couch layout on the test plate"
```

---

### Task 9: The couch model and fixtures

**Files:**
- Create: `src/components/couch/couchModel.js`, `src/components/couch/couchFixtures.js`
- Test: `src/components/couch/__tests__/couchModel.test.js`

**Interfaces:**
- Consumes: `COPY`, `dayWord`, `lengthWords`, `whenAired` (Task 7); `upNext`, `formatClock` (`src/utils/scheduleTime.js`); `showTitle` (`src/components/schedule/scheduleModel.js`); `huntFeature` (`src/components/gamba/guide.js`); `huntMode`, `huntStats` (`src/components/hunts/huntStats.js`); `cleanTitle`, `parseDuration` (`src/components/vods/videoStoreModel.js`); `SOCIAL_LINKS` (`src/constants.js`).
- Input shape (documented at the top of `couchModel.js`): `{ now, timeZone, statusReady, isLive, stream: { title, viewers, game, thumbnailUrl } | null, schedule: array | null (null = loading), videos, clips, category, hunts: { live, recent, loading, error }, round, lastHunt, leaderboardEndsAt, giveaway: { keyword, prize, status } | null, games: [{ appid, name, playtime_2weeks }] | null, lastVisit: number | null (first visit) | undefined (storage unreadable), reel }`.
- Produces: `DOOR_ORDER`, `DESTINATION`, `tvState(input)`, `laptopState(input)`, `latestFinished(hunts)`, `isNewTape(vod, lastVisit, now)`, `steamCovers(games)`, `buildCouch(input) → { tv: { state, preview, viewers, cards }, laptop, giveaway, covers, doors }`. A door is `{ id, href, kicker, teaser, sentence, destination, label, lit, sticker }`. `COUCH_FIXTURES` (keys `offair live giveaway hunt round late loading noart empty`), each `{ input, noArt? }`.

- [ ] **Step 1: Write the fixtures** (`src/components/couch/couchFixtures.js`)

```js
// Dev fixtures for the couch (/?fixture=…) and the tests' inputs. Loaded by
// HomePage only outside production builds. Sunday 10:00 AM in Arizona.
const NOW = Date.parse('2026-10-04T17:00:00Z');
const DAY = 86400000;
const HOUR = 3600000;

const SCHEDULE = [
  { day: 'MONDAY', time: '11:00 AM AZ', content: 'Slots', gameName: 'Bonus Hunt Time!', status: 'on' },
  { day: 'TUESDAY', time: '5:00 PM AZ', content: 'Slots', gameName: 'Freestyle Chilling', status: 'regular' },
];

const VIDEOS = [
  {
    id: '2585950001',
    title: 'Win Wednesdays 💥 Games and Gamba? 💥communityhunts.gg / goofer.tv',
    created_at: '2026-10-02T03:00:00Z',
    duration: '4h37m20s',
    thumbnail_url: 'https://static-cdn.jtvnw.net/cf_vods/d1m7jfoe9zdc1j/thumb/thumb0-%{width}x%{height}.jpg',
  },
];

const CLIPS = [
  { id: 'c1', title: 'chat called it', thumbnail_url: 'https://clips-media-assets2.twitch.tv/c1-preview-480x272.jpg' },
  { id: 'c2', title: 'the 1,240x', thumbnail_url: 'https://clips-media-assets2.twitch.tv/c2-preview-480x272.jpg' },
];

const LAST_HUNT = {
  id: 'h9',
  status: 'finished',
  totalWon: 412,
  pot: 600,
  currency: null,
  bonusCount: 3,
  bonuses: [
    { slot: 'Sugar Rush 1000', bet: 0.5, win: 620, multiplier: 1240 },
    { slot: 'Wanted Dead or a Wild', bet: 0.5, win: 244, multiplier: 488 },
    { slot: "Groovin' Gems", bet: 0.5, win: null, multiplier: null },
  ],
};

const LIVE_HUNT = {
  id: 'h10',
  status: 'live',
  pot: 600,
  currency: null,
  bonusCount: 23,
  bonuses: Array.from({ length: 23 }, (_, i) => {
    if (i >= 14) return { slot: `Slot ${i + 1}`, bet: 1, win: null, multiplier: null };
    const win = i === 13 ? 48 : 28;
    return { slot: `Slot ${i + 1}`, bet: 1, win, multiplier: win };
  }),
};

const BASE = {
  now: NOW,
  timeZone: 'America/Phoenix',
  statusReady: true,
  isLive: false,
  stream: null,
  schedule: SCHEDULE,
  videos: VIDEOS,
  clips: CLIPS,
  category: 'Slots',
  hunts: { live: null, recent: [{ id: 'h9', status: 'finished', totalWon: 412, pot: 600 }], loading: false, error: null },
  round: null,
  lastHunt: LAST_HUNT,
  leaderboardEndsAt: NOW + 3 * DAY + 4 * HOUR,
  giveaway: null,
  games: [
    { appid: 2694490, name: 'Path of Exile 2', playtime_2weeks: 14 },
    { appid: 2379780, name: 'Balatro', playtime_2weeks: 6 },
    { appid: 294100, name: 'RimWorld', playtime_2weeks: 3 },
    { appid: 1145360, name: 'Hades', playtime_2weeks: 1 },
  ],
  lastVisit: Date.parse('2026-09-30T00:00:00Z'),
  reel: null,
};

const LIVE = {
  ...BASE,
  isLive: true,
  stream: {
    title: 'Bonus hunt night, chat picks the last slot',
    viewers: 214,
    game: 'Slots',
    thumbnailUrl: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_gooferg-{width}x{height}.jpg',
  },
};

export const COUCH_FIXTURES = {
  offair: { input: BASE },
  live: { input: LIVE },
  giveaway: { input: { ...LIVE, giveaway: { keyword: '!goof', prize: '$25.00 bonus buy', status: 'open' } } },
  hunt: { input: { ...LIVE, hunts: { live: LIVE_HUNT, recent: [], loading: false, error: null } } },
  round: { input: { ...BASE, round: { id: 'r1', acceptPredictions: true, status: 'open', entryCount: 37, source: 'manual' } } },
  late: {
    input: {
      ...BASE,
      schedule: [{ day: 'SUNDAY', time: '9:00 AM AZ', content: 'Slots', gameName: 'Sunday Slots', status: 'on' }, ...SCHEDULE],
    },
  },
  loading: {
    input: {
      ...BASE,
      statusReady: false,
      schedule: null,
      videos: [],
      clips: [],
      category: null,
      hunts: { live: null, recent: [], loading: true, error: null },
      round: undefined,
      lastHunt: null,
      leaderboardEndsAt: null,
      games: null,
      lastVisit: null,
    },
  },
  noart: { input: BASE, noArt: true },
  empty: {
    input: {
      ...BASE,
      schedule: [],
      videos: [],
      clips: [],
      category: null,
      hunts: { live: null, recent: [], loading: false, error: null },
      lastHunt: null,
      leaderboardEndsAt: null,
      games: [],
      lastVisit: null,
    },
  },
};
```

- [ ] **Step 2: Write the failing test**

```js
import { COUCH_FIXTURES as F } from '../couchFixtures';
import { DOOR_ORDER, buildCouch, isNewTape, steamCovers } from '../couchModel';

const door = (couch, id) => couch.doors.find((d) => d.id === id);
const NOW = F.offair.input.now;

test('off air: TV, guide, tapes, laptop and games say the right things', () => {
  const c = buildCouch(F.offair.input);
  expect(c.tv.state).toBe('offair');
  expect(c.doors.map((d) => d.id)).toEqual(['tv', 'laptop', 'tapes', 'guide', 'games', 'remote', 'photo']);
  expect(door(c, 'tv').sentence).toBe('Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time!');
  expect(door(c, 'tv').href).toBe('/vods');
  expect(door(c, 'guide').sentence).toBe('Next up: Bonus Hunt Time! tomorrow at 11:00 AM, in 1 day 1 hour.');
  expect(door(c, 'tapes').sentence).toBe('You missed Win Wednesdays. Thursday night, 4 hours 37.');
  expect(door(c, 'tapes').sticker).toBe('new');
  expect(door(c, 'laptop').sentence).toBe('Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000.');
  expect(door(c, 'laptop').href).toBe('/gamba');
  expect(door(c, 'games').sentence).toBe('Lately: Path of Exile 2, 14 hours in two weeks. Last streamed: Slots.');
  expect(door(c, 'tv').label).toBe('TV: Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Vods.');
  expect(c.tv.cards.map((k) => k.text)).toEqual([
    door(c, 'tv').sentence,
    door(c, 'tapes').sentence,
    door(c, 'laptop').sentence,
  ]);
  expect(c.laptop.mode).toBe('idle');
  expect(c.laptop.resetsIn).toBe(3 * 86400000 + 4 * 3600000);
});

test('live: the TV goes to the stream and lights up', () => {
  const c = buildCouch(F.live.input);
  const tv = door(c, 'tv');
  expect(c.tv.state).toBe('live');
  expect(tv.href).toBe('https://twitch.tv/GooferG');
  expect(tv.lit).toBe(true);
  expect(tv.label).toBe("TV: Goofer's live right now. Lean in to watch. Opens the stream.");
  expect(c.tv.preview).toMatch(/live_user_gooferg-640x360\.jpg\?p=\d+$/);
  expect(c.tv.viewers).toBe(214);
  expect(c.tv.cards).toEqual([]);
});

test('an open giveaway sticks the note on the TV, second in order', () => {
  const c = buildCouch(F.giveaway.input);
  expect(c.doors[1].id).toBe('note');
  expect(c.doors[1].sentence).toBe("Giveaway's open. Type !goof in chat for a $25.00 bonus buy.");
  expect(c.doors[1].href).toBe('/giveaway');
  const closed = buildCouch({ ...F.giveaway.input, giveaway: { ...F.giveaway.input.giveaway, status: 'rolling' } });
  expect(closed.doors.find((d) => d.id === 'note')).toBeUndefined();
});

test('a live hunt turns the laptop on and points it at Hunts', () => {
  const c = buildCouch(F.hunt.input);
  expect(c.laptop).toMatchObject({ mode: 'hunt', opened: 14, total: 23, back: 412 });
  expect(door(c, 'laptop').sentence).toBe('A hunt is running. 14 of 23 bonuses opened, $412 back so far.');
  expect(door(c, 'laptop').href).toBe('/gamba/hunts');
  expect(door(c, 'laptop').lit).toBe(true);
});

test('an open round', () => {
  const c = buildCouch(F.round.input);
  expect(c.laptop).toMatchObject({ mode: 'open', guesses: 37 });
  expect(door(c, 'laptop').sentence).toBe('Predictions are open. 37 guesses in so far. Guess the payout before it locks.');
});

test('a late show', () => {
  const c = buildCouch(F.late.input);
  expect(door(c, 'tv').sentence).toBe('Sunday Slots should be on by now. Give him a minute.');
  expect(door(c, 'guide').sentence).toBe('Next up: Sunday Slots, due now.');
});

test('loading never claims off air', () => {
  const c = buildCouch(F.loading.input);
  expect(c.tv.state).toBe('waiting');
  expect(door(c, 'tv').sentence).toBe("Checking whether Goofer's on.");
  expect(door(c, 'guide').sentence).toBe('Checking the guide.');
  expect(door(c, 'tapes').sentence).toBe('No tapes yet. Check back after the next stream.');
  expect(door(c, 'games').sentence).toBe('His game library and the wheel.');
});

test('empty', () => {
  const c = buildCouch(F.empty.input);
  expect(door(c, 'tv').sentence).toBe('Off the air. Nothing on the books yet.');
  expect(door(c, 'guide').sentence).toBe('Nothing on the books yet. The guide has the week.');
  expect(door(c, 'laptop').sentence).toBe('The gamba tools live here.');
  expect(door(c, 'tapes').sticker).toBeNull();
});

test('isNewTape', () => {
  const vod = { created_at: '2026-10-02T03:00:00Z' };
  expect(isNewTape(vod, Date.parse('2026-09-30T00:00:00Z'), NOW)).toBe(true);
  expect(isNewTape(vod, Date.parse('2026-10-03T00:00:00Z'), NOW)).toBe(false);
  expect(isNewTape(vod, null, NOW)).toBe(true);
  expect(isNewTape({ created_at: '2026-09-20T00:00:00Z' }, null, NOW)).toBe(false);
  expect(isNewTape(vod, undefined, NOW)).toBe(false);
  expect(isNewTape(null, null, NOW)).toBe(false);
});

test('steamCovers keeps three with portrait art', () => {
  const covers = steamCovers(F.offair.input.games);
  expect(covers).toHaveLength(3);
  expect(covers[0]).toEqual({
    appid: 2694490,
    name: 'Path of Exile 2',
    hours: 14,
    cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2694490/library_600x900.jpg',
  });
  expect(steamCovers(null)).toEqual([]);
});

test('every fixture keeps the voice rules and the door order', () => {
  for (const { input } of Object.values(F)) {
    const c = buildCouch(input);
    const ids = c.doors.map((d) => d.id);
    expect(ids).toEqual(DOOR_ORDER.filter((id) => ids.includes(id)));
    for (const d of c.doors) {
      expect(d.label).not.toMatch(/—|, not /i);
    }
  }
});
```

- [ ] **Step 3: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=couchModel` → FAIL.

- [ ] **Step 4: Write `couchModel.js`**

```js
import { SOCIAL_LINKS } from '../../constants';
import { formatClock, upNext } from '../../utils/scheduleTime';
import { huntFeature } from '../gamba/guide';
import { huntMode, huntStats } from '../hunts/huntStats';
import { showTitle } from '../schedule/scheduleModel';
import { cleanTitle, parseDuration } from '../vods/videoStoreModel';
import { COPY, dayWord, lengthWords, untilWords, whenAired } from './couchCopy';
import { ROOM } from './couchLayout';

// The couch's state from one plain input (spec: Model). Pure.
//
// input: { now, timeZone, statusReady, isLive,
//   stream: { title, viewers, game, thumbnailUrl } | null,
//   schedule: array | null (null while loading), videos, clips, category,
//   hunts: { live, recent, loading, error }, round, lastHunt (with bonuses),
//   leaderboardEndsAt, giveaway: { keyword, prize, status } | null,
//   games: [{ appid, name, playtime_2weeks }] | null,
//   lastVisit: ms | null (first visit) | undefined (storage unreadable), reel }

export const DOOR_ORDER = ['tv', 'note', 'laptop', 'tapes', 'guide', 'games', 'remote', 'photo'];
export const DESTINATION = {
  tv: 'Vods',
  note: 'Giveaway',
  laptop: 'Gamba',
  tapes: 'Vods',
  guide: 'Schedule',
  games: 'Gaming',
  remote: 'Store',
  photo: 'About',
};
const NEW_TAPE_MS = 72 * 3600000;
const POLL_MS = 120000;
const STEAM_COVER = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

export function tvState({ statusReady, isLive }) {
  if (isLive) return 'live';
  return statusReady ? 'offair' : 'waiting';
}

export const latestFinished = (hunts) =>
  ((hunts && hunts.recent) || []).find((h) => h && h.status !== 'live') || null;

function bestHit(hunt) {
  if (!hunt || !Array.isArray(hunt.bonuses)) return null;
  const s = huntStats(hunt, null);
  const b = s.bestIndex >= 0 ? s.bonuses[s.bestIndex] : null;
  return b ? { multi: Number(b.multiplier), slot: b.slot || 'a slot' } : null;
}

export function laptopState({ hunts, round, lastHunt, leaderboardEndsAt, now }) {
  const feature = huntFeature({ hunts, round });
  if (feature.kind === 'live' && feature.hunt) {
    const s = feature.stats;
    // Money builders get real numbers only (a missing one would print an em dash).
    return { mode: 'hunt', opened: s.openedCount, total: s.bonusCount, back: s.wonSoFar ?? 0, currency: feature.currency };
  }
  const mode = huntMode(round);
  if (mode === 'open' || mode === 'locked') return { mode, guesses: feature.guessCount };
  const resetsIn = leaderboardEndsAt != null && leaderboardEndsAt > now ? leaderboardEndsAt - now : null;
  const last = lastHunt && Number.isFinite(Number(lastHunt.totalWon))
    ? { paid: lastHunt.totalWon, start: lastHunt.pot, currency: lastHunt.currency || null, best: bestHit(lastHunt) }
    : null;
  return { mode: 'idle', resetsIn, last };
}

export function isNewTape(vod, lastVisit, now) {
  const aired = vod ? Date.parse(vod.created_at) : NaN;
  if (!Number.isFinite(aired) || lastVisit === undefined) return false;
  if (lastVisit === null) return now - aired <= NEW_TAPE_MS;
  return aired > lastVisit;
}

export function steamCovers(games) {
  return (Array.isArray(games) ? games : [])
    .filter((g) => g && g.appid)
    .slice(0, 3)
    .map((g) => ({
      appid: g.appid,
      name: g.name,
      hours: Math.max(0, Math.floor(g.playtime_2weeks || 0)),
      cover: STEAM_COVER(g.appid),
    }));
}

function tvCopy(state, input, next, show) {
  if (state === 'waiting') return COPY.tvWaiting();
  if (state === 'live') return COPY.tvLive({ viewers: input.stream ? input.stream.viewers : null });
  if (!next) return COPY.tvNothing();
  if (next.phase === 'late') return COPY.tvLate({ title: show });
  const day = dayWord(next.start.getTime(), input.now, input.timeZone);
  if (!next.timeKnown) return COPY.tvDay({ title: show, day });
  return COPY.tvNext({ title: show, day, clock: formatClock(next.start, input.timeZone) });
}

function guideCopy(input, next, show) {
  if (input.schedule == null) return COPY.guideLoading();
  if (!next) return COPY.guideNone();
  if (next.phase === 'late') return COPY.guideLate({ title: show });
  const day = dayWord(next.start.getTime(), input.now, input.timeZone);
  if (!next.timeKnown) return COPY.guideDay({ title: show, day });
  return COPY.guide({
    title: show,
    day,
    clock: formatClock(next.start, input.timeZone),
    until: untilWords(next.start.getTime() - input.now),
  });
}

function laptopCopy(laptop) {
  if (laptop.mode === 'hunt') return COPY.laptopHunt(laptop);
  if (laptop.mode === 'open') return COPY.laptopOpen(laptop);
  if (laptop.mode === 'locked') return COPY.laptopLocked();
  if (laptop.last) return COPY.laptopLastHunt(laptop.last);
  return COPY.laptopIdle(laptop);
}

function tapesCopy(vod, input) {
  if (!vod) return COPY.tapesNone();
  const seconds = parseDuration(vod.duration);
  return COPY.tapes({
    title: cleanTitle(vod.title),
    when: whenAired(Date.parse(vod.created_at), input.now, input.timeZone),
    length: seconds ? lengthWords(seconds) : null,
  });
}

function preview(stream, now) {
  if (!stream || !stream.thumbnailUrl) return null;
  const url = stream.thumbnailUrl.replace('{width}', '640').replace('{height}', '360');
  return `${url}?p=${Math.floor(now / POLL_MS)}`;
}

export function buildCouch(input) {
  const state = tvState(input);
  const next = Array.isArray(input.schedule) ? upNext(input.schedule, input.now) : null;
  const show = next ? showTitle(next.entry).title || 'the next stream' : null;
  const newest = (input.videos || [])[0] || null;
  const laptop = laptopState(input);
  const covers = steamCovers(input.games);
  const giveaway =
    input.giveaway && input.giveaway.status === 'open' && input.giveaway.keyword ? input.giveaway : null;

  const copy = {
    tv: tvCopy(state, input, next, show),
    note: giveaway ? COPY.noteOpen({ keyword: giveaway.keyword, prize: giveaway.prize }) : null,
    laptop: laptopCopy(laptop),
    tapes: tapesCopy(newest, input),
    guide: guideCopy(input, next, show),
    games: covers.length ? COPY.games({ ...covers[0], category: input.category }) : COPY.gamesNone({ category: input.category }),
    remote: COPY.remote(),
    photo: COPY.photo(),
  };
  const href = {
    tv: state === 'live' ? SOCIAL_LINKS.twitch : '/vods',
    note: '/giveaway',
    laptop: laptop.mode === 'idle' ? '/gamba' : '/gamba/hunts',
    tapes: '/vods',
    guide: '/schedule',
    games: '/gaming',
    remote: '/store',
    photo: '/about',
  };

  const doors = DOOR_ORDER.filter((id) => copy[id]).map((id) => {
    const destination = id === 'tv' && state === 'live' ? 'the stream' : DESTINATION[id];
    // The room names its objects ("Tapes" in the 90s room); COPY's kicker is the fallback.
    const kicker = (ROOM.names && ROOM.names[id]) || copy[id].kicker;
    return {
      id,
      href: href[id],
      ...copy[id],
      kicker,
      destination,
      label: `${kicker}: ${copy[id].sentence} Opens ${destination}.`,
      lit: (id === 'tv' && state === 'live') || (id === 'laptop' && laptop.mode !== 'idle') || id === 'note',
      sticker: id === 'tapes' && isNewTape(newest, input.lastVisit, input.now) ? 'new' : null,
    };
  });

  const cards =
    state === 'offair'
      ? [
          { kicker: 'Off air', text: copy.tv.sentence },
          { kicker: 'Tapes', text: copy.tapes.sentence },
          { kicker: 'Laptop', text: copy.laptop.sentence },
        ]
      : [];

  return {
    tv: {
      state,
      preview: state === 'live' ? preview(input.stream, input.now) : null,
      viewers: input.stream ? input.stream.viewers : null,
      cards,
    },
    laptop,
    giveaway,
    covers,
    doors,
  };
}
```

- [ ] **Step 5: Run tests** → `npm test -- --watchAll=false --testPathPattern=couchModel` → PASS (11 tests). If `parseDuration('4h37m20s')` doesn't return 16640 in this repo, read `src/components/vods/videoStoreModel.js:28` and adapt the call (not the expected sentence).

- [ ] **Step 6: Commit**

```bash
git add src/components/couch/couchModel.js src/components/couch/couchFixtures.js src/components/couch/__tests__/couchModel.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): couch model and fixtures"
```

---

### Task 10: The reel's order and mode

**Files:**
- Create: `src/components/couch/reel.js`, `src/components/couch/useTvReel.js`
- Test: `src/components/couch/__tests__/reel.test.js`

**Interfaces:**
- Consumes: `coverUrl` (`src/components/vods/videoStoreModel.js`).
- Produces: `SEGMENT_MS = 6000`, `STATIC_MS = 300`; `reelItems({ reel, clips, videos, cards }) → item[]` where an item is `{ kind: 'video', id, title, sources: { av1, h264 }, poster }`, `{ kind: 'still', id, src }` or `{ kind: 'card', id, kicker, text }`; `reelMode({ reducedMotion, saveData, autoplayBlocked }) → 'video' | 'stills' | 'hold'`; `useTvReel() → manifest[] | null`.

- [ ] **Step 1: Write the failing test**

```js
import { act, render, screen } from '@testing-library/react';
import { reelItems, reelMode } from '../reel';
import useTvReel from '../useTvReel';

const CARDS = [{ kicker: 'Off air', text: 'A' }, { kicker: 'Tapes', text: 'B' }];

test('with a manifest the reel alternates loops and cards', () => {
  const reel = [
    { id: 'one', title: 'one', sources: { av1: '/tv/reel/one.webm', h264: '/tv/reel/one.mp4' }, poster: '/tv/reel/one.jpg' },
    { id: 'two', title: 'two', sources: { av1: '/tv/reel/two.webm', h264: '/tv/reel/two.mp4' }, poster: '/tv/reel/two.jpg' },
    { id: 'three', title: 'three', sources: { av1: '/tv/reel/three.webm', h264: '/tv/reel/three.mp4' }, poster: '/tv/reel/three.jpg' },
  ];
  expect(reelItems({ reel, cards: CARDS }).map((i) => `${i.kind}:${i.id}`)).toEqual([
    'video:one', 'card:card-0', 'video:two', 'card:card-1', 'video:three',
  ]);
});

test('without a manifest it uses the newest tape and clip thumbnails', () => {
  const items = reelItems({
    reel: [],
    videos: [{ id: 'v1', thumbnail_url: 'https://x/thumb-%{width}x%{height}.jpg' }],
    clips: [{ id: 'c1', thumbnail_url: 'https://x/c1.jpg' }, { id: 'c2' }],
    cards: CARDS,
  });
  expect(items).toEqual([
    { kind: 'still', id: 'vod-v1', src: 'https://x/thumb-640x360.jpg' },
    { kind: 'card', id: 'card-0', kicker: 'Off air', text: 'A' },
    { kind: 'still', id: 'clip-c1', src: 'https://x/c1.jpg' },
    { kind: 'card', id: 'card-1', kicker: 'Tapes', text: 'B' },
  ]);
});

test('reelMode', () => {
  expect(reelMode({})).toBe('video');
  expect(reelMode({ saveData: true })).toBe('stills');
  expect(reelMode({ autoplayBlocked: true })).toBe('stills');
  expect(reelMode({ reducedMotion: true, saveData: true })).toBe('hold');
});

function Probe() {
  const reel = useTvReel();
  return <p data-testid="reel">{reel === null ? 'null' : JSON.stringify(reel)}</p>;
}

test('useTvReel fetches the manifest once the page is idle, and [] when there is none', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  render(<Probe />);
  expect(screen.getByTestId('reel').textContent).toBe('null');
  await act(async () => {
    jest.advanceTimersByTime(1300);
  });
  jest.useRealTimers();
  expect(global.fetch).toHaveBeenCalledWith('/tv/reel/manifest.json');
  expect(screen.getByTestId('reel').textContent).toBe('[]');
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=couch/__tests__/reel` → FAIL.

- [ ] **Step 3: Write `reel.js`**

```js
import { coverUrl } from '../vods/videoStoreModel';

// The TV's running order off air (spec: The TV). Pure.
export const SEGMENT_MS = 6000;
export const STATIC_MS = 300;

// Loops (or, with no manifest, the newest tape and up to six clip thumbnails)
// alternating with station-break cards.
export function reelItems({ reel, clips = [], videos = [], cards = [] }) {
  const pictures =
    Array.isArray(reel) && reel.length
      ? reel.map((r) => ({ kind: 'video', id: r.id, title: r.title, sources: r.sources, poster: r.poster }))
      : [
          ...videos.slice(0, 1).map((v) => ({ kind: 'still', id: `vod-${v.id}`, src: coverUrl(v, 640, 360) })),
          ...clips.slice(0, 6).map((c) => ({ kind: 'still', id: `clip-${c.id}`, src: c.thumbnail_url || null })),
        ].filter((s) => s.src);
  const out = [];
  for (let i = 0; i < Math.max(pictures.length, cards.length); i += 1) {
    if (pictures[i]) out.push(pictures[i]);
    if (cards[i]) out.push({ kind: 'card', id: `card-${i}`, kicker: cards[i].kicker, text: cards[i].text });
  }
  return out;
}

// 'hold': one still and a card, no advancing (reduced motion). 'stills': no
// video (Save-Data, or the browser refused autoplay). Otherwise 'video'.
export function reelMode({ reducedMotion, saveData, autoplayBlocked }) {
  if (reducedMotion) return 'hold';
  if (saveData || autoplayBlocked) return 'stills';
  return 'video';
}
```

- [ ] **Step 4: Write `useTvReel.js`**

```js
import { useEffect, useState } from 'react';

const MANIFEST = '/tv/reel/manifest.json';

// The curated reel from scripts/tv-reel, fetched once after the page is idle.
// null until then; [] when there is no reel (a missing file, or the dev
// server's HTML fallback, fails to parse).
export default function useTvReel() {
  const [reel, setReel] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => {
      fetch(MANIFEST)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (!cancelled) setReel(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (!cancelled) setReel([]);
        });
    });
    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, []);
  return reel;
}
```

- [ ] **Step 5: Run tests** → PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/couch/reel.js src/components/couch/useTvReel.js src/components/couch/__tests__/reel.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): TV reel order, modes and manifest"
```

---

### Task 11: The TV

**Files:**
- Create: `src/components/couch/CouchTv.js`
- Modify: `src/index.css` (append `.couch-crt`, `.couch-flip-static`)
- Test: `src/components/couch/__tests__/CouchTv.test.js`

**Interfaces:**
- Consumes: `StaticNoise` (Task 4), `StatusLight`, `MONO`, `SEGMENT_MS`, `STATIC_MS`, `reelItems` output, `buildCouch().tv`.
- Produces: `CouchTv({ tv, items, mode, flipTo = null, onAutoplayBlocked, segmentMs = SEGMENT_MS })` (default export). Test ids: `couch-tv`, `tv-static`, `tv-live`, `tv-video`, `tv-still`, `tv-card`, `tv-switch`, `tv-flip`.

- [ ] **Step 1: Write the failing test**

```js
import { act, render, screen } from '@testing-library/react';
import CouchTv from '../CouchTv';
import { STATIC_MS } from '../reel';

const STILL = { kind: 'still', id: 's1', src: '/a.jpg' };
const CARD = { kind: 'card', id: 'card-0', kicker: 'Off air', text: 'Back tomorrow.' };
const VIDEO = { kind: 'video', id: 'v1', sources: { av1: '/v1.webm', h264: '/v1.mp4' }, poster: '/v1.jpg' };
const OFF = { state: 'offair', preview: null, viewers: null, cards: [] };

beforeEach(() => {
  jest.useFakeTimers();
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
afterEach(() => jest.useRealTimers());

test('waiting shows static and the whole TV is decorative', () => {
  render(<CouchTv tv={{ ...OFF, state: 'waiting' }} items={[]} mode="video" />);
  expect(screen.getByTestId('tv-static')).toBeTruthy();
  expect(screen.getByTestId('couch-tv').getAttribute('aria-hidden')).toBe('true');
});

test('live shows the preview and the tally', () => {
  render(<CouchTv tv={{ state: 'live', preview: '/p-640x360.jpg?p=1', viewers: 214, cards: [] }} items={[STILL]} mode="video" />);
  expect(screen.getByTestId('tv-live').getAttribute('src')).toBe('/p-640x360.jpg?p=1');
  expect(screen.getByText('Live · 214')).toBeTruthy();
  expect(screen.queryByTestId('tv-still')).toBeNull();
});

test('stills advance through a static cut to the card', () => {
  render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/a.jpg');
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId('tv-switch')).toBeTruthy();
  act(() => jest.advanceTimersByTime(STATIC_MS));
  expect(screen.getByTestId('tv-card').textContent).toContain('Back tomorrow.');
});

test('hold mode keeps one still with the sentence and never advances', () => {
  render(<CouchTv tv={OFF} items={[CARD, STILL]} mode="hold" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByTestId('tv-still')).toBeTruthy();
  expect(screen.getByText('Back tomorrow.')).toBeTruthy();
  expect(screen.queryByTestId('tv-switch')).toBeNull();
});

test('stills mode shows a loop as its poster', () => {
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="stills" />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/v1.jpg');
});

test('video mode plays muted and reports a refused autoplay', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(new Error('NotAllowedError')));
  const onBlocked = jest.fn();
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={onBlocked} />);
  const video = screen.getByTestId('tv-video');
  expect(video.muted).toBe(true);
  expect(video.querySelectorAll('source')).toHaveLength(2);
  await act(async () => {});
  expect(onBlocked).toHaveBeenCalled();
});

test('the remote flips the screen to the GSN ident', () => {
  render(<CouchTv tv={OFF} items={[STILL]} mode="stills" flipTo="gsn" />);
  expect(screen.getByTestId('tv-flip').getAttribute('src')).toBe('/gsn/ident.webp');
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=CouchTv` → FAIL.

- [ ] **Step 3: Write `CouchTv.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { MONO } from '../onAir/classes';
import StaticNoise from '../onAir/StaticNoise';
import StatusLight from '../onAir/StatusLight';
import { SCREEN_CLASS } from './couchLayout';
import { SEGMENT_MS, STATIC_MS } from './reel';

// The couch's TV (spec: The TV). It sits in the art's screen rectangle and
// sizes its type in container units. Decorative: the TV door's link says what
// is on.
const GSN_IDENT = '/gsn/ident.webp';
const AV1 = 'video/webm; codecs="av01.0.04M.08"';

function useTabHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

function Card({ item }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-onair-surface-4 px-[8cqw]" data-testid="tv-card">
      <span className={`${MONO} text-[3.4cqw] tracking-[0.22em] text-onair-signal`}>{item.kicker}</span>
      <span className="mt-[2.5cqw] font-onair text-[7cqw] font-extrabold leading-[1.05] tracking-[-0.02em] text-onair-ink-1">
        {item.text}
      </span>
    </div>
  );
}

function Video({ item, hidden, onEnded, onBlocked }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (hidden) {
      v.pause();
      return;
    }
    const playing = v.play();
    if (playing && typeof playing.catch === 'function') playing.catch(() => onBlocked && onBlocked());
  }, [item.id, hidden, onBlocked]);
  return (
    <video
      ref={ref}
      key={item.id}
      className="h-full w-full object-cover"
      muted
      playsInline
      preload="auto"
      poster={item.poster}
      onEnded={onEnded}
      onError={onEnded}
      data-testid="tv-video"
    >
      {item.sources.av1 && <source src={item.sources.av1} type={AV1} />}
      {item.sources.h264 && <source src={item.sources.h264} type="video/mp4" />}
    </video>
  );
}

function Still({ src, moving }) {
  return (
    <img src={src} alt="" className={`h-full w-full object-cover ${moving ? 'motion-safe:animate-slow-zoom' : ''}`} data-testid="tv-still" />
  );
}

function Reel({ items, mode, segmentMs, onBlocked }) {
  const [index, setIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const hidden = useTabHidden();
  const item = items.length ? items[index % items.length] : null;
  const advance = useCallback(() => {
    if (items.length > 1) setSwitching(true);
  }, [items.length]);

  useEffect(() => {
    if (!switching) return undefined;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
      setSwitching(false);
    }, STATIC_MS);
    return () => clearTimeout(t);
  }, [switching, items.length]);

  useEffect(() => {
    if (!item || mode === 'hold' || hidden || switching) return undefined;
    if (item.kind === 'video' && mode === 'video') return undefined; // the loop ends itself
    const t = setTimeout(advance, segmentMs);
    return () => clearTimeout(t);
  }, [item, mode, hidden, switching, segmentMs, advance]);

  if (!item) return <StaticNoise className="absolute inset-0" testId="tv-static" />;

  if (mode === 'hold') {
    const still = items.find((i) => i.kind !== 'card');
    const card = items.find((i) => i.kind === 'card');
    return (
      <>
        {still && <Still src={still.kind === 'video' ? still.poster : still.src} moving={false} />}
        {card && (
          <span className="absolute inset-x-0 bottom-0 bg-onair-surface-4/90 px-[5cqw] py-[3cqw] font-onair text-[5cqw] font-bold leading-tight text-onair-ink-1">
            {card.text}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {item.kind === 'card' && <Card item={item} />}
      {item.kind === 'video' && mode === 'video' && <Video item={item} hidden={hidden} onEnded={advance} onBlocked={onBlocked} />}
      {item.kind === 'video' && mode !== 'video' && <Still src={item.poster} moving />}
      {item.kind === 'still' && <Still src={item.src} moving />}
      {switching && <StaticNoise className="absolute inset-0" testId="tv-switch" />}
    </>
  );
}

function LivePreview({ tv }) {
  return (
    <>
      {tv.preview ? (
        <img src={tv.preview} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid="tv-live" />
      ) : (
        <StaticNoise className="absolute inset-0" testId="tv-static" />
      )}
      <span className="absolute left-[4cqw] top-[4cqw]">
        <StatusLight status="live">{tv.viewers != null ? `Live · ${tv.viewers}` : 'Live'}</StatusLight>
      </span>
      <span className="absolute bottom-[4cqw] right-[4cqw] rounded-onair-tile bg-onair-signal px-[3cqw] py-[1.6cqw] font-onair text-[3.6cqw] font-bold text-onair-surface-4">
        Watch here
      </span>
    </>
  );
}

export default function CouchTv({ tv, items, mode, flipTo = null, onAutoplayBlocked, segmentMs = SEGMENT_MS }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-onair-surface-4"
      style={{ containerType: 'inline-size' }}
      aria-hidden="true"
      data-testid="couch-tv"
    >
      {tv.state === 'waiting' && <StaticNoise className="absolute inset-0" testId="tv-static" />}
      {tv.state === 'live' && <LivePreview tv={tv} />}
      {tv.state === 'offair' && <Reel items={items} mode={mode} segmentMs={segmentMs} onBlocked={onAutoplayBlocked} />}
      {flipTo === 'gsn' && (
        <>
          <img src={GSN_IDENT} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid="tv-flip" />
          <StaticNoise className="couch-flip-static absolute inset-0" testId="tv-flip-static" />
        </>
      )}
      <span className={`${SCREEN_CLASS} pointer-events-none absolute inset-0`} />
    </div>
  );
}
```

- [ ] **Step 4: Append to `src/index.css`**

```css
/* The couch (DESIGN.md §7, The couch). Screen dressing over the TV and the
   laptop: scanlines, a curvature vignette and glass glare. */
.couch-crt {
  background:
    repeating-linear-gradient(0deg, rgb(255 255 255 / 0.03) 0 1px, transparent 1px 3px),
    radial-gradient(ellipse at 50% 50%, transparent 58%, rgb(0 0 0 / 0.45)),
    linear-gradient(160deg, rgb(255 255 255 / 0.07), transparent 38%);
}
.couch-flip-static {
  animation: camera-static-out 300ms ease-in both;
}
```

- [ ] **Step 5: Run tests** → `npm test -- --watchAll=false --testPathPattern=CouchTv` → PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/couch/CouchTv.js src/components/couch/__tests__/CouchTv.test.js src/index.css
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): the couch TV with live preview, reel and GSN flip"
```

---

### Task 12: The laptop

**Files:**
- Create: `src/components/couch/LaptopScreen.js`
- Modify: `tailwind.config.js` (keyframes and animations: `onair-bounce-x`, `onair-bounce-y`)
- Test: `src/components/couch/__tests__/LaptopScreen.test.js`

**Interfaces:**
- Consumes: `buildCouch().laptop`, `money`, `plural`, `shortUntil` (Task 7), `MONO`.
- Produces: `LaptopScreen({ laptop })` (default export), test id `laptop-screen`.

- [ ] **Step 1: Write the failing test**

```js
import { render, screen } from '@testing-library/react';
import LaptopScreen from '../LaptopScreen';

test('a live hunt shows opened of total and money back', () => {
  render(<LaptopScreen laptop={{ mode: 'hunt', opened: 14, total: 23, back: 412, currency: null }} />);
  expect(screen.getByText('Hunt live')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen').textContent).toContain('14/23');
  expect(screen.getByText('$412 back')).toBeTruthy();
});

test('a round shows its state and guesses', () => {
  render(<LaptopScreen laptop={{ mode: 'locked', guesses: 37 }} />);
  expect(screen.getByText('Predictions locked')).toBeTruthy();
  expect(screen.getByText('37 guesses')).toBeTruthy();
});

test('idle is the screensaver with the board reset', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: 3 * 86400000 + 4 * 3600000, last: null }} />);
  expect(screen.getByText('GG')).toBeTruthy();
  expect(screen.getByText('Board resets in 3d 4h')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen').getAttribute('aria-hidden')).toBe('true');
});

test('idle without a reset shows only the bug', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: null, last: null }} />);
  expect(screen.queryByText(/Board resets/)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=LaptopScreen` → FAIL.

- [ ] **Step 3: Add the screensaver keyframes to `tailwind.config.js`** (inside `theme.extend.keyframes` and `theme.extend.animation`, next to the other `onair-*` entries)

```js
        // The couch laptop's screensaver: the GG bug drifting corner to corner.
        // The end offsets match the bug's box in LaptopScreen (24cqw x 10cqw).
        'onair-bounce-x': { from: { left: '0%' }, to: { left: 'calc(100% - 24cqw)' } },
        'onair-bounce-y': { from: { top: '0%' }, to: { top: 'calc(100% - 10cqw)' } },
```

```js
        'onair-bounce-x': 'onair-bounce-x 7s linear infinite alternate',
        'onair-bounce-y': 'onair-bounce-y 4.3s linear infinite alternate',
```

- [ ] **Step 4: Write `LaptopScreen.js`**

```js
import { MONO } from '../onAir/classes';
import { money, plural, shortUntil } from './couchCopy';
import { SCREEN_CLASS } from './couchLayout';

// The laptop on the coffee table (spec: The laptop). On Air readouts only,
// never casino imagery. It turns on during a hunt but never glows.

function Hunt({ laptop }) {
  const { opened, total, back, currency } = laptop;
  const pct = total ? Math.min(100, (opened / total) * 100) : 0;
  return (
    <div className="flex h-full flex-col justify-center gap-[3cqw] px-[7cqw]">
      <span className={`${MONO} text-[5cqw] tracking-[0.2em] text-onair-signal`}>Hunt live</span>
      <span className="font-onair text-[16cqw] font-extrabold leading-none text-onair-ink-1">
        {opened}
        <span className="text-onair-ink-4">/{total ?? '?'}</span>
      </span>
      {total ? (
        <span className="block h-[3cqw] w-full overflow-hidden rounded-onair-label bg-onair-surface-raised">
          <span className="block h-full bg-onair-signal" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      <span className={`${MONO} text-[5cqw] tracking-[0.18em] text-onair-ink-3`}>{money(back, currency)} back</span>
    </div>
  );
}

function Round({ laptop }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[3cqw] px-[7cqw]">
      <span className={`${MONO} text-[5cqw] tracking-[0.2em] text-onair-signal`}>
        {laptop.mode === 'open' ? 'Predictions open' : 'Predictions locked'}
      </span>
      <span className="font-onair text-[11cqw] font-extrabold leading-none text-onair-ink-1">
        {plural(laptop.guesses || 0, 'guess', 'guesses')}
      </span>
    </div>
  );
}

function Screensaver({ laptop }) {
  return (
    <>
      <div className="absolute inset-x-[6cqw] bottom-[16cqw] top-[6cqw]">
        <div className="absolute inset-y-0 left-0 w-[24cqw] motion-safe:animate-onair-bounce-x">
          <span className="absolute left-0 top-0 grid h-[10cqw] w-full place-items-center rounded-onair-tile bg-onair-surface-raised font-onair text-[6cqw] font-extrabold text-onair-ink-2 motion-safe:animate-onair-bounce-y">
            GG
          </span>
        </div>
      </div>
      {laptop.resetsIn ? (
        <span className={`${MONO} absolute inset-x-0 bottom-[5cqw] text-center text-[4.5cqw] tracking-[0.18em] text-onair-ink-4`}>
          Board resets in {shortUntil(laptop.resetsIn)}
        </span>
      ) : null}
    </>
  );
}

export default function LaptopScreen({ laptop }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-onair-surface-4"
      style={{ containerType: 'inline-size' }}
      aria-hidden="true"
      data-testid="laptop-screen"
    >
      {laptop.mode === 'hunt' && <Hunt laptop={laptop} />}
      {(laptop.mode === 'open' || laptop.mode === 'locked') && <Round laptop={laptop} />}
      {laptop.mode === 'idle' && <Screensaver laptop={laptop} />}
      <span className={`${SCREEN_CLASS} pointer-events-none absolute inset-0`} />
    </div>
  );
}
```

- [ ] **Step 5: Run tests** → PASS (4 tests). Also run `npm test -- --watchAll=false --testPathPattern=onAirContract` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/couch/LaptopScreen.js src/components/couch/__tests__/LaptopScreen.test.js tailwind.config.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): the gamba laptop with hunt, round and screensaver"
```

---

### Task 13: The room (desktop)

**Files:**
- Create: `src/components/couch/useCouchStage.js`, `src/components/couch/RoomDoors.js`, `src/components/couch/CouchFront.js` (room part; the phone part lands in Task 14)
- Modify: `src/index.css` (append `.couch-dim`)
- Test: `src/components/couch/__tests__/CouchFront.test.js`

**Interfaces:**
- Consumes: `coverBox`, `pctRect`, `viewRect`, `zoomTransform` (Task 1); `useDoor` (Task 6); `LAYOUT`, `pctStyle`, `within`, `plateSrc`, `plateSrcSet`, `center` (Task 8); `CouchTv` (Task 11); `LaptopScreen` (Task 12); `NAV_H`; `MONO`, `FOCUS`.
- Produces:
  - `useCouchStage(aspect, focal) → { containerRef, stageRef, box, zoomFor(rectPct) → zoom }`
  - `RoomDoors({ doors, covers, giveaway, onDoor })`
  - `CouchFront({ couch, items, mode, flipTo, onDoor, onAutoplayBlocked, stage, roomLayout, noArt })` (default export) and `ROOM_QUERY = '(min-width: 768px) and (min-aspect-ratio: 4/3)'`
  - `onDoor(door, anchorElement)` is called on a plain click of any door. Test ids: `couch-stage`, `couch-glow`.

- [ ] **Step 1: Write the failing test**

```js
import { fireEvent, render, screen, within as inside } from '@testing-library/react';
import CouchFront from '../CouchFront';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import useCouchStage from '../useCouchStage';
import { ART_ASPECT, LAYOUT } from '../couchLayout';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});

function Room({ fixture = 'offair', onDoor = () => {} }) {
  const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal);
  const couch = buildCouch(F[fixture].input);
  return <CouchFront couch={couch} items={[]} mode="stills" onDoor={onDoor} stage={stage} roomLayout />;
}
const doorList = () => screen.getByRole('list', { name: 'Things in the room' });

test('the room is an ordered list of real links, in door order', () => {
  render(<Room />);
  const links = inside(doorList()).getAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/vods', '/gamba', '/vods', '/schedule', '/gaming', '/store', '/about']);
  expect(links[0].getAttribute('aria-label')).toBe('TV: Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Vods.');
});

test('a plain click hands the door to onDoor; a ctrl-click stays native', () => {
  const onDoor = jest.fn();
  render(<Room onDoor={onDoor} />);
  const guide = screen.getByRole('link', { name: /^TV guide:/ });
  fireEvent.click(guide, { button: 0, ctrlKey: true });
  expect(onDoor).not.toHaveBeenCalled();
  fireEvent.click(guide, { button: 0 });
  expect(onDoor.mock.calls[0][0].id).toBe('guide');
  expect(onDoor.mock.calls[0][1]).toBe(guide);
});

test('labels show the teaser; the plate and screens render', () => {
  render(<Room />);
  expect(screen.getByText('Back tomorrow 11:00 AM')).toBeTruthy();
  expect(screen.getByTestId('couch-stage').querySelector('img').getAttribute('src')).toBe('/couch/90s/test-room-1280.webp');
  expect(screen.getByTestId('couch-tv')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen')).toBeTruthy();
});

test('live: the TV light is on and the TV door goes to the stream', () => {
  render(<Room fixture="live" />);
  expect(screen.getByTestId('couch-glow')).toBeTruthy();
  expect(screen.getByRole('link', { name: /^TV:/ }).getAttribute('href')).toBe('https://twitch.tv/GooferG');
});

test('off air the room casts no light', () => {
  render(<Room />);
  expect(screen.queryByTestId('couch-glow')).toBeNull();
});

test('an open giveaway puts the handwritten note on the TV', () => {
  render(<Room fixture="giveaway" />);
  const note = screen.getByRole('link', { name: /^Note:/ });
  expect(note.textContent).toContain('!goof');
  expect(note.getAttribute('href')).toBe('/giveaway');
});

test('a new tape wears a sticker', () => {
  render(<Room />);
  expect(inside(screen.getByRole('link', { name: /^Tapes:/ })).getByText('New')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=CouchFront` → FAIL.

- [ ] **Step 3: Write `useCouchStage.js`**

```js
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { coverBox, pctRect, viewRect, zoomTransform } from '../camera/cameraMath';
import { NAV_H } from '../nav/navMetrics';

// Measures the room's container, places the art over it like a cover image
// around the focal point, and turns a rect in percent of the art into the
// camera zoom that fills the view with it. Rects are computed from the box at
// rest, never measured off the (possibly transformed) stage.
export default function useCouchStage(aspect, focal) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomFor = useCallback(
    (rect) => {
      const c = containerRef.current.getBoundingClientRect();
      const b = coverBox({ width: c.width, height: c.height }, aspect, focal);
      const stage = { x: c.left + b.left, y: c.top + b.top, width: b.width, height: b.height };
      return zoomTransform(stage, pctRect(stage, rect), viewRect(window, NAV_H));
    },
    [aspect, focal]
  );

  return { containerRef, stageRef, box: size ? coverBox(size, aspect, focal) : null, zoomFor };
}
```

- [ ] **Step 4: Write `RoomDoors.js`**

```js
import { useCallback } from 'react';
import useDoor from '../camera/useDoor';
import { FOCUS, MONO } from '../onAir/classes';
import { LAYOUT, pctStyle, within } from './couchLayout';

// The doors laid over the art (spec: Doors). One ordered list of real links:
// its order is the tab order and the screen-reader structure of the room.
// Cutouts lift on hover; the laptop doesn't, because its screen sits on top.
const LIFT = ['tapes', 'guide', 'games', 'remote', 'photo'];

function Label({ door, style }) {
  return (
    <span className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full pb-1.5" style={style} aria-hidden="true">
      <span className="flex flex-col rounded-onair-tile bg-onair-surface-2/90 px-2.5 py-1.5 shadow-onair-row">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className={`h-[7px] w-[7px] rounded-full ${door.lit ? 'bg-onair-signal' : 'bg-onair-ink-5'}`} />
          <span className={`${MONO} text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}>{door.kicker}</span>
          <span className="font-onair text-[0.8125rem] font-bold text-onair-ink-1">{door.teaser}</span>
        </span>
        <span className="hidden w-[18rem] pt-1 font-onair text-[0.8125rem] font-medium leading-snug text-onair-ink-2 group-hover:block group-focus-visible:block">
          {door.sentence} <span className="text-onair-signal">Opens {door.destination}</span>
        </span>
      </span>
    </span>
  );
}

function StickyNote({ keyword }) {
  return (
    <span className="absolute inset-0 grid -rotate-6 place-items-center rounded-onair-label bg-onair-paper p-[6%] text-center shadow-onair-row">
      <span className="font-onair-marker text-[1.0625rem] leading-tight text-onair-paper-ink">
        type
        <br />
        {keyword}
      </span>
    </span>
  );
}

function NewSticker() {
  return (
    <span className="absolute -top-[10%] right-[4%] rotate-6 rounded-onair-label bg-onair-signal px-2 py-0.5 font-onair-marker text-[0.9375rem] text-onair-paper-ink shadow-onair-row">
      New
    </span>
  );
}

function RoomDoor({ door, covers, giveaway, onDoor }) {
  const box = LAYOUT.doors[door.id];
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const props = useDoor(door.href, go);
  const [ax, ay] = box.anchor;
  const [x, y, w, h] = box.rect;
  const anchor = { left: `${((ax - x) / w) * 100}%`, top: `${((ay - y) / h) * 100}%` };
  const lift = LIFT.includes(door.id)
    ? 'transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-[2%] motion-safe:group-focus-visible:-translate-y-[2%] group-hover:drop-shadow-lg'
    : '';
  return (
    <li className="absolute" style={pctStyle(box.rect)}>
      <a {...props} aria-label={door.label} data-door={door.id} className={`group relative block h-full w-full rounded-onair-tile ${FOCUS}`}>
        {box.cutout && (
          <img src={box.cutout} alt="" data-door-art draggable={false} className={`absolute inset-0 h-full w-full ${lift}`} />
        )}
        {door.id === 'games' &&
          (box.cases || []).map((rect, i) =>
            covers[i] ? (
              <img key={covers[i].appid} src={covers[i].cover} alt="" className="absolute object-cover" style={pctStyle(within(box.rect, rect))} />
            ) : null
          )}
        {door.id === 'note' && giveaway && <StickyNote keyword={giveaway.keyword} />}
        {door.sticker === 'new' && <NewSticker />}
        <Label door={door} style={anchor} />
      </a>
    </li>
  );
}

export default function RoomDoors({ doors, covers, giveaway, onDoor }) {
  return (
    <ol aria-label="Things in the room" className="absolute inset-0">
      {doors.map((door) => (
        <RoomDoor key={door.id} door={door} covers={covers} giveaway={giveaway} onDoor={onDoor} />
      ))}
    </ol>
  );
}
```

- [ ] **Step 5: Write `CouchFront.js` (room part)**

```js
import { useState } from 'react';
import CouchTv from './CouchTv';
import LaptopScreen from './LaptopScreen';
import RoomDoors from './RoomDoors';
import { LAYOUT, center, pctStyle, plateSrc, plateSrcSet } from './couchLayout';

// The couch (spec: The room). Presentational: the art, the live screens and
// the doors, positioned in percent of the art on one stage the camera moves.
export const ROOM_QUERY = '(min-width: 768px) and (min-aspect-ratio: 4/3)';

function Room({ couch, items, mode, flipTo, onDoor, onAutoplayBlocked, stage, onPlateError }) {
  const { containerRef, stageRef, box } = stage;
  const base = LAYOUT.art.empty || LAYOUT.art.plate;
  const [tx, ty] = center(LAYOUT.screens.tv);
  const live = couch.tv.state === 'live';
  return (
    <section aria-label="Goofer's couch" className="mt-[57px]">
      <div ref={containerRef} className="relative h-[calc(100svh-57px)] overflow-hidden bg-onair-surface-4">
        <div
          ref={stageRef}
          data-testid="couch-stage"
          className="absolute origin-top-left"
          style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : { inset: 0 }}
        >
          <img
            src={plateSrc(base)}
            srcSet={plateSrcSet(base)}
            sizes="100vw"
            fetchPriority="high"
            alt=""
            draggable={false}
            onError={onPlateError}
            className="absolute inset-0 h-full w-full select-none"
          />
          <RoomDoors doors={couch.doors} covers={couch.covers} giveaway={couch.giveaway} onDoor={onDoor} />
          <span
            className={`couch-dim pointer-events-none absolute inset-0 ${live ? 'couch-dim--live' : ''}`}
            style={{ '--tv-x': `${tx}%`, '--tv-y': `${ty}%` }}
            data-testid={live ? 'couch-glow' : undefined}
          />
          <span className="pointer-events-none absolute z-[2]" style={pctStyle(LAYOUT.screens.tv)}>
            <CouchTv tv={couch.tv} items={items} mode={mode} flipTo={flipTo} onAutoplayBlocked={onAutoplayBlocked} />
          </span>
          <span className="pointer-events-none absolute z-[2]" style={pctStyle(LAYOUT.screens.laptop)}>
            <LaptopScreen laptop={couch.laptop} />
          </span>
        </div>
      </div>
    </section>
  );
}

export default function CouchFront(props) {
  const [plateFailed, setPlateFailed] = useState(false);
  return <Room {...props} onPlateError={() => setPlateFailed(true)} plateFailed={plateFailed} />;
}
```

(Task 14 replaces the default export with the room/phone switch; keep `Room` as is.)

- [ ] **Step 6: Append `.couch-dim` to `src/index.css`**

```css
/* Night in the room; only the TV casts light, and only while live. */
.couch-dim {
  z-index: 1;
  background: rgb(0 0 0 / 0.22);
  transition: background 400ms;
}
.couch-dim--live {
  background:
    radial-gradient(ellipse 34% 46% at var(--tv-x) var(--tv-y), color-mix(in srgb, theme('colors.onair.signal.DEFAULT') 18%, transparent), transparent 70%),
    rgb(0 0 0 / 0.1);
}
@media (prefers-reduced-motion: reduce) {
  .couch-dim {
    transition: none;
  }
}
```

- [ ] **Step 7: Run tests** → `npm test -- --watchAll=false --testPathPattern=CouchFront` → PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/couch/useCouchStage.js src/components/couch/RoomDoors.js src/components/couch/CouchFront.js src/components/couch/__tests__/CouchFront.test.js src/index.css
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): the room with doors, labels, screens and light"
```

---

### Task 14: Phones and the no-art fallback

**Files:**
- Create: `src/components/couch/DoorTiles.js`, `src/components/couch/TvCrop.js`
- Modify: `src/components/couch/CouchFront.js` (default export chooses the layout)
- Test: `src/components/couch/__tests__/CouchPhone.test.js`

**Interfaces:**
- Consumes: `useDoor`, `LAYOUT`, `cropStyle`, `pctStyle`, `plateSrc`, `rectAspect`, `within`, `CouchTv`.
- Produces: `DoorTiles({ doors, onDoor, noArt = false, skip = [] })`, `TvCrop({ door, tv, items, mode, flipTo, onDoor, onAutoplayBlocked })`. `CouchFront` renders the room when `roomLayout && !noArt` and the plate hasn't failed; otherwise `TvCrop` (unless there is no art) plus `DoorTiles`. Tile art carries `data-door-art`.

- [ ] **Step 1: Write the failing test**

```js
import { fireEvent, render, screen, within as inside } from '@testing-library/react';
import CouchFront from '../CouchFront';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
const STAGE = { containerRef: { current: null }, stageRef: { current: null }, box: null };
const front = (fixture, extra = {}) => (
  <CouchFront couch={buildCouch(F[fixture].input)} items={[]} mode="stills" onDoor={() => {}} stage={STAGE} roomLayout={false} {...extra} />
);

test('phones get the TV crop and a tile per door, TV first', () => {
  render(front('offair'));
  const tv = screen.getByRole('link', { name: /^TV:/ });
  expect(inside(tv).getByTestId('couch-tv')).toBeTruthy();
  const tiles = inside(screen.getByRole('list', { name: 'On the coffee table' })).getAllByRole('link');
  expect(tiles.map((a) => a.getAttribute('data-door'))).toEqual(['laptop', 'tapes', 'guide', 'games', 'remote', 'photo']);
  expect(screen.getByText('You missed Win Wednesdays. Thursday night, 4 hours 37.')).toBeTruthy();
});

test('an open giveaway tile spans both columns', () => {
  render(front('giveaway'));
  const note = screen.getByRole('link', { name: /^Note:/ });
  expect(note.closest('li').className).toMatch(/col-span-2/);
});

test('tapping a tile hands it to onDoor', () => {
  const onDoor = jest.fn();
  render(front('offair', { onDoor }));
  fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  expect(onDoor.mock.calls[0][0].id).toBe('tapes');
});

test('no art: every door is a plain tile, the TV included, and no images load', () => {
  const { container } = render(front('offair', { noArt: true, roomLayout: true }));
  const tiles = inside(screen.getByRole('list', { name: 'On the coffee table' })).getAllByRole('link');
  expect(tiles[0].getAttribute('data-door')).toBe('tv');
  expect(container.querySelector('img')).toBeNull();
});

test('a plate that fails to load falls back to the tiles', () => {
  const { container } = render(front('offair', { roomLayout: true, stage: { ...STAGE, box: null } }));
  fireEvent.error(container.querySelector('[data-testid="couch-stage"] img'));
  expect(screen.getByRole('list', { name: 'On the coffee table' })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=CouchPhone` → FAIL.

- [ ] **Step 3: Write `DoorTiles.js`**

```js
import { useCallback } from 'react';
import useDoor from '../camera/useDoor';
import { FOCUS, MONO } from '../onAir/classes';
import { LAYOUT, cropStyle, plateSrc, rectAspect } from './couchLayout';

// The doors as tiles (spec: Phone layout, The skeleton): phones, and any time
// the art is missing. Same links, same order, each with its sentence.
function TileArt({ id }) {
  const box = LAYOUT.doors[id];
  if (!box || id === 'note') return null;
  if (box.cutout) {
    return <img src={box.cutout} alt="" data-door-art className="mx-auto block h-[4.5rem] w-auto object-contain" />;
  }
  return (
    <span className="relative mx-auto block h-[4.5rem] overflow-hidden rounded-onair-tile" style={{ aspectRatio: rectAspect(box.rect) }}>
      <img src={plateSrc(LAYOUT.art.plate)} alt="" data-door-art style={cropStyle(box.rect)} />
    </span>
  );
}

function Tile({ door, onDoor, noArt }) {
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const props = useDoor(door.href, go);
  return (
    <li className={door.id === 'note' ? 'col-span-2' : ''}>
      <a
        {...props}
        aria-label={door.label}
        data-door={door.id}
        className={`flex h-full flex-col gap-2 rounded-onair-card bg-onair-surface-1 p-3 shadow-onair-card ${FOCUS}`}
      >
        {!noArt && <TileArt id={door.id} />}
        <span className={`${MONO} text-[0.625rem] tracking-[0.18em] text-onair-ink-4`}>{door.kicker}</span>
        <span className="font-onair text-[0.9375rem] font-bold leading-snug text-onair-ink-1">{door.sentence}</span>
      </a>
    </li>
  );
}

export default function DoorTiles({ doors, onDoor, noArt = false, skip = [] }) {
  return (
    <section className="px-3 pb-6 pt-4">
      <h2 className={`${MONO} px-1.5 pb-3 text-[0.625rem] tracking-[0.2em] text-onair-ink-4`}>On the coffee table</h2>
      <ol aria-label="On the coffee table" className="grid grid-cols-2 gap-2.5">
        {doors
          .filter((d) => !skip.includes(d.id))
          .map((door) => (
            <Tile key={door.id} door={door} onDoor={onDoor} noArt={noArt} />
          ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: Write `TvCrop.js`**

```js
import { useCallback } from 'react';
import useDoor from '../camera/useDoor';
import { FOCUS } from '../onAir/classes';
import CouchTv from './CouchTv';
import { LAYOUT, cropStyle, pctStyle, plateSrc, rectAspect, within } from './couchLayout';

// Phones: the TV and its stand, cropped from the same plate, with the live
// screen in it. The whole crop is the TV door.
export default function TvCrop({ door, tv, items, mode, flipTo, onDoor, onAutoplayBlocked }) {
  const crop = LAYOUT.phoneCrop;
  const go = useCallback((el) => onDoor(door, el), [door, onDoor]);
  const props = useDoor(door.href, go);
  return (
    <a
      {...props}
      aria-label={door.label}
      data-door="tv"
      className={`relative mt-[57px] block overflow-hidden ${FOCUS}`}
      style={{ aspectRatio: rectAspect(crop) }}
    >
      <img src={plateSrc(LAYOUT.art.plate)} alt="" style={cropStyle(crop)} />
      <span className="pointer-events-none absolute" style={pctStyle(within(crop, LAYOUT.screens.tv))}>
        <CouchTv tv={tv} items={items} mode={mode} flipTo={flipTo} onAutoplayBlocked={onAutoplayBlocked} />
      </span>
    </a>
  );
}
```

- [ ] **Step 5: Replace the default export in `CouchFront.js`**

Add imports `import DoorTiles from './DoorTiles';` and `import TvCrop from './TvCrop';`, then:

```js
export default function CouchFront(props) {
  const { couch, items, mode, flipTo, onDoor, onAutoplayBlocked, roomLayout, noArt = false } = props;
  const [plateFailed, setPlateFailed] = useState(false);
  if (roomLayout && !noArt && !plateFailed) return <Room {...props} onPlateError={() => setPlateFailed(true)} />;
  const art = !noArt && !plateFailed;
  const tv = couch.doors.find((d) => d.id === 'tv');
  return (
    <div className={art ? '' : 'mt-[57px]'}>
      {art && <TvCrop door={tv} tv={couch.tv} items={items} mode={mode} flipTo={flipTo} onDoor={onDoor} onAutoplayBlocked={onAutoplayBlocked} />}
      <DoorTiles doors={couch.doors} onDoor={onDoor} noArt={!art} skip={art ? ['tv'] : []} />
    </div>
  );
}
```

- [ ] **Step 6: Run tests** → `npm test -- --watchAll=false --testPathPattern="CouchPhone|CouchFront"` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/couch/DoorTiles.js src/components/couch/TvCrop.js src/components/couch/CouchFront.js src/components/couch/__tests__/CouchPhone.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): phone layout and the no-art tiles"
```

---

### Task 15: Live data

**Files:**
- Create: `src/components/couch/useLastVisit.js`, `useLiveGiveaway.js`, `useSteamGames.js`, `useCouchData.js`
- Modify: `api/steam-games.js` (cache header), `src/setupProxy.js` (dev proxy)
- Test: `src/components/couch/__tests__/couchData.test.js`, `src/__tests__/steamGamesApi.test.js`

**Interfaces:**
- Consumes: `useNow` (`src/components/hunts/useNow.js`), `useSchedule`, `useCommunityHunts`, `usePredictionRound`, `useHunt`, `useLeaderboardData`, `latestFinished` (Task 9), `useTvReel` (Task 10).
- Produces: `useLastVisit() → number | null | undefined`; `useLiveGiveaway() → giveaway | null`; `useSteamGames() → games[] | null`; `toCouchInput(parts) → couch input` (pure); `useCouchData({ isLive, streamData, statusReady, videos, clips, channelData }) → couch input`.

- [ ] **Step 1: Write the failing tests**

`src/components/couch/__tests__/couchData.test.js`:

```js
import { act, render, screen, waitFor } from '@testing-library/react';
import { toCouchInput } from '../useCouchData';
import useLastVisit from '../useLastVisit';
import useLiveGiveaway from '../useLiveGiveaway';
import useSteamGames from '../useSteamGames';

const mockSnapshot = { docs: [] };
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => 'c',
  query: (ref) => ref,
  where: () => null,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (_q, next) => {
    next({ empty: mockSnapshot.docs.length === 0, docs: mockSnapshot.docs });
    return () => {};
  },
}));

function Show({ hook }) {
  const value = hook();
  return <p data-testid="v">{value === undefined ? 'undefined' : JSON.stringify(value)}</p>;
}
const v = () => screen.getByTestId('v').textContent;

beforeEach(() => localStorage.clear());

test('useLastVisit: null on a first visit, then the stored time', async () => {
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('null');
  await waitFor(() => expect(localStorage.getItem('gg_last_visit')).not.toBeNull());
});

test('useLastVisit: the previous visit', () => {
  localStorage.setItem('gg_last_visit', '1700000000000');
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('1700000000000');
});

test('useLastVisit: undefined when storage throws', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(<Show hook={useLastVisit} />);
  expect(v()).toBe('undefined');
  spy.mockRestore();
});

test('useLiveGiveaway reads the newest active giveaway', () => {
  mockSnapshot.docs = [{ id: 'g1', data: () => ({ status: 'open', keyword: '!goof', prize: '$25.00 bonus buy' }) }];
  render(<Show hook={useLiveGiveaway} />);
  expect(JSON.parse(v())).toEqual({ id: 'g1', status: 'open', keyword: '!goof', prize: '$25.00 bonus buy' });
  mockSnapshot.docs = [];
});

test('useSteamGames: games on success, null on failure', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{ appid: 1, name: 'X', playtime_2weeks: 2 }] }) });
  const { unmount } = render(<Show hook={useSteamGames} />);
  await waitFor(() => expect(v()).toBe('[{"appid":1,"name":"X","playtime_2weeks":2}]'));
  unmount();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  render(<Show hook={useSteamGames} />);
  await act(async () => {});
  expect(v()).toBe('null');
});

test('toCouchInput maps App and hook data onto the model input', () => {
  const input = toCouchInput({
    now: 5,
    timeZone: 'UTC',
    isLive: true,
    statusReady: true,
    streamData: { title: 'T', viewer_count: 9, game_name: 'Slots', thumbnail_url: 'u' },
    videos: [],
    clips: [],
    channelData: { game_name: 'Slots' },
    schedule: { schedule: [], loading: true },
    hunts: { live: null, recent: [] },
    round: { round: null },
    lastHunt: { id: 'h', bonuses: [] },
    leaderboard: { endsAt: 99 },
    giveaway: { status: 'open', keyword: 'k', prize: 'p', id: 'g' },
    games: null,
    lastVisit: null,
    reel: [],
  });
  expect(input.stream).toEqual({ title: 'T', viewers: 9, game: 'Slots', thumbnailUrl: 'u' });
  expect(input.schedule).toBeNull();
  expect(input.category).toBe('Slots');
  expect(input.round).toBeNull();
  expect(input.leaderboardEndsAt).toBe(99);
  expect(input.giveaway).toEqual({ status: 'open', keyword: 'k', prize: 'p' });
  expect(input.lastHunt).toEqual({ id: 'h', bonuses: [] });
});
```

`src/__tests__/steamGamesApi.test.js`:

```js
import handler from '../../api/steam-games';

test('steam-games is cached at the CDN', async () => {
  process.env.STEAM_API_KEY = 'k';
  process.env.STEAM_ID = 'id';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: { games: [{ appid: 1, name: 'X', playtime_forever: 120, playtime_2weeks: 60, img_icon_url: 'a' }] } }),
  });
  const res = { setHeader: jest.fn(), status: jest.fn(() => res), json: jest.fn(), end: jest.fn() };
  await handler({ method: 'GET' }, res);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  expect(res.json.mock.calls[0][0].games[0]).toMatchObject({ appid: 1, name: 'X', playtime_2weeks: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail** → `npm test -- --watchAll=false --testPathPattern="couchData|steamGamesApi"` → FAIL.

- [ ] **Step 3: Write the hooks**

`useLastVisit.js`:

```js
import { useEffect, useState } from 'react';

const KEY = 'gg_last_visit';

// The viewer's previous visit (ms), read once per page load; the visit is then
// recorded after mount (not during render, so StrictMode's double render can't
// read its own write). null on a first visit; undefined when storage can't be
// read, which means "no New sticker".
export default function useLastVisit() {
  const [last] = useState(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw == null ? null : Number(raw) || null;
    } catch {
      return undefined;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // best-effort
    }
  }, []);
  return last;
}
```

`useLiveGiveaway.js`:

```js
import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The newest giveaway that is still running: the same query (and index) the
// /giveaway page uses. One document.
export default function useLiveGiveaway() {
  const [giveaway, setGiveaway] = useState(null);
  useEffect(() => {
    const q = query(
      collection(db, 'giveaways'),
      where('status', 'in', ['open', 'closed', 'rolling', 'playing']),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    return onSnapshot(
      q,
      (snap) => setGiveaway(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setGiveaway(null)
    );
  }, []);
  return giveaway;
}
```

`useSteamGames.js`:

```js
import { useEffect, useState } from 'react';

// Goofer's last-two-weeks Steam games (/api/steam-games, CDN-cached). null
// until it lands or when it fails.
export default function useSteamGames() {
  const [games, setGames] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/steam-games')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setGames(data && Array.isArray(data.games) ? data.games : null);
      })
      .catch(() => {
        if (!cancelled) setGames(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return games;
}
```

`useCouchData.js`:

```js
import useCommunityHunts from '../../hooks/useCommunityHunts';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import { useSchedule } from '../../hooks/useSchedule';
import useHunt from '../hunts/useHunt';
import useNow from '../hunts/useNow';
import usePredictionRound from '../hunts/usePredictionRound';
import { latestFinished } from './couchModel';
import useLastVisit from './useLastVisit';
import useLiveGiveaway from './useLiveGiveaway';
import useSteamGames from './useSteamGames';
import useTvReel from './useTvReel';

// App's Twitch poll plus the hooks below, mapped onto the couch model's input.
export function toCouchInput(p) {
  const s = p.streamData;
  const g = p.giveaway;
  return {
    now: p.now,
    timeZone: p.timeZone,
    statusReady: p.statusReady,
    isLive: p.isLive,
    stream: s ? { title: s.title, viewers: s.viewer_count ?? null, game: s.game_name || null, thumbnailUrl: s.thumbnail_url || null } : null,
    schedule: p.schedule.loading ? null : p.schedule.schedule,
    videos: p.videos || [],
    clips: p.clips || [],
    category: (p.channelData && p.channelData.game_name) || null,
    hunts: p.hunts,
    round: p.round.round,
    lastHunt: p.lastHunt && Array.isArray(p.lastHunt.bonuses) ? p.lastHunt : null,
    leaderboardEndsAt: p.leaderboard.endsAt ?? null,
    giveaway: g ? { status: g.status, keyword: g.keyword, prize: g.prize } : null,
    games: p.games,
    lastVisit: p.lastVisit,
    reel: p.reel,
  };
}

export default function useCouchData({ isLive, streamData, statusReady, videos, clips, channelData }) {
  const now = useNow(30000);
  const schedule = useSchedule();
  const hunts = useCommunityHunts();
  const round = usePredictionRound();
  const finished = latestFinished(hunts);
  const { hunt: lastHunt } = useHunt(finished ? finished.id : null, finished);
  const leaderboard = useLeaderboardData();
  const giveaway = useLiveGiveaway();
  const games = useSteamGames();
  const lastVisit = useLastVisit();
  const reel = useTvReel();
  return toCouchInput({
    now,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isLive,
    statusReady,
    streamData,
    videos,
    clips,
    channelData,
    schedule,
    hunts,
    round,
    lastHunt,
    leaderboard,
    giveaway,
    games,
    lastVisit,
    reel,
  });
}
```

Note: `toCouchInput` returns a new object every render, so `Couch` memoizes `buildCouch` on the input object; that is fine because `useNow` already re-renders every 30 s.

- [ ] **Step 4: Cache `/api/steam-games` and proxy it in dev**

In `api/steam-games.js`, just before `res.status(200).json({ games: formattedGames });` add:

```js
    // Home is the most-visited page; let the CDN answer most of it.
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
```

In `src/setupProxy.js`, inside `module.exports`, before the `/api/me` block, add:

```js
  // /api/steam-games needs STEAM_API_KEY (server-only): dev reads the deployed function.
  app.use(
    '/api/steam-games',
    createProxyMiddleware({
      target: DEPLOYED_API_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/api/steam-games': '/api/steam-games' },
    })
  );
```

- [ ] **Step 5: Run tests** → `npm test -- --watchAll=false --testPathPattern="couchData|steamGamesApi"` → PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/couch/useLastVisit.js src/components/couch/useLiveGiveaway.js src/components/couch/useSteamGames.js src/components/couch/useCouchData.js src/components/couch/__tests__/couchData.test.js src/__tests__/steamGamesApi.test.js api/steam-games.js src/setupProxy.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): live data for the couch; cache Steam at the CDN"
```

---

### Task 16: Wiring the camera to the couch

**Files:**
- Create: `src/components/couch/TvFrame.js`, `src/components/couch/Couch.js`
- Test: `src/components/couch/__tests__/Couch.test.js`

**Interfaces:**
- Consumes: everything above; `useMediaQuery` (`src/hooks/useMediaQuery.js`); `SOCIAL_LINKS`.
- Produces: `Couch({ input, noArt = false, introPullBack = false, introDone = true })` (default export), `aimFor(doorId) → rect`, `FLIP_MS = 400`; `TvFrame({ onExit })`. Must render inside a `CameraProvider`.

- [ ] **Step 1: Write the failing test**

```js
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import CameraProvider from '../../camera/CameraProvider';
import Couch from '../Couch';
import { COUCH_FIXTURES as F } from '../couchFixtures';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
const ZERO = { zoom: 0, cut: 0, staticIn: 0, minHold: 0, maxHold: 0, tuneOut: 0, pull: 0, introPull: 0, fade: 0, grow: 0 };
let nav;

function Site({ input, timings = ZERO }) {
  const loc = useLocation();
  nav = useNavigate();
  return loc.pathname === '/' ? <Couch input={input} /> : <p data-testid="page">{loc.pathname}</p>;
}
const renderSite = (input = F.offair.input, room = true, timings = ZERO) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: room, addEventListener() {}, removeEventListener() {} });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={timings}>
        <Site input={input} />
      </CameraProvider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
afterEach(() => {
  delete window.matchMedia;
  delete Element.prototype.animate;
});

test('a door takes you to its page', async () => {
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/vods'));
});

test('two quick clicks still make one trip', async () => {
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
    fireEvent.click(screen.getByRole('link', { name: /^TV guide:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/vods'));
});

test('the remote flips the TV to GSN, then lands on the Store', async () => {
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Remote:/ }), { button: 0 });
  });
  expect(screen.getByTestId('tv-flip')).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/store'));
});

test('live: the TV opens the stream inside the TV, and Back to the couch closes it', async () => {
  renderSite(F.live.input);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV:/ }), { button: 0 });
  });
  expect(screen.getByTitle("Goofer's live stream")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Back to the couch' }));
  });
  expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
});

test('the stream ending while you watch closes the frame', async () => {
  const { rerender } = renderSite(F.live.input);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV:/ }), { button: 0 });
  });
  rerender(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={ZERO}>
        <Site input={F.offair.input} />
      </CameraProvider>
    </MemoryRouter>
  );
  expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
  expect(screen.getByRole('link', { name: /^Tapes:/ })).toBeTruthy();
});

test('Back from a door pulls the camera back once; the nav does not', async () => {
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderSite(F.offair.input, true, { ...ZERO, pull: 1 });
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page')).toBeTruthy());
  await act(async () => nav(-1));
  await waitFor(() => expect(Element.prototype.animate).toHaveBeenCalled());
  const [keyframes] = Element.prototype.animate.mock.calls[0];
  expect(keyframes[1].transform).toBe('translate(0px, 0px) scale(1)');
  Element.prototype.animate.mockClear();
  await act(async () => nav('/vods'));
  await act(async () => nav('/'));
  expect(Element.prototype.animate).not.toHaveBeenCalled();
});

test('phones: a tile grows into its page', async () => {
  renderSite(F.offair.input, false);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV guide:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/schedule'));
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=couch/__tests__/Couch.test` → FAIL.

- [ ] **Step 3: Write `TvFrame.js`**

```js
import { useEffect, useRef } from 'react';
import { SOCIAL_LINKS } from '../../constants';
import { NAV_H } from '../nav/navMetrics';
import { FOCUS } from '../onAir/classes';

// "Inside the TV" while live (spec: Watch inside the TV): the Twitch player at
// full resolution under the nav. Esc, Back or the button pull back out.
export default function TvFrame({ onExit, channel = 'GooferG' }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onExit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit]);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return (
    <div role="dialog" aria-modal="true" aria-label="Goofer's stream" className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-onair-surface-4" style={{ top: NAV_H }}>
      <iframe
        title="Goofer's live stream"
        src={`https://player.twitch.tv/?channel=${channel}&parent=${host}&autoplay=true`}
        allowFullScreen
        className="min-h-0 w-full flex-1"
      />
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          ref={closeRef}
          type="button"
          onClick={onExit}
          className={`rounded-onair-control bg-onair-surface-raised px-4 py-2.5 font-onair text-[0.9375rem] font-bold text-onair-ink-1 shadow-onair-raised ${FOCUS}`}
        >
          Back to the couch
        </button>
        <a
          href={SOCIAL_LINKS.twitch}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-onair-control bg-onair-viewer px-4 py-2.5 font-onair text-[0.9375rem] font-bold text-white-body ${FOCUS}`}
        >
          Open on Twitch
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `Couch.js`**

```js
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMediaQuery from '../../hooks/useMediaQuery';
import { TIMINGS, useCamera } from '../camera/CameraProvider';
import { viewRect } from '../camera/cameraMath';
import { NAV_H } from '../nav/navMetrics';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import CouchFront, { ROOM_QUERY } from './CouchFront';
import TvFrame from './TvFrame';
import { ART_ASPECT, LAYOUT } from './couchLayout';
import { buildCouch } from './couchModel';
import { reelItems, reelMode } from './reel';
import useCouchStage from './useCouchStage';

// The couch with its camera (spec: The camera). Must sit inside CameraProvider.
export const FLIP_MS = 400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What the camera aims at: the TV's screen for the TV and the remote.
export const aimFor = (id) => (id === 'tv' || id === 'remote' ? LAYOUT.screens.tv : LAYOUT.doors[id].rect);

const saveData = () => typeof navigator !== 'undefined' && !!(navigator.connection && navigator.connection.saveData);

export default function Couch({ input, noArt = false, introPullBack = false, introDone = true }) {
  const couch = useMemo(() => buildCouch(input), [input]);
  const roomLayout = useMediaQuery(ROOM_QUERY);
  const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal);
  const camera = useCamera();
  const navigate = useNavigate();
  const location = useLocation();
  const [flipTo, setFlipTo] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const mode = reelMode({ reducedMotion: prefersReducedMotion(), saveData: saveData(), autoplayBlocked: blocked });
  const items = useMemo(
    () => reelItems({ reel: input.reel, clips: input.clips, videos: input.videos, cards: couch.tv.cards }),
    [input.reel, input.clips, input.videos, couch.tv.cards]
  );
  const live = couch.tv.state === 'live';
  const watching = live && !!(location.state && location.state.watch);
  const inRoom = roomLayout && !noArt;

  const onDoor = useCallback(
    async (door, el) => {
      const stageEl = stage.stageRef.current;
      if (door.id === 'tv' && live) {
        if (inRoom && stageEl) await camera.enterInPlace({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')), state: { watch: true } });
        else navigate(location.pathname, { state: { watch: true } });
        return;
      }
      if (!inRoom || !stageEl) {
        const art = el.querySelector('img[data-door-art]');
        const cutout = LAYOUT.doors[door.id] && LAYOUT.doors[door.id].cutout;
        const src = art && cutout ? art.currentSrc || art.src : null;
        await camera.growFrom({ rect: (src ? art : el).getBoundingClientRect(), src, href: door.href, doorId: door.id, view: viewRect(window, NAV_H) });
        return;
      }
      if (door.id === 'remote') {
        setFlipTo('gsn');
        await wait(FLIP_MS);
      }
      await camera.goThrough({ stage: stageEl, zoom: stage.zoomFor(aimFor(door.id)), href: door.href, doorId: door.id });
    },
    [camera, inRoom, live, location.pathname, navigate, stage]
  );

  // On mount: start inside the TV for the intro, or pull back from the door we
  // came back through. Layout effect, so the zoomed frame is what paints first.
  useLayoutEffect(() => {
    const stageEl = stage.stageRef.current;
    if (introPullBack && !introDone) {
      if (inRoom && stageEl) camera.hold({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')) });
      return;
    }
    const back = camera.takeReturn();
    if (!back) return;
    if (inRoom && stageEl) {
      camera.pullBack({ stage: stageEl, zoom: stage.zoomFor(aimFor(back)) });
      return;
    }
    const tile = document.querySelector(`[data-door="${back}"]`);
    if (!tile) return;
    const art = tile.querySelector('img[data-door-art]');
    const cutout = LAYOUT.doors[back] && LAYOUT.doors[back].cutout;
    const src = art && cutout ? art.currentSrc || art.src : null;
    camera.shrinkInto({ rect: (src ? art : tile).getBoundingClientRect(), src, view: viewRect(window, NAV_H) });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The intro: once the power-on finishes, pull back from the TV.
  const introPending = useRef(introPullBack && !introDone);
  useEffect(() => {
    if (!introPending.current || !introDone) return;
    introPending.current = false;
    const stageEl = stage.stageRef.current;
    if (inRoom && stageEl) camera.pullBack({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')), duration: TIMINGS.introPull, withStatic: false });
  }, [introDone, inRoom, camera, stage]);

  // Leaving "inside the TV" (Back, Esc, the button, or the stream ending).
  const wasWatching = useRef(watching);
  useEffect(() => {
    const stageEl = stage.stageRef.current;
    if (wasWatching.current && !watching && inRoom && stageEl) camera.pullBack({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')) });
    wasWatching.current = watching;
  }, [watching, inRoom, camera, stage]);

  const exitWatch = useCallback(() => {
    if (location.key === 'default') navigate(location.pathname, { replace: true, state: null });
    else navigate(-1);
  }, [location.key, location.pathname, navigate]);

  return (
    <>
      <CouchFront
        couch={couch}
        items={items}
        mode={mode}
        flipTo={flipTo}
        onDoor={onDoor}
        onAutoplayBlocked={() => setBlocked(true)}
        stage={stage}
        roomLayout={roomLayout}
        noArt={noArt}
      />
      {watching && <TvFrame onExit={exitWatch} />}
    </>
  );
}
```

- [ ] **Step 5: Run tests** → `npm test -- --watchAll=false --testPathPattern=couch/__tests__/Couch.test` → PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/couch/TvFrame.js src/components/couch/Couch.js src/components/couch/__tests__/Couch.test.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): doors, the remote, watch mode and pull-backs on the camera"
```

---

### Task 17: Home, App and the welcome card

**Files:**
- Modify: `src/pages/HomePage.js` (replace whole file), `src/App.js` (provider, HomePage props), `src/components/WelcomeSignOn.js` (restyle, copy, `delayMs`)
- Test: `src/pages/__tests__/HomePage.test.js`

**Interfaces:**
- Consumes: `Couch` (Task 16), `useCouchData` (Task 15), `COUCH_FIXTURES` (Task 9), `CameraProvider` (Task 5).
- Produces: `HomePage({ channelData, isLive, streamData, loading, clips, videos, statusReady, introDone, introPullBack })`; `WelcomeSignOn({ introDone, delayMs = 400 })`.

- [ ] **Step 1: Write the failing test**

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CameraProvider from '../../components/camera/CameraProvider';
import HomePage from '../HomePage';

jest.mock('../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
// The live path's hooks reach Firebase; a fixture never calls them.
jest.mock('../../components/couch/useCouchData', () => () => ({}));

beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
  window.history.pushState({}, '', '/?fixture=offair');
});
afterEach(() => window.history.pushState({}, '', '/'));

test('a dev fixture renders the couch', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider>
        <HomePage introDone={false} />
      </CameraProvider>
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: /^Tapes:/ }).getAttribute('href')).toBe('/vods');
});
```

- [ ] **Step 2: Run test to verify it fails** → `npm test -- --watchAll=false --testPathPattern=pages/__tests__/HomePage` → FAIL.

- [ ] **Step 3: Replace `src/pages/HomePage.js`**

```js
import { useState } from 'react';
import WelcomeSignOn from '../components/WelcomeSignOn';
import Couch from '../components/couch/Couch';
import useCouchData from '../components/couch/useCouchData';

// Home: the couch (spec: docs/superpowers/specs/2026-10-04-couch-home-design.md).
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /?fixture=offair|live|giveaway|hunt|round|late|loading|noart|empty
  // renders the couch from couchFixtures. Webpack drops this branch, and the
  // fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/couch/couchFixtures').COUCH_FIXTURES[key] || null;
  };
}

function LiveCouch({ introPullBack, introDone, ...twitch }) {
  const input = useCouchData(twitch);
  return <Couch input={input} introPullBack={introPullBack} introDone={introDone} />;
}

export default function HomePage({ introDone = true, introPullBack = false, ...twitch }) {
  const [fixture] = useState(readFixture);
  return (
    <>
      <WelcomeSignOn introDone={introDone} delayMs={introPullBack ? 1500 : 400} />
      {fixture ? (
        <Couch input={fixture.input} noArt={!!fixture.noArt} />
      ) : (
        <LiveCouch introPullBack={introPullBack} introDone={introDone} {...twitch} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Wire `src/App.js`**

1. Add `import CameraProvider from './components/camera/CameraProvider';`.
2. Wrap the JSX inside `<div className="min-h-screen bg-zinc-broadcast text-white-body">` (everything from `{showTVIntro && …}` through `{isBrandRoute && <SiteFooter />}`) in `<CameraProvider>` … `</CameraProvider>`.
3. Replace the `HomePage` element's props with:

```js
              <HomePage
                channelData={channelData}
                isLive={isLive}
                streamData={streamData}
                loading={loading}
                clips={clips}
                videos={videos}
                statusReady={statusReady}
                introDone={!showTVIntro}
                introPullBack={intro.mode === 'gate'}
              />
```

- [ ] **Step 5: Restyle `src/components/WelcomeSignOn.js`**

Keep `SEEN_KEY`, `alreadySeen`, `markSeen`, the focus and Escape effects and `dismiss`. Delete `goToTools`. Change the signature to `export default function WelcomeSignOn({ introDone, delayMs = SIGN_ON_DELAY_MS })` and use `delayMs` in the `setTimeout`. Replace the returned JSX with:

```jsx
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 motion-safe:animate-fade-in" onClick={dismiss}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label="First time on the couch"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-onair-card bg-onair-surface-1 p-6 font-onair shadow-onair-card focus:outline-none motion-safe:animate-modal-in sm:p-8"
      >
        <div className={`${MONO} mb-3 flex items-center gap-2 text-[0.625rem] tracking-[0.2em] text-onair-signal`}>
          <span className="h-1.5 w-1.5 rounded-full bg-onair-signal" aria-hidden="true" />
          Channel sign-on
        </div>
        <h2 className="mb-3 text-[1.875rem] font-extrabold leading-tight tracking-[-0.02em] text-onair-ink-1">First time on the couch?</h2>
        <p className="mb-6 text-[0.9375rem] leading-relaxed text-onair-ink-3">
          This is Goofer's living room. Everything in it is clickable: the TV, the tapes, the laptop, the guide. The menu up top works too.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className={`rounded-onair-control bg-onair-signal px-4 py-2.5 text-[0.9375rem] font-bold text-onair-surface-4 shadow-onair-raised ${FOCUS}`}
        >
          Look around
        </button>
      </div>
    </div>
```

and add `import { FOCUS, MONO } from './onAir/classes';` at the top.

- [ ] **Step 6: Run the home test and the full suite**

Run: `npm test -- --watchAll=false --testPathPattern=pages/__tests__/HomePage` → PASS.
Run: `npm test -- --watchAll=false` → all PASS (fix any App or WelcomeSignOn test that asserted the old copy or props by updating it to the new behaviour).

- [ ] **Step 7: See it in the browser**

Run `npm start` (background) and open `http://localhost:3000/?fixture=offair`, `?fixture=live`, `?fixture=giveaway`, `?fixture=hunt`, `?fixture=loading`, `?fixture=noart`, then the live page `/`. Click a door, press Back, try the phone view (devtools device mode). Note anything off and fix it before committing.

- [ ] **Step 8: Commit**

```bash
git add src/pages/HomePage.js src/pages/__tests__/HomePage.test.js src/App.js src/components/WelcomeSignOn.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): home is the couch; camera in the app shell"
```

---

### Task 18: Themes

**Files:**
- Create: `src/components/couch/themes.js`, `src/components/couch/Dressing.js`
- Modify: `src/components/couch/couchModel.js` (theme in, `theme` out, theme cards first), `src/components/couch/couchFixtures.js` (`theme: null` in BASE, a `halloween` fixture), `src/components/couch/useCouchData.js` (theme from the calendar and `?theme=`), `src/components/couch/CouchFront.js` (dressing in the room, theme bug to the laptop), `src/components/couch/TvCrop.js` (dressing in the crop), `src/components/couch/LaptopScreen.js` (`bug` prop)
- Test: `src/components/couch/__tests__/themes.test.js`

**Interfaces:**
- Consumes: `LAYOUT`, `pctStyle`, `within` (Task 8); `buildCouch`, `COUCH_FIXTURES` (Task 9); `LaptopScreen` (Task 12); `CouchFront`, `TvCrop` (Tasks 13–14); `toCouchInput`, `useCouchData` (Task 15); `HOME_ZONE` (`src/utils/scheduleTime.js`).
- Produces: `THEMES`, `themeFor(now, override = null) → id | null`, `readThemeOverride() → string | null`, `themeArt(layout, theme) → object | null` (themes.js); `Dressing({ layers, frame = null })` (default export); model input `theme`, output `couch.theme`; `LaptopScreen({ laptop, bug = null })`; `TvCrop` gains a `theme` prop.

- [ ] **Step 1: Write the failing test** (`src/components/couch/__tests__/themes.test.js`)

```js
import { render, screen } from '@testing-library/react';
import Dressing from '../Dressing';
import LaptopScreen from '../LaptopScreen';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import { THEMES, themeArt, themeFor } from '../themes';
import { toCouchInput } from '../useCouchData';

const at = (iso) => Date.parse(iso);

test('Halloween runs through October on the Arizona calendar', () => {
  expect(themeFor(at('2026-10-15T12:00:00Z'))).toBe('halloween');
  expect(themeFor(at('2026-11-01T06:00:00Z'))).toBe('halloween'); // Oct 31, 11 PM in Arizona
  expect(themeFor(at('2026-11-01T08:00:00Z'))).toBeNull(); // Nov 1, 1 AM in Arizona
  expect(themeFor(at('2026-09-30T12:00:00Z'))).toBeNull();
});

test('an override previews a theme or switches it off', () => {
  expect(themeFor(at('2026-03-01T12:00:00Z'), 'halloween')).toBe('halloween');
  expect(themeFor(at('2026-10-15T12:00:00Z'), 'none')).toBeNull();
  expect(themeFor(at('2026-10-15T12:00:00Z'), 'nope')).toBe('halloween');
});

test('themeArt reads a theme from a room layout', () => {
  const layout = { themes: { halloween: { dressing: [] } } };
  expect(themeArt(layout, 'halloween')).toEqual({ dressing: [] });
  expect(themeArt(layout, null)).toBeNull();
  expect(themeArt({}, 'halloween')).toBeNull();
});

test('a theme leads the TV reel with its card and travels on the couch', () => {
  const c = buildCouch(F.halloween.input);
  expect(c.theme).toBe('halloween');
  expect(c.tv.cards[0]).toEqual(THEMES.halloween.cards[0]);
  expect(c.tv.cards).toHaveLength(4);
  expect(buildCouch(F.offair.input).theme).toBeNull();
});

test('toCouchInput carries the theme', () => {
  const base = { schedule: { schedule: [], loading: false }, round: { round: null }, leaderboard: {}, hunts: {} };
  expect(toCouchInput({ ...base, theme: 'halloween' }).theme).toBe('halloween');
  expect(toCouchInput(base).theme).toBeNull();
});

test('dressing layers are decorative and placed in percent, inside a frame when given', () => {
  const { container } = render(<Dressing layers={[{ id: 'cobweb', src: '/c.webp', rect: [10, 20, 30, 40] }]} frame={[0, 0, 50, 50]} />);
  const img = container.querySelector('img[data-dressing="cobweb"]');
  expect(img.getAttribute('aria-hidden')).toBe('true');
  expect(img.className).toMatch(/pointer-events-none/);
  expect(img.style.left).toBe('20%');
  expect(img.style.width).toBe('60%');
});

test('no layers, no dressing', () => {
  const { container } = render(<Dressing layers={null} />);
  expect(container.innerHTML).toBe('');
});

test('the laptop screensaver shows the theme bug', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: null, last: null }} bug="/couch/90s/halloween/bug.webp" />);
  expect(screen.getByTestId('laptop-screen').querySelector('img').getAttribute('src')).toBe('/couch/90s/halloween/bug.webp');
  expect(screen.queryByText('GG')).toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail** → `npm test -- --watchAll=false --testPathPattern=couch/__tests__/themes` → FAIL.

- [ ] **Step 3: Write `themes.js`**

```js
import { HOME_ZONE } from '../../utils/scheduleTime';

// Seasonal themes (spec: Themes). A theme dresses the room: its calendar and
// copy live here, its art in the room's layout under themes.<id>.
export const THEMES = {
  halloween: {
    months: [9], // October (0-based), on Goofer's Arizona calendar
    cards: [{ kicker: 'Spooky season', text: 'The couch is haunted until Halloween.' }],
  },
};

// The theme for `now`, unless `override` names one; 'none' switches themes off.
export function themeFor(now, override = null) {
  if (override === 'none') return null;
  if (override && THEMES[override]) return override;
  const month = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: HOME_ZONE }).format(now)) - 1;
  return Object.keys(THEMES).find((id) => THEMES[id].months.includes(month)) || null;
}

// ?theme=<id> previews a theme in any build; ?theme=none switches it off.
export function readThemeOverride() {
  try {
    return new URLSearchParams(window.location.search).get('theme');
  } catch {
    return null;
  }
}

export const themeArt = (layout, theme) => (theme && layout && layout.themes && layout.themes[theme]) || null;
```

- [ ] **Step 4: Write `Dressing.js`**

```js
import { pctStyle, within } from './couchLayout';

// A theme's dressing over the room (spec: Themes): decorative layers with no
// pointer events, positioned in percent of the art (or of `frame`, a rect of
// the art, inside the phone's TV crop).
export default function Dressing({ layers, frame = null }) {
  if (!layers || !layers.length) return null;
  return layers.map((layer) => (
    <img
      key={layer.id}
      src={layer.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-dressing={layer.id}
      className="pointer-events-none absolute select-none"
      style={pctStyle(frame ? within(frame, layer.rect) : layer.rect)}
    />
  ));
}
```

- [ ] **Step 5: Thread the theme through the model, fixtures and data**

In `couchModel.js`: add `import { THEMES } from './themes';`; in `buildCouch`, add `const theme = input.theme && THEMES[input.theme] ? input.theme : null;` and change the cards to

```js
  const cards =
    state === 'offair'
      ? [
          ...(theme ? THEMES[theme].cards : []),
          { kicker: 'Off air', text: copy.tv.sentence },
          { kicker: 'Tapes', text: copy.tapes.sentence },
          { kicker: 'Laptop', text: copy.laptop.sentence },
        ]
      : [];
```

and add `theme,` to the returned object. Document `theme: id | null` in the input comment.

In `couchFixtures.js`: add `theme: null,` to `BASE` and `halloween: { input: { ...BASE, theme: 'halloween' } },` to `COUCH_FIXTURES`. Update the HomePage fixture comment in `src/pages/HomePage.js` to list `halloween`.

In `useCouchData.js`: import `{ readThemeOverride, themeFor }` from `./themes`; in `toCouchInput` add `theme: p.theme ?? null,`; in `useCouchData` pass `theme: themeFor(now, readThemeOverride())` into `toCouchInput`.

- [ ] **Step 6: Dress the room, the crop and the laptop**

`LaptopScreen.js`: the default export takes `{ laptop, bug = null }` and passes `bug` to `Screensaver`, which renders, inside the bouncing span, `{bug ? <img src={bug} alt="" className="h-full w-full object-contain" /> : 'GG'}`.

`CouchFront.js` (Room): add imports `Dressing` and `{ themeArt }` from `./themes`; compute `const art = themeArt(LAYOUT, couch.theme);`; render `<Dressing layers={art && art.dressing} />` right after the plate `<img>`; pass `bug={art && art.laptopBug}` to `LaptopScreen`; pass `theme={couch.theme}` to `TvCrop` in the phone branch.

`TvCrop.js`: accept `theme`; compute `const art = themeArt(LAYOUT, theme);`; render `<Dressing layers={art && art.dressing} frame={crop} />` right after the crop's plate `<img>`.

- [ ] **Step 7: Run tests** → `npm test -- --watchAll=false --testPathPattern="couch/"` → PASS (all couch suites).

- [ ] **Step 8: Commit**

```bash
git add src/components/couch src/pages/HomePage.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): seasonal themes dress the couch"
```

---

### Task 19: Toys

**Files:**
- Create: `src/components/couch/Toy.js`, `src/components/couch/RoomToys.js`
- Modify: `src/components/couch/themes.js` (`roomToys`), `src/components/couch/couchLayout.js` (`intersects`), `src/components/couch/__tests__/couchLayout.test.js` (no toy or dressing on a door), `tailwind.config.js` (`couch-wiggle`, `couch-drop`, `couch-pop`, `couch-flicker`), `src/components/couch/CouchFront.js` (toys in the room), `src/components/couch/TvCrop.js` (toy stills in the crop)
- Test: `src/components/couch/__tests__/Toy.test.js`

**Interfaces:**
- Consumes: `pctStyle`, `LAYOUT`, `DOOR_IDS` (Task 8); `themeArt` (Task 18); `prefersReducedMotion`.
- Produces: `Toy({ toy })` (default) and `TOY_MS`; `RoomToys({ toys })`; `roomToys(layout, theme) → toy[]`; `intersects(a, b) → boolean`. A toy is `{ id, effect: 'toggle' | 'light' | 'wiggle' | 'drop' | 'pop', rect, art: { idle, active?, extra? } }`.

- [ ] **Step 1: Write the failing tests**

`src/components/couch/__tests__/Toy.test.js`:

```js
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomToys from '../RoomToys';
import Toy, { TOY_MS } from '../Toy';
import { roomToys } from '../themes';

const LAMP = { id: 'lamp', effect: 'toggle', rect: [5, 10, 10, 30], art: { idle: '/lamp-on.webp', active: '/lamp-off.webp' } };
const PUMPKIN = { id: 'pumpkin', effect: 'light', rect: [60, 50, 6, 8], art: { idle: '/p.webp', active: '/p-lit.webp' } };
const CAN = { id: 'can', effect: 'pop', rect: [70, 80, 3, 6], art: { idle: '/can.webp' } };
const toyEl = (c, id) => c.querySelector(`[data-toy="${id}"]`);
const pic = (el) => el.querySelector('img').getAttribute('src');

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  delete window.matchMedia;
});

test('a toy is decorative: hidden from screen readers and out of the tab order', () => {
  const { container } = render(<Toy toy={LAMP} />);
  const el = toyEl(container, 'lamp');
  expect(el.getAttribute('aria-hidden')).toBe('true');
  expect(el.getAttribute('tabindex')).toBeNull();
  expect(container.querySelector('button, a')).toBeNull();
});

test('the lamp toggles between its two pictures', () => {
  const { container } = render(<Toy toy={LAMP} />);
  const el = toyEl(container, 'lamp');
  fireEvent.pointerDown(el);
  expect(pic(el)).toBe('/lamp-off.webp');
  fireEvent.pointerDown(el);
  expect(pic(el)).toBe('/lamp-on.webp');
});

test('the pumpkin lights up, then dies down', () => {
  const { container } = render(<Toy toy={PUMPKIN} />);
  const el = toyEl(container, 'pumpkin');
  fireEvent.pointerDown(el);
  expect(el.getAttribute('data-on')).toBe('true');
  expect(pic(el)).toBe('/p-lit.webp');
  act(() => jest.advanceTimersByTime(TOY_MS.light));
  expect(el.getAttribute('data-on')).toBe('false');
  expect(pic(el)).toBe('/p.webp');
});

test('under reduced motion the pumpkin still lights; a one-shot just resets', () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  const { container } = render(
    <>
      <Toy toy={PUMPKIN} />
      <Toy toy={CAN} />
    </>
  );
  fireEvent.pointerDown(toyEl(container, 'pumpkin'));
  fireEvent.pointerDown(toyEl(container, 'can'));
  act(() => jest.advanceTimersByTime(0));
  expect(toyEl(container, 'pumpkin').getAttribute('data-on')).toBe('true');
  expect(toyEl(container, 'can').getAttribute('data-on')).toBe('false');
});

test('a can with no extra picture fizzes', () => {
  const { container } = render(<Toy toy={CAN} />);
  fireEvent.pointerDown(toyEl(container, 'can'));
  expect(screen.getByTestId('toy-bubbles')).toBeTruthy();
});

test('roomToys adds the theme toys to the room toys', () => {
  const layout = { toys: [LAMP], themes: { halloween: { toys: [PUMPKIN] } } };
  expect(roomToys(layout, 'halloween').map((t) => t.id)).toEqual(['lamp', 'pumpkin']);
  expect(roomToys(layout, null).map((t) => t.id)).toEqual(['lamp']);
  expect(roomToys({}, null)).toEqual([]);
});

test('RoomToys renders nothing without toys', () => {
  const { container } = render(<RoomToys toys={[]} />);
  expect(container.innerHTML).toBe('');
});
```

Append to `src/components/couch/__tests__/couchLayout.test.js` (and import `intersects`):

```js
test('intersects', () => {
  expect(intersects([0, 0, 10, 10], [5, 5, 10, 10])).toBe(true);
  expect(intersects([0, 0, 10, 10], [10, 0, 5, 5])).toBe(false);
});

test('in the final art no toy or dressing sits on a door', () => {
  if (!LAYOUT.final) return;
  const items = [
    ...(LAYOUT.toys || []),
    ...Object.values(LAYOUT.themes || {}).flatMap((t) => [...(t.toys || []), ...(t.dressing || [])]),
  ];
  for (const item of items) {
    for (const id of DOOR_IDS) expect([item.id, id, intersects(item.rect, LAYOUT.doors[id].rect)]).toEqual([item.id, id, false]);
  }
});
```

- [ ] **Step 2: Run them to see them fail** → `npm test -- --watchAll=false --testPathPattern="Toy.test|couchLayout"` → FAIL.

- [ ] **Step 3: Add the keyframes to `tailwind.config.js`** (next to the other `onair-*` and `couch-*` entries)

```js
        // Couch toys (spec: Toys). Transform and opacity only.
        'couch-wiggle': {
          '0%,100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-4deg)' },
          '40%': { transform: 'rotate(4deg)' },
          '60%': { transform: 'rotate(-3deg)' },
          '80%': { transform: 'rotate(2deg)' },
        },
        'couch-drop': { '0%,100%': { transform: 'translateY(0)' }, '40%,60%': { transform: 'translateY(160%)' } },
        'couch-pop': {
          '0%': { transform: 'translateY(0) scale(0.6)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(-140%) scale(1)', opacity: '0' },
        },
        'couch-flicker': { '0%,100%': { opacity: '1' }, '20%': { opacity: '0.82' }, '45%': { opacity: '1' }, '70%': { opacity: '0.88' } },
```

```js
        'couch-wiggle': 'couch-wiggle 0.6s ease-in-out',
        'couch-drop': 'couch-drop 2.4s ease-in-out',
        'couch-pop': 'couch-pop 0.9s ease-out forwards',
        'couch-flicker': 'couch-flicker 0.5s steps(2) infinite',
```

- [ ] **Step 4: Write `Toy.js`**

```js
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import { pctStyle } from './couchLayout';

// A toy (spec: Toys): poke it and it reacts; it goes nowhere. Pointer and
// touch only, so it is hidden from screen readers and never in the tab order.
// It lights itself at most (a lit pumpkin is art), never the room.
export const TOY_MS = { light: 4000, wiggle: 600, drop: 2400, pop: 900 };
const MOTION = {
  light: 'motion-safe:animate-couch-flicker',
  wiggle: 'motion-safe:animate-couch-wiggle',
  drop: 'motion-safe:animate-couch-drop',
};
const THREAD = 'before:absolute before:bottom-full before:left-1/2 before:h-[300%] before:w-px before:bg-onair-ink-5';

function Bubbles() {
  return (
    <span className="pointer-events-none absolute bottom-full left-[30%] h-[60%] w-[40%] motion-safe:animate-couch-pop" data-testid="toy-bubbles">
      <span className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-full bg-onair-paper/80" />
      <span className="absolute bottom-[30%] left-[45%] h-1 w-1 rounded-full bg-onair-paper/70" />
      <span className="absolute bottom-[60%] right-0 h-1.5 w-1.5 rounded-full bg-onair-paper/60" />
    </span>
  );
}

export default function Toy({ toy }) {
  const [on, setOn] = useState(false);
  const [run, setRun] = useState(0);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const poke = () => {
    if (toy.effect === 'toggle') {
      setOn((v) => !v);
      return;
    }
    clearTimeout(timer.current);
    setOn(true);
    setRun((n) => n + 1);
    const ms = toy.effect === 'light' || !prefersReducedMotion() ? TOY_MS[toy.effect] || 800 : 0;
    timer.current = setTimeout(() => setOn(false), ms);
  };

  const art = toy.art || {};
  const src = on && art.active ? art.active : art.idle;
  const moving = on && MOTION[toy.effect] ? MOTION[toy.effect] : '';
  return (
    <span
      aria-hidden="true"
      data-toy={toy.id}
      data-on={on ? 'true' : 'false'}
      onPointerDown={poke}
      className="pointer-events-auto absolute cursor-pointer select-none"
      style={pctStyle(toy.rect)}
    >
      <span key={run} className={`absolute inset-0 ${toy.effect === 'drop' ? THREAD : ''} ${moving}`}>
        {src && <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full" />}
      </span>
      {on && toy.effect === 'pop' &&
        (art.extra ? (
          <img key={`x-${run}`} src={art.extra} alt="" className="pointer-events-none absolute bottom-full left-1/4 h-1/2 w-1/2 motion-safe:animate-couch-pop" />
        ) : (
          <Bubbles key={`b-${run}`} />
        ))}
    </span>
  );
}
```

- [ ] **Step 5: Write `RoomToys.js`, `roomToys` and `intersects`**

`RoomToys.js`:

```js
import Toy from './Toy';

// The room's toys (spec: Toys). They sit under the doors' labels and never on
// a door; the layer itself takes no pointer events, each toy does.
export default function RoomToys({ toys }) {
  if (!toys || !toys.length) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-testid="room-toys">
      {toys.map((toy) => (
        <Toy key={toy.id} toy={toy} />
      ))}
    </div>
  );
}
```

Append to `themes.js`:

```js
// The room's toys plus the theme's (spec: Toys).
export const roomToys = (layout, theme) => [...((layout && layout.toys) || []), ...((themeArt(layout, theme) || {}).toys || [])];
```

Append to `couchLayout.js`:

```js
export const intersects = ([ax, ay, aw, ah], [bx, by, bw, bh]) => ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
```

- [ ] **Step 6: Put the toys in the room and the crop**

`CouchFront.js` (Room): import `RoomToys` and `roomToys`; render `<RoomToys toys={roomToys(LAYOUT, couch.theme)} />` right after `<Dressing … />` (before `RoomDoors`, so labels stay on top and the dim covers toys like the rest of the room).

`TvCrop.js`: the crop is one link, so toys inside it are still pictures. Change its dressing line to

```js
      <Dressing
        layers={[
          ...((art && art.dressing) || []),
          ...roomToys(LAYOUT, theme)
            .filter((t) => t.art && t.art.idle)
            .map((t) => ({ id: `toy-${t.id}`, src: t.art.idle, rect: t.rect })),
        ]}
        frame={crop}
      />
```

- [ ] **Step 7: Run tests** → `npm test -- --watchAll=false --testPathPattern="couch/"` and `--testPathPattern=onAirContract` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/couch tailwind.config.js
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): toys to poke in the room"
```

---

### Task 20: The window

**Files:**
- Create: `src/components/couch/moon.js`, `src/components/couch/RoomWindow.js`
- Modify: `tailwind.config.js` (`couch-twinkle`, `couch-blink`, `couch-shoot`, `couch-cross`), `src/index.css` (the night's colours), `src/components/couch/CouchFront.js` (outside behind the plate, blinds and hit areas in front), `src/components/couch/Couch.js` (pass `now`)
- Test: `src/components/couch/__tests__/RoomWindow.test.js`

**Interfaces:**
- Consumes: `LAYOUT.window` (`{ glass, blinds?: { src, rect }, cord?, skyline?: { src, rect } }`), `pctStyle`, `within`, `ART_ASPECT` (Task 8); `themeArt` (Task 18).
- Produces: `moonPhase(now) → 0..1`, `moonPath(phase, r = 50) → svg path` (moon.js); `useWindowState()`, `WindowOutside({ win, state, now, theme, witch })`, `WindowFront({ win, state, theme, aspect })`, `moonBox(glass, harvest, aspect)`, `MOON`, `HARVEST` (RoomWindow.js); `CouchFront` gains a `now` prop.

- [ ] **Step 1: Write the failing test** (`src/components/couch/__tests__/RoomWindow.test.js`)

```js
import { fireEvent, render, screen } from '@testing-library/react';
import { WindowFront, WindowOutside, moonBox, useWindowState } from '../RoomWindow';
import { moonPath, moonPhase } from '../moon';

const WIN = {
  glass: [70, 10, 20, 40],
  blinds: { src: '/blinds.webp', rect: [69, 8, 22, 30] },
  cord: [90, 20, 1, 15],
  skyline: { src: '/sky.webp', rect: [70, 38, 20, 12] },
};
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const ECLIPSE = Date.UTC(2000, 0, 21, 4, 40); // a full moon (the total lunar eclipse of January 2000)

function Window({ theme = null, now = ECLIPSE, witch }) {
  const state = useWindowState();
  return (
    <div>
      <WindowOutside win={WIN} state={state} now={now} theme={theme} witch={witch} />
      <WindowFront win={WIN} state={state} theme={theme} aspect={16 / 9} />
    </div>
  );
}
const toy = (c, id) => c.querySelector(`[data-toy="${id}"]`);

test('moonPhase: a known new moon, half a month later, and a known full moon', () => {
  expect(moonPhase(NEW_MOON)).toBeCloseTo(0, 5);
  expect(moonPhase(NEW_MOON + 14.765294 * 86400000)).toBeCloseTo(0.5, 3);
  expect(Math.abs(moonPhase(ECLIPSE) - 0.5)).toBeLessThan(0.03);
});

test('moonPath draws new, half and full moons', () => {
  expect(moonPath(0)).toBe('M 50 0 A 50 50 0 0 1 50 100 A 50 50 0 0 0 50 0 Z');
  expect(moonPath(0.25)).toBe('M 50 0 A 50 50 0 0 1 50 100 A 0 50 0 0 0 50 0 Z');
  expect(moonPath(0.5)).toBe('M 50 0 A 50 50 0 0 0 50 100 A 50 50 0 0 0 50 0 Z');
  expect(moonPath(0.75)).toBe('M 50 0 A 50 50 0 0 0 50 100 A 0 50 0 0 0 50 0 Z');
});

test("the outside shows tonight's moon, stars and the skyline, all decorative", () => {
  const { container } = render(<Window />);
  const out = screen.getByTestId('window-outside');
  expect(out.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByTestId('window-moon').getAttribute('data-phase')).toBe('0.49');
  expect(out.querySelectorAll('.couch-star').length).toBeGreaterThan(5);
  expect(out.querySelector('img').getAttribute('src')).toBe('/sky.webp');
  expect(screen.queryByTestId('window-bats')).toBeNull();
  expect(container.querySelectorAll('[aria-hidden="true"][data-toy]').length).toBe(3);
});

test('tapping the sky sends a shooting star; tapping the moon makes it wink', () => {
  const { container } = render(<Window />);
  fireEvent.pointerDown(toy(container, 'sky'));
  expect(screen.getByTestId('window-shooting')).toBeTruthy();
  fireEvent.pointerDown(toy(container, 'moon'));
  expect(screen.getByTestId('window-moon').getAttribute('class')).toMatch(/animate-couch-blink/);
});

test('the cord rolls the blinds up and down', () => {
  const { container } = render(<Window />);
  fireEvent.pointerDown(toy(container, 'cord'));
  expect(screen.getByTestId('window-blinds').getAttribute('data-up')).toBe('true');
  fireEvent.pointerDown(toy(container, 'cord'));
  expect(screen.getByTestId('window-blinds').getAttribute('data-up')).toBe('false');
});

test('Halloween: a harvest moon, bats, and every third moon tap a witch', () => {
  const { container } = render(<Window theme="halloween" witch="/witch.webp" />);
  expect(screen.getByTestId('window-moon').getAttribute('data-phase')).toBe('0.50');
  expect(screen.getByTestId('window-bats')).toBeTruthy();
  const moon = toy(container, 'moon');
  fireEvent.pointerDown(moon);
  fireEvent.pointerDown(moon);
  expect(screen.queryByTestId('window-witch')).toBeNull();
  fireEvent.pointerDown(moon);
  expect(screen.getByTestId('window-witch').getAttribute('src')).toBe('/witch.webp');
});

test('moonBox is square on screen', () => {
  const [x, y, w, h] = moonBox([70, 10, 20, 40], false, 16 / 9);
  expect(x).toBeCloseTo(82, 5);
  expect(y).toBeCloseTo(28.4, 5);
  expect(w).toBeCloseTo(3.6, 5);
  expect(h).toBeCloseTo((3.6 * 16) / 9, 5);
});

test('no glass, no window', () => {
  function Bare() {
    const state = useWindowState();
    return <WindowOutside win={{}} state={state} now={ECLIPSE} />;
  }
  const { container } = render(<Bare />);
  expect(container.innerHTML).toBe('');
});
```

- [ ] **Step 2: Run it to see it fail** → `npm test -- --watchAll=false --testPathPattern=RoomWindow` → FAIL.

- [ ] **Step 3: Write `moon.js`**

```js
// Tonight's moon (spec: The window). Pure.
const SYNODIC_DAYS = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

// 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
export function moonPhase(now) {
  const days = (now - NEW_MOON) / 86400000;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

// The lit part of a moon of radius r in a 2r × 2r box, as an SVG path: the lit
// limb (right while waxing, left while waning), then the terminator, an
// ellipse that bulges toward the lit side for a crescent and away for a gibbous.
export function moonPath(phase, r = 50) {
  const p = ((phase % 1) + 1) % 1;
  const waxing = p < 0.5;
  const k = Math.cos(2 * Math.PI * p);
  const rx = round2(Math.abs(k) * r);
  const limb = waxing ? 1 : 0;
  const terminator = waxing === k > 0 ? 0 : 1;
  return `M ${r} 0 A ${r} ${r} 0 0 ${limb} ${r} ${2 * r} A ${rx} ${r} 0 0 ${terminator} ${r} 0 Z`;
}
```

- [ ] **Step 4: Write `RoomWindow.js`**

```js
import { useCallback, useRef, useState } from 'react';
import { pctStyle, within } from './couchLayout';
import { moonPath, moonPhase } from './moon';

// The window (spec: The window). The glass is transparent in the room's art:
// WindowOutside renders behind the plate, WindowFront (the blinds and the toy
// hit areas) in front of it. Always night; pointer and touch only; silent; it
// lights nothing in the room.
const STARS = [[8, 12], [18, 30], [27, 8], [39, 22], [52, 10], [61, 34], [73, 18], [86, 9], [92, 28], [14, 46], [47, 44], [80, 40]];
// The moon's box in percent of the glass; the harvest moon is bigger.
export const MOON = { x: 60, y: 46, w: 18 };
export const HARVEST = { x: 52, y: 40, w: 30 };
const BAT = 'M0 5 Q3 0 6 4 Q8 2 10 4 Q12 2 14 4 Q17 0 20 5 Q15 4 12 7 Q10 5 8 7 Q5 4 0 5 Z';

// The moon's hit box in percent of the art: square on screen, so its height is
// its width times the art's aspect.
export function moonBox([gx, gy, gw, gh], harvest, aspect) {
  const m = harvest ? HARVEST : MOON;
  const w = (m.w / 100) * gw;
  return [gx + (m.x / 100) * gw, gy + (m.y / 100) * gh, w, w * aspect];
}

export function useWindowState() {
  const [wink, setWink] = useState(0);
  const [shooting, setShooting] = useState(0);
  const [witch, setWitch] = useState(0);
  const [blindsUp, setBlindsUp] = useState(false);
  const taps = useRef(0);
  const pokeMoon = useCallback((halloween) => {
    setWink((n) => n + 1);
    taps.current += 1;
    if (halloween && taps.current % 3 === 0) setWitch((n) => n + 1);
  }, []);
  const pokeSky = useCallback(() => setShooting((n) => n + 1), []);
  const pullCord = useCallback(() => setBlindsUp((v) => !v), []);
  return { wink, shooting, witch, blindsUp, pokeMoon, pokeSky, pullCord };
}

export function WindowOutside({ win, state, now, theme, witch = null }) {
  if (!win || !win.glass) return null;
  const harvest = theme === 'halloween';
  const phase = harvest ? 0.5 : moonPhase(now);
  const m = harvest ? HARVEST : MOON;
  return (
    <div aria-hidden="true" data-testid="window-outside" className="couch-sky pointer-events-none absolute overflow-hidden" style={pctStyle(win.glass)}>
      {STARS.map(([x, y], i) => (
        <span
          key={i}
          className="couch-star absolute h-[3px] w-[3px] rounded-full motion-safe:animate-couch-twinkle"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 5) * 0.7}s` }}
        />
      ))}
      <svg
        key={`moon-${state.wink}`}
        viewBox="0 0 100 100"
        data-testid="window-moon"
        data-phase={phase.toFixed(2)}
        className={`absolute ${state.wink ? 'motion-safe:animate-couch-blink' : ''}`}
        style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%` }}
      >
        <circle cx="50" cy="50" r="50" className="couch-moon-dark" />
        <path d={moonPath(phase)} className={harvest ? 'couch-moon couch-moon--harvest' : 'couch-moon'} />
      </svg>
      {state.shooting ? (
        <span key={`star-${state.shooting}`} data-testid="window-shooting" className="couch-shooting absolute left-[8%] top-[16%] h-[2px] w-[22%] motion-safe:animate-couch-shoot" />
      ) : null}
      <span className="couch-plane absolute top-[24%] h-[3px] w-[3px] rounded-full motion-safe:animate-couch-cross" />
      {harvest && (
        <span data-testid="window-bats" className="absolute top-[30%] flex w-[30%] gap-[6%] motion-safe:animate-couch-cross" style={{ animationDuration: '31s' }}>
          {[0, 1, 2, 3].map((i) => (
            <svg key={i} viewBox="0 0 20 8" className="couch-bat w-1/4" style={{ marginTop: `${(i % 2) * 6}%` }}>
              <path d={BAT} />
            </svg>
          ))}
        </span>
      )}
      {harvest && witch && state.witch ? (
        <img
          key={`witch-${state.witch}`}
          src={witch}
          alt=""
          data-testid="window-witch"
          className="absolute top-[20%] w-[22%] motion-safe:animate-couch-cross"
          style={{ animationDuration: '4s', animationIterationCount: 1 }}
        />
      ) : null}
      {win.skyline && <img src={win.skyline.src} alt="" className="absolute" style={pctStyle(within(win.glass, win.skyline.rect))} />}
    </div>
  );
}

export function WindowFront({ win, state, theme, aspect }) {
  if (!win || !win.glass) return null;
  const halloween = theme === 'halloween';
  return (
    <>
      {win.blinds && (
        <span aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={pctStyle(win.blinds.rect)}>
          <img
            src={win.blinds.src}
            alt=""
            data-testid="window-blinds"
            data-up={state.blindsUp ? 'true' : 'false'}
            className={`h-full w-full origin-top transition-transform duration-500 ease-out motion-reduce:transition-none ${state.blindsUp ? 'scale-y-[0.18]' : ''}`}
          />
        </span>
      )}
      <span aria-hidden="true" data-toy="sky" onPointerDown={state.pokeSky} className="absolute z-[3] cursor-pointer" style={pctStyle(win.glass)} />
      <span
        aria-hidden="true"
        data-toy="moon"
        onPointerDown={() => state.pokeMoon(halloween)}
        className="absolute z-[3] cursor-pointer rounded-full"
        style={pctStyle(moonBox(win.glass, halloween, aspect))}
      />
      {win.cord && <span aria-hidden="true" data-toy="cord" onPointerDown={state.pullCord} className="absolute z-[3] cursor-pointer" style={pctStyle(win.cord)} />}
    </>
  );
}
```

- [ ] **Step 5: Keyframes and colours**

`tailwind.config.js` keyframes:

```js
        // The couch window (spec: The window).
        'couch-twinkle': { '0%,100%': { opacity: '0.85' }, '50%': { opacity: '0.35' } },
        'couch-blink': { '0%,100%': { transform: 'scaleY(1)' }, '45%,55%': { transform: 'scaleY(0.12)' } },
        'couch-shoot': {
          from: { transform: 'translate(0, 0)', opacity: '0' },
          '15%': { opacity: '1' },
          to: { transform: 'translate(320%, 160%)', opacity: '0' },
        },
        'couch-cross': { '0%': { left: '-35%' }, '60%,100%': { left: '110%' } },
```

and animations:

```js
        'couch-twinkle': 'couch-twinkle 3.2s ease-in-out infinite',
        'couch-blink': 'couch-blink 0.7s ease-in-out',
        'couch-shoot': 'couch-shoot 0.9s ease-out forwards',
        'couch-cross': 'couch-cross 60s linear infinite',
```

Append to `src/index.css`:

```css
/* The couch window's night (DESIGN.md §7, The couch). */
.couch-sky {
  background: linear-gradient(180deg, #0b1020 0%, #18213a 60%, #2a2440 100%);
}
.couch-star {
  background: #f1ead8;
}
.couch-moon-dark {
  fill: #2b3046;
}
.couch-moon {
  fill: #efe6c8;
}
.couch-moon--harvest {
  fill: #f0a050;
}
.couch-shooting {
  background: linear-gradient(90deg, transparent, #f1ead8);
}
.couch-plane {
  background: #e05a4a;
}
.couch-bat {
  fill: #0b0a10;
}
```

- [ ] **Step 6: Put the window in the room**

`CouchFront.js` (Room): import `{ WindowFront, WindowOutside, useWindowState }` and `ART_ASPECT`; take a `now` prop; `const win = useWindowState();`. In the stage, render `<WindowOutside win={LAYOUT.window} state={win} now={now} theme={couch.theme} witch={art && art.witch} />` **before** the plate `<img>` (the glass is transparent, so the night shows through), and `<WindowFront win={LAYOUT.window} state={win} theme={couch.theme} aspect={ART_ASPECT} />` right after `<RoomToys … />`.

`Couch.js`: pass `now={input.now}` to `CouchFront`.

- [ ] **Step 7: Run tests** → `npm test -- --watchAll=false --testPathPattern="couch/|onAirContract"` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/couch tailwind.config.js src/index.css
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): a window onto the night, with the moon to poke"
```

---

### Task 21: ✋ The art (owner picks at each step)

**Files:**
- Create: `scripts/couch-art/comfy-tools.mjs`, `scripts/couch-art/frame.py`, `scripts/couch-art/measure.py`
- Modify: `scripts/gsn-art/README.md` (a "The couch" section), `src/components/couch/rooms/90s.json` (generated, `final: true`)
- Create (generated), all in `public/couch/90s/`: `room-{1280,1920,2560}.webp` and `empty-{…}.webp` (glass transparent), `cut-{tapes,guide,laptop,games,remote,photo}.webp`, `toy-{lamp,lamp-off,controller,can}.webp`, `blinds.webp`, `skyline.webp`, `halloween/{cobweb,bats-paper,pumpkin,pumpkin-lit,spider,candy,witch}.webp`
- Delete: `public/couch/90s/test-room-1280.webp`
- Test: `src/components/couch/__tests__/couchLayout.test.js` (unchanged; the safe-area test now runs)

Work in a scratch folder `W=<scratchpad>/couch-art` with `masks/` inside. ComfyUI Desktop must be running on :8000 (the owner opens it).

- [ ] **Step 1: Base renders.** Prompt (one line):

`a cramped 1990s living room late at night seen from just behind a couch, a large chunky beige CRT television with a rabbit-ear antenna on a low wooden TV stand in the centre of the frame, filling about a third of the frame width, facing the camera straight on, the television screen dark grey, blank and matte, a VCR and a short stack of black VHS tapes on the stand's open lower shelf, three plain game cases standing upright on the shelf with their blank fronts facing the camera, a low wooden coffee table across the foreground with an open silver laptop whose blank screen faces the camera, a folded TV listings magazine, a TV remote control, a game controller and a soda can lying apart from each other, an empty picture frame hanging on the wall to the left of the television, a floor lamp glowing on the left, a window with half-closed blinds and night outside on the right wall, its glass seen straight on, every object inside the central area of the frame with clear space between the objects, straight-on eye-level framing, wide shot, 1990s home video still, shot on a camcorder, a dim room at night lit by a warm floor lamp and the cool glow of the television, set lit in dark teal and plum with warm practical light, light VHS grain, slight chromatic bleed, analog video softness, no people, no text, no letters, no logos, no watermark`

```bash
for s in 1 2 3 4; do node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/zimage-turbo.json "$W/base-$s.png" --prompt "<prompt>" --width 1600 --height 896 --seed $s; done
```

Show the four (a contact sheet in the brainstorm companion or as files) and **wait for the owner's pick**. Check against the composition rules: TV about a third of the width, straight on; laptop screen straight on and not hiding the tapes; cases facing front; every door inside the middle 75 % × 76 %.

- [ ] **Step 2: Cartoon redraw.** Prompt:

`Redraw this entire image as a crude early-2000s American late-night adult cable cartoon. Keep the same composition, objects, framing and light placement: the CRT television, the TV stand with the VCR, tapes and game cases, the coffee table with the laptop, magazine and remote, the floor lamp, the empty picture frame and the window with blinds. The television and laptop screens stay plain, blank, matte and empty, with no glare or reflections. Extremely simple flat shapes, flat solid colors with no shading or gradients, flat walls with no light pools, clean medium-weight black outlines, minimal detail, stiff low-budget limited-animation look, muted sickly palette of olive, dull teal, faded plum and beige. Not anime, not cute, not 3D. No text, no letters, no logos anywhere.`

```bash
for wf in 2509 2511; do for s in 1 2; do node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/qwen-edit-$wf.json "$W/cartoon-$wf-$s.png" --image "$W/base-<pick>.png" --prompt "<redraw prompt>" --seed $s; done; done
```

**Wait for the owner's pick.** Fix anything off with targeted Qwen edits on the pick (same command, edit prompt such as "Keep everything exactly the same. Remove the glare from the television screen."). Save the result as `$W/cartoon.png`.

- [ ] **Step 3: Write `scripts/couch-art/comfy-tools.mjs`**

```js
#!/usr/bin/env node
// Couch art helpers on the owner's ComfyUI (Desktop on :8000; COMFY_URL overrides).
//   node scripts/couch-art/comfy-tools.mjs mask    <in.png> <out.png> "<what>" [--separate] [--threshold 0.5]
//        SAM 3 by name (ComfyUI-RMBG SAM3Segment): a white-on-black mask. With
//        --separate, one mask per instance: <out>-1.png, <out>-2.png, …
//   node scripts/couch-art/comfy-tools.mjs erase   <in.png> <mask.png> <out.png>   LaMa fill where the mask is white
//   node scripts/couch-art/comfy-tools.mjs upscale <in.png> <out.png>              4x-AnimeSharp
import fs from 'node:fs/promises';
import path from 'node:path';

const HOST = process.env.COMFY_URL || 'http://127.0.0.1:8000';
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? fallback : rest[i + 1];
};

async function upload(file) {
  const form = new FormData();
  form.append('image', new Blob([await fs.readFile(file)]), path.basename(file));
  form.append('overwrite', 'true');
  const res = await fetch(`${HOST}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return (await res.json()).name;
}

async function run(prompt) {
  const res = await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  const q = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(q, null, 2));
    process.exit(1);
  }
  for (let i = 0; i < 900; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const h = (await (await fetch(`${HOST}/history/${q.prompt_id}`)).json())[q.prompt_id];
    if (h) return h.outputs;
  }
  throw new Error('timed out waiting for ComfyUI');
}

async function save(outputs, nodeId, nameFor) {
  const images = (outputs[nodeId] && outputs[nodeId].images) || [];
  for (let i = 0; i < images.length; i += 1) {
    const img = images[i];
    const params = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const buf = Buffer.from(await (await fetch(`${HOST}/view?${params}`)).arrayBuffer());
    const out = nameFor(i, images.length);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf);
    console.log(out);
  }
  if (!images.length) throw new Error('ComfyUI returned no image (nothing matched?)');
}

const save1 = (out) => (i, n) => (n === 1 ? out : out.replace(/\.png$/, `-${i + 1}.png`));

if (cmd === 'mask') {
  const [input, out, what] = rest;
  const outputs = await run({
    1: { class_type: 'LoadImage', inputs: { image: await upload(input) } },
    2: {
      class_type: 'SAM3Segment',
      inputs: {
        image: ['1', 0],
        model_name: 'sam3.1_multiplex_fp16',
        prompt: what,
        output_mode: flag('separate') ? 'Separate' : 'Merged',
        confidence_threshold: Number(opt('threshold', '0.5')),
      },
    },
    3: { class_type: 'SaveImage', inputs: { images: ['2', 2], filename_prefix: 'couch-mask' } },
  });
  await save(outputs, '3', save1(out));
} else if (cmd === 'erase') {
  const [input, mask, out] = rest;
  const outputs = await run({
    1: { class_type: 'LoadImage', inputs: { image: await upload(input) } },
    2: { class_type: 'LoadImageMask', inputs: { image: await upload(mask), channel: 'red' } },
    3: { class_type: 'AILab_LamaRemover', inputs: { images: ['1', 0], masks: ['2', 0], removal_strength: 230, edge_smoothness: 8 } },
    4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'couch-erase' } },
  });
  await save(outputs, '4', () => out);
} else if (cmd === 'upscale') {
  const [input, out] = rest;
  const outputs = await run({
    1: { class_type: 'LoadImage', inputs: { image: await upload(input) } },
    2: { class_type: 'UpscaleModelLoader', inputs: { model_name: '4x-AnimeSharp.safetensors' } },
    3: { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['2', 0], image: ['1', 0] } },
    4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'couch-up' } },
  });
  await save(outputs, '4', () => out);
} else {
  console.error('usage: comfy-tools.mjs mask|erase|upscale …');
  process.exit(1);
}
```

If ComfyUI answers `node_errors` for a node, run `curl -s http://127.0.0.1:8000/object_info/<NodeName>` and fix the input names; do not guess.

- [ ] **Step 4: The portrait in the frame.** The owner supplies a stream still or a selfie (keep it in `$W`, never in the repo).

```bash
node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/qwen-edit-2511.json "$W/portrait.png" --image "$W/owner.jpg" --seed 1 --prompt "Redraw this person as a crude early-2000s American late-night adult cable cartoon portrait, head and shoulders, keep their glasses, hair and face shape recognisable, deadpan expression, extremely simple flat shapes, flat solid colors with no shading, clean medium-weight black outlines, muted palette of olive, dull teal, faded plum and beige, plain flat background. Not anime, not cute, not 3D. No text, no letters, no logos."
node scripts/couch-art/comfy-tools.mjs mask "$W/cartoon.png" "$W/masks/frame-inner.png" "blank picture inside the picture frame"
```

Write `scripts/couch-art/frame.py`:

```python
"""Paste the cartoon portrait into the picture frame's inner area.

usage: python scripts/couch-art/frame.py <plate.png> <frame-inner-mask.png> <portrait.png> <out.png>
"""
import sys

import numpy as np
from PIL import Image, ImageOps

plate_path, mask_path, portrait_path, out_path = sys.argv[1:5]
plate = Image.open(plate_path).convert("RGB")
mask = Image.open(mask_path).convert("L").resize(plate.size)
ys, xs = np.nonzero(np.array(mask) > 127)
if not len(xs):
    raise SystemExit("empty mask")
box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
portrait = ImageOps.fit(Image.open(portrait_path).convert("RGB"), (box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
plate.paste(portrait, box[:2])
plate.save(out_path)
print(f"{out_path}: portrait at {box}")
```

```bash
python scripts/couch-art/frame.py "$W/cartoon.png" "$W/masks/frame-inner.png" "$W/portrait.png" "$W/cartoon-framed.png"
```

**Show the owner the framed plate and wait for an OK** (redo the portrait seed if it doesn't read as them).

- [ ] **Step 5: Upscale and mask**

```bash
node scripts/couch-art/comfy-tools.mjs upscale "$W/cartoon-framed.png" "$W/plate-4x.png"
python -c "from PIL import Image; im=Image.open(r'$W/plate-4x.png'); im.resize((2560, round(2560*im.height/im.width)), Image.LANCZOS).save(r'$W/plate.png')"
T="node scripts/couch-art/comfy-tools.mjs mask $W/plate.png"
$T "$W/masks/tv.png" "crt television"
$T "$W/masks/screen-tv.png" "television screen"
$T "$W/masks/laptop.png" "laptop"
$T "$W/masks/screen-laptop.png" "laptop screen"
$T "$W/masks/tapes.png" "vcr and stack of vhs tapes"
$T "$W/masks/guide.png" "magazine"
$T "$W/masks/games.png" "game cases"
$T "$W/masks/case.png" "game case" --separate
$T "$W/masks/remote.png" "remote control"
$T "$W/masks/photo.png" "picture frame"
$T "$W/masks/window-glass.png" "window glass"
$T "$W/masks/blinds.png" "window blinds"
$T "$W/masks/cord.png" "blinds pull cord"
$T "$W/masks/lamp.png" "floor lamp"
$T "$W/masks/controller.png" "game controller"
$T "$W/masks/can.png" "soda can"
```

Rename the `case-N.png` files left to right as `case-1.png … case-3.png`. Open each mask and check it covers its object (raise or lower `--threshold` and rerun if not). Fallback for any object SAM 3 misses: crop around it and run the RMBG node pack's BiRefNet (`BiRefNet_toonout`) in the ComfyUI UI, then paste the mask back at full size.

- [ ] **Step 5b: The variants, the Halloween set and the night outside.** Every image from here is upscaled like the plate (`comfy-tools.mjs upscale`, then resized to 2560 wide) before it is masked or measured.

```bash
Q="node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/qwen-edit-2511.json"
Z="node scripts/gsn-art/render.mjs scripts/gsn-art/workflows/zimage-turbo.json"
mkdir -p "$W/halloween/masks"
$Q "$W/lamp-off.png" --image "$W/plate.png" --seed 1 --prompt "Keep everything exactly the same. The floor lamp is switched off: its shade is plain and unlit. Flat solid colors, clean black outlines. No text, no letters."
for s in 1 2; do $Q "$W/halloween/plate-$s.png" --image "$W/plate.png" --seed $s --prompt "Keep everything exactly the same and in the same place, and add Halloween decorations in the same flat cartoon style: an unlit carved jack-o'-lantern on the TV stand beside the television, fake cobwebs in the top corner of the window frame, black paper bat cutouts taped on the wall, a bowl of candy on the coffee table, a small cartoon spider hanging from the cobweb on a thread. Keep every new decoration clear of the television, the tapes, the game cases, the laptop, the magazine, the remote and the picture frame. No text, no letters."; done
```

**Show the owner `lamp-off.png` and the two Halloween plates and wait for the picks.** Save the picked one as `$W/halloween/plate.png`, then:

```bash
$Q "$W/halloween/pumpkin-lit.png" --image "$W/halloween/plate.png" --seed 1 --prompt "Keep everything exactly the same. The jack-o'-lantern's carved eyes and mouth glow bright orange from a candle inside. Flat solid colors, clean black outlines. No text."
H="node scripts/couch-art/comfy-tools.mjs mask $W/halloween/plate.png"
$H "$W/halloween/masks/cobweb.png" "cobweb"
$H "$W/halloween/masks/bats-paper.png" "paper bats on the wall"
$H "$W/halloween/masks/pumpkin.png" "jack-o'-lantern"
$H "$W/halloween/masks/spider.png" "spider"
$H "$W/halloween/masks/candy.png" "bowl of candy"
$Z "$W/skyline-base.png" --width 1600 --height 400 --seed 1 --prompt "a wide flat strip of a Phoenix suburb skyline at night in silhouette: saguaro cacti, a palm tree, a streetlight and a low flat-roofed house with one small window, dark navy shapes on a plain white background, side view, no text, no letters"
$Z "$W/halloween/witch-base.png" --width 1024 --height 640 --seed 1 --prompt "a witch flying on a broomstick seen from the side, a flat black silhouette on a plain white background, no text, no letters"
```

Redraw the skyline and the witch with the cartoon redraw prompt from Step 2 (`$Q … --image <base>`), then remove their white backgrounds with the RMBG node pack's `BiRefNetRMBG` (model `BiRefNet_toonout`) in the ComfyUI UI and save them as transparent PNGs: `$W/skyline.png` and `$W/halloween/witch.png`. **Show the owner the lit pumpkin, the skyline and the witch.**

- [ ] **Step 6: The empty room**

```bash
python -c "
from PIL import Image, ImageChops, ImageFilter
import glob
ms=[Image.open(p).convert('L') for p in glob.glob(r'$W/masks/*.png') if not any(k in p for k in ('screen-','case-','frame-inner','tv.png','window-glass','cord'))]
u=ms[0]
for m in ms[1:]: u=ImageChops.lighter(u,m)
u.filter(ImageFilter.MaxFilter(9)).save(r'$W/masks/union.png')"
node scripts/couch-art/comfy-tools.mjs erase "$W/plate.png" "$W/masks/union.png" "$W/empty.png"
```

Check `empty.png`: the objects are gone and the wall, floor, stand and table continue cleanly. If LaMa smears a large area, use a Qwen 2511 edit on `plate.png` instead ("Keep everything exactly the same. Remove the laptop, magazine, remote, tapes, VCR, game cases and picture frame; continue the table, shelf and wall behind them.").

- [ ] **Step 7: Write `scripts/couch-art/measure.py`**

```python
"""Turn the picked room art and its masks into the couch's assets and layout.

usage: python scripts/couch-art/measure.py <work-dir> [room-id]

<work-dir> holds (see the art task in the plan), every image 2560 wide:
  plate.png, empty.png              the room, and the room with every door object,
                                    toy and the blinds erased
  masks/<door>.png                  tv tapes guide laptop games remote photo (white = object)
  masks/screen-tv.png, screen-laptop.png, window-glass.png, blinds.png, cord.png (optional)
  masks/case-1.png … case-3.png     game case fronts, left to right (optional)
  masks/lamp.png, controller.png, can.png   the room's toys
  lamp-off.png                      the plate with the lamp switched off
  skyline.png                       the night skyline strip, transparent background (optional)
  halloween/ (optional)             plate.png, pumpkin-lit.png, witch.png (transparent) and
                                    masks/cobweb.png, bats-paper.png, pumpkin.png, spider.png, candy.png
Writes public/couch/<room>/… and src/components/couch/rooms/<room>.json (final: true).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOORS = ["tv", "tapes", "guide", "laptop", "games", "remote", "photo"]
CUT = ["tapes", "guide", "laptop", "games", "remote", "photo"]
WIDTHS = {1280: 90, 1920: 150, 2560: 250}
CUT_KB = 40
NAMES = {"tv": "TV", "note": "Note", "laptop": "Laptop", "tapes": "Tapes", "guide": "TV guide", "games": "Games", "remote": "Remote", "photo": "Photo"}
TOYS = [("lamp", "toggle"), ("controller", "wiggle"), ("can", "pop")]
HALLOWEEN_DRESSING = ["cobweb", "bats-paper"]
HALLOWEEN_TOYS = [("pumpkin", "light"), ("spider", "drop"), ("candy", "pop")]


def load_mask(path, size):
    return Image.open(path).convert("L").resize(size)


def bbox(mask):
    a = np.array(mask) > 127
    ys, xs = np.nonzero(a)
    if not len(xs):
        raise SystemExit("empty mask")
    h, w = a.shape
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return [round(100 * x0 / w, 2), round(100 * y0 / h, 2), round(100 * (x1 - x0) / w, 2), round(100 * (y1 - y0) / h, 2)]


def webp(img, out, max_kb):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for quality in range(86, 39, -4):
        img.save(out, "WEBP", quality=quality, method=6)
        kb = os.path.getsize(out) / 1024
        if kb <= max_kb:
            break
    print(f"{out}: {img.size[0]}x{img.size[1]} q{quality} {kb:.0f} KB" + ("" if kb <= max_kb else " (OVER BUDGET)"))
    return kb <= max_kb


def cutout(img, mask, rect, out, max_kb=CUT_KB):
    W, H = img.size
    box = (round(rect[0] * W / 100), round(rect[1] * H / 100), round((rect[0] + rect[2]) * W / 100), round((rect[1] + rect[3]) * H / 100))
    piece = img.crop(box).convert("RGBA")
    piece.putalpha(mask.crop(box).filter(ImageFilter.GaussianBlur(0.6)))
    target = max(1, round(rect[2] / 100 * 1920))
    if piece.width > target:
        piece = piece.resize((target, round(piece.height * target / piece.width)), Image.LANCZOS)
    return webp(piece, out, max_kb)


def phone_crop(a, b, W, H, pad=4.0):
    x0, y0 = min(a[0], b[0]) - pad, min(a[1], b[1]) - pad
    x1, y1 = max(a[0] + a[2], b[0] + b[2]) + pad, max(a[1] + a[3], b[1] + b[3]) + pad
    w, h = x1 - x0, y1 - y0
    if w * W / (h * H) < 4 / 3:
        nw = h * H * 4 / 3 / W
        x0, w = x0 - (nw - w) / 2, nw
    else:
        nh = w * W * 3 / 4 / H
        y0, h = y0 - (nh - h) / 2, nh
    x0, y0 = min(max(0, x0), 100 - w), min(max(0, y0), 100 - h)
    return [round(x0, 2), round(y0, 2), round(w, 2), round(h, 2)]


def main(work, room="90s"):
    pub = os.path.join(ROOT, "public", "couch", room)
    layout_path = os.path.join(ROOT, "src", "components", "couch", "rooms", f"{room}.json")

    def url(name):
        return f"/couch/{room}/{name}"

    plate = Image.open(os.path.join(work, "plate.png")).convert("RGB")
    W, H = plate.size
    size = (W, H)
    empty = Image.open(os.path.join(work, "empty.png")).convert("RGB").resize(size)

    def mask(name):
        return load_mask(os.path.join(work, "masks", f"{name}.png"), size)

    def has_mask(name):
        return os.path.exists(os.path.join(work, "masks", f"{name}.png"))

    ok = True

    # The glass is transparent in both plates, so the night shows through.
    glass_mask = mask("window-glass")
    alpha = Image.eval(glass_mask, lambda v: 0 if v > 127 else 255)
    plate_a, empty_a = plate.convert("RGBA"), empty.convert("RGBA")
    plate_a.putalpha(alpha)
    empty_a.putalpha(alpha)
    plate_map, empty_map = {}, {}
    for w, kb in WIDTHS.items():
        dims = (w, round(w * H / W))
        ok &= webp(plate_a.resize(dims, Image.LANCZOS), os.path.join(pub, f"room-{w}.webp"), kb)
        ok &= webp(empty_a.resize(dims, Image.LANCZOS), os.path.join(pub, f"empty-{w}.webp"), kb)
        plate_map[str(w)], empty_map[str(w)] = url(f"room-{w}.webp"), url(f"empty-{w}.webp")

    doors = {}
    for d in DOORS:
        m = mask(d)
        rect = bbox(m)
        entry = {"rect": rect, "anchor": [round(rect[0] + rect[2] / 2, 2), rect[1]]}
        if d in CUT:
            ok &= cutout(plate, m, rect, os.path.join(pub, f"cut-{d}.webp"))
            entry["cutout"] = url(f"cut-{d}.webp")
        doors[d] = entry
    tv = doors["tv"]["rect"]
    note = [round(tv[0] + tv[2] * 0.04, 2), round(tv[1] + tv[3] * 0.04, 2), round(tv[2] * 0.2, 2), round(tv[3] * 0.24, 2)]
    doors["note"] = {"rect": note, "anchor": [round(note[0] + note[2] / 2, 2), note[1]]}
    cases = [bbox(mask(f"case-{i}")) for i in (1, 2, 3) if has_mask(f"case-{i}")]
    if cases:
        doors["games"]["cases"] = cases
    screens = {k: bbox(mask(f"screen-{k}")) for k in ("tv", "laptop")}

    # The window: the glass, the blinds (cut from the plate), the cord, the skyline.
    glass = bbox(glass_mask)
    blinds_mask = mask("blinds")
    blinds_rect = bbox(blinds_mask)
    ok &= cutout(plate, blinds_mask, blinds_rect, os.path.join(pub, "blinds.webp"), 60)
    window = {"glass": glass, "blinds": {"src": url("blinds.webp"), "rect": blinds_rect}}
    if has_mask("cord"):
        window["cord"] = bbox(mask("cord"))
    sky_path = os.path.join(work, "skyline.png")
    if os.path.exists(sky_path):
        sky = Image.open(sky_path).convert("RGBA")
        sky_w = max(1, round(glass[2] / 100 * 1920))
        sky = sky.resize((sky_w, round(sky.height * sky_w / sky.width)), Image.LANCZOS)
        sky_h = round(100 * sky.height / (1920 * H / W), 2)  # its height in percent of the art
        ok &= webp(sky, os.path.join(pub, "skyline.webp"), CUT_KB)
        window["skyline"] = {"src": url("skyline.webp"), "rect": [glass[0], round(glass[1] + glass[3] - sky_h, 2), glass[2], sky_h]}

    # The room's toys, cut from the plate; the lamp's off state from lamp-off.png.
    lamp_off = Image.open(os.path.join(work, "lamp-off.png")).convert("RGB").resize(size)
    toys = []
    for name, effect in TOYS:
        m = mask(name)
        rect = bbox(m)
        ok &= cutout(plate, m, rect, os.path.join(pub, f"toy-{name}.webp"))
        art = {"idle": url(f"toy-{name}.webp")}
        if name == "lamp":
            ok &= cutout(lamp_off, m, rect, os.path.join(pub, "toy-lamp-off.webp"))
            art["active"] = url("toy-lamp-off.webp")
        toys.append({"id": name, "effect": effect, "rect": rect, "art": art})

    # Halloween: dressing and toys cut from the Halloween plate.
    themes = {}
    hw = os.path.join(work, "halloween")
    if os.path.isdir(hw):
        hplate = Image.open(os.path.join(hw, "plate.png")).convert("RGB").resize(size)
        lit = Image.open(os.path.join(hw, "pumpkin-lit.png")).convert("RGB").resize(size)

        def hmask(name):
            return load_mask(os.path.join(hw, "masks", f"{name}.png"), size)

        dressing = []
        for name in HALLOWEEN_DRESSING:
            m = hmask(name)
            rect = bbox(m)
            ok &= cutout(hplate, m, rect, os.path.join(pub, "halloween", f"{name}.webp"))
            dressing.append({"id": name, "src": url(f"halloween/{name}.webp"), "rect": rect})
        htoys = []
        for name, effect in HALLOWEEN_TOYS:
            m = hmask(name)
            rect = bbox(m)
            ok &= cutout(hplate, m, rect, os.path.join(pub, "halloween", f"{name}.webp"))
            art = {"idle": url(f"halloween/{name}.webp")}
            if name == "pumpkin":
                ok &= cutout(lit, m, rect, os.path.join(pub, "halloween", "pumpkin-lit.webp"))
                art["active"] = url("halloween/pumpkin-lit.webp")
            htoys.append({"id": name, "effect": effect, "rect": rect, "art": art})
        # The unlit pumpkin doubles as the laptop's screensaver bug.
        theme = {"dressing": dressing, "toys": htoys, "laptopBug": url("halloween/pumpkin.webp")}
        witch_path = os.path.join(hw, "witch.png")
        if os.path.exists(witch_path):
            witch = Image.open(witch_path).convert("RGBA")
            witch = witch.resize((400, round(witch.height * 400 / witch.width)), Image.LANCZOS)
            ok &= webp(witch, os.path.join(pub, "halloween", "witch.webp"), CUT_KB)
            theme["witch"] = url("halloween/witch.webp")
        themes["halloween"] = theme

    s = screens["tv"]
    layout = {
        "final": True,
        "room": {"id": room, "screen": "crt", "names": NAMES},
        "art": {
            "width": W,
            "height": H,
            "focal": [round(s[0] + s[2] / 2, 2), round(s[1] + s[3] / 2, 2)],
            "plate": plate_map,
            "empty": empty_map,
        },
        "screens": screens,
        "doors": doors,
        "window": window,
        "toys": toys,
        "themes": themes,
        "phoneCrop": phone_crop(tv, doors["tapes"]["rect"], W, H),
    }
    with open(layout_path, "w") as f:
        json.dump(layout, f, indent=2)
        f.write("\n")
    print(f"wrote {layout_path}")
    if not ok:
        raise SystemExit("some files are over budget")


if __name__ == "__main__":
    main(*sys.argv[1:3])
```

- [ ] **Step 8: Generate, clean up and test**

```bash
python scripts/couch-art/measure.py "$W" 90s
git rm -q public/couch/90s/test-room-1280.webp
npm test -- --watchAll=false --testPathPattern="couchLayout|CouchFront|CouchPhone|Couch.test"
```

Expected: every file within budget; the layout tests pass, including the safe-area test. If a door falls outside the safe area, the art must change (Step 1 or 2 again), not the test. If `CouchFront` tests assert the old plate path (`/couch/90s/test-room-1280.webp`), change that assertion to `/couch/90s/empty-1920.webp` (the room now draws the empty plate under the cutouts).

- [ ] **Step 9: Record the art.** Append a "The couch" section to `scripts/gsn-art/README.md`: the base prompt, the redraw prompt, the portrait prompt, the picked seeds and models, the mask prompts, the erase method used, and the commands from Steps 3–8. Add the rule: "The owner's own likeness is allowed in the couch's picture frame, with the owner's consent (2026-10-04); no other real people."

- [ ] **Step 10: ✋ Owner review** in `npm start` → `http://localhost:3000/?fixture=offair` (and `live`, `giveaway`, `halloween`, `?theme=none`, phone view). Poke every toy and the window (moon, sky, cord). Fix what the owner flags.

- [ ] **Step 11: Commit**

```bash
git add scripts/couch-art public/couch src/components/couch/rooms/90s.json scripts/gsn-art/README.md src/components/couch/__tests__
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): the couch art, cutouts and measured layout"
```

---

### Task 22: ✋ The TV reel

**Files:**
- Create: `scripts/tv-reel/build.mjs`, `scripts/tv-reel/reel.json`
- Modify: `package.json` (script `tv:reel`), `.gitignore` (`scripts/tv-reel/source/`)
- Create (generated): `public/tv/reel/*.webm|mp4|jpg`, `public/tv/reel/manifest.json`

- [ ] **Step 1: Write `scripts/tv-reel/build.mjs`**

```js
#!/usr/bin/env node
// Builds the couch TV's video reel (spec: The reel script) from clips the owner
// downloaded from the Twitch creator dashboard into scripts/tv-reel/source/
// (gitignored). reel.json lists them in playing order:
//   [{ "file": "chat-called-it.mp4", "title": "chat called it", "start": 2 }]
// Each becomes an 8 s, 360p, silent loop as AV1 .webm and H.264 .mp4 plus a
// poster, in public/tv/reel/ with manifest.json. Needs ffmpeg on PATH.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SOURCE = path.join(HERE, 'source');
const OUT = path.join(ROOT, 'public', 'tv', 'reel');
const SECONDS = 8;
const LOOP_KB = 600;
const REEL_KB = 4096;
const POSTER_KB = 30;

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const kb = (f) => fs.statSync(f).size / 1024;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('ffmpeg is not on PATH');
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(path.join(HERE, 'reel.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
const over = [];
let total = 0;

for (const item of list) {
  const src = path.join(SOURCE, item.file);
  if (!fs.existsSync(src)) {
    console.error(`missing ${src}`);
    process.exit(1);
  }
  const id = slug(item.id || path.parse(item.file).name);
  const ss = String(item.start || 0);
  const vf = 'scale=-2:360,fps=24';
  const webm = path.join(OUT, `${id}.webm`);
  const mp4 = path.join(OUT, `${id}.mp4`);
  const poster = path.join(OUT, `${id}.jpg`);
  ff(['-ss', ss, '-t', String(SECONDS), '-i', src, '-vf', vf, '-an', '-c:v', 'libaom-av1', '-crf', '40', '-b:v', '0', '-cpu-used', '6', '-row-mt', '1', webm]);
  ff(['-ss', ss, '-t', String(SECONDS), '-i', src, '-vf', vf, '-an', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', mp4]);
  ff(['-ss', String(Number(ss) + 1), '-i', src, '-frames:v', '1', '-vf', 'scale=-2:360', '-q:v', '6', poster]);
  for (const [file, cap] of [[webm, LOOP_KB], [mp4, LOOP_KB], [poster, POSTER_KB]]) {
    if (kb(file) > cap) over.push(`${path.basename(file)} ${kb(file).toFixed(0)} KB > ${cap} KB`);
  }
  total += kb(webm) + kb(poster); // a browser downloads one video format
  manifest.push({
    id,
    title: item.title || '',
    sources: { av1: `/tv/reel/${id}.webm`, h264: `/tv/reel/${id}.mp4` },
    poster: `/tv/reel/${id}.jpg`,
    seconds: SECONDS,
  });
}

if (total > REEL_KB) over.push(`reel ${total.toFixed(0)} KB > ${REEL_KB} KB`);
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
if (over.length) {
  console.error(`Over budget:\n  ${over.join('\n  ')}`);
  process.exit(1);
}
console.log(`${manifest.length} loops, ${total.toFixed(0)} KB (AV1 + posters)`);
```

- [ ] **Step 2: Wire it up.** Add `"tv:reel": "node scripts/tv-reel/build.mjs"` to `package.json` scripts and `scripts/tv-reel/source/` to `.gitignore`.

- [ ] **Step 3: ✋ The owner picks 6–10 clips**, downloads them from the Twitch creator dashboard into `scripts/tv-reel/source/`, and we write `scripts/tv-reel/reel.json` together (file, title, start second of the best 8 s).

- [ ] **Step 4: Build and check**

Run: `npm run tv:reel`
Expected: `N loops, … KB (AV1 + posters)` and no "Over budget". If a loop is over, raise its `-crf` in the script for that run or pick a calmer start second.

- [ ] **Step 5: See it.** `npm start`, open `/?fixture=offair`: the TV plays the loops with static cuts and the station-break cards between them. Toggle reduced motion in devtools: one still and a sentence. Network "Save-Data" (or Chrome's Lite mode) gives stills.

- [ ] **Step 6: Commit**

```bash
git add scripts/tv-reel/build.mjs scripts/tv-reel/reel.json package.json .gitignore public/tv/reel
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "feat(home): the TV reel script and the first reel"
```

---

### Task 23: Clean-up, rules and docs

**Files:**
- Delete: `src/components/HomeHero.js`, `HomeLeaderboardCallout.js`, `HomeGambaTools.js`, `StatsTicker.js`, `SignOff.js`, `SteamGames.jsx`, `SectionHeader.js`, `SectionDivider.js`, `ClipCard.js`, `VideoModal.js`, `src/hooks/useVideoModal.js`, their tests under `__tests__/`, and `public/site_banner_v2.png`
- Modify: `src/components/onAir/__tests__/onAirContract.test.js`, `DESIGN.md` (§7), `CLAUDE.md`, `docs/superpowers/specs/2026-10-04-couch-home-design.md` (status line)
- Create (generated): `public/share/home.jpg`

- [ ] **Step 1: Confirm nothing else uses the old home pieces, then delete them**

```bash
for c in HomeHero HomeLeaderboardCallout HomeGambaTools StatsTicker SignOff SteamGames SectionHeader SectionDivider ClipCard VideoModal useVideoModal site_banner_v2; do echo "== $c"; grep -rln "$c" src public/index.html scripts --include=*.js --include=*.jsx --include=*.html | grep -v "src/components/$c" ; done
```

Expected: no lines under any heading (other than files in the same delete list). Then `git rm` each file and any `__tests__` file that only tests them.

- [ ] **Step 2: Extend the contract test.** In `onAirContract.test.js`:
  - add `'src/components/couch'` and `'src/components/camera'` to `DIRS`;
  - add `'src/components/couch/couchFixtures.js'` to `RAW_COLOUR_EXEMPT`;
  - define `const isCouch = (rel) => rel.startsWith('src/components/couch/') || rel.startsWith('src/components/camera/');`;
  - in the "no raw colours" test, add `isCouch(rel) ||` to the `only` condition;
  - in the mono-tracking test, use `only: (rel) => isNavChrome(rel) || isVods(rel) || isCouch(rel)`;
  - rename the marker test to `'Type: the marker face is Goofer Video and the couch only'` and filter with `.filter((rel) => !isVods(rel) && !isCouch(rel))`;
  - in the marker size test use `only: (rel) => isVods(rel) || isCouch(rel)`.

Run: `npm test -- --watchAll=false --testPathPattern=onAirContract` → PASS. Fix any couch source the scan flags (never add an exemption for a component).

- [ ] **Step 3: DESIGN.md §7.** In the intro paragraph add home: "…the store (`/store`, the Goofer Shopping Network), the schedule (`/schedule`, the Goofer Guide), the video store (`/vods`, Goofer Video) and home (`/`, the couch) are built on it…". Change the Paper token line's "Goofer Video only" to "Goofer Video and the couch" and the marker line's "for Goofer Video's handwritten labels and index cards only" to "for Goofer Video's labels and index cards and the couch's sticky note and stickers only". Add before "### Named Rules":

```markdown
### The couch

- **Home is Goofer's living room at 2 AM.** One illustrated room under the nav, sized like a cover image around the TV. Every object is a door to a channel: TV (the stream while live, else Vods), sticky note (Giveaway, only while one is open), laptop (Gamba), tapes (Vods), TV guide (Schedule), game cases (Gaming), remote (Store) and the framed photo (About). Every door and label sits inside the art's safe area (x 12.5–87.5 %, y 12–88 %).
- **Labels glance, sentences explain.** Each door has a small mono kicker and teaser that is always visible; hover or focus opens its station-break sentence and "Opens …".
- **The camera.** A plain click zooms the room into the object (about 650 ms), the channel-change static covers the cut, the page tunes in. Back pulls the camera out to the couch. On phones a tile's art grows to fill the screen instead.
- **The TV** plays the reel off air (loops or stills, with station-break cards), the live preview while live, and the stream inside the TV when clicked. **The laptop** shows the hunt, the prediction round, or a bouncing GG screensaver.
- **Phones** see a 4:3 crop of the TV above "On the coffee table" tiles. With no art, every door is a tile.
- **Themes** dress the room on a calendar in `themes.js` (Halloween is October); `?theme=<id>` previews one and `?theme=none` turns it off.
- **Toys** react to a poke and go nowhere: the lamp toggles, the controller rumbles, the can fizzes; Halloween adds the jack-o'-lantern, the spider and the candy bowl. Silent; under reduced motion they switch art without moving.
- **The window** shows an always-night outside behind transparent glass: tonight's real moon phase, stars, a Phoenix skyline and a plane; the moon winks, the sky throws a shooting star, the cord rolls the blinds. Halloween brings a harvest moon, bats and a witch.
```

and to "### Named Rules":

```markdown
**Doors Are Links.** Every couch object is a real anchor in one ordered list; modifier and middle clicks stay native, and only a plain click plays the camera.

**One Camera.** One layer moves, by transform only, for about a second at most; the static covers every page swap. Under reduced motion it is a short cross-fade.

**Only The TV Casts Light.** The room is dim; the TV lights it only while live. The laptop screen turns on during a hunt but never glows.

**Art Is Measured.** Couch positions come from the room's layout (`src/components/couch/rooms/<id>.json`), written by `scripts/couch-art/measure.py` from the masks; components never hand-tune a coordinate.

**Rooms Are Swappable.** A room is its art plus its measured layout (names, screen skin, window, toys, theme art). Behaviour lives in code; a new era is a new folder and layout file.

**Toys Light Themselves.** A toy may light itself while you play with it (a lit pumpkin is art with an opacity flicker); it never uses a glow token and lights nothing around it. Only the TV lights the room.

**Dressing Never Covers A Door.** Theme dressing and toys are decorative (`aria-hidden`, pointer and touch only, never in the tab order) and never sit on a door or a label; the layout test enforces it.
```

- [ ] **Step 4: CLAUDE.md.**
  - In "Routing & Shell", replace the HomePage notes with: "`/` is the couch (`src/components/couch/`, wired by `HomePage`): an illustrated room whose objects are links; the site camera (`src/components/camera/CameraProvider.js`, mounted in `App.js` above the per-route `ErrorBoundary`) zooms into a door, cuts to static and swaps the page; Back pulls back. Dev: `/?fixture=offair|live|giveaway|hunt|round|late|loading|noart|empty`. Lazy pages load through `src/routes/loaders.js` so doors can prefetch."
  - Under Commands add: "`npm run tv:reel` — encodes the couch TV's loops from `scripts/tv-reel/source/` (gitignored, clips the owner downloads) per `scripts/tv-reel/reel.json` into `public/tv/reel/` (needs ffmpeg). Commit the outputs."
  - Under Gotchas add a "Couch" entry: art in `public/couch/` from `scripts/couch-art/` (ComfyUI-RMBG SAM 3 masks, LaMa erase, 4x-AnimeSharp, `measure.py` writes `src/components/couch/rooms/<room>.json`, `final: true` enables the safe-area and toy-placement tests; themes in `themes.js`, preview with `?theme=`); `useCouchData` adds two one-doc listeners (prediction round, live giveaway); `/api/steam-games` is CDN-cached 30 min and proxied to the deployed site in dev; the router test stub keeps history and `useNavigationType`.

- [ ] **Step 5: Spec status.** Change the spec's `**Status:**` line to `Approved (spec review 2026-10-04)`.

- [ ] **Step 6: Re-shoot the home card** (dev server running):

```bash
npm run share:shots -- --only=home --base=http://localhost:3000
```

Expected: `public/share/home.jpg` shows the room.

- [ ] **Step 7: Full suite and build**

Run: `npm test -- --watchAll=false` → all PASS.
Run: `npm run build` → completes (the share page check passes).

- [ ] **Step 8: Commit**

```bash
git add -A src DESIGN.md CLAUDE.md docs public/share/home.jpg public/site_banner_v2.png
[ "$(git branch --show-current)" = feat/couch-home ] && git commit -m "chore(home): retire the old home, extend the On Air rules and docs"
```

---

### Task 24: ✋ Reviews, the owner's localhost play-test, then the PR

- [ ] **Step 1: Motion review.** Invoke the `review-animations` skill on `src/components/camera/` and `src/components/couch/` (the camera move, the reel cuts, the screensaver, the label reveal). Apply the fixes it confirms, test, commit (`fix(home): …`).

- [ ] **Step 2: Accessibility review.** Dispatch the `accessibility-auditor` agent on the couch: keyboard order through the doors, link names, focus after a camera move and after leaving the TV frame, the TV frame dialog, reduced motion, label contrast on the art. Apply confirmed fixes, test, commit.

- [ ] **Step 3: Performance review.** Dispatch the `performance-benchmarker` agent: phone-class CPU, the plate's LCP with `fetchPriority="high"`, the stage transform at 60 fps, reel bytes, the extra listeners. Apply confirmed fixes, test, commit.

- [ ] **Step 4: ✋ Owner play-test on localhost.** Start `npm start` for the owner and hand over the checklist: every door (mouse, keyboard, touch), Back after each, the remote, live watch mode (if live, or `?fixture=live`), the giveaway note, phone layout, reduced motion, a first visit (clear site data) with the intro pull-back and the welcome card, every toy and the window (moon, sky, cord), and Halloween on and off (`?theme=halloween`, `?theme=none`). Fix everything the owner finds, re-run the suite and build after each batch, and repeat until the owner signs off. **Do not push before the sign-off.**

- [ ] **Step 5: Push and open the PR** (only after the sign-off):

```bash
[ "$(git branch --show-current)" = feat/couch-home ] && git push -u origin feat/couch-home
gh pr create --title "Home: the couch" --body "<summary of the spec, the test plan the owner ran, and the deferred items>"
```

No Claude attribution in the PR title or body. The owner merges.
