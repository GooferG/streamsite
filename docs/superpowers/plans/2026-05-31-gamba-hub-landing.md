# Gamba Hub Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bare `/gamba` show a hub landing (leaderboard hero + tool grid) instead of redirecting into the leaderboard tool.

**Architecture:** Remove the `/gamba` index redirect; `GambaPage` falls back to `activeTool = null` and renders a new `GambaHub` component (no tab strip) when no tool is in the URL. `GambaHub` composes the reused `HomeLeaderboardCallout` (hero) and a generalized `HomeGambaTools` (tool grid). A "Hub" control is added to the tab strip + mobile sheet for getting back.

**Tech Stack:** React 19, react-router-dom v7, Tailwind, lucide-react. No test harness for this UI — verification is manual + production build.

**Spec:** `docs/superpowers/specs/2026-05-31-gamba-hub-landing-design.md`

---

## File Structure

- **Modify** `src/App.js` — remove the `/gamba` index redirect and the now-unused `Navigate` import.
- **Modify** `src/components/HomeGambaTools.js` — generalize: optional wrapper/heading props so it works both as the home strip (defaults unchanged) and inside the hub.
- **Modify** `src/components/HomeLeaderboardCallout.js` — add optional `ctaTarget` / `ctaLabel` props (defaults preserve current behavior).
- **Create** `src/components/GambaHub.js` — composes the hero + tool grid.
- **Modify** `src/pages/GambaPage.js` — `activeTool` falls back to `null`; render `GambaHub` + hide the strip when null; add a "Hub" control to the strip and mobile sheet.

Order: reusable-component generalizations (Tasks 1-2) before `GambaHub` (Task 3) before GambaPage wiring (Task 4) before the redirect removal (Task 5, so the hub exists before bare `/gamba` stops redirecting).

---

## Task 1: Generalize HomeGambaTools

**Files:**
- Modify: `src/components/HomeGambaTools.js`

The home strip hardcodes the section wrapper (`id="gamba-tools"`, home width/padding) and the
`SectionHeader`. Make those configurable so the hub can render the same grid inside its own
container with a different heading. Home-page defaults stay byte-for-byte equivalent.

- [ ] **Step 1: Replace the component signature and wrapper**

In `src/components/HomeGambaTools.js`, replace the component (lines 14-62) with this
prop-driven version. The default prop values reproduce today's home behavior exactly:

```jsx
export default function HomeGambaTools({
  setPage,
  sectionId = 'gamba-tools',
  className = 'py-16 px-6 sm:px-10',
  innerClassName = 'max-w-7xl 2xl:max-w-[1440px] mx-auto',
  segment = '05',
  eyebrow = 'Back of house · The gamba wing',
  title = 'The gamba tools',
}) {
  return (
    <section id={sectionId} className={className}>
      <div className={innerClassName}>
        <SectionHeader
          segment={segment}
          eyebrow={eyebrow}
          title={title}
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

The `TOOL_BLURBS` const and imports above it stay unchanged.

- [ ] **Step 2: Build (validates JSX + that HomePage still type-checks the call)**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds. HomePage calls `<HomeGambaTools setPage={setPage} />` with no new
props, so it uses all defaults — home page unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/HomeGambaTools.js
git commit -m "refactor: make HomeGambaTools wrapper and heading configurable"
```

---

## Task 2: Add configurable CTA to HomeLeaderboardCallout

**Files:**
- Modify: `src/components/HomeLeaderboardCallout.js`

Add optional props so the hub instance can override the CTA target/label later. Defaults
preserve today's behavior (navigate to `/gamba/leaderboard`, "View standings" label).

- [ ] **Step 1: Accept the props**

In `src/components/HomeLeaderboardCallout.js`, change the component signature (line 228):

```jsx
export default function HomeLeaderboardCallout({
  ctaTarget = '/gamba/leaderboard',
  ctaLabel = 'View standings',
} = {}) {
```

- [ ] **Step 2: Use ctaTarget in the click handler**

Find `const handleClick = () => navigate('/gamba/leaderboard');` (line 243) and change it to:

```jsx
  const handleClick = () => navigate(ctaTarget);
```

- [ ] **Step 3: Use ctaLabel in the CTA text**

Find the CTA span `<span>View standings</span>` (around line 468) and replace the literal
with the prop:

```jsx
                  <span>{ctaLabel}</span>
```

- [ ] **Step 4: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds. HomePage renders `<HomeLeaderboardCallout />` with no props →
defaults → unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeLeaderboardCallout.js
git commit -m "feat: configurable CTA target/label on HomeLeaderboardCallout"
```

---

## Task 3: Create the GambaHub component

**Files:**
- Create: `src/components/GambaHub.js`

Composes the leaderboard hero + the tool grid. Takes a `setPage`-style nav callback for the
grid cards. Renders inside GambaPage's existing container, so no outer width here.

- [ ] **Step 1: Write the component**

Create `src/components/GambaHub.js`:

```jsx
import HomeLeaderboardCallout from './HomeLeaderboardCallout';
import HomeGambaTools from './HomeGambaTools';

// The /gamba hub landing: leaderboard hero on top, tool grid below.
// `setPage(id)` matches GambaPage's nav convention (e.g. setPage('gamba/wheel')).
export default function GambaHub({ setPage }) {
  return (
    <div>
      <HomeLeaderboardCallout />
      <HomeGambaTools
        setPage={setPage}
        sectionId="gamba-hub-tools"
        className="pt-4 pb-8"
        innerClassName=""
        segment={null}
        eyebrow="The gamba wing"
        title="Pick a tool"
      />
    </div>
  );
}
```

Notes:
- `HomeLeaderboardCallout` uses its defaults (navigates to `/gamba/leaderboard`), correct
  on the hub.
- The hub passes `innerClassName=""` because it already sits inside GambaPage's
  `max-w-7xl 2xl:max-w-[1600px]` container — no second width wrapper.
- `sectionId="gamba-hub-tools"` avoids a duplicate `id="gamba-tools"` if the home strip is
  ever on the same DOM (it isn't, but ids should be unique per surface).
- `segment={null}` → `SectionHeader` omits the "SEGMENT" prefix (it already guards on
  falsy `segment`: `{segment && (...)}`).

- [ ] **Step 2: Commit (build happens in Task 4 once it's wired)**

```bash
git add src/components/GambaHub.js
git commit -m "feat: GambaHub landing component (hero + tool grid)"
```

---

## Task 4: Wire the hub into GambaPage

**Files:**
- Modify: `src/pages/GambaPage.js`

`activeTool` falls back to `null`; when null, render `GambaHub` and hide the tab strip /
tuner. Add a "Hub" control to the desktop strip and the mobile sheet. Guard the
`activeIndex` / `scrollIntoView` logic against null.

- [ ] **Step 1: Import GambaHub**

In `src/pages/GambaPage.js`, add after the `Leaderboard` import (line 14):

```js
import GambaHub from '../components/GambaHub';
```

- [ ] **Step 2: Null-safe active tool + index**

Change the active-tool fallback (line 267) from:

```js
  const activeTool = location.pathname.split('/')[2] || 'leaderboard';
```

to:

```js
  const activeTool = location.pathname.split('/')[2] || null;
```

The `activeIndex` computation (lines 268-271) currently is:

```js
  const activeIndex = Math.max(
    0,
    GAMBA_TOOLS.findIndex((t) => t.id === activeTool)
  );
```

This already yields `0` when `activeTool` is null (findIndex returns -1 → Math.max(0,-1)=0).
That's fine — `activeIndex` is only read by the strip/tuner, which we hide on the hub. No
change needed, but the `scrollIntoView` effect must not run on the hub.

- [ ] **Step 3: Guard the scrollIntoView effect**

The effect (around lines 263-268, keyed on `[activeTool]`) scrolls the active strip button
into view. On the hub there is no strip. Add an early return when `activeTool` is null:

```js
  useEffect(() => {
    if (!activeTool) return;
    const strip = stripRef.current;
    if (!strip) return;
    const activeBtn = strip.querySelector('[data-active="true"]');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [activeTool]);
```

(Match the existing effect body; the only addition is the `if (!activeTool) return;` guard
as the first line.)

- [ ] **Step 4: Add a goToHub handler**

Near `setActiveTool` (line 272, `const setActiveTool = (tool) => navigate(\`/gamba/${tool}\`);`),
add:

```js
  const goToHub = () => navigate('/gamba');
```

(`setActiveTool` builds `/gamba/<tool>` and cannot produce bare `/gamba`, so the hub control
uses `goToHub`.)

- [ ] **Step 5: Render the hub when no tool is active; gate the strip**

Replace the return's body (lines 270-328) so the hub renders when `activeTool` is null, and
the strip/tuner/tool-surface render only when a tool is active. Current structure:

```jsx
  return (
    <div className="pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto">
        {/* Mobile/tablet — single tuner button */}
        <div className="lg:hidden">
          <MobileChannelTrigger activeIndex={activeIndex} onOpen={() => setSheetOpen(true)} />
        </div>
        {/* Desktop — equal-width strip */}
        <div className="hidden lg:block">
          <div ref={stripRef} className="flex border border-white/8 bg-zinc-card/30" role="tablist" aria-label="Gamba tools">
            {GAMBA_TOOLS.map((tool, i) => (
              <ChannelTab key={tool.id} tool={tool} channelNumber={i + 1} active={activeTool === tool.id} onClick={() => setActiveTool(tool.id)} />
            ))}
          </div>
        </div>
        {/* Tool surface */}
        <div className="mt-4">
          {activeTool === 'leaderboard' && <Leaderboard />}
          {activeTool === 'suggest' && <SuggestAdminTab />}
          {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
          {activeTool === 'hunt-tracker' && (<Suspense fallback={<ToolLoading label="Loading hunt tracker…" />}><HuntTracker /></Suspense>)}
          {activeTool === 'wheel' && (<Suspense fallback={<ToolLoading label="Tuning slot signal…" />}><SlotPicker /></Suspense>)}
        </div>
      </div>
      <MobileChannelSheet open={sheetOpen} activeId={activeTool} onSelect={(id) => { setActiveTool(id); setSheetOpen(false); }} onClose={() => setSheetOpen(false)} />
    </div>
  );
```

New version — wrap the tool UI in `activeTool ?` and render `<GambaHub />` otherwise. Add the
"Hub" control as the leading item in the desktop strip:

```jsx
  return (
    <div className="pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto">
        {activeTool ? (
          <>
            {/* Mobile/tablet — single tuner button */}
            <div className="lg:hidden">
              <MobileChannelTrigger
                activeIndex={activeIndex}
                onOpen={() => setSheetOpen(true)}
              />
            </div>

            {/* Desktop — equal-width strip with a leading Hub control */}
            <div className="hidden lg:block">
              <div
                ref={stripRef}
                className="flex border border-white/8 bg-zinc-card/30"
                role="tablist"
                aria-label="Gamba tools"
              >
                <button
                  type="button"
                  onClick={goToHub}
                  className="flex items-center gap-2 px-4 py-3 border-r border-white/8 text-white/55 hover:text-white-body hover:bg-white/5 transition-colors duration-150"
                  aria-label="Back to gamba hub"
                >
                  <LayoutGrid size={13} aria-hidden="true" />
                  <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono">
                    Hub
                  </span>
                </button>
                {GAMBA_TOOLS.map((tool, i) => (
                  <ChannelTab
                    key={tool.id}
                    tool={tool}
                    channelNumber={i + 1}
                    active={activeTool === tool.id}
                    onClick={() => setActiveTool(tool.id)}
                  />
                ))}
              </div>
            </div>

            {/* Tool surface */}
            <div className="mt-4">
              {activeTool === 'leaderboard' && <Leaderboard />}
              {activeTool === 'suggest' && <SuggestAdminTab />}
              {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
              {activeTool === 'hunt-tracker' && (
                <Suspense fallback={<ToolLoading label="Loading hunt tracker…" />}>
                  <HuntTracker />
                </Suspense>
              )}
              {activeTool === 'wheel' && (
                <Suspense fallback={<ToolLoading label="Tuning slot signal…" />}>
                  <SlotPicker />
                </Suspense>
              )}
            </div>
          </>
        ) : (
          <GambaHub setPage={(id) => navigate(`/${id}`)} />
        )}
      </div>

      {activeTool && (
        <MobileChannelSheet
          open={sheetOpen}
          activeId={activeTool}
          onSelect={(id) => {
            setActiveTool(id);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
          onHub={goToHub}
        />
      )}
    </div>
  );
```

Notes:
- `GambaHub`'s `setPage` is `(id) => navigate(\`/${id}\`)` so a card calling
  `setPage('gamba/wheel')` navigates to `/gamba/wheel` (mirrors App.js's `setPage`).
- `MobileChannelSheet` gains an `onHub` prop (next step) for the mobile hub control.

- [ ] **Step 6: Add the import for the Hub icon**

`LayoutGrid` is a lucide icon. Add it to the lucide import block at the top of GambaPage
(the existing `import { ChevronDown, X } from 'lucide-react';` line):

```js
import { ChevronDown, X, LayoutGrid } from 'lucide-react';
```

- [ ] **Step 7: Add a Hub control to the mobile sheet**

In `MobileChannelSheet` (around lines 98-...), accept an `onHub` prop and render a "Back to
hub" row at the top of the sheet's option list. Find the sheet's options list (the
`GAMBA_TOOLS.map` inside the sheet) and add a leading button before it:

```jsx
        <button
          type="button"
          onClick={onHub}
          className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/8 text-white/65 hover:text-white-body hover:bg-white/5 transition-colors duration-150"
        >
          <LayoutGrid size={14} aria-hidden="true" />
          <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono">
            Back to hub
          </span>
        </button>
```

Update the `MobileChannelSheet` signature to accept `onHub`:
`function MobileChannelSheet({ open, activeId, onSelect, onClose, onHub }) {`.
(Place the new button immediately inside the sheet's scrollable option container, before the
tools map. If the exact container class differs, match the surrounding markup — the button
styling above is self-contained.)

- [ ] **Step 8: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds (validates GambaHub JSX, the new GambaPage branches, and the
`LayoutGrid` import).

- [ ] **Step 9: Manual check (tool routes still work; hub renders)**

Run: `npm start`. `/gamba/leaderboard` (and each tool URL) loads its tool with the strip,
now with a leading "Hub" button. Clicking "Hub" → `/gamba`. (Bare `/gamba` still redirects
to leaderboard until Task 5 removes the redirect — so test the hub fully after Task 5.)

- [ ] **Step 10: Commit**

```bash
git add src/pages/GambaPage.js
git commit -m "feat: render gamba hub when no tool active; add hub control to strip"
```

---

## Task 5: Remove the index redirect

**Files:**
- Modify: `src/App.js`

With the hub in place, bare `/gamba` should land on it. Remove the redirect and the
now-unused `Navigate` import.

- [ ] **Step 1: Remove the index redirect child**

In `src/App.js`, delete the index route (lines 242-245):

```jsx
            <Route
              index
              element={<Navigate to="/gamba/leaderboard" replace />}
            />
```

Leave the `/gamba` parent route and the other `null` children intact.

- [ ] **Step 2: Remove the unused Navigate import**

`Navigate` (App.js line 5) was used only by that redirect (verified: the sole other match is
the line just deleted). Remove `Navigate,` from the `react-router-dom` import block. Keep
`useNavigate` and the other imports.

- [ ] **Step 3: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds with no "unused var Navigate" lint error (CRA fails the build on
that, so a green build confirms the import was fully removed).

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: /gamba lands on the hub instead of redirecting to leaderboard"
```

---

## Final verification

- [ ] **Step 1: Full manual pass**

Run: `npm start`.
- `/gamba` → hub: leaderboard hero on top, "Pick a tool" grid below, **no** tab strip.
- Each hub tool card → `/gamba/<id>`, tool loads with the strip + leading "Hub" button.
- "Hub" button (desktop strip) and "Back to hub" (mobile sheet) → `/gamba` hub.
- Top-nav "Gamba" → `/gamba` hub. Nav dropdown items → `/gamba/<tool>`.
- Direct-load each `/gamba/<tool>` URL → loads that tool, unchanged.
- Home page: `HomeGambaTools` strip and `HomeLeaderboardCallout` look exactly as before.

- [ ] **Step 2: Changed file set**

Run: `git diff --name-only HEAD~6 HEAD` (5 task commits + spec).
Expected code files: `src/App.js`, `src/components/HomeGambaTools.js`, `src/components/HomeLeaderboardCallout.js`, `src/components/GambaHub.js`, `src/pages/GambaPage.js`.

- [ ] **Step 3: Production build**

Run: `npx cross-env CI=true npm run build`
Expected: "Compiled successfully", no new ESLint errors.
