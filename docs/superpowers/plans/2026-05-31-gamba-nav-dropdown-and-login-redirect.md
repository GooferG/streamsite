# Gamba Nav Dropdown + Login Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hover/click/keyboard dropdown of Gamba tools to the nav (generic, so Gaming can reuse it), and redirect every Twitch login to `/me`.

**Architecture:** Lift the Gamba tool list out of `GambaPage.js` into a shared `src/data/gambaTools.js`. `Navigation.js` gains a generic `NavDropdown` (desktop) and a drawer accordion (mobile), both driven by that list. The login redirect is a two-line change in `TwitchCallbackPage.js` — no server work.

**Tech Stack:** React 19, react-router-dom v7, Tailwind, lucide-react. No test harness for nav/page code — verification is manual + production build.

**Spec:** `docs/superpowers/specs/2026-05-31-gamba-nav-dropdown-and-login-redirect-design.md`

---

## File Structure

- **Create** `src/data/gambaTools.js` — canonical Gamba tool list (id, label, icon). One source of truth for the in-page tabs and the nav dropdown.
- **Modify** `src/pages/GambaPage.js` — import `GAMBA_TOOLS` from the new module instead of defining `TOOLS` locally; drop the now-unused icon imports.
- **Modify** `src/components/Navigation.js` — add `NavDropdown` (desktop), the drawer accordion (mobile), and the `hasDropdown` flag on the Gamba nav item.
- **Modify** `src/pages/TwitchCallbackPage.js` — redirect to `/me` instead of `/suggest`.

Order matters: the shared module (Task 1) must exist before GambaPage (Task 2) and Navigation (Tasks 3-4) import it. The redirect (Task 5) is independent.

---

## Task 1: Create the shared Gamba tools module

**Files:**
- Create: `src/data/gambaTools.js`

- [ ] **Step 1: Write the module**

Create `src/data/gambaTools.js` with exactly this content (the array is moved verbatim from `GambaPage.js` lines 32-38 — same ids, labels, icons):

```js
import { Target, Gamepad2, MessageSquarePlus, Layers, Radio } from 'lucide-react';

// Canonical Gamba tool list. Single source of truth for the in-page tool tabs
// (GambaPage) and the nav dropdown (Navigation). Routes are /gamba/${id}.
export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', icon: MessageSquarePlus },
];
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/data/gambaTools.js`
Expected: no output. (Plain ESM, no JSX — `node --check` parses it.)

- [ ] **Step 3: Commit**

```bash
git add src/data/gambaTools.js
git commit -m "refactor: extract GAMBA_TOOLS to shared module"
```

---

## Task 2: Point GambaPage at the shared module

**Files:**
- Modify: `src/pages/GambaPage.js`

The 5 tool icons (`Target`, `Gamepad2`, `MessageSquarePlus`, `Layers`, `Radio`) are used **only** in the `TOOLS` array (verified: 10 occurrences = 5 imports + 5 array uses). `ChevronDown` and `X` are used elsewhere and must stay.

- [ ] **Step 1: Trim the icon import block**

In `src/pages/GambaPage.js`, replace the lucide import block (lines 3-11):

```js
import {
  Target,
  Gamepad2,
  MessageSquarePlus,
  Layers,
  Radio,
  ChevronDown,
  X,
} from 'lucide-react';
```

with (only the two icons GambaPage still uses directly):

```js
import { ChevronDown, X } from 'lucide-react';
```

- [ ] **Step 2: Import the shared list**

Add this import right after the `Leaderboard` import (line 14):

```js
import { GAMBA_TOOLS } from '../data/gambaTools';
```

- [ ] **Step 3: Remove the local TOOLS array and rename references**

Delete the local definition (lines 32-38):

```js
const TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', icon: MessageSquarePlus },
];
```

Then replace every remaining `TOOLS` reference in the file with `GAMBA_TOOLS`. There are
several (e.g. `TOOLS[activeIndex]`, `TOOLS.findIndex(...)`, `TOOLS.map(...)`). Use a
whole-word replace of `TOOLS` → `GAMBA_TOOLS` across the file body (the import you added
in Step 2 already uses `GAMBA_TOOLS`, so it stays correct).

- [ ] **Step 4: Verify no stale references remain**

Run: `grep -n "\bTOOLS\b" src/pages/GambaPage.js`
Expected: no output (every reference is now `GAMBA_TOOLS`).

Run: `grep -nE "\b(Target|Gamepad2|MessageSquarePlus|Layers|Radio)\b" src/pages/GambaPage.js`
Expected: no output (those icons no longer referenced in this file).

- [ ] **Step 5: Build to confirm GambaPage still compiles**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds, no ESLint errors (an unused import or undefined `TOOLS` would fail the CRA build).

- [ ] **Step 6: Commit**

```bash
git add src/pages/GambaPage.js
git commit -m "refactor: GambaPage uses shared GAMBA_TOOLS"
```

---

## Task 3: Add the desktop NavDropdown

**Files:**
- Modify: `src/components/Navigation.js`

Add a generic `NavDropdown` component and wire the Gamba nav item to it. The label keeps navigating to `/gamba`; a chevron + hover open the menu.

- [ ] **Step 1: Add imports**

In `src/components/Navigation.js`, update the lucide import block (lines 2-8) to add `ChevronDown`:

```js
import {
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Store as StoreIcon,
  ChevronDown,
} from 'lucide-react';
```

Add the shared tools import after the `useAuth` import (line 10):

```js
import { GAMBA_TOOLS } from '../data/gambaTools';
```

- [ ] **Step 2: Add `hasDropdown` to the Gamba nav item**

In the `NAV_ITEMS` array (lines 14-23), change the Gamba entry:

```js
  { id: 'gamba', label: 'Gamba', code: '04', dropdown: GAMBA_TOOLS },
```

(Leave the other entries unchanged. Using `dropdown: <list>` both flags the item and
carries its tools, so the nav map needs no second lookup.)

- [ ] **Step 3: Add the `NavDropdown` component**

Insert this component **after** the `NavLink` component definition (after its closing
brace around line 91, before `function ViewerAuthControl`):

```jsx
function NavDropdown({ item, items, active, setPage }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);

  // Outside-click closes (same pattern as ViewerAuthControl).
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Clear any pending close timer on unmount.
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openNow = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Small delay so diagonal mouse travel into the menu doesn't dismiss it.
  const closeSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const go = (toolId) => {
    setOpen(false);
    setPage(`${item.id}/${toolId}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      const first = wrapRef.current?.querySelector('[role="menuitem"]');
      first?.focus();
    }
  };

  const onItemKeyDown = (e, idx) => {
    const menuItems = wrapRef.current?.querySelectorAll('[role="menuitem"]');
    if (!menuItems) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      menuItems[Math.min(idx + 1, menuItems.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      menuItems[Math.max(idx - 1, 0)]?.focus();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <div className="inline-flex items-center gap-1">
        <NavLink item={item} active={active} onClick={() => setPage(item.id)} />
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${item.label} tools`}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className="p-0.5 text-white/45 hover:text-white-body transition-colors duration-150"
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          aria-label={`${item.label} tools`}
          className="absolute left-0 top-full mt-2 w-48 border border-white/10 bg-zinc-card shadow-lg z-50 motion-safe:animate-[gamba-sheet-fade_0.15s_ease-out]"
        >
          {items.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                role="menuitem"
                onClick={() => go(tool.id)}
                onKeyDown={(e) => onItemKeyDown(e, idx)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-white/75 hover:text-white-body hover:bg-zinc-broadcast/50 transition-colors duration-150"
              >
                {Icon && <Icon size={13} aria-hidden="true" />}
                <span className="text-[11px] font-bold tracking-eyebrow uppercase font-mono">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

> Note: `gamba-sheet-fade` is a keyframe already defined in `App.js`'s global
> `<style jsx>` block (used by the Gamba mobile sheet). `motion-safe:` makes it honor
> `prefers-reduced-motion` automatically (Tailwind only applies the class when motion is
> allowed). No new keyframes needed.

- [ ] **Step 4: Wire the desktop nav map to use NavDropdown**

In the desktop nav block, replace the current `NAV_ITEMS.map(...)` (lines 225-232):

```jsx
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={currentPage === item.id}
                onClick={() => setPage(item.id)}
              />
            ))}
```

with a branch on `item.dropdown`:

```jsx
            {NAV_ITEMS.map((item) =>
              item.dropdown ? (
                <NavDropdown
                  key={item.id}
                  item={item}
                  items={item.dropdown}
                  active={currentPage === item.id}
                  setPage={setPage}
                />
              ) : (
                <NavLink
                  key={item.id}
                  item={item}
                  active={currentPage === item.id}
                  onClick={() => setPage(item.id)}
                />
              )
            )}
```

- [ ] **Step 5: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds, no ESLint errors.

- [ ] **Step 6: Manual desktop check**

Run: `npm start`. On a desktop-width window:
1. Hover "Gamba" → tools menu fades in. Move into the menu → it stays open.
2. Move away → it closes after a beat.
3. Click a tool → routes to `/gamba/<id>` (e.g. Slot Picker → `/gamba/wheel`) and the menu closes.
4. Click the "Gamba" label itself → goes to `/gamba` (lands on the leaderboard tool).
5. Tab to the chevron, press Enter → menu opens; ArrowDown moves into items; ArrowUp/Down move; Esc closes.
6. Open the menu, click elsewhere on the page → menu closes.

Expected: all six hold.

- [ ] **Step 7: Commit**

```bash
git add src/components/Navigation.js
git commit -m "feat: desktop Gamba nav dropdown (hover + click + keyboard)"
```

---

## Task 4: Add the mobile drawer accordion

**Files:**
- Modify: `src/components/Navigation.js`

In the mobile drawer, the Gamba row expands an indented sub-list of its tools.

- [ ] **Step 1: Add expanded state to the drawer nav**

The mobile drawer renders `NAV_ITEMS.map(...)` inside the `<nav className="flex flex-col">`
(lines 365-393). It currently maps each item to a single button. We need local expand
state for dropdown items. Add a state hook near the top of the `Navigation` component body
(after `const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`, line 204):

```js
  const [expandedMobile, setExpandedMobile] = useState(null);
```

- [ ] **Step 2: Replace the mobile nav map**

Replace the mobile `NAV_ITEMS.map(...)` block (lines 366-393, the `{NAV_ITEMS.map((item) => { ... })}`)
with a version that renders an accordion for items with `dropdown`:

```jsx
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            if (item.dropdown) {
              const isOpen = expandedMobile === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMobile((cur) => (cur === item.id ? null : item.id))
                    }
                    aria-expanded={isOpen}
                    className={`group w-full flex items-center gap-3 px-5 py-3.5 border-l-2 transition-colors duration-150 ${
                      isActive
                        ? 'bg-zinc-card border-emerald-signal'
                        : 'border-transparent hover:bg-zinc-card/50'
                    }`}
                  >
                    <span
                      className={`text-sm font-bold tracking-tight ${
                        isActive ? 'text-white-body' : 'text-white/70'
                      }`}
                    >
                      {item.label}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`ml-auto text-white/40 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="bg-zinc-broadcast/40">
                      {item.dropdown.map((tool) => {
                        const Icon = tool.icon;
                        const toolActive =
                          currentPage === item.id &&
                          window.location.pathname.split('/')[2] === tool.id;
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => handleNavClick(`${item.id}/${tool.id}`)}
                            className={`w-full flex items-center gap-2.5 pl-10 pr-5 py-3 border-l-2 transition-colors duration-150 ${
                              toolActive
                                ? 'border-emerald-signal text-white-body'
                                : 'border-transparent text-white/60 hover:text-white-body hover:bg-zinc-card/40'
                            }`}
                          >
                            {Icon && <Icon size={14} aria-hidden="true" />}
                            <span className="text-[11px] font-bold tracking-eyebrow uppercase font-mono">
                              {tool.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`group flex items-center gap-3 px-5 py-3.5 border-l-2 transition-colors duration-150 ${
                  isActive
                    ? 'bg-zinc-card border-emerald-signal'
                    : 'border-transparent hover:bg-zinc-card/50'
                }`}
              >
                <span
                  className={`text-sm font-bold tracking-tight ${
                    isActive ? 'text-white-body' : 'text-white/70'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-[9px] font-bold tracking-eyebrow-lg text-emerald-signal font-mono">
                    ON
                  </span>
                )}
              </button>
            );
          })}
```

> Note: `handleNavClick` already does `setPage(id)` + `setMobileMenuOpen(false)`, and
> `setPage('gamba/wheel')` navigates to `/gamba/wheel`. The sub-item active check reads
> `window.location.pathname` directly (the component receives `currentPage` only as the
> first segment); this is a read at render time and is fine for highlight purposes.

- [ ] **Step 3: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds, no ESLint errors.

- [ ] **Step 4: Manual mobile check**

Run: `npm start`. Narrow the window to mobile width (or device emulation):
1. Open the drawer (hamburger). Tap "Gamba" → sub-list of 5 tools expands, chevron rotates.
2. Tap a tool → navigates to `/gamba/<id>` and the drawer closes.
3. Reopen drawer, tap "Gamba" twice → expands then collapses.
4. The currently-open tool's sub-row is highlighted when its `/gamba/<id>` is active.

Expected: all four hold.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navigation.js
git commit -m "feat: mobile drawer accordion for Gamba tools"
```

---

## Task 5: Redirect Twitch login to /me

**Files:**
- Modify: `src/pages/TwitchCallbackPage.js`

- [ ] **Step 1: Change the success redirect**

In `src/pages/TwitchCallbackPage.js`, line 24, change:

```js
      .then(() => navigate('/suggest', { replace: true }))
```

to:

```js
      .then(() => navigate('/me', { replace: true }))
```

- [ ] **Step 2: Change the error-fallback button**

Lines 36-41, change the button's target and label:

```jsx
          <button
            onClick={() => navigate('/me')}
            className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 hover:border-purple-bright/60 transition-all"
          >
            Back to My Account
          </button>
```

- [ ] **Step 3: Verify no other `/suggest` redirect remains in this file**

Run: `grep -n "/suggest" src/pages/TwitchCallbackPage.js`
Expected: no output.

- [ ] **Step 4: Build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

With `vercel dev` or a preview deploy backing `/api/twitch-auth`: sign in with Twitch →
land on `/me` (test both a brand-new account and an existing one). Both go to `/me`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/TwitchCallbackPage.js
git commit -m "feat: send Twitch login to /me instead of /suggest"
```

---

## Final verification

- [ ] **Step 1: Confirm the changed file set**

Run: `git diff --name-only HEAD~6 HEAD` (the 5 task commits + spec).
Expected only: `src/data/gambaTools.js`, `src/pages/GambaPage.js`, `src/components/Navigation.js`, `src/pages/TwitchCallbackPage.js`, and the spec doc.

- [ ] **Step 2: GambaPage in-page tabs still work**

Run: `npm start`, open `/gamba`. Confirm the in-page tool tabs (desktop strip + mobile
sheet) still render and switch tools — they now read from `GAMBA_TOOLS` but behavior is unchanged.

- [ ] **Step 3: Production build**

Run: `npx cross-env CI=true npm run build`
Expected: build succeeds with no new ESLint errors.
