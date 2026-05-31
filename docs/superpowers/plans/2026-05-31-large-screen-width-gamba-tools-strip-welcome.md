# Large-Screen Width + Gamba Tools Strip + Welcome Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen content on large screens (tools wider than marketing), add a home-page gamba-tools channel strip, and add a one-time "first time on the channel?" sign-on card.

**Architecture:** Part 1 is CSS-only `2xl:` overrides on existing `max-w-7xl` containers. Part 2 is a new `HomeGambaTools` component rendering the shared `GAMBA_TOOLS` list as channel cards, mounted in HomePage with a `#gamba-tools` anchor. Part 3 is a new `WelcomeSignOn` overlay card, home-only, gated on the intro being done (a small `introDone` prop threaded App → HomePage) and persisted once in `localStorage`.

**Tech Stack:** React 19, react-router-dom v7, Tailwind, lucide-react. No test harness for page/nav UI — verification is manual + production build.

**Spec:** `docs/superpowers/specs/2026-05-31-large-screen-width-gamba-tools-strip-welcome-design.md`

> **Spec correction (read first):** the spec says the welcome card keys off intro state
> "HomePage already tracks." That is inaccurate — the intro state (`showTVIntro`,
> `tvIntroPlayed` sessionStorage key) lives in `App.js`, not HomePage. This plan threads a
> small `introDone` prop from App → HomePage → WelcomeSignOn instead of polling
> sessionStorage. Everything else in the spec stands.

---

## File Structure

- **Modify (Part 1):** `src/pages/HomePage.js`, `src/pages/VodsPage.js`, `src/pages/GamingPage.js`, `src/pages/GearInteractive.js`, `src/components/StatsTicker.js`, `src/components/HomeLeaderboardCallout.js` → `2xl:max-w-[1440px]`; `src/pages/GambaPage.js` → `2xl:max-w-[1600px]`.
- **Create (Part 2):** `src/components/HomeGambaTools.js`. **Modify:** `src/pages/HomePage.js` (mount it + `#gamba-tools` anchor).
- **Create (Part 3):** `src/components/WelcomeSignOn.js`. **Modify:** `src/App.js` (pass `introDone`), `src/pages/HomePage.js` (accept `introDone`, mount the card).

Part 1 is independent and lands first. Part 2 must precede Part 3 (the card scrolls to Part 2's anchor).

---

## Task 1: Widen marketing containers at 2xl

**Files:**
- Modify: `src/pages/HomePage.js` (3 sites), `src/pages/VodsPage.js`, `src/pages/GamingPage.js`, `src/pages/GearInteractive.js`, `src/components/StatsTicker.js` (3 sites), `src/components/HomeLeaderboardCallout.js`

Every marketing container keeps `max-w-7xl` and gains `2xl:max-w-[1440px]`. The class string is the only change in each.

- [ ] **Step 1: HomePage — three containers**

In `src/pages/HomePage.js`, the three `max-w-7xl mx-auto` containers (around lines 94, 144, 245) each become `max-w-7xl 2xl:max-w-[1440px] mx-auto`. Use replace-all on the exact class fragment:

Replace each occurrence of `className="max-w-7xl mx-auto"` with `className="max-w-7xl 2xl:max-w-[1440px] mx-auto"`. (All three HomePage occurrences are the identical string `max-w-7xl mx-auto`.)

- [ ] **Step 2: VodsPage and GamingPage**

In `src/pages/VodsPage.js` line 119: `className="relative max-w-7xl mx-auto"` → `className="relative max-w-7xl 2xl:max-w-[1440px] mx-auto"`.

In `src/pages/GamingPage.js` line 147: `className="relative max-w-7xl mx-auto"` → `className="relative max-w-7xl 2xl:max-w-[1440px] mx-auto"`.

- [ ] **Step 3: GearInteractive**

In `src/pages/GearInteractive.js` line 78: `className="max-w-7xl mx-auto space-y-12"` → `className="max-w-7xl 2xl:max-w-[1440px] mx-auto space-y-12"`.

- [ ] **Step 4: StatsTicker — three containers**

In `src/components/StatsTicker.js`:
- Line 110: `className="max-w-7xl mx-auto px-6 sm:px-10 pt-10 sm:pt-12 pb-6 sm:pb-8"` → prepend `2xl:max-w-[1440px]` after `max-w-7xl`: `className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-6 sm:px-10 pt-10 sm:pt-12 pb-6 sm:pb-8"`.
- Line 132: `className="max-w-7xl mx-auto sm:flex sm:justify-between sm:divide-x sm:divide-white/5 overflow-x-auto sm:overflow-visible scrollbar-hide motion-safe:sm:overflow-visible"` → insert `2xl:max-w-[1440px]` after `max-w-7xl`.
- Line 158: `className="max-w-7xl mx-auto px-6 sm:px-10 pb-3 text-[10px] sm:text-xs font-bold tracking-eyebrow-lg uppercase text-red-destructive font-mono"` → insert `2xl:max-w-[1440px]` after `max-w-7xl`.

- [ ] **Step 5: HomeLeaderboardCallout**

In `src/components/HomeLeaderboardCallout.js` line 329: `className="max-w-7xl mx-auto"` → `className="max-w-7xl 2xl:max-w-[1440px] mx-auto"`.

- [ ] **Step 6: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds (Tailwind generates the arbitrary `2xl:max-w-[1440px]` utility; no config change needed).

- [ ] **Step 7: Commit**

```bash
git add src/pages/HomePage.js src/pages/VodsPage.js src/pages/GamingPage.js src/pages/GearInteractive.js src/components/StatsTicker.js src/components/HomeLeaderboardCallout.js
git commit -m "feat: widen marketing containers to 1440px at 2xl"
```

---

## Task 2: Widen GambaPage (tools) at 2xl

**Files:**
- Modify: `src/pages/GambaPage.js`

- [ ] **Step 1: Widen the tools container**

In `src/pages/GambaPage.js` line 272: `className="max-w-7xl mx-auto"` → `className="max-w-7xl 2xl:max-w-[1600px] mx-auto"`.

- [ ] **Step 2: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual width check**

Run: `npm start`, widen the window past 1536px. GambaPage fills to ~1600px, marketing pages to ~1440px, both with less gutter. Narrow below 1536px → identical to before.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GambaPage.js
git commit -m "feat: widen gamba tools container to 1600px at 2xl"
```

---

## Task 3: Build the HomeGambaTools strip

**Files:**
- Create: `src/components/HomeGambaTools.js`

A channel-segment section listing the gamba tools as cards. Reuses `SectionHeader`
(`accent="white"` — it has no purple branch) and the shared `GAMBA_TOOLS` list. Cards
carry the gamba-purple identity. Per-tool copy is keyed by tool id with a generic fallback.

- [ ] **Step 1: Write the component**

Create `src/components/HomeGambaTools.js`:

```jsx
import SectionHeader from './SectionHeader';
import { GAMBA_TOOLS } from '../data/gambaTools';

// One short in-register line per tool (sentence case, voice-rule compliant).
// Keyed by GAMBA_TOOLS id; unknown ids fall back to a generic line.
const TOOL_BLURBS = {
  leaderboard: "See who's climbing the monthly standings.",
  'hunt-tracker': 'Follow the bonus hunt live, bonus by bonus.',
  'bonus-hunts': 'Browse past hunts and how they paid out.',
  wheel: 'Spin up a random slot to play next.',
  suggest: 'Drop a slot for the next hunt.',
};

export default function HomeGambaTools({ setPage }) {
  return (
    <section id="gamba-tools" className="py-16 px-6 sm:px-10">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
        <SectionHeader
          segment="05"
          eyebrow="Back of house · The gamba wing"
          title="The gamba tools"
          accent="white"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMBA_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setPage(`gamba/${tool.id}`)}
                className="group text-left bg-zinc-card border border-white/8 rounded-lg p-4 transition-colors duration-200 hover:border-purple-gamba/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-gamba"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {Icon && (
                    <Icon
                      size={16}
                      className="text-purple-bright"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-sm font-bold tracking-tight text-white-body group-hover:text-white-body">
                    {tool.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto text-white/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-purple-bright"
                  >
                    →
                  </span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  {TOOL_BLURBS[tool.id] || 'Open this tool in the gamba wing.'}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

(No standalone syntax check — `node --check` cannot parse JSX. The CRA build in Task 4
Step 3 is the real validation for this component.)

```bash
git add src/components/HomeGambaTools.js
git commit -m "feat: HomeGambaTools channel strip component"
```

---

## Task 4: Mount HomeGambaTools in HomePage

**Files:**
- Modify: `src/pages/HomePage.js`

- [ ] **Step 1: Import the component**

In `src/pages/HomePage.js`, add after the `SectionHeader` import (line 8):

```js
import HomeGambaTools from '../components/HomeGambaTools';
```

- [ ] **Step 2: Mount it after the leaderboard callout**

Find `<HomeLeaderboardCallout />` (line 139) and add the strip right after it:

```jsx
      <HomeLeaderboardCallout />

      <HomeGambaTools setPage={setPage} />
```

- [ ] **Step 3: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds (this also validates Task 3's JSX).

- [ ] **Step 4: Manual check**

Run: `npm start`, open `/`. The "Segment 05 · Back of house · The gamba tools" section
renders below the leaderboard callout with a card per GAMBA_TOOLS entry. Click each →
routes to `/gamba/<id>` (leaderboard, hunt-tracker, bonus-hunts, wheel, suggest).

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.js
git commit -m "feat: mount gamba tools strip on home page"
```

---

## Task 5: Build the WelcomeSignOn card

**Files:**
- Create: `src/components/WelcomeSignOn.js`

A one-time, home-only sign-on card. Shows when `introDone` is true and the
`gg_welcome_seen` localStorage flag is absent. Dismiss or act → set the flag.

- [ ] **Step 1: Write the component**

Create `src/components/WelcomeSignOn.js`:

```jsx
import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'gg_welcome_seen';

function alreadySeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode) — show, don't crash
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore — non-persisting fallback
  }
}

export default function WelcomeSignOn({ introDone }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);

  // Show once the intro is done, if not seen before.
  useEffect(() => {
    if (introDone && !alreadySeen()) setOpen(true);
  }, [introDone]);

  // Focus the card and wire Esc-to-dismiss while open.
  useEffect(() => {
    if (!open) return undefined;
    cardRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    markSeen();
    setOpen(false);
  };

  const goToTools = () => {
    markSeen();
    setOpen(false);
    const el = document.getElementById('gamba-tools');
    if (el) {
      const reduce =
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label="First time on the channel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-zinc-card border border-emerald-signal/40 rounded-lg p-6 sm:p-8 focus:outline-none"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden rounded-lg"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-3">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-signal"
              aria-hidden="true"
            />
            <span>Channel sign-on</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white-body mb-3">
            First time on the channel?
          </h2>
          <p className="text-sm text-white/65 leading-relaxed mb-6">
            Watch live, dig through the tape, follow the bonus hunts, and climb
            the leaderboard. The gamba tools are part of the show.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
            >
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                Got it
              </span>
            </button>
            <button
              type="button"
              onClick={goToTools}
              className="inline-flex items-center gap-1.5 px-2 py-2.5 text-white/55 hover:text-white-body transition-colors duration-150"
            >
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                Show me the gamba tools
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WelcomeSignOn.js
git commit -m "feat: WelcomeSignOn channel sign-on card component"
```

---

## Task 6: Thread introDone and mount the welcome card

**Files:**
- Modify: `src/App.js`, `src/pages/HomePage.js`

- [ ] **Step 1: Pass introDone from App**

In `src/App.js`, the HomePage element (lines 219-227) gets one more prop. `showTVIntro`
is already in scope. Add `introDone={!showTVIntro}`:

```jsx
              <HomePage
                setPage={(id) => navigate(id === 'home' ? '/' : `/${id}`)}
                channelData={channelData}
                isLive={isLive}
                streamData={streamData}
                loading={loading}
                clips={clips}
                videos={videos}
                introDone={!showTVIntro}
              />
```

- [ ] **Step 2: Accept introDone in HomePage**

In `src/pages/HomePage.js`, add `introDone` to the destructured props (the `export default
function HomePage({ ... })` block starting line 35):

```jsx
export default function HomePage({
  setPage,
  channelData,
  isLive,
  streamData,
  loading,
  clips,
  videos,
  introDone,
}) {
```

(Match the existing prop list; append `introDone` to it. If the real list differs from the
above, just add `introDone,` to whatever is there.)

- [ ] **Step 3: Import and mount the card**

Add the import after the `HomeGambaTools` import (Task 4 Step 1):

```js
import WelcomeSignOn from '../components/WelcomeSignOn';
```

Mount it near the top of HomePage's returned JSX (it's a fixed overlay, so placement in the
tree does not affect layout — put it as the first child of the outer wrapper). Find the
HomePage return's outermost element and add as its first child:

```jsx
      <WelcomeSignOn introDone={introDone} />
```

- [ ] **Step 4: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run: `npm start` (or a preview deploy). In a fresh browser profile (or after running
`localStorage.removeItem('gg_welcome_seen')` in devtools and clearing
`sessionStorage.tvIntroPlayed`), load `/`:
1. The TV static intro plays; when it finishes, the sign-on card appears.
2. "Got it" dismisses it. Reload `/` → the card does not reappear (localStorage flag set).
3. Clear `gg_welcome_seen`, reload, click "Show me the gamba tools" → card dismisses and
   the page smooth-scrolls to the CH 05 strip.
4. Press Esc with the card open → dismisses.
5. Deep-link to `/gamba` → no card (home-only).
6. With OS reduced-motion on → no scanline texture, instant scroll.

- [ ] **Step 6: Commit**

```bash
git add src/App.js src/pages/HomePage.js
git commit -m "feat: mount welcome sign-on card on home page after intro"
```

---

## Final verification

- [ ] **Step 1: Changed file set**

Run: `git diff --name-only HEAD~8 HEAD` (6 task commits + spec + this plan).
Expected code files: `src/pages/HomePage.js`, `src/pages/VodsPage.js`, `src/pages/GamingPage.js`, `src/pages/GearInteractive.js`, `src/pages/GambaPage.js`, `src/components/StatsTicker.js`, `src/components/HomeLeaderboardCallout.js`, `src/components/HomeGambaTools.js`, `src/components/WelcomeSignOn.js`, `src/App.js`. No `tailwind.config.js` change.

- [ ] **Step 2: No Tailwind config change**

Run: `git status` and confirm `tailwind.config.js` is unmodified (arbitrary `2xl:max-w-[...]` values need no config).

- [ ] **Step 3: Production build**

Run: `npx cross-env CI=true npm run build`
Expected: "Compiled successfully", no new ESLint errors.
