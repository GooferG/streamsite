# On Air Gamba Tuner and Guide Hub (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Gamba strip and the `/gamba` hub with the On Air "hybrid tuner" and a live channel guide whose featured monitor is taken over by Hunts while it is on air.

**Architecture:** `GambaPage` becomes a thin page: the tuner (`src/components/gamba/GambaTuner.js`), then either the guide hub or a tool. The hub splits into pure derivations (`gamba/guide.js`), one data hook (`useGuideData`), a single featured `Monitor` (`FeaturedMonitor`) and link rows (`GuideListings`). The Hunts monitor's stage parts move into a shared module so the hub reuses them instead of copying them.

**Tech Stack:** React 19, react-router-dom 7 (`Link`, `Navigate`, `useLocation`), Tailwind 3 with the `onair` tokens, lucide-react, Jest + React Testing Library via react-scripts (no jest-dom: assert with `toBeTruthy`, `getAttribute`, `className`). In Jest `react-router-dom` is `src/test/reactRouterDomStub.js` (a minimal in-memory router).

**Spec:** `docs/superpowers/specs/2026-10-03-onair-nav-gamba-guide-design.md`, Part 3 (tuner) and Part 4 (guide hub). PR 1 (#39) shipped Parts 1–2.

**Decisions since the spec (approved in conversation on 2026-10-03):**
- The featured monitor has no ◀ ▶ flip: Hunts keeps the takeover; the leaderboard's pool, leader and countdown sit in its listing row.
- `Monitor` already has a `label` prop (added by the store, #38), so the spec's "Monitor gains a label prop" is done.
- PR 1's lessons apply up front: 44×44 steppers, no hover-only behaviour in the tuner, mono codes tracked, no `text-base`, motion guarded, the contract test scans `src/components/gamba/`.

**Deliberate deviations from the spec:**
- ◀ ▶ are router links named for their target (the spec said buttons): they navigate, so they are links (middle-click works).
- The needle remembers its last channel across mounts. `App.js` wraps the routes in `ErrorBoundary key={location.pathname}`, so every tool switch remounts the page; a plain CSS transition would never play.

## Global Constraints

- Branch `feat/onair-gamba-guide` from `main` (`15e6bab` or later). Work in the main checkout, never a worktree. Another session may switch branches in this folder: every commit command starts with `test "$(git branch --show-current)" = feat/onair-gamba-guide && …`. Never stage `test-output.txt`.
- Commit messages: short imperative subject, **no `Co-Authored-By` or any Claude attribution** (same for the PR body).
- Tokens only in `src/components/gamba/` (no raw hex or `rgba(`); radii `rounded-onair-*` or `rounded-full`. Never `font-semibold`; nothing below `text-[0.625rem]`; mono labels (`${MONO}`) carry `tracking-[…]` ≥ 0.15em on the same line; no `text-base` / `text-lg`. The §7 type scale is 96 / 60 / 30 / 24 / 22 / 20 / 17 / 15 / 14 / 13 / 12 / 11 / 10.
- Readable Labels: informational text never fainter than `text-onair-ink-5`.
- Glow Means Something: only the LIVE light (`StatusLight`) glows on the hub. The needle, progress notches and lit rows do not glow. No orange (`orange-*`, `onair-winner*`) in `src/components/gamba/`.
- Honest Set Dressing: the tuning band, needle and notches are `aria-hidden`, have no cursor and no hover.
- Motion Has An Off Switch: the needle slide, transitions and the monitor static respect `prefers-reduced-motion`.
- Tuner breakpoints: ≥1024 five segments with `CH 0n` and name; 768–1023 names only; <768 the stepper `◀ · band · CH 02 Hunts · 3 of 5 · ▶`. Steppers and segments are at least 44px tall.
- Takeover rule: Hunts holds the featured monitor while a hunt is live or the latest prediction round has `acceptPredictions` and status `open` or `locked`; otherwise the leaderboard. A loading or failed hunts read never selects Hunts on its own. The Hunts listing row is lit exactly when Hunts holds the monitor; the Leaderboard row is never lit.
- Destinations: `/gamba` (hub), `/gamba/leaderboard`, `/gamba/hunts`, `/gamba/bonus-battle`, `/gamba/wheel`; an unknown `/gamba/<id>` redirects to `/gamba`.
- Copy (DESIGN.md §6): no em dashes in prose, no "X, not Y" constructions, no AI-tell words.
- CRA's Jest preset resets mocks before each test: re-arm `jest.fn` implementations in `beforeEach`.
- Tests: `CI=true npm test -- --testPathPattern=<path>`; full gate `CI=true npm test` and `npm run build`.

## Review Focus

1. **Huge amounts in a non-dollar currency** (ARS hunts run to `ARS 1,539,232.70`): the live-hunt hero must set the code small and fit a phone; the side stats must not overflow. Test in Task 5 (the hero splits `ARS` from the figure); visual check in Task 8.
2. **A new leaderboard month with no players or a zero pool:** the monitor shows `—` for the pool and the listing reads "No standings yet", never "undefined leads". Tests in Task 4 and Task 5.
3. **The hunts poll fails while a round is open:** the monitor still shows the pre-hunt screen from the Firestore round, and the Hunts row shows the round (lit), never "No signal" beside a working monitor. Test in Task 4.
4. **Switching tools remounts the page:** the needle must slide from the previous channel (remembered across mounts) and jump under reduced motion. Tests in Task 1.
5. **A hunt still live after its round settled:** Hunts holds the monitor as a live hunt with no predictions chip and the "Watch the opening" call to action. Tests in Task 4 and Task 5.

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `src/components/gamba/GambaTuner.js` | Create | The hybrid tuner: links, band, needle memory, steppers |
| `src/test/reactRouterDomStub.js` | Modify | Add `Navigate` |
| `src/pages/GambaPage.js` | Rewrite | Tuner + hub or tool; unknown id redirect; On Air loading text |
| `src/components/hunts/MonitorStage.js` | Create | `Eyebrow`, `Question`, `Hero`, `SideStats`, `HeroRow`, `Chips`, `Stage` moved out of HuntMonitor |
| `src/components/hunts/HuntMonitor.js` | Modify | Import the stage parts |
| `src/components/onAir/OnAirButton.js` | Modify | `as` prop so a router `Link` can wear the button look |
| `src/components/gamba/guide.js` | Create | Pure derivations: takeover, hunt feature, leaderboard facts, resets text, listing rows |
| `src/components/gamba/FeaturedMonitor.js` | Create | One `Monitor`, hunt or leaderboard screen, progress notches |
| `src/components/gamba/GuideListings.js` | Create | "What's on" rows (link per tool) |
| `src/components/gamba/useGuideData.js` | Create | Leaderboard, countdown, hunts poll, prediction round |
| `src/components/gamba/guideFixtures.js` | Create | Dev-only fixtures |
| `src/components/gamba/GambaGuide.js` | Create | The hub: featured monitor + listings, fixture switch |
| `src/components/GambaHub.js` | Delete | Replaced by `GambaGuide` |
| `src/components/onAir/__tests__/onAirContract.test.js` | Modify | Scan `src/components/gamba/` with the nav-chrome rules |
| `CLAUDE.md`, `DESIGN.md` | Modify | Document the tuner and guide |

---

### Task 1: The hybrid tuner

**Files:**
- Create: `src/components/gamba/GambaTuner.js`
- Modify: `src/components/onAir/__tests__/onAirContract.test.js`
- Test: `src/components/gamba/__tests__/GambaTuner.test.js`

**Interfaces:**
- Consumes: `GAMBA_CHANNELS`, `channelLabel` (`src/data/gambaTools.js`); `MONO`, `FOCUS` (`onAir/classes.js`); `prefersReducedMotion` (`onAir/useChannelSwitch.js`).
- Produces: default `GambaTuner({ current })` where `current` is a `GAMBA_CHANNELS` entry or `null` (null renders as the hub). Named `resetTunerMemory()` for tests.

- [ ] **Step 1: Write the failing test**

Create `src/components/gamba/__tests__/GambaTuner.test.js`:

```js
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaTuner, { resetTunerMemory } from '../GambaTuner';
import { GAMBA_CHANNELS } from '../../../data/gambaTools';

const at = (id) => GAMBA_CHANNELS.find((c) => c.id === id);

function renderTuner(id) {
  return render(
    <MemoryRouter initialEntries={[at(id).path]}>
      <GambaTuner current={at(id)} />
    </MemoryRouter>
  );
}

const nav = () => screen.getByRole('navigation', { name: 'Gamba channels' });
const needle = () => screen.getByTestId('tuner-needle');
const frame = () => act(() => new Promise((r) => requestAnimationFrame(() => r())));

function setReducedMotion(on) {
  window.matchMedia = jest.fn((query) => ({ matches: on && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => resetTunerMemory());
afterEach(() => {
  delete window.matchMedia;
});

test('five channel links with CH numbers; the current one is the page', () => {
  renderTuner('hunts');
  const links = within(nav()).getAllByRole('link').filter((a) => /^CH/.test(a.textContent));
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['CH 00Hub', '/gamba'],
    ['CH 01Leaderboard', '/gamba/leaderboard'],
    ['CH 02Hunts', '/gamba/hunts'],
    ['CH 03Bonus Battle', '/gamba/bonus-battle'],
    ['CH 04Slot Picker', '/gamba/wheel'],
  ]);
  expect(links[2].getAttribute('aria-current')).toBe('page');
  expect(links[1].getAttribute('aria-current')).toBeNull();
});

test('steppers name their target and wrap at both ends', () => {
  const { unmount } = renderTuner('hub');
  expect(screen.getByRole('link', { name: 'Previous channel: Slot Picker' }).getAttribute('href')).toBe('/gamba/wheel');
  expect(screen.getByRole('link', { name: 'Next channel: Leaderboard' }).getAttribute('href')).toBe('/gamba/leaderboard');
  unmount();
  renderTuner('wheel');
  expect(screen.getByRole('link', { name: 'Next channel: Hub' }).getAttribute('href')).toBe('/gamba');
});

test('null current reads as the hub', () => {
  render(
    <MemoryRouter initialEntries={['/gamba']}>
      <GambaTuner current={null} />
    </MemoryRouter>
  );
  expect(within(nav()).getByRole('link', { name: /CH 00\s*Hub/ }).getAttribute('aria-current')).toBe('page');
});

test('the phone readout names the channel and its position', () => {
  renderTuner('hunts');
  expect(screen.getByTestId('tuner-readout').textContent).toMatch(/CH 02\s*Hunts\s*· 3 of 5/);
});

test('the band and needle are set dressing', () => {
  renderTuner('hunts');
  expect(screen.getByTestId('tuner-band').getAttribute('aria-hidden')).toBe('true');
  expect(needle().className).toContain('motion-safe:transition-[left]');
});

test('first visit: the needle starts on its channel', () => {
  renderTuner('hunts');
  expect(needle().style.left).toBe('50%');
});

test('after a remount the needle slides from the previous channel', async () => {
  const first = renderTuner('hunts');
  first.unmount();
  renderTuner('wheel');
  expect(needle().style.left).toBe('50%');
  await frame();
  expect(needle().style.left).toBe('90%');
});

test('reduced motion: the needle jumps straight to the new channel', () => {
  setReducedMotion(true);
  const first = renderTuner('hunts');
  first.unmount();
  renderTuner('wheel');
  expect(needle().style.left).toBe('90%');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern=gamba/__tests__/GambaTuner`
Expected: FAIL (`Cannot find module '../GambaTuner'`).

- [ ] **Step 3: Write the implementation**

Create `src/components/gamba/GambaTuner.js`:

```js
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FOCUS, MONO } from '../onAir/classes';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import { GAMBA_CHANNELS, channelLabel } from '../../data/gambaTools';

const COUNT = GAMBA_CHANNELS.length;
const needleLeft = (i) => `${((i + 0.5) / COUNT) * 100}%`;
const wrap = (i) => GAMBA_CHANNELS[(i + COUNT) % COUNT];

// Where the needle last rested. App.js remounts the routes on every pathname
// change (ErrorBoundary key), so the tuner remembers across mounts and slides
// from the previous channel instead of appearing in place.
let lastTuned = null;

// Tests reset the remembered position between cases.
export function resetTunerMemory() {
  lastTuned = null;
}

function useNeedle(index) {
  const [at, setAt] = useState(() => (lastTuned == null || prefersReducedMotion() ? index : lastTuned));
  useEffect(() => {
    lastTuned = index;
    if (at === index) return undefined;
    const raf = requestAnimationFrame(() => setAt(index));
    return () => cancelAnimationFrame(raf);
  }, [index, at]);
  return at;
}

function StepLink({ to, direction }) {
  const Icon = direction === 'Previous' ? ChevronLeft : ChevronRight;
  return (
    <Link
      to={to.path}
      aria-label={`${direction} channel: ${to.label}`}
      className={`inline-flex min-h-11 w-11 flex-none items-center justify-center self-stretch rounded-onair-control bg-white/[0.07] text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] motion-reduce:transition-none ${FOCUS}`}
    >
      <Icon size={18} aria-hidden="true" />
    </Link>
  );
}

// The Gamba tuner (spec Part 3): labelled channel links under a tuning band.
// The band and needle are set dressing; the links do the work.
export default function GambaTuner({ current }) {
  const index = Math.max(0, GAMBA_CHANNELS.findIndex((c) => c.id === (current && current.id)));
  const tuned = GAMBA_CHANNELS[index];
  const at = useNeedle(index);

  return (
    <nav
      aria-label="Gamba channels"
      className="flex gap-1.5 rounded-onair-row bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 p-1.5 font-onair shadow-onair-card"
    >
      <StepLink to={wrap(index - 1)} direction="Previous" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="relative mx-1.5 mb-1.5 mt-1 h-2.5 rounded-full bg-onair-track" aria-hidden="true" data-testid="tuner-band">
          <span
            data-testid="tuner-needle"
            className="absolute -top-[3px] h-4 w-0.5 -translate-x-1/2 rounded-full bg-onair-signal motion-safe:transition-[left] motion-safe:duration-300 motion-safe:ease-out"
            style={{ left: needleLeft(at) }}
          />
        </div>
        <ul className="hidden gap-1 md:flex">
          {GAMBA_CHANNELS.map((ch) => {
            const on = ch.id === tuned.id;
            return (
              <li key={ch.id} className="min-w-0 flex-1">
                <Link
                  to={ch.path}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-center gap-2.5 rounded-onair-control px-3 py-2 text-[0.9375rem] font-bold transition-colors duration-150 motion-reduce:transition-none ${FOCUS} ${
                    on
                      ? 'bg-gradient-to-r from-onair-signal-deep/[0.18] to-onair-signal-deep/[0.05] text-onair-ink-1 shadow-onair-lit-signal'
                      : 'text-onair-ink-3 hover:bg-white/5 hover:text-onair-ink-1'
                  }`}
                >
                  <span className={`${MONO} hidden whitespace-nowrap text-[0.6875rem] font-bold tracking-[0.15em] lg:inline ${on ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
                    {channelLabel(ch)}
                  </span>
                  <span className="truncate">{ch.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p data-testid="tuner-readout" className="flex items-baseline justify-center gap-2 pb-1 md:hidden">
          <span className={`${MONO} text-[0.6875rem] font-bold tracking-[0.15em] text-onair-signal`}>{channelLabel(tuned)}</span>
          <span className="font-bold text-onair-ink-1">{tuned.label}</span>
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-5`}>
            · {index + 1} of {COUNT}
          </span>
        </p>
      </div>
      <StepLink to={wrap(index + 1)} direction="Next" />
    </nav>
  );
}
```

In `src/components/onAir/__tests__/onAirContract.test.js`:
- add `'src/components/gamba'` to `DIRS` (after `'src/components/nav'`);
- widen `isNavChrome` so the nav-chrome rules (no orange, mono tracking on the same line, no `text-base`/`text-lg`, raw colours) also cover the Gamba chrome:

```js
const isNavChrome = (rel) =>
  rel.startsWith('src/components/nav/') || rel.startsWith('src/components/gamba/') || rel === CONTROL_ROOM_BUTTON;
```

(Read the file first: keep the rest unchanged. If a rule's test title names "nav" only, rename it to "nav and Gamba".)

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npm test -- --testPathPattern="(gamba/__tests__/GambaTuner|onAirContract)"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/components/gamba src/components/onAir/__tests__/onAirContract.test.js && git commit -m "feat(gamba): hybrid tuner with a remembered needle"
```

---

### Task 2: GambaPage on the tuner, with the unknown-id redirect

**Files:**
- Modify: `src/test/reactRouterDomStub.js` (add `Navigate`)
- Rewrite: `src/pages/GambaPage.js`
- Test: `src/test/__tests__/reactRouterDomStub.test.js` (append), `src/pages/__tests__/GambaPage.test.js` (create)

**Interfaces:**
- Consumes: `GambaTuner` (Task 1), `channelForPath` (`data/gambaTools.js`), `GambaHub` (kept until Task 7).
- Produces: `GambaPage` renders `GambaTuner` above the hub or the tool; `/gamba/<unknown>` renders `<Navigate to="/gamba" replace />`. The stub exports `Navigate({ to })`.

- [ ] **Step 1: Write the failing tests**

Append to `src/test/__tests__/reactRouterDomStub.test.js` (add `Navigate` to its import from `'react-router-dom'`):

```js
test('Navigate moves to its target once', () => {
  function Where() {
    return <p>at {useLocation().pathname}</p>;
  }
  render(
    <MemoryRouter initialEntries={['/gamba/nope']}>
      <Routes>
        <Route path="/gamba/nope" element={<Navigate to="/gamba" replace />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('at /gamba')).toBeTruthy();
});
```

(If the file's existing imports don't include `useLocation`, `Routes`, `Route` or `render`/`screen`, add them.)

Create `src/pages/__tests__/GambaPage.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaPage from '../GambaPage';
import { resetTunerMemory } from '../../components/gamba/GambaTuner';

jest.mock('../HuntsPage', () => () => <p>hunts tool</p>);
jest.mock('../../components/Leaderboard', () => () => <p>leaderboard tool</p>);
jest.mock('../../components/BonusBattle', () => () => <p>battle tool</p>);
jest.mock('../../components/SlotPicker', () => () => <p>picker tool</p>);
jest.mock('../../components/GambaHub', () => () => <p>gamba hub</p>);

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GambaPage />
    </MemoryRouter>
  );
}

const current = () =>
  screen
    .getByRole('navigation', { name: 'Gamba channels' })
    .querySelector('[aria-current="page"]').textContent;

beforeEach(() => resetTunerMemory());

test('/gamba shows the tuner on CH 00 above the hub', () => {
  renderAt('/gamba');
  expect(current()).toMatch(/CH 00\s*Hub/);
  expect(screen.getByText('gamba hub')).toBeTruthy();
});

test('/gamba/hunts shows the tuner on CH 02 above the Hunts tool', () => {
  renderAt('/gamba/hunts');
  expect(current()).toMatch(/CH 02\s*Hunts/);
  expect(screen.getByText('hunts tool')).toBeTruthy();
});

test('lazy tools load behind the On Air loading line', async () => {
  renderAt('/gamba/wheel');
  expect(await screen.findByText('picker tool')).toBeTruthy();
});

test('an unknown tool id redirects to the hub', () => {
  renderAt('/gamba/nope');
  expect(screen.getByText('gamba hub')).toBeTruthy();
  expect(current()).toMatch(/CH 00\s*Hub/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npm test -- --testPathPattern="(reactRouterDomStub|pages/__tests__/GambaPage)"`
Expected: FAIL (`Navigate` is not exported; the tuner isn't on the page yet).

- [ ] **Step 3: Write the implementation**

In `src/test/reactRouterDomStub.js` add, after `useNavigate`:

```js
// <Navigate to /> moves the in-memory location once, after mount.
function Navigate({ to }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}
```

and add `Navigate` to `module.exports`. Update the header comment's list of supported APIs to include `Navigate`.

Replace `src/pages/GambaPage.js` with:

```js
import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import HuntsPage from './HuntsPage';
import Leaderboard from '../components/Leaderboard';
import GambaHub from '../components/GambaHub';
import GambaTuner from '../components/gamba/GambaTuner';
import { MONO } from '../components/onAir/classes';
import { channelForPath } from '../data/gambaTools';
import useTuningPhrase, { TUNING_PHRASES } from '../hooks/useTuningPhrase';

// Code-split the heavier tools so they only download when opened. The slot
// catalogue itself is fetched from /api/slots on first use (useSlotCatalog).
const SlotPicker = lazy(() => import('../components/SlotPicker'));
const BonusBattle = lazy(() => import('../components/BonusBattle'));

// While a tool chunk loads: its own label, then the broadcast tuning phrases.
function ToolLoading({ label }) {
  const phrase = useTuningPhrase(true, [label, ...TUNING_PHRASES]);
  return (
    <div className="px-4 py-16 text-center">
      <p className={`${MONO} text-[0.625rem] font-bold tracking-[0.25em] text-onair-ink-4 motion-safe:animate-pulse`}>{phrase}</p>
    </div>
  );
}

// /gamba/*: the tuner, then the hub (no tool id) or the tool. An unknown tool
// id goes back to the hub.
export default function GambaPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toolId = pathname.split('/')[2] || null;
  const channel = channelForPath(pathname);
  if (toolId && !channel) return <Navigate to="/gamba" replace />;

  return (
    <div className="px-4 pb-16 pt-20 sm:px-6">
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px]">
        <GambaTuner current={channel} />
        <div className="mt-4">
          {!toolId && <GambaHub setPage={(id) => navigate(`/${id}`)} />}
          {toolId === 'leaderboard' && <Leaderboard />}
          {toolId === 'hunts' && <HuntsPage />}
          {toolId === 'bonus-battle' && (
            <Suspense fallback={<ToolLoading label="Loading bonus battle…" />}>
              <BonusBattle />
            </Suspense>
          )}
          {toolId === 'wheel' && (
            <Suspense fallback={<ToolLoading label="Tuning slot signal…" />}>
              <SlotPicker />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
```

This removes `ChannelTab`, `MobileChannelTrigger`, `MobileChannelSheet`, the `gamba-sheet-*` keyframes and the `scrollIntoView` effect (the nav's side sheet lists every channel on phones).

- [ ] **Step 4: Run tests and the build**

Run: `CI=true npm test -- --testPathPattern="(reactRouterDomStub|pages/__tests__/GambaPage|gamba)"`
Expected: PASS. Then `npm run build` → "Compiled successfully." (no unused imports left in GambaPage).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/test/reactRouterDomStub.js src/test/__tests__/reactRouterDomStub.test.js src/pages/GambaPage.js src/pages/__tests__/GambaPage.test.js && git commit -m "feat(gamba): tuner on every Gamba page; unknown tools go to the hub"
```

---

### Task 3: Shared monitor stage parts and a linkable OnAirButton

**Files:**
- Create: `src/components/hunts/MonitorStage.js`
- Modify: `src/components/hunts/HuntMonitor.js` (remove the local `EYEBROW`, `HERO`, `Eyebrow`, `Question`, `Hero`, `SideStats`, `HeroRow`, `Chips`, `Stage`; import them)
- Modify: `src/components/onAir/OnAirButton.js`
- Test: `src/components/hunts/__tests__/MonitorStage.test.js`, `src/components/onAir/__tests__/onAirPrimitives.test.js` (append)

**Interfaces:**
- Produces (named exports of `hunts/MonitorStage.js`): `Eyebrow({ tone: 'signal'|'winner'|'muted', children })`, `Question({ children })`, `Hero({ text, suffix?, label?, tone?: 'ink'|'loss'|'signal' })`, `SideStats({ items: Array<{label, value}> })`, `HeroRow({ hero, side })`, `Chips({ children })`, `Stage({ eyebrow, children })`. Markup identical to today's HuntMonitor internals.
- Produces: `OnAirButton({ as = 'button', … })`; when `as` is not `'button'` it doesn't pass `type`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/hunts/__tests__/MonitorStage.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { Chips, Eyebrow, Hero, HeroRow, Question, SideStats, Stage } from '../MonitorStage';

test('the stage parts render the Hunts monitor markup', () => {
  render(
    <Stage eyebrow={<Eyebrow tone="signal">Community hunt · Opening bonuses</Eyebrow>}>
      <Question>What does the hunt pay?</Question>
      <HeroRow hero={<Hero text="ARS 1,539,232.70" label="Won so far" />} side={[{ label: 'Start cost', value: '$2,421.82' }]} />
      <Chips>
        <span>chip</span>
      </Chips>
    </Stage>
  );
  expect(screen.getByText('Community hunt · Opening bonuses').className).toContain('text-onair-signal');
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
  // The currency code is set small beside the figure so long amounts fit.
  expect(screen.getByText('ARS').className).toContain('text-[0.45em]');
  expect(screen.getByText('Start cost')).toBeTruthy();
});

test('SideStats renders nothing without items', () => {
  const { container } = render(<SideStats items={[]} />);
  expect(container.innerHTML).toBe('');
});
```

Append to `src/components/onAir/__tests__/onAirPrimitives.test.js`:

```js
test('OnAirButton can render as another element (a router Link) without a type', () => {
  function FakeLink({ to, children, ...rest }) {
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    );
  }
  render(
    <OnAirButton as={FakeLink} to="/gamba/hunts" variant="viewer">
      Get your guess in
    </OnAirButton>
  );
  const link = screen.getByRole('link', { name: 'Get your guess in' });
  expect(link.getAttribute('href')).toBe('/gamba/hunts');
  expect(link.hasAttribute('type')).toBe(false);
  expect(link.className).toContain('from-onair-viewer');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npm test -- --testPathPattern="(MonitorStage|onAirPrimitives)"`
Expected: FAIL (`Cannot find module '../MonitorStage'`; the OnAirButton link gets `type="button"`).

- [ ] **Step 3: Write the implementation**

Create `src/components/hunts/MonitorStage.js` by **moving verbatim** these blocks out of `HuntMonitor.js` (read the file first; today they sit between the `SCREENS` table and `openHero`): the `EYEBROW` and `HERO` maps, and the functions `Eyebrow`, `Question`, `Hero` (with its comment), `SideStats`, `HeroRow`, `Chips`, `Stage`. Add `export` to each function. The new file's header:

```js
import { MONO } from '../onAir/classes';
import { fitFigure } from '../onAir/fit';
import MoneyFigure, { fitTextFor } from './MoneyFigure';

// Building blocks of an On Air monitor screen, shared by the Hunts monitor and
// the Gamba guide's featured monitor. Screen content is the size container for
// the fitted hero (container-type: inline-size, --hero-share).
```

In `HuntMonitor.js`, delete those blocks and add:

```js
import { Chips, Eyebrow, Hero, HeroRow, Question, SideStats, Stage } from './MonitorStage';
```

Remove imports HuntMonitor no longer uses (`fitFigure`, `MoneyFigure`/`fitTextFor`, `MONO` if unused — let `npm run build` / ESLint tell you). Do not change any markup.

In `src/components/onAir/OnAirButton.js`, change the signature and element:

```js
export default function OnAirButton({ as: Tag = 'button', variant = 'viewer', size = 'md', type = 'button', className = '', children, ...rest }) {
  const typeProp = Tag === 'button' ? { type } : {};
  return (
    <Tag
      {...typeProp}
      className={`inline-flex items-center justify-center gap-2 rounded-onair-control font-bold transition-[filter,background-color] duration-150 ${SIZES[size]} ${VARIANTS[variant]} ${DISABLED} ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npm test -- --testPathPattern="(src/components/hunts|onAir)"`
Expected: PASS — including every existing `HuntMonitor` / `HuntsTab` test unchanged (the move is behaviour-neutral).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/components/hunts/MonitorStage.js src/components/hunts/HuntMonitor.js src/components/hunts/__tests__/MonitorStage.test.js src/components/onAir/OnAirButton.js src/components/onAir/__tests__/onAirPrimitives.test.js && git commit -m "refactor(onair): share monitor stage parts; OnAirButton renders as a link"
```

---

### Task 4: Guide derivations

**Files:**
- Create: `src/components/gamba/guide.js`
- Test: `src/components/gamba/__tests__/guide.test.js`

**Interfaces:**
- Consumes: `huntMode`, `tabHuntRef`, `huntStats`, `signedMoney`, `topPrizeText` (`hunts/huntStats.js`); `formatMoney` (`utils/money.js`); `huntTypeLabel`, `profitLoss` (`utils/huntFormat.js`); `GAMBA_TOOLS`, `channelLabel` (`data/gambaTools.js`).
- Data shape consumed everywhere below (`GuideData`): `{ leaderboard: { players: [{ maskedUsername, wagered, prize }], prizePool, periodLabel, endsAt, isLoading, error }, countdown: { days, hours, minutes, seconds, isOver, unknown? }, hunts: { live, recent, loading, error }, round: undefined | null | roundDoc }`.
- Produces:
  - `pickFeatured({ hunts, round }) → 'hunts' | 'leaderboard'`
  - `huntFeature({ hunts, round }) → { kind: 'live'|'prehunt', mode: 'open'|'locked'|'offair', round, hunt, stats, currency, guessCount, prize }`
  - `progressModel(stats) → null | { opened, total, style: 'notches'|'bar' }` (notches up to 60 bonuses)
  - `leaderboardFacts(leaderboard) → { loading: true } | { noSignal: true } | { pool, period, leader: null|{ name, wagered, prize }, lead, standings: string[] }`
  - `formatResets(countdown) → string | null` (`'Resets in 27d 04h'`, `'Resetting now'`, or null when unknown)
  - `guideRows({ featured, feature, hunts, leaderboard, resets }) → Array<{ id, channel, label, path, now, next, lit, live, tone }>` in `GAMBA_TOOLS` order; `tone` is `'signal' | 'loss' | null` for the "now" text.

- [ ] **Step 1: Write the failing test**

Create `src/components/gamba/__tests__/guide.test.js`:

```js
import { formatResets, guideRows, huntFeature, leaderboardFacts, pickFeatured, progressModel } from '../guide';

const LIVE_HUNT = {
  id: 'h9',
  status: 'live',
  huntType: 'community',
  currency: null,
  pot: 2421.82,
  bonusCount: 4,
  totalWon: null,
  bonuses: [
    { slot: 'Wanted', bet: 1, win: 212, multiplier: 212 },
    { slot: 'Sugar', bet: 1, win: 40, multiplier: 40 },
    { slot: 'Gates', bet: 1, win: null, multiplier: null },
    { slot: 'Dog', bet: 1, win: null, multiplier: null },
  ],
};
const ROUND = (status, over = {}) => ({
  id: 'r1',
  title: 'Thursday comm hunt',
  status,
  acceptPredictions: true,
  entryCount: 6,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h9', totalCost: 2421.82, currency: null, bonusCount: 4 },
  ...over,
});
const HUNTS = (over = {}) => ({ live: null, recent: [], loading: false, error: null, ...over });
const BOARD = (over = {}) => ({
  players: [
    { maskedUsername: 'ab***z', wagered: 41203.4, prize: 2000 },
    { maskedUsername: 'kr***9', wagered: 34333.1, prize: 1000 },
  ],
  prizePool: 5000,
  periodLabel: 'OCTOBER',
  endsAt: 1,
  isLoading: false,
  error: null,
  ...over,
});

describe('pickFeatured', () => {
  test('a live hunt takes the monitor', () => {
    expect(pickFeatured({ hunts: HUNTS({ live: LIVE_HUNT }), round: null })).toBe('hunts');
  });
  test('an open or locked round takes it before the hunt starts', () => {
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('open') })).toBe('hunts');
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('locked') })).toBe('hunts');
  });
  test('settled, paused or still-loading rounds leave it to the leaderboard', () => {
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('settled') })).toBe('leaderboard');
    expect(pickFeatured({ hunts: HUNTS(), round: ROUND('open', { acceptPredictions: false }) })).toBe('leaderboard');
    expect(pickFeatured({ hunts: HUNTS(), round: undefined })).toBe('leaderboard');
  });
  test('a loading hunts read never selects Hunts', () => {
    expect(pickFeatured({ hunts: HUNTS({ live: LIVE_HUNT, loading: true }), round: null })).toBe('leaderboard');
  });
});

describe('huntFeature', () => {
  test('live hunt with an open round', () => {
    const f = huntFeature({ hunts: HUNTS({ live: LIVE_HUNT }), round: ROUND('open') });
    expect(f).toMatchObject({ kind: 'live', mode: 'open', guessCount: 6 });
    expect(f.stats.wonSoFar).toBe(252);
    expect(f.stats.openedCount).toBe(2);
  });
  test('live hunt after its round settled: no round, offair mode', () => {
    const f = huntFeature({ hunts: HUNTS({ live: LIVE_HUNT }), round: ROUND('settled') });
    expect(f).toMatchObject({ kind: 'live', mode: 'offair', round: null, guessCount: 0, prize: null });
  });
  test('open round before the hunt starts', () => {
    const f = huntFeature({ hunts: HUNTS(), round: ROUND('open') });
    expect(f).toMatchObject({ kind: 'prehunt', mode: 'open' });
    expect(f.stats.startCost).toBe(2421.82);
  });
});

test('progressModel: notches up to 60 bonuses, then a bar; null without bonuses', () => {
  expect(progressModel({ bonuses: [1, 2, 3], openedCount: 1, bonusCount: 3 })).toEqual({ opened: 1, total: 3, style: 'notches' });
  expect(progressModel({ bonuses: new Array(61).fill(1), openedCount: 10, bonusCount: 61 }).style).toBe('bar');
  expect(progressModel({ bonuses: [], openedCount: 0, bonusCount: 0 })).toBeNull();
});

describe('leaderboardFacts', () => {
  test('leader, lead, prize and the top five standings in whole dollars', () => {
    expect(leaderboardFacts(BOARD())).toEqual({
      pool: '$5,000',
      period: 'OCTOBER',
      leader: { name: 'ab***z', wagered: '$41,203', prize: '$2,000' },
      lead: '$6,870',
      standings: ['1 ab***z $41,203', '2 kr***9 $34,333'],
    });
  });
  test('a new month with no players or pool', () => {
    expect(leaderboardFacts(BOARD({ players: [], prizePool: 0 }))).toEqual({ pool: null, period: 'OCTOBER', leader: null, lead: null, standings: [] });
  });
  test('loading, and a failed read with nothing to show', () => {
    expect(leaderboardFacts(BOARD({ isLoading: true, players: [] }))).toEqual({ loading: true });
    expect(leaderboardFacts(BOARD({ error: 'HTTP 502', players: [] }))).toEqual({ noSignal: true });
  });
});

test('formatResets', () => {
  expect(formatResets({ days: 27, hours: 4, minutes: 0, seconds: 0, isOver: false })).toBe('Resets in 27d 04h');
  expect(formatResets({ isOver: true })).toBe('Resetting now');
  expect(formatResets({ unknown: true })).toBeNull();
});

describe('guideRows', () => {
  const rows = (args) => Object.fromEntries(guideRows(args).map((r) => [r.id, r]));
  const base = { hunts: HUNTS(), leaderboard: BOARD(), resets: 'Resets in 27d 04h' };

  test('tool order, channels and paths', () => {
    expect(guideRows({ ...base, featured: 'leaderboard', feature: null }).map((r) => [r.id, r.channel, r.path])).toEqual([
      ['leaderboard', 'CH 01', '/gamba/leaderboard'],
      ['hunts', 'CH 02', '/gamba/hunts'],
      ['bonus-battle', 'CH 03', '/gamba/bonus-battle'],
      ['wheel', 'CH 04', '/gamba/wheel'],
    ]);
  });

  test('live hunt: the Hunts row is lit with the LIVE light; the leaderboard row adds the pool', () => {
    const hunts = HUNTS({ live: LIVE_HUNT });
    const feature = huntFeature({ hunts, round: ROUND('open') });
    const r = rows({ ...base, hunts, featured: 'hunts', feature });
    expect(r.hunts).toMatchObject({ lit: true, live: true, now: 'Community hunt · 2/4 opened · $252.00 won', next: 'Predictions open · 6 in' });
    expect(r.leaderboard).toMatchObject({ lit: false, now: '$5,000 pool · ab***z leads · $41,203', next: 'Resets in 27d 04h' });
  });

  test('locked round, and a live hunt without a round', () => {
    const hunts = HUNTS({ live: LIVE_HUNT });
    expect(rows({ ...base, hunts, featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('locked') }) }).hunts.next).toBe('Entries closed · 6 guesses');
    expect(rows({ ...base, hunts, featured: 'hunts', feature: huntFeature({ hunts, round: null }) }).hunts.next).toBe('No round open');
  });

  test('pre-hunt, even with the hunts poll failing: lit with the round', () => {
    const hunts = HUNTS({ error: 'HTTP 502' });
    const feature = huntFeature({ hunts, round: ROUND('open') });
    expect(rows({ ...base, hunts, featured: 'hunts', feature }).hunts).toMatchObject({
      lit: true,
      live: false,
      now: 'Thursday comm hunt · Predictions open',
      next: '6 guesses in',
    });
  });

  test('off air: last result in signal or loss; nothing lit', () => {
    const win = { id: 'a', pot: 100, totalWon: 150, currency: null };
    const loss = { id: 'b', pot: 100, totalWon: 40, currency: null };
    expect(rows({ ...base, hunts: HUNTS({ recent: [win] }), featured: 'leaderboard', feature: null }).hunts).toMatchObject({
      lit: false,
      now: 'Last hunt +$50.00',
      tone: 'signal',
      next: 'No round open',
    });
    expect(rows({ ...base, hunts: HUNTS({ recent: [loss] }), featured: 'leaderboard', feature: null }).hunts).toMatchObject({ now: 'Last hunt −$60.00', tone: 'loss' });
  });

  test('hunts read failed with nothing cached: No signal', () => {
    expect(rows({ ...base, hunts: HUNTS({ error: 'HTTP 502' }), featured: 'leaderboard', feature: null }).hunts).toMatchObject({ now: 'No signal', next: '—' });
  });

  test('leaderboard row: no standings yet, no signal, loading', () => {
    expect(rows({ ...base, leaderboard: BOARD({ players: [], prizePool: 0 }), featured: 'leaderboard', feature: null }).leaderboard.now).toBe('No standings yet');
    expect(rows({ ...base, leaderboard: BOARD({ players: [], error: 'x' }), featured: 'leaderboard', feature: null }).leaderboard.now).toBe('No signal');
    expect(rows({ ...base, leaderboard: BOARD({ players: [], isLoading: true }), featured: 'leaderboard', feature: null }).leaderboard.now).toBe('Tuning…');
  });

  test('static channels', () => {
    const r = rows({ ...base, featured: 'leaderboard', feature: null });
    expect(r['bonus-battle']).toMatchObject({ now: 'Two bonuses, one winner. Call it.', next: 'Any time', lit: false });
    expect(r.wheel).toMatchObject({ now: 'Spin up a random slot to play next.', next: 'Any time', lit: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern=gamba/__tests__/guide`
Expected: FAIL (`Cannot find module '../guide'`).

- [ ] **Step 3: Write the implementation**

Create `src/components/gamba/guide.js`:

```js
import { huntMode, huntStats, signedMoney, tabHuntRef, topPrizeText } from '../hunts/huntStats';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel, profitLoss } from '../../utils/huntFormat';
import { GAMBA_TOOLS, channelLabel } from '../../data/gambaTools';

// Pure derivations for the Gamba guide hub (spec Part 4). Everything here is a
// string, a number or null: the components only lay it out.

const NOTCH_CAP = 60;
const usd = (n) => `$${Math.trunc(Number(n) || 0).toLocaleString('en-US')}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const liveHuntOf = (hunts) => (hunts && !hunts.loading ? hunts.live || null : null);
const isActive = (round) => !!round && !!round.acceptPredictions && (round.status === 'open' || round.status === 'locked');

// Hunts holds the featured monitor while a hunt is live or a prediction round
// is open or locked; otherwise the leaderboard has it. A loading or failed
// hunts read never selects Hunts on its own.
export function pickFeatured({ hunts, round }) {
  return liveHuntOf(hunts) || isActive(round) ? 'hunts' : 'leaderboard';
}

// What the hunt screen talks about: the live hunt (kind 'live'), else the
// active round before its hunt starts (kind 'prehunt').
export function huntFeature({ hunts, round }) {
  const live = liveHuntOf(hunts);
  const active = isActive(round);
  const activeRound = active ? round : null;
  const hunt = live || (active ? tabHuntRef(round, live, hunts && hunts.recent).summary : null);
  const snap = activeRound && activeRound.bonusHuntSnapshot;
  return {
    kind: live ? 'live' : 'prehunt',
    mode: active ? huntMode(round) : 'offair',
    round: activeRound,
    hunt,
    stats: huntStats(hunt, activeRound),
    currency: (hunt && hunt.currency) || (snap && snap.currency) || null,
    guessCount: activeRound ? activeRound.entryCount || 0 : 0,
    prize: activeRound ? topPrizeText(activeRound) : null,
  };
}

// One notch per bonus up to NOTCH_CAP, then a continuous bar.
export function progressModel(stats) {
  const total = stats && stats.bonuses && stats.bonuses.length ? stats.bonusCount || stats.bonuses.length : 0;
  if (!total) return null;
  return { opened: stats.openedCount, total, style: total > NOTCH_CAP ? 'bar' : 'notches' };
}

// Handles arrive pre-masked from the bean board; never re-mask.
export function leaderboardFacts(lb) {
  const players = (lb && lb.players) || [];
  if (lb && lb.isLoading && !players.length) return { loading: true };
  if (lb && lb.error && !players.length) return { noSignal: true };
  const [leader, second] = players;
  return {
    pool: lb && lb.prizePool > 0 ? usd(lb.prizePool) : null,
    period: (lb && lb.periodLabel) || null,
    leader: leader ? { name: leader.maskedUsername, wagered: usd(leader.wagered), prize: leader.prize > 0 ? usd(leader.prize) : null } : null,
    lead: leader && second ? usd(leader.wagered - second.wagered) : null,
    standings: players.slice(0, 5).map((p, i) => `${i + 1} ${p.maskedUsername} ${usd(p.wagered)}`),
  };
}

export function formatResets(countdown) {
  if (!countdown || countdown.unknown) return null;
  if (countdown.isOver) return 'Resetting now';
  return `Resets in ${countdown.days}d ${String(countdown.hours).padStart(2, '0')}h`;
}

function leaderboardRow(lb, featured) {
  if (lb.loading) return 'Tuning…';
  if (lb.noSignal) return 'No signal';
  if (!lb.leader) return lb.pool ? `${lb.pool} pool` : 'No standings yet';
  const leads = `${lb.leader.name} leads · ${lb.leader.wagered}`;
  return featured === 'hunts' && lb.pool ? `${lb.pool} pool · ${leads}` : leads;
}

function roundNext(feature) {
  if (feature.mode === 'open') return `Predictions open · ${feature.guessCount} in`;
  if (feature.mode === 'locked') return `Entries closed · ${plural(feature.guessCount, 'guess', 'guesses')}`;
  return 'No round open';
}

function huntsRow(featured, feature, hunts) {
  if (featured === 'hunts' && feature.kind === 'live') {
    const { stats, hunt } = feature;
    const parts = [`${huntTypeLabel(hunt.huntType)} hunt`];
    if (stats.bonuses.length) parts.push(`${stats.openedCount}/${stats.bonusCount} opened`);
    if (stats.wonSoFar != null) parts.push(`${formatMoney(stats.wonSoFar, feature.currency)} won`);
    return { now: parts.join(' · '), next: roundNext(feature), lit: true, live: true, tone: null };
  }
  if (featured === 'hunts') {
    const state = feature.mode === 'open' ? 'Predictions open' : 'Entries closed';
    return { now: `${feature.round.title} · ${state}`, next: `${plural(feature.guessCount, 'guess', 'guesses')} in`, lit: true, live: false, tone: null };
  }
  if (hunts.loading) return { now: 'Tuning…', next: '—', lit: false, live: false, tone: null };
  const last = (hunts.recent || [])[0];
  if (!last) {
    return hunts.error
      ? { now: 'No signal', next: '—', lit: false, live: false, tone: null }
      : { now: 'No hunts yet', next: 'No round open', lit: false, live: false, tone: null };
  }
  const result = profitLoss(last);
  return {
    now: result != null ? `Last hunt ${signedMoney(result, last.currency)}` : 'Last hunt',
    next: 'No round open',
    lit: false,
    live: false,
    tone: result == null ? null : result < 0 ? 'loss' : 'signal',
  };
}

const STATIC_ROWS = {
  'bonus-battle': 'Two bonuses, one winner. Call it.',
  wheel: 'Spin up a random slot to play next.',
};

export function guideRows({ featured, feature, hunts, leaderboard, resets }) {
  const lb = leaderboardFacts(leaderboard);
  return GAMBA_TOOLS.map((tool) => {
    const head = { id: tool.id, channel: channelLabel(tool), label: tool.label, path: tool.path };
    if (tool.id === 'leaderboard') {
      return { ...head, now: leaderboardRow(lb, featured), next: resets || '—', lit: false, live: false, tone: null };
    }
    if (tool.id === 'hunts') return { ...head, ...huntsRow(featured, feature, hunts || {}) };
    return { ...head, now: STATIC_ROWS[tool.id], next: 'Any time', lit: false, live: false, tone: null };
  });
}
```

Note: `signedMoney` uses the true minus sign `−` (U+2212) for losses; the tests expect it.

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern=gamba/__tests__/guide`
Expected: PASS. If a money string differs (e.g. `formatMoney` without a currency gives `$252.00`), fix the code, not the expectation, unless the expectation contradicts `formatMoney`'s documented format.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/components/gamba/guide.js src/components/gamba/__tests__/guide.test.js && git commit -m "feat(gamba): guide derivations for the takeover, leaderboard and listings"
```

---

### Task 5: The featured monitor

**Files:**
- Create: `src/components/gamba/FeaturedMonitor.js`
- Test: `src/components/gamba/__tests__/FeaturedMonitor.test.js`

**Interfaces:**
- Consumes: `Monitor` (`onAir/Monitor.js`: props `tint`, `status`, `channel`, `clock`, `channelKey`, `readout`, `chyron`, `label`); `Chip`; `OnAirButton` with `as`; stage parts (Task 3); `formatAvg`, `formatAvgFigure`; `tickerItems` (`hunts/huntBoard.js`); `formatClock` (`hunts/huntTime.js`); `formatMoney`; `huntTypeLabel`; `progressModel`, `leaderboardFacts` (Task 4); `channelLabel`, `GAMBA_TOOLS`.
- Produces: default `FeaturedMonitor({ featured, feature, leaderboard, resets, now, ready })`. One `<Monitor label="Featured channel">` whose `channelKey` is `ready ? featured : null`, so the channel-change static plays when the takeover starts or ends, never on first load.

- [ ] **Step 1: Write the failing test**

Create `src/components/gamba/__tests__/FeaturedMonitor.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FeaturedMonitor from '../FeaturedMonitor';
import { huntFeature } from '../guide';

const NOW = new Date(2026, 9, 1, 21, 58).getTime();
const LIVE_HUNT = {
  id: 'h9', status: 'live', huntType: 'community', currency: null, pot: 2421.82, bonusCount: 2, totalWon: null,
  bonuses: [{ slot: 'Wanted', bet: 1, win: 212, multiplier: 212 }, { slot: 'Dog', bet: 1, win: null, multiplier: null }],
};
const ROUND = (status) => ({
  id: 'r1', title: 'Thursday comm hunt', status, acceptPredictions: true, entryCount: 6, source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h9', totalCost: 2421.82, currency: null, bonusCount: 2 },
});
const HUNTS = (over = {}) => ({ live: null, recent: [], loading: false, error: null, ...over });
const BOARD = {
  players: [{ maskedUsername: 'ab***z', wagered: 41203, prize: 2000 }, { maskedUsername: 'kr***9', wagered: 34333, prize: 1000 }],
  prizePool: 5000, periodLabel: 'OCTOBER', endsAt: 1, isLoading: false, error: null,
};

function show(props) {
  return render(
    <MemoryRouter>
      <FeaturedMonitor leaderboard={BOARD} resets="Resets in 27d 04h" now={NOW} ready {...props} />
    </MemoryRouter>
  );
}

test('live hunt with predictions open: LIVE light, won so far, chip and the guess call to action', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('open') }) });
  expect(screen.getByRole('region', { name: 'Featured channel' })).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
  expect(screen.getByText(/Community hunt · Opening bonuses/)).toBeTruthy();
  expect(screen.getByText('Won so far · 1/2 opened')).toBeTruthy();
  // The chip ("Predictions open · 6 in"); the chyron also says "Predictions open".
  expect(screen.getByText(/Predictions open ·/)).toBeTruthy();
  const cta = screen.getByRole('link', { name: 'Get your guess in' });
  expect(cta.getAttribute('href')).toBe('/gamba/hunts');
  expect(cta.className).toContain('from-onair-viewer');
});

test('live hunt after its round settled: no chip, watch call to action', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('settled') }) });
  expect(screen.queryByText(/Predictions open ·/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Watch the opening' }).getAttribute('href')).toBe('/gamba/hunts');
});

test('a huge ARS amount sets the code small beside the figure', () => {
  const hunts = HUNTS({ live: { ...LIVE_HUNT, currency: 'ARS', bonuses: [{ slot: 'X', bet: 1, win: 1539232.7, multiplier: 9 }] } });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: null }) });
  expect(screen.getByText('ARS').className).toContain('text-[0.45em]');
});

test('pre-hunt: the question, no LIVE light, guess call to action', () => {
  show({ featured: 'hunts', feature: huntFeature({ hunts: HUNTS(), round: ROUND('open') }) });
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
  expect(screen.queryByText('Live')).toBeNull();
  expect(screen.getByRole('link', { name: 'Get your guess in' })).toBeTruthy();
});

test('leaderboard: pool, leader, resets clock, standings chyron and the standings link', () => {
  show({ featured: 'leaderboard', feature: null });
  expect(screen.getByText(/CH 01 · Leaderboard/)).toBeTruthy();
  expect(screen.getByText('5,000')).toBeTruthy();
  expect(screen.getByText('ab***z · $41,203')).toBeTruthy();
  expect(screen.getAllByText(/1 ab\*\*\*z \$41,203/).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: 'View standings' }).getAttribute('href')).toBe('/gamba/leaderboard');
});

test('leaderboard: a new month shows a dash for the pool', () => {
  show({ featured: 'leaderboard', feature: null, leaderboard: { ...BOARD, players: [], prizePool: 0 } });
  expect(screen.getByText('—')).toBeTruthy();
});

test('leaderboard: a failed read shows No signal', () => {
  show({ featured: 'leaderboard', feature: null, leaderboard: { ...BOARD, players: [], error: 'HTTP 502' } });
  expect(screen.getByRole('heading', { name: 'No signal' })).toBeTruthy();
});

test('the static plays when the takeover starts, never on first load', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  const feature = huntFeature({ hunts, round: ROUND('open') });
  const view = (featured, ready) => (
    <MemoryRouter>
      <FeaturedMonitor featured={featured} feature={featured === 'hunts' ? feature : null} leaderboard={BOARD} resets={null} now={NOW} ready={ready} />
    </MemoryRouter>
  );
  const { rerender } = render(view('leaderboard', false));
  rerender(view('leaderboard', true));
  expect(screen.queryByTestId('onair-static')).toBeNull();
  rerender(view('hunts', true));
  expect(screen.getByTestId('onair-static')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern=gamba/__tests__/FeaturedMonitor`
Expected: FAIL (`Cannot find module '../FeaturedMonitor'`).

- [ ] **Step 3: Write the implementation**

Create `src/components/gamba/FeaturedMonitor.js`:

```js
import { Link } from 'react-router-dom';
import Monitor from '../onAir/Monitor';
import Chip from '../onAir/Chip';
import OnAirButton from '../onAir/OnAirButton';
import { Chips, Eyebrow, Hero, HeroRow, Question, Stage } from '../hunts/MonitorStage';
import { formatAvg, formatAvgFigure, signedMoney } from '../hunts/huntStats';
import { tickerItems } from '../hunts/huntBoard';
import { formatClock } from '../hunts/huntTime';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel } from '../../utils/huntFormat';
import { GAMBA_TOOLS, channelLabel } from '../../data/gambaTools';
import { leaderboardFacts, progressModel } from './guide';

// The guide's featured monitor (spec Part 4): one Monitor that shows Hunts
// while it is on air and the leaderboard otherwise. One instance, so the
// channel-change static plays when the takeover starts or ends.

const CH = Object.fromEntries(GAMBA_TOOLS.map((t) => [t.id, channelLabel(t)]));
const TAGS = {
  open: { tag: 'Open', tone: 'signal', readout: { label: 'Entries open', tone: 'signal' } },
  locked: { tag: 'Closed', tone: 'muted', readout: { label: 'Entries closed', tone: 'muted' } },
  offair: { tag: 'On air', tone: 'muted', readout: { label: 'Hunt live', tone: 'signal' } },
};

function Cta({ ghost, to, children }) {
  return (
    <div className="mt-2 flex justify-center">
      <OnAirButton as={Link} to={to} variant={ghost ? 'ghost' : 'viewer'} size="sm" className="min-h-11">
        {children}
      </OnAirButton>
    </div>
  );
}

// One notch per bonus (opened in signal-deep), or a bar past 60 bonuses.
// Set dressing: the opened count is in the hero's label.
function Progress({ model }) {
  if (!model) return null;
  if (model.style === 'bar') {
    return (
      <div className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-onair-ink-7" aria-hidden="true">
        <div className="h-full rounded-full bg-onair-signal-deep" style={{ width: `${(model.opened / model.total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-xl gap-1" aria-hidden="true" data-testid="hunt-notches">
      {Array.from({ length: model.total }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-full ${i < model.opened ? 'bg-onair-signal-deep' : 'bg-onair-ink-7'}`} />
      ))}
    </div>
  );
}

function RoundChip({ feature }) {
  if (feature.mode === 'open') {
    return (
      <Chip tone="signal">
        Predictions open · <b>{feature.guessCount}</b> in
      </Chip>
    );
  }
  if (feature.mode === 'locked') {
    return (
      <Chip>
        Entries closed · <b>{feature.guessCount}</b> {feature.guessCount === 1 ? 'guess' : 'guesses'}
      </Chip>
    );
  }
  return null;
}

function LiveHuntScreen({ feature, money }) {
  const { stats, hunt } = feature;
  const opened = stats.bonuses.length ? ` · ${stats.openedCount}/${stats.bonusCount} opened` : '';
  const side = [
    stats.startCost != null && { label: 'Start cost', value: money(stats.startCost) },
    stats.stillNeedAvg != null && { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg) },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{huntTypeLabel(hunt.huntType)} hunt · Opening bonuses</Eyebrow>}>
      <HeroRow hero={<Hero text={money(stats.wonSoFar)} label={`Won so far${opened}`} />} side={side} />
      <Progress model={progressModel(stats)} />
      <Chips>
        <RoundChip feature={feature} />
      </Chips>
      {feature.mode === 'open' ? <Cta to="/gamba/hunts">Get your guess in</Cta> : <Cta ghost to="/gamba/hunts">Watch the opening</Cta>}
    </Stage>
  );
}

function PreHuntScreen({ feature, money }) {
  const { stats, round } = feature;
  const hero =
    stats.requiredAvg != null ? (
      <Hero text={formatAvgFigure(stats.requiredAvg)} suffix="x" label="Required avg to break even" />
    ) : stats.startCost != null ? (
      <Hero text={money(stats.startCost)} label="Break-even" />
    ) : null;
  return (
    <Stage eyebrow={<Eyebrow tone="signal">{round.title} · {feature.mode === 'open' ? 'Predictions open' : 'Entries closed'}</Eyebrow>}>
      <Question>What does the hunt pay?</Question>
      {hero && <HeroRow hero={hero} side={[]} />}
      <Chips>
        {stats.bonusCount ? (
          <Chip>
            <b>{stats.bonusCount}</b> bonuses
          </Chip>
        ) : null}
        <RoundChip feature={feature} />
      </Chips>
      {feature.mode === 'open' ? <Cta to="/gamba/hunts">Get your guess in</Cta> : <Cta ghost to="/gamba/hunts">See the round</Cta>}
    </Stage>
  );
}

function LeaderboardScreen({ facts }) {
  if (facts.loading) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">Tuning…</Eyebrow>}>
        <Question>Monthly leaderboard</Question>
      </Stage>
    );
  }
  if (facts.noSignal) {
    return (
      <Stage eyebrow={<Eyebrow tone="muted">No signal</Eyebrow>}>
        <Question>No signal</Question>
        <p className="text-sm text-onair-ink-4">We can’t reach the standings right now. Refresh to retune.</p>
      </Stage>
    );
  }
  const side = [
    facts.leader && { label: 'Leader', value: `${facts.leader.name} · ${facts.leader.wagered}` },
    facts.leader && facts.leader.prize && { label: '1st prize', value: facts.leader.prize },
    facts.lead && { label: 'Lead', value: facts.lead },
  ].filter(Boolean);
  return (
    <Stage eyebrow={<Eyebrow tone="muted">Code BEAN on Rainbet · Monthly pool</Eyebrow>}>
      <HeroRow hero={<Hero text={facts.pool || '—'} label={facts.period || 'Current period'} />} side={side} />
      <Cta ghost to="/gamba/leaderboard">View standings</Cta>
    </Stage>
  );
}

export default function FeaturedMonitor({ featured, feature, leaderboard, resets, now, ready }) {
  if (featured === 'hunts' && feature) {
    const money = (v) => formatMoney(v, feature.currency);
    const signed = (v) => signedMoney(v, feature.currency);
    const tags = TAGS[feature.mode] || TAGS.offair;
    const items = tickerItems(feature.mode, {
      stats: feature.stats,
      guessCount: feature.guessCount,
      prize: feature.prize,
      isLive: feature.kind === 'live',
      money,
      signed,
    });
    return (
      <Monitor
        label="Featured channel"
        tint="signal"
        status={feature.kind === 'live' ? 'live' : null}
        channel={`${CH.hunts} · Hunts`}
        clock={formatClock(now)}
        channelKey={ready ? 'hunts' : null}
        readout={{ channel: CH.hunts, ...tags.readout }}
        chyron={items.length ? { tag: tags.tag, tone: tags.tone, items } : null}
      >
        <div className="[--hero-share:0.9] sm:[--hero-share:0.55]" style={{ containerType: 'inline-size' }}>
          {feature.kind === 'live' ? <LiveHuntScreen feature={feature} money={money} /> : <PreHuntScreen feature={feature} money={money} />}
        </div>
      </Monitor>
    );
  }

  const facts = leaderboardFacts(leaderboard);
  const clock = resets ? { long: resets.toUpperCase(), short: resets.toUpperCase() } : null;
  const standings = facts.standings || [];
  return (
    <Monitor
      label="Featured channel"
      tint="neutral"
      status={null}
      channel={`${CH.leaderboard} · Leaderboard${facts.period ? ` · ${facts.period}` : ''}`}
      clock={clock}
      channelKey={ready ? 'leaderboard' : null}
      readout={{ channel: CH.leaderboard, label: facts.noSignal ? 'No signal' : 'Standings', tone: 'muted' }}
      chyron={standings.length ? { tag: 'Standings', tone: 'muted', items: standings } : null}
    >
      <div className="[--hero-share:0.9] sm:[--hero-share:0.55]" style={{ containerType: 'inline-size' }}>
        <LeaderboardScreen facts={facts} />
      </div>
    </Monitor>
  );
}
```

Note: both branches return a `<Monitor>` at the same position in the tree, so React keeps one instance and `useChannelSwitch` sees the `channelKey` change. Keep it that way (don't wrap one branch in an extra element).

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern="(gamba|onAirContract)"`
Expected: PASS (the contract test now scans this file: no orange, tracked mono, no `text-base`).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/components/gamba/FeaturedMonitor.js src/components/gamba/__tests__/FeaturedMonitor.test.js && git commit -m "feat(gamba): featured monitor with the Hunts takeover"
```

---

### Task 6: The "What's on" listings

**Files:**
- Create: `src/components/gamba/GuideListings.js`
- Test: `src/components/gamba/__tests__/GuideListings.test.js`

**Interfaces:**
- Consumes: `Panel` (`onAir/Panel.js`: `as`, `radius`, `lit`), `StatusLight`, `MONO`, `FOCUS`; rows from `guideRows` (Task 4).
- Produces: default `GuideListings({ rows })` → a `<ul>` of link rows (`Panel as={Link}` with `radius="row"` and `lit="signal"` when `row.lit`).

- [ ] **Step 1: Write the failing test**

Create `src/components/gamba/__tests__/GuideListings.test.js`:

```js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuideListings from '../GuideListings';

const ROWS = [
  { id: 'leaderboard', channel: 'CH 01', label: 'Leaderboard', path: '/gamba/leaderboard', now: 'ab***z leads · $41,203', next: 'Resets in 27d 04h', lit: false, live: false, tone: null },
  { id: 'hunts', channel: 'CH 02', label: 'Hunts', path: '/gamba/hunts', now: 'Community hunt · 2/4 opened', next: 'Predictions open · 6 in', lit: true, live: true, tone: null },
  { id: 'bonus-battle', channel: 'CH 03', label: 'Bonus Battle', path: '/gamba/bonus-battle', now: 'Last hunt −$60.00', next: 'Any time', lit: false, live: false, tone: 'loss' },
];

const renderRows = () =>
  render(
    <MemoryRouter>
      <GuideListings rows={ROWS} />
    </MemoryRouter>
  );

test('each row is one link to its tool', () => {
  renderRows();
  expect(screen.getByRole('link', { name: /CH 01\s*Leaderboard/ }).getAttribute('href')).toBe('/gamba/leaderboard');
  expect(screen.getByRole('link', { name: /CH 02\s*Hunts/ }).getAttribute('href')).toBe('/gamba/hunts');
});

test('the lit row carries the signal wash and the LIVE light; others rest', () => {
  renderRows();
  const hunts = screen.getByRole('link', { name: /CH 02\s*Hunts/ });
  expect(hunts.getAttribute('data-lit')).toBe('signal');
  expect(hunts.textContent).toContain('Live');
  const board = screen.getByRole('link', { name: /CH 01\s*Leaderboard/ });
  expect(board.getAttribute('data-lit')).toBeNull();
  expect(board.textContent).not.toContain('Live');
});

test('a loss reads in the loss ink', () => {
  renderRows();
  expect(screen.getByText('Last hunt −$60.00').className).toContain('text-onair-loss');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern=gamba/__tests__/GuideListings`
Expected: FAIL (`Cannot find module '../GuideListings'`).

- [ ] **Step 3: Write the implementation**

Create `src/components/gamba/GuideListings.js`:

```js
import { Link } from 'react-router-dom';
import Panel from '../onAir/Panel';
import StatusLight from '../onAir/StatusLight';
import { FOCUS, MONO } from '../onAir/classes';

const TONE = { signal: 'text-onair-signal-light', loss: 'text-onair-loss' };

// "What's on": one listing row per tool, the whole row a link. The lit row is
// the channel on the featured monitor (Panel's signal wash); only the LIVE
// light glows.
export default function GuideListings({ rows }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Panel
            as={Link}
            to={row.path}
            radius="row"
            lit={row.lit ? 'signal' : null}
            className={`grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 px-4 py-4 transition-[filter] duration-150 hover:brightness-110 motion-reduce:transition-none sm:grid-cols-[5.5rem_12rem_1fr_15rem_1.5rem] sm:px-[18px] ${FOCUS}`}
          >
            <span className={`${MONO} text-[0.8125rem] font-bold tracking-[0.15em] ${row.lit ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
              {row.channel}
            </span>
            <span className="text-xl font-extrabold text-onair-ink-1">{row.label}</span>
            <span className="col-span-full flex flex-wrap items-center gap-2.5 text-[0.9375rem] text-onair-ink-3 sm:col-span-1">
              {row.live && <StatusLight status="live" />}
              <span className={TONE[row.tone] || ''}>{row.now}</span>
            </span>
            <span className="col-span-full text-sm text-onair-ink-4 sm:col-span-1">{row.next}</span>
            <span aria-hidden="true" className="hidden text-[1.0625rem] text-onair-ink-5 sm:block">
              →
            </span>
          </Panel>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern="(gamba|onAirContract)"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/components/gamba/GuideListings.js src/components/gamba/__tests__/GuideListings.test.js && git commit -m "feat(gamba): What's on listings, one link row per channel"
```

---

### Task 7: The guide hub, its data, fixtures, and the swap

**Files:**
- Create: `src/components/gamba/useGuideData.js`
- Create: `src/components/gamba/guideFixtures.js`
- Create: `src/components/gamba/GambaGuide.js`
- Modify: `src/pages/GambaPage.js` (hub → `GambaGuide`)
- Modify: `src/pages/__tests__/GambaPage.test.js` (mock `GambaGuide` instead of `GambaHub`)
- Delete: `src/components/GambaHub.js`
- Test: `src/components/gamba/__tests__/GambaGuide.test.js`

**Interfaces:**
- Consumes: `useLeaderboardData` (named, `hooks/useLeaderboardData.js`), `useCountdown` (named, `hooks/useCountdown.js`), `useCommunityHunts` (default), `usePredictionRound` (default, `hunts/usePredictionRound.js` → `{ round, error }`), `useNow(intervalMs, enabled)` (default, `hunts/useNow.js`); Tasks 4–6.
- Produces: default `useGuideData() → GuideData`; `GUIDE_FIXTURES` (`live`, `prehunt`, `offair`, `noleaderboard`), each a `GuideData` plus `now`; `GuideView({ data, now })` (named) and default `GambaGuide()`.

- [ ] **Step 1: Write the failing test**

Create `src/components/gamba/__tests__/GambaGuide.test.js`:

```js
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaGuide, { GuideView } from '../GambaGuide';
import { GUIDE_FIXTURES } from '../guideFixtures';
import useGuideData from '../useGuideData';

jest.mock('../useGuideData', () => jest.fn());

const view = (key) =>
  render(
    <MemoryRouter>
      <GuideView data={GUIDE_FIXTURES[key]} now={GUIDE_FIXTURES[key].now} />
    </MemoryRouter>
  );

const listings = () => within(screen.getByRole('region', { name: "What's on" }));

test('live fixture: Hunts holds the monitor and its row is lit', () => {
  view('live');
  expect(screen.getByRole('region', { name: 'Featured channel' }).textContent).toContain('Hunts');
  expect(listings().getByRole('link', { name: /CH 02\s*Hunts/ }).getAttribute('data-lit')).toBe('signal');
  expect(listings().getAllByRole('link')).toHaveLength(4);
});

test('pre-hunt fixture: the question on the monitor', () => {
  view('prehunt');
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
});

test('off-air fixture: the leaderboard holds the monitor, nothing lit', () => {
  view('offair');
  expect(screen.getByRole('link', { name: 'View standings' })).toBeTruthy();
  listings()
    .getAllByRole('link')
    .forEach((a) => expect(a.getAttribute('data-lit')).toBeNull());
});

test('no-leaderboard fixture: No signal on the monitor', () => {
  view('noleaderboard');
  expect(screen.getByRole('heading', { name: 'No signal' })).toBeTruthy();
});

test('live data path: GambaGuide reads useGuideData', () => {
  useGuideData.mockReturnValue(GUIDE_FIXTURES.offair);
  render(
    <MemoryRouter>
      <GambaGuide />
    </MemoryRouter>
  );
  expect(useGuideData).toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'View standings' })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern=gamba/__tests__/GambaGuide`
Expected: FAIL (`Cannot find module '../GambaGuide'`).

- [ ] **Step 3: Write the implementation**

Create `src/components/gamba/useGuideData.js`:

```js
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import { useCountdown } from '../../hooks/useCountdown';
import useCommunityHunts from '../../hooks/useCommunityHunts';
import usePredictionRound from '../hunts/usePredictionRound';

// Everything the guide hub reads: the bean leaderboard poll, its reset
// countdown, the communityhunts overview poll (60s, server-cached 30s) and the
// latest prediction round (one Firestore listener, limit 1).
export default function useGuideData() {
  const leaderboard = useLeaderboardData();
  const countdown = useCountdown(leaderboard.endsAt);
  const hunts = useCommunityHunts();
  const { round, error: roundError } = usePredictionRound();
  return { leaderboard, countdown, hunts, round, roundError };
}
```

Create `src/components/gamba/guideFixtures.js`:

```js
// Dev-only fixtures for /gamba?fixture=live|prehunt|offair|noleaderboard.
// GambaGuide requires this module only outside production builds.

const NOW = new Date(2026, 9, 1, 21, 58).getTime();

const BOARD = {
  players: [
    { maskedUsername: 'ab***z', wagered: 41203, prize: 2000 },
    { maskedUsername: 'kr***9', wagered: 34333, prize: 1000 },
    { maskedUsername: 'vo***t', wagered: 29120, prize: 500 },
    { maskedUsername: 'sk***y', wagered: 18452, prize: 250 },
    { maskedUsername: 'xi***r', wagered: 12010, prize: 100 },
  ],
  prizePool: 5000,
  periodLabel: 'OCTOBER',
  endsAt: NOW + 27 * 86400000 + 4 * 3600000,
  isLoading: false,
  error: null,
};
const COUNTDOWN = { days: 27, hours: 4, minutes: 0, seconds: 0, isOver: false };

const bonus = (slot, bet, win) => ({ slot, bet, win, multiplier: win == null ? null : win / bet, thumb: null });
const LIVE_HUNT = {
  id: 'h9',
  status: 'live',
  huntType: 'community',
  currency: null,
  startedAt: '2026-10-01T23:30:00.000Z',
  endedAt: null,
  bonusCount: 8,
  pot: 2421.82,
  totalWon: null,
  averageMultiple: null,
  bonuses: [
    bonus('Wanted Dead or a Wild', 0.6, 127.2),
    bonus('Sugar Rush 1000', 0.6, 24),
    bonus('Gates of Olympus', 0.6, 61.8),
    bonus('The Dog House', 0.6, 3),
    bonus('Big Bass Splash', 0.6, null),
    bonus('Fruit Party', 0.6, null),
    bonus('Starlight Princess', 0.6, null),
    bonus('Sweet Bonanza', 0.6, null),
  ],
};
const LAST_HUNT = { id: 'h8', status: 'archived', huntType: 'community', currency: null, bonusCount: 30, pot: 1800, totalWon: 2175.7, averageMultiple: 72.5, endedAt: '2026-09-30T04:10:00.000Z' };
const ROUND = (status) => ({
  id: 'r7',
  title: 'Thursday comm hunt',
  status,
  acceptPredictions: true,
  entryCount: 6,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h9', totalCost: 2421.82, currency: null, bonusCount: 8 },
  rewards: { tiers: [{ place: 1, tickets: 500, prize: null }] },
});

export const GUIDE_FIXTURES = {
  live: { now: NOW, leaderboard: BOARD, countdown: COUNTDOWN, hunts: { live: LIVE_HUNT, recent: [LAST_HUNT], loading: false, error: null }, round: ROUND('open') },
  prehunt: { now: NOW, leaderboard: BOARD, countdown: COUNTDOWN, hunts: { live: null, recent: [LAST_HUNT], loading: false, error: null }, round: ROUND('open') },
  offair: { now: NOW, leaderboard: BOARD, countdown: COUNTDOWN, hunts: { live: null, recent: [LAST_HUNT], loading: false, error: null }, round: null },
  noleaderboard: {
    now: NOW,
    leaderboard: { ...BOARD, players: [], prizePool: 0, error: 'HTTP 502' },
    countdown: { unknown: true },
    hunts: { live: null, recent: [LAST_HUNT], loading: false, error: null },
    round: null,
  },
};
```

Create `src/components/gamba/GambaGuide.js`:

```js
import { useState } from 'react';
import FeaturedMonitor from './FeaturedMonitor';
import GuideListings from './GuideListings';
import useGuideData from './useGuideData';
import useNow from '../hunts/useNow';
import { MONO } from '../onAir/classes';
import { formatResets, guideRows, huntFeature, pickFeatured } from './guide';

// /gamba: the guide channel (CH 00). The featured monitor, then tonight's
// listings. Hunts takes the monitor while it is on air (spec Part 4).
export function GuideView({ data, now }) {
  const featured = pickFeatured(data);
  const feature = featured === 'hunts' ? huntFeature(data) : null;
  const resets = formatResets(data.countdown);
  const rows = guideRows({ featured, feature, hunts: data.hunts, leaderboard: data.leaderboard, resets });
  const ready = !data.hunts.loading && data.round !== undefined && !data.leaderboard.isLoading;
  return (
    <div className="font-onair">
      <FeaturedMonitor featured={featured} feature={feature} leaderboard={data.leaderboard} resets={resets} now={now} ready={ready} />
      <section aria-labelledby="gamba-whats-on" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <h2 id="gamba-whats-on" className="text-2xl font-extrabold text-onair-ink-1">
            What's on
          </h2>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Tonight's listings</span>
        </div>
        <GuideListings rows={rows} />
      </section>
    </div>
  );
}

function LiveGuide() {
  const data = useGuideData();
  const now = useNow(30 * 1000);
  return <GuideView data={data} now={now} />;
}

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba?fixture=live|prehunt|offair|noleaderboard renders the hub
  // from fixtures. Webpack drops this branch, and the module with it, from
  // production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('./guideFixtures').GUIDE_FIXTURES[key] || null;
  };
}

export default function GambaGuide() {
  const [fixture] = useState(readFixture);
  return fixture ? <GuideView data={fixture} now={fixture.now} /> : <LiveGuide />;
}
```

In `src/pages/GambaPage.js`:
- replace `import GambaHub from '../components/GambaHub';` with `import GambaGuide from '../components/gamba/GambaGuide';`
- replace `{!toolId && <GambaHub setPage={(id) => navigate(`/${id}`)} />}` with `{!toolId && <GambaGuide />}`
- remove `useNavigate` from the import and the `const navigate = useNavigate();` line.

In `src/pages/__tests__/GambaPage.test.js`: change the mock line to `jest.mock('../../components/gamba/GambaGuide', () => () => <p>gamba hub</p>);` (the assertions keep reading "gamba hub").

Delete the old hub: `git rm src/components/GambaHub.js` (only GambaPage imported it; `grep -rn "GambaHub" src` must print nothing afterwards).

- [ ] **Step 4: Run tests and the build**

Run: `CI=true npm test -- --testPathPattern="(gamba|pages/__tests__/GambaPage|onAirContract)"`
Expected: PASS.
Run: `npm run build` → "Compiled successfully." Then confirm the fixtures are not in the production bundle: `grep -l "noleaderboard" build/static/js/*.js` prints nothing.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add src/components/gamba src/pages/GambaPage.js src/pages/__tests__/GambaPage.test.js && git commit -m "feat(gamba): the guide hub replaces the old hub"
```

(The `git rm` in Step 3 already staged the deletion.)

---

### Task 8: Docs, gates, verification and the PR

**Files:**
- Modify: `CLAUDE.md`, `DESIGN.md`

**Interfaces:** none (consumes the finished branch).

The implementer does Steps 1–3 and the docs commit. The controller does Steps 4–6 (browser check, design and accessibility reviews, PR), as in PR 1.

- [ ] **Step 1: CLAUDE.md**

In "Routing & Shell", replace the sentence about `/gamba/*` using `GambaPage` "as an outlet with sub-route ids the page reads from the URL" with:

```markdown
- `/gamba/*` renders `GambaPage`: the Gamba tuner (`src/components/gamba/GambaTuner.js`, channels CH 00 Hub … CH 04 Slot Picker from `GAMBA_CHANNELS`) above the guide hub or a tool; an unknown tool id redirects to `/gamba`. The tuner remembers its last channel in a module variable because `App.js` remounts routes on every pathname change (`ErrorBoundary key`). The hub (`gamba/GambaGuide.js`) is a featured `Monitor` that Hunts takes over while a hunt is live or a round is open/locked (else the leaderboard), plus "What's on" link rows; pure rules in `gamba/guide.js`, data in `useGuideData`. Dev: `/gamba?fixture=live|prehunt|offair|noleaderboard`.
```

(Read the section first; if the old sentence is phrased differently, replace the `/gamba/*` clause by content.)

- [ ] **Step 2: DESIGN.md**

In §7, after the "Navigation" subsection, add:

```markdown
### Gamba tuner and guide

- **The tuner is labelled channels under a tuning band.** The segments are real links; the band and needle are set dressing. The needle slides about 300ms from the previous channel and jumps under reduced motion. ◀ ▶ step through the channels and wrap. Below `md` the stepper and a "CH 02 Hunts · 3 of 5" readout carry it.
- **The hub is the guide channel.** One featured monitor: Hunts while a hunt is live or a round is open or locked, the leaderboard otherwise. The channel-change static plays when the takeover starts or ends, never on first load.
- **What's on.** One link row per tool. The lit row is the channel on the monitor; only the LIVE light glows.
```

- [ ] **Step 3: Gates and the docs commit**

Run: `CI=true npm test` (full) and `npm run build`. Both pass.

```bash
test "$(git branch --show-current)" = feat/onair-gamba-guide && git add CLAUDE.md DESIGN.md && git commit -m "docs: the Gamba tuner and guide hub"
```

- [ ] **Step 4 (controller): Browser check**

With `npm start`, check `/gamba` and each tool at about 1440, 1100, 900 and 400 wide, plus every fixture (`?fixture=live|prehunt|offair|noleaderboard`): tuner layout per breakpoint; the needle slides between tools and jumps under emulated reduced motion; the ARS case (temporarily point the live fixture's currency at `ARS` in the browser via the `live` fixture, or eyeball a real ARS hunt) fits a phone; the listings stack on phones; the static plays only on a takeover change; keyboard pass through the tuner, the CTA and the rows.

- [ ] **Step 5 (controller): Reviews**

Dispatch `ui-finish-gate` (against DESIGN.md §7 incl. the new subsection) and `accessibility-auditor` (tuner links/steppers, featured monitor, listing rows) alongside the final whole-branch review; fold their findings into one fix wave.

- [ ] **Step 6 (controller): PR**

Push `feat/onair-gamba-guide` and open a PR against `main` (no Claude attribution) summarising the tuner, the guide hub and the takeover rule, the two deviations above, tests and build results, and deferred items.
