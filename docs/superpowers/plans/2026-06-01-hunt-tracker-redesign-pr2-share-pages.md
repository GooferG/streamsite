# Hunt Tracker Redesign — PR 2: Share Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the two public hunt share pages — the live spectator view (`/live/:shareId`) and the suggestion intake form (`/hunt-suggest/:linkId`) — for glanceable live viewing and a fast mobile form-fill.

**Architecture:** Two independent page files, each self-contained behind its own route. The live page gains a phase-aware lead (Building-the-hunt vs Profit hero), a Bonuses count cell, a two-column body, a dominant now-opening card, a client-side stale-data signal, capped scrolling tables, and warmer state copy. The intake page gains a plain lede, mobile stacking, progressive slot fields, a password helper + reveal, error-on-field, and warmer success/closed copy. No data-model, Firestore, serverless, or routing changes.

**Tech Stack:** React 19, react-router-dom v7 (`useParams`), Firebase Firestore `onSnapshot` (live page, already wired), `fetch` to `/api/hunt-suggest/*` (intake page, already wired), Tailwind, lucide-react, Jest + `@testing-library/react`, `react-scripts` for build/lint.

**Spec:** `docs/superpowers/specs/2026-06-01-hunt-tracker-ux-redesign-design.md` (§8 live page, §9 intake page, §10 capped scroll on the live page).

**Depends on:** PR 1 ideally merged first for the `gold-scatter` Tailwind token (used by the live page's 5-scat star). If PR 1 is not yet merged, Task 0 adds the token here too; on merge, dedupe.

---

## File Structure

**Modified files:**
- `src/pages/LiveHuntPage.js` — §8: phase-aware lead, profit hero, bonuses cell, two-column body, now-opening card, stale-data signal, phone tables, state copy, capped scroll (§10), squad payout coloring, reduced-motion pulse.
- `src/pages/HuntSuggestPage.js` — §9: lede, mobile stacking, progressive slots, password helper + reveal, error-on-field + `role="alert"`, success count echo, closed/error next steps, slot `aria-label`s, rename "Edit / add more".
- `tailwind.config.js` — only if PR 1 has not landed the `gold-scatter` token (Task 0).

**Convention notes (read once):**
- Components default-export. Pages live in `src/pages/`.
- Run a single test: `npm test -- --watchAll=false --testPathPattern=<name>`. Lint via `npm run build`.
- Dev server `npm start`; live page at `/live/<id>`, intake at `/hunt-suggest/<id>`. To get real ids, create a hunt as owner, go live + create a collect link in the tracker, copy the URLs from the share bar.
- `fmt()` / `fmtX()` / `computeStats()` / `openingOrder()` live in `src/utils/huntCalc.js`. `computeStats` already returns `bonusCount`, `totalStakes`, `profit`, `bestX`, `start`, `finish`, `totalBuyIns`.
- No `Co-Authored-By` trailers in commits.
- Branch first if on `main`: `git checkout -b feat/hunt-tracker-redesign-pr2`.

---

## Task 0: Ensure `gold-scatter` token exists (skip if PR 1 merged)

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Check for the token**

Run: `npm run build` is not needed — just open `tailwind.config.js` and look in `theme.extend.colors` for `'gold-scatter'`.
- If present (PR 1 merged): skip this task entirely, proceed to Task 1.
- If absent: add it after `'white-muted': '#a1a1aa',`:

```js
        'gold-scatter': '#fbbf24',
```

- [ ] **Step 2: Commit (only if you added it)**

```bash
git add tailwind.config.js
git commit -m "feat: add gold-scatter token (live page star)"
```

---

## Task 1: Live page — extract opened-count + phase, add Bonuses cell

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (stats computation block lines ~38–52; stats grid lines ~90–108)

This is the data-prep step. `openedCount` is "bonuses with a win entered", matching the owner side. Add it next to the existing derived values.

- [ ] **Step 1: Compute `openedCount`**

After the existing `nextBonus` line (~line 52), add:

```js
  const openedCount = bonuses.filter((b) => (Number(b.win) || 0) > 0).length;
  const bonusCount = bonuses.length;
```

- [ ] **Step 2: Add the Bonuses cell to the stats grid**

In the stats grid (`<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">`, lines ~91–108), add a Bonuses cell as the first cell, showing opened / total:

```jsx
              <StatCell
                label="Bonuses"
                value={
                  <span>
                    <span className="text-purple-bright">{openedCount}</span>
                    <span className="text-white/40"> / {bonusCount}</span>
                  </span>
                }
              />
```

Place it before the existing Start cell. The grid will now hold 5 cells; change `sm:grid-cols-4` to `sm:grid-cols-5` on that wrapper so they sit in one row on desktop. (This grid is temporary scaffolding — Task 3 restructures the lead; the Bonuses cell survives into the supporting strip there.)

- [ ] **Step 3: Verify and commit**

Run: `npm run build`. Expected: "Compiled successfully".

```bash
git add src/pages/LiveHuntPage.js
git commit -m "feat: live page bonuses count cell + opened-count derivation"
```

---

## Task 2: Live page — stale-data signal + distinct error state

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (subscription effect lines ~15–36; live eyebrow lines ~57–61; missing block lines ~69–79)

§8 stale-data: track last-snapshot time; if no update in N seconds, downgrade the eyebrow and stop the pulse. Route the `onSnapshot` error to its own state distinct from "missing".

- [ ] **Step 1: Add state + a tick timer**

Add to the component state (near `useState` declarations, ~lines 11–13):

```js
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connError, setConnError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
```

In the subscription effect, on a successful snapshot set `setLastUpdate(Date.now())` and `setConnError(false)`; in the error callback set `setConnError(true)` instead of `setMissing(true)`:

```js
    const unsub = onSnapshot(
      doc(db, 'shared_hunts', shareId),
      (snap) => {
        setLoading(false);
        setConnError(false);
        setLastUpdate(Date.now());
        if (snap.exists()) {
          setHunt({ id: snap.id, ...snap.data() });
          setMissing(false);
        } else {
          setHunt(null);
          setMissing(true);
        }
      },
      (err) => {
        console.error('live sub error:', err);
        setLoading(false);
        setConnError(true);
      }
    );
    return unsub;
```

Add a 1s tick so the "Xs ago" staleness recomputes (gate the interval cleanup properly):

```js
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
```

- [ ] **Step 2: Derive staleness + phase-aware eyebrow**

Before the return, compute:

```js
  const STALE_MS = 20000;
  const ageMs = lastUpdate ? now - lastUpdate : null;
  const stale = ageMs != null && ageMs > STALE_MS;
```

Replace the fixed live eyebrow (lines ~57–61) so it reflects stale/error and stops the pulse when not fresh:

```jsx
        <div
          className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono mb-4 ${
            stale || connError ? 'text-orange-admin' : 'text-red-destructive'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              stale || connError
                ? 'bg-orange-admin'
                : 'bg-red-destructive motion-safe:animate-pulse'
            }`}
          />
          <Radio size={12} aria-hidden="true" />
          <span>
            {connError
              ? 'Reconnecting…'
              : stale
                ? `Last update ${Math.round(ageMs / 1000)}s ago`
                : 'Live bonus hunt'}
          </span>
        </div>
```

Note `motion-safe:animate-pulse` replaces the raw `animate-pulse` so reduced-motion users get a static dot (spec §8 secondary + a11y).

- [ ] **Step 3: Verify and commit**

Run: `npm run build` then `npm start`; open a live hunt while sharing. Stop sharing from the tracker (or kill the network) and watch the eyebrow flip to stale/reconnecting and the pulse stop.

```bash
git add src/pages/LiveHuntPage.js
git commit -m "feat: live page stale-data signal + distinct connection-error state"
```

---

## Task 3: Live page — phase-aware lead (Building the hunt vs Profit hero)

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (heading + phase eyebrow lines ~83–88; stats grid from Task 1)

§8 phase-aware lead. Collecting → "Building the hunt" (bonus count + total staked, calm note, no profit hero). Opening → Profit hero + supporting strip.

- [ ] **Step 1: Phase-aware eyebrow copy**

Change the phase eyebrow (lines ~86–88) so collecting reads spectator-friendly:

```jsx
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-6">
              {opening ? '▸ Opening slots' : '▸ Building the hunt'}
            </p>
```

- [ ] **Step 2: Replace the flat stats grid with a phase-aware lead + supporting strip**

Replace the stats grid block (the `<div className="grid grid-cols-2 sm:grid-cols-5 ...">` from Task 1, lines ~90–108) with: a lead that switches on `opening`, then a supporting strip that always includes the Bonuses cell.

```jsx
            {/* Lead */}
            {opening ? (
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
                  Profit
                </span>
                <span
                  className={`text-4xl sm:text-5xl font-black tabular-nums leading-none ${
                    stats.profit == null
                      ? 'text-white/50'
                      : stats.profit >= 0
                        ? 'text-emerald-signal'
                        : 'text-red-destructive'
                  }`}
                >
                  {stats.profit == null
                    ? '—'
                    : `${stats.profit >= 0 ? '+' : ''}${fmt(stats.profit)}`}
                </span>
              </div>
            ) : (
              <div className="border border-purple-gamba/40 bg-purple-gamba/5 p-5 mb-2">
                <p className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono mb-2">
                  Building the hunt
                </p>
                <p className="text-3xl sm:text-4xl font-black leading-none mb-1 tabular-nums">
                  <span className="text-purple-bright">{bonusCount}</span>{' '}
                  {bonusCount === 1 ? 'bonus' : 'bonuses'} lined up
                </p>
                <p className="text-[12px] font-mono text-white/50 mb-3 tabular-nums">
                  {fmt(stats.totalStakes)} staked so far
                </p>
                <p className="text-sm text-white/55">
                  Slots are still going in. Opening starts once the list is locked.
                </p>
              </div>
            )}

            {/* Supporting stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              <StatCell
                label="Bonuses"
                value={
                  <span>
                    <span className="text-purple-bright">{openedCount}</span>
                    <span className="text-white/40"> / {bonusCount}</span>
                  </span>
                }
              />
              <StatCell label="Start" value={fmt(stats.start)} />
              <StatCell
                label={opening ? 'Finish' : 'Total staked'}
                value={opening ? fmt(stats.finish) : fmt(stats.totalStakes)}
              />
              <StatCell label="Best X" value={stats.bestX != null ? fmtX(stats.bestX) : '—'} />
            </div>
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build` then `npm start`. View a hunt in collecting (no wins yet) and in opening.
Expected: collecting leads with "Building the hunt" (count + staked + note), no profit hero; opening leads with the big Profit number. The Bonuses cell shows in both; the third strip cell is Total staked in collecting, Finish in opening.

```bash
git add src/pages/LiveHuntPage.js
git commit -m "feat: live page phase-aware lead (building vs profit hero)"
```

---

## Task 4: Live page — dominant now-opening card with markers + progress

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (now-opening card lines ~110–129; needs `Star` already imported — it is)

§8: reorder the now-opening card above the supporting strip during opening, enlarge the slot name, re-add S/star markers, add opened progress + next-up stake.

- [ ] **Step 1: Move and rebuild the now-opening card**

Move the `{opening && currentBonus && (...)}` block so it renders **immediately after the lead** (after the Profit hero `<div>`, before the supporting stats strip). Replace its contents with the enriched version:

```jsx
            {opening && currentBonus && (
              <div className="border border-purple-gamba/40 bg-purple-gamba/5 p-5 mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono">
                    Now opening
                  </span>
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono tabular-nums">
                    {openedCount} / {bonusCount} opened
                  </span>
                </div>
                <div className="h-0.5 bg-white/10 mb-3">
                  <div
                    className="h-full bg-purple-bright transition-all"
                    style={{ width: `${bonusCount ? (openedCount / bonusCount) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  {currentBonus.super && (
                    <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">
                      S
                    </span>
                  )}
                  {currentBonus.fiveScat && (
                    <Star
                      size={18}
                      aria-label="5 scatter"
                      className="shrink-0 fill-gold-scatter text-gold-scatter"
                    />
                  )}
                  <p className="font-black text-white-body text-3xl sm:text-4xl leading-tight truncate">
                    {currentBonus.slot}
                  </p>
                </div>
                <p className="text-[12px] font-mono text-white/50 tabular-nums">
                  stake {fmt(currentBonus.stake)}
                  {currentBonus.caller ? ` · 📣 ${currentBonus.caller}` : ''}
                </p>
                {nextBonus && (
                  <p className="text-[11px] font-mono text-white/40 mt-3">
                    Next: <span className="text-white/70">{nextBonus.slot}</span>
                    <span className="text-white/40"> · {fmt(nextBonus.stake)}</span>
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 2: Verify and commit**

Run: `npm run build` then `npm start`; open a hunt in opening phase with a 5-scat/super current slot.
Expected: the now-opening card sits right under the Profit hero, big slot name, S/gold-star markers shown, a progress bar, and next-up with stake.

```bash
git add src/pages/LiveHuntPage.js
git commit -m "feat: live page dominant now-opening card with markers + progress"
```

---

## Task 5: Live page — two-column body (bonuses left, squad right) + capped scroll

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (page width line ~56; bonus table lines ~131–179; squad table lines ~181–214)

§8 two-column body + §10 capped scroll. Widen the page, wrap the two tables in a responsive 2-col grid, cap each table's height with sticky header.

- [ ] **Step 1: Widen the page container**

Change the inner container `max-w-3xl` (line ~56) to `max-w-5xl`.

- [ ] **Step 2: Wrap the two tables in a 2-column grid**

The bonus table block (`{bonuses.length > 0 && (...)}`, ~131–179) and the squad table block (`{gamblers.length > 0 && (...)}`, ~181–214) are currently sequential. Wrap both in:

```jsx
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <div>
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono mb-2">
                  Bonuses <span className="text-white/30">· {bonusCount}</span>
                </p>
                {/* bonus table block here */}
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono mb-2">
                  Squad split <span className="text-white/30">· {gamblers.length}</span>
                </p>
                {/* squad table block here */}
              </div>
            </div>
```

Move the existing bonus `<div className="border ... overflow-x-auto ... mb-6">` table into the first column slot (drop its `mb-6`), and the squad table into the second. Render the column wrappers unconditionally; inside each, keep the existing empty-handling (if `bonuses.length === 0` the bonus column simply shows its label with no table — acceptable, or guard the table as today).

- [ ] **Step 3: Cap each table height with sticky header (+ totals where present)**

On the bonus table's scroll wrapper, add `max-h-[48vh] overflow-y-auto` to the existing `overflow-x-auto` div, and make its `<thead> tr` sticky: add `sticky top-0 z-10` (it already has `bg-zinc-broadcast/50`). The live bonus table has no tfoot today; leave as-is (spec: live squad table has no totals row; the live bonus table likewise just pins its header).

On the squad table's scroll wrapper, add `max-h-[48vh] overflow-y-auto` and make its `<thead> tr` `sticky top-0 z-10`.

- [ ] **Step 4: Verify and commit**

Run: `npm run build` then `npm start`; open a hunt with 20+ bonuses on a wide screen and on a phone width.
Expected: desktop shows bonuses left, squad right, under the shared band; each table caps height and scrolls with a pinned header; phone width stacks them (bonuses first).

```bash
git add src/pages/LiveHuntPage.js
git commit -m "feat: live page two-column body + capped-scroll tables"
```

---

## Task 6: Live page — phone table affordance, current-row highlight, payout coloring, missing-state copy

**Files:**
- Modify: `src/pages/LiveHuntPage.js` (bonus row slot cell ~152–167; isCurrent ~150; squad payout ~205–207; missing block ~69–79)

- [ ] **Step 1: Truncated-name title + scroll fade**

On the bonus table's slot `<span className="truncate">{b.slot}</span>` (line ~160), add `title={b.slot}` to the cell so the full name is hoverable. On the bonus table scroll wrapper, add a right-edge fade by giving the wrapper `relative` and appending an `::after` is not possible inline; instead add a Tailwind gradient mask via an extra element is overkill — simplest acceptable affordance: keep the `[scrollbar-width:thin]` and the `title`. (The two-column cap from Task 5 already reduces horizontal pressure; the `min-w-[420px]` can drop to `min-w-[360px]` to reduce horizontal scroll on phones.) Change `min-w-[420px]` → `min-w-[360px]` on both tables.

- [ ] **Step 2: Strengthen the current-row highlight**

The current row uses `bg-purple-gamba/15` (line ~150). Bump to `bg-purple-gamba/25` and add a left accent: change the row className builder to:

```jsx
                          className={`border-b border-white/5 ${
                            isCurrent ? 'bg-purple-gamba/25 shadow-[inset_3px_0_0_#c084fc]' : ''
                          }`}
```

- [ ] **Step 3: Color the squad payout win/loss**

The squad payout cell (lines ~205–207) is flat `text-white/70`. Color it vs `inFor` like the owner tool:

```jsx
                          <td
                            className={`px-3 py-2 text-right font-bold tabular-nums ${
                              payout == null
                                ? 'text-white/60'
                                : payout >= g.inFor
                                  ? 'text-emerald-signal'
                                  : 'text-red-destructive'
                            }`}
                          >
                            {payout != null ? fmt(payout) : '—'}
                          </td>
```

- [ ] **Step 4: Warmer missing-state copy**

In the missing block (lines ~69–79), change the body line "The stream may have ended sharing." to "Nothing live right now. Catch the next hunt on stream." Keep the icon + eyebrow. (The headline "This hunt isn't live" can stay; verify the curly apostrophe renders — if any doubt, change to "This hunt is not live".)

- [ ] **Step 5: Verify and commit**

Run: `npm run build` then `npm start`.
Expected: current row clearly highlighted with a left accent; squad payouts colored; long slot names hoverable; missing state reads warm.

```bash
git add src/pages/LiveHuntPage.js
git commit -m "polish: live page row highlight, payout color, phone names, missing copy"
```

---

## Task 7: Intake page — lede, mobile stacking, password helper + reveal

**Files:**
- Modify: `src/pages/HuntSuggestPage.js` (form block lines ~141–212; name/password grid ~155–180; add `Eye`/`EyeOff` imports)

§9: cold-newcomer lede, stack name/password on mobile, password helper + reveal toggle.

- [ ] **Step 1: Add imports + reveal/error state**

Add to the lucide import (line ~3): `Eye, EyeOff`. Add state near the others (~lines 17–22):

```js
  const [showPw, setShowPw] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
```

`errorCode` holds the raw API error string (e.g. `'BAD_PASSWORD'`) so the password
field can mark itself; it is wired into the submit handler in Task 9, and reads as
`null` (no error) until then, so the field border stays normal in the meantime.

- [ ] **Step 2: Add the lede**

In the form's intro block (lines ~143–153), after the `huntName` `<p>`, the existing line "Drop up to {MAX_SLOTS} slots. Same name resubmits to update your picks." stays, but add a plain what-is-this sentence above it:

```jsx
                <p className="text-white/55 text-sm mt-1">
                  Pick the slots you want played on this stream. The streamer reviews
                  the list live.
                </p>
                <p className="text-white/45 text-[12px] mt-1">
                  Drop up to {MAX_SLOTS} slots. Same name resubmits to update your picks.
                </p>
```

- [ ] **Step 3: Stack name + password on mobile**

Change the grid (line ~155) from `grid grid-cols-2 gap-3` to `grid grid-cols-1 sm:grid-cols-2 gap-3`.

- [ ] **Step 4: Password reveal toggle + helper**

Replace the password `<label>` block (lines ~168–179) with a reveal toggle and a helper line:

```jsx
                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
                    <Lock size={10} aria-hidden="true" /> Password <span className="text-emerald-signal">*</span>
                  </span>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className={`${inputCls} pr-10 ${submitError === 'BAD_PASSWORD_MARK' ? 'border-red-destructive' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      title={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white-body"
                    >
                      {showPw ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    </button>
                  </div>
                  <p className="text-[11.5px] text-white/45 mt-1.5">
                    It's in chat or on stream right now.
                  </p>
                </label>
```

(The `BAD_PASSWORD_MARK` border wiring is finished in Task 9; for now the class is harmless.)

- [ ] **Step 5: Verify and commit**

Run: `npm run build` then `npm start`; open an intake link at phone width.
Expected: lede explains the page; name/password stack on mobile; password field has a working show/hide eye and a helper line.

```bash
git add src/pages/HuntSuggestPage.js
git commit -m "feat: intake page lede, mobile stacking, password helper + reveal"
```

---

## Task 8: Intake page — progressive slot fields + slots-used count + aria-labels

**Files:**
- Modify: `src/pages/HuntSuggestPage.js` (slots block lines ~182–195; add `shownSlots` state)

§9: show one field, reveal the next as the prior fills, cap at `MAX_SLOTS`; show a `n / 6` count; label each field.

- [ ] **Step 1: Add `shownSlots` state**

Near the other state (~line 19), add:

```js
  const [shownSlots, setShownSlots] = useState(1);
```

Keep the existing `slots` array state (`Array(MAX_SLOTS).fill('')`) as the value store; `shownSlots` only controls how many are rendered.

- [ ] **Step 2: Render progressively with a count + add-more**

Replace the picks block (lines ~182–195) with:

```jsx
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 font-mono">
                    Your picks
                  </span>
                  <span className="text-[10px] font-mono text-white/40 tabular-nums">
                    {filledSlots.length} / {MAX_SLOTS}
                  </span>
                </div>
                {slots.slice(0, shownSlots).map((s, i) => (
                  <SlotAutocomplete
                    key={i}
                    value={s}
                    onChange={(v) => setSlot(i, v)}
                    placeholder={i === 0 ? 'Slot 1 (one is enough)' : `Slot ${i + 1}`}
                    className={inputCls}
                    aria-label={`Slot ${i + 1}`}
                  />
                ))}
                {shownSlots < MAX_SLOTS && (
                  <button
                    type="button"
                    onClick={() => setShownSlots((n) => Math.min(MAX_SLOTS, n + 1))}
                    className="w-full px-3 py-2.5 border border-dashed border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/10 transition-colors text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
                  >
                    + Add another slot
                  </button>
                )}
              </div>
```

- [ ] **Step 3: Confirm `SlotAutocomplete` forwards `aria-label`**

Open `src/components/SlotAutocomplete.js`; if it does not spread extra props to its `<input>`, add `aria-label` passthrough. (If it already spreads `...rest`, no change.)

- [ ] **Step 4: Verify and commit**

Run: `npm run build` then `npm start`; open an intake link.
Expected: one slot field shows; "+ Add another slot" reveals the next up to 6; the count tracks filled slots; each field is screen-reader-labeled.

```bash
git add src/pages/HuntSuggestPage.js src/components/SlotAutocomplete.js
git commit -m "feat: intake page progressive slot fields + count + aria-labels"
```

---

## Task 9: Intake page — error-on-field, submit hint, success/closed copy, rename Edit

**Files:**
- Modify: `src/pages/HuntSuggestPage.js` (submit handler error map ~67–78; error render ~197–199; submit button ~201–211; done block ~120–140; closed block ~115–119; loadError ~109–114)

- [ ] **Step 1: Associate the BAD_PASSWORD error with the field + role=alert**

The error map sets `submitError` to a message string. Add a flag to mark the password field. Simplest: track the raw error code too.

Add state (~line 21): `const [errorCode, setErrorCode] = useState(null);`

In `submit()`'s `!r.ok` branch, set `setErrorCode(data.error)` alongside `setSubmitError(...)`. In the password input className (Task 7 Step 4), replace the `submitError === 'BAD_PASSWORD_MARK'` placeholder with `errorCode === 'BAD_PASSWORD'`. After a failed submit with `BAD_PASSWORD`, focus the field: in the `!r.ok` branch, if `data.error === 'BAD_PASSWORD'`, call `document.querySelector('input[type=password]')?.focus()` (or use a ref). Update the `BAD_PASSWORD` message text to: `'That password didn\'t match. Check chat for the current one.'`

Make the error line announce: change the error `<p>` (lines ~197–199) to:

```jsx
              {submitError && (
                <p role="alert" className="text-red-destructive text-sm">{submitError}</p>
              )}
```

Clear `errorCode` at the top of `submit()` (alongside `setSubmitError(null)`).

- [ ] **Step 2: Submit hint instead of a silent dead button**

The submit button is `disabled={!canSubmit}`. Add a quiet hint under it that names what is missing (keep the button disabled state):

```jsx
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
              >
                <Send size={14} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {submitting ? 'Sending…' : 'Send suggestions'}
                </span>
              </button>
              {!canSubmit && !submitting && (
                <p className="text-[11px] text-white/40 text-center font-mono">
                  {!name.trim()
                    ? 'Add your name to send.'
                    : !password
                      ? 'Enter the password to send.'
                      : 'Add at least one slot to send.'}
                </p>
              )}
```

- [ ] **Step 3: Success echoes the count; rename "Edit / add more"**

In the `done` block (lines ~120–140), echo the number sent and rename the button. The submit captured `filledSlots.length` at send time; store it:

Add state `const [sentCount, setSentCount] = useState(0);`. In `submit()` success branch, before `setDone(true)`, add `setSentCount(filledSlots.length);`. Update the success copy:

```jsx
                <p className="text-white/55 text-sm mt-1">
                  Sent {sentCount} {sentCount === 1 ? 'pick' : 'picks'} to {info?.huntName}.
                  Resubmit anytime to update them.
                </p>
```

Rename the button label from "Edit / add more" to "Add more picks" (line ~137).

- [ ] **Step 4: Closed + loadError next steps**

- Closed block (lines ~115–119): after "Suggestions are closed for this hunt." add " Catch the next one on stream." (same `<p>` or a second line).
- loadError ERROR (line ~113): after "Something went wrong loading this link." add " Try refreshing."

- [ ] **Step 5: Verify and commit**

Run: `npm run build` then `npm start`; open an intake link.
Expected: submitting with a wrong password red-borders + focuses the password field and shows the pointer message (announced to SR); the disabled submit shows a hint of what's missing; success echoes "Sent N picks"; "Add more picks" button; closed/error states give a next step.

```bash
git add src/pages/HuntSuggestPage.js
git commit -m "feat: intake page error-on-field, submit hint, success count, warmer states"
```

---

## Task 10: Full PR 2 verification

**Files:** none (verification only)

- [ ] **Step 1: Tests + build**

Run: `npm test -- --watchAll=false` then `npm run build`.
Expected: all existing tests pass; "Compiled successfully" with no lint errors. (No new unit tests are required for these page-level presentational changes; the spec's testing section lists them as manual.)

- [ ] **Step 2: Manual smoke (live page)**

Create a hunt as owner, go live, copy the watch link. Open `/live/<id>`:
- Collecting (no wins): leads with "Building the hunt" + count + staked; Bonuses cell `0 / N`.
- Start opening + enter a win on the owner side: live page switches to Profit hero + now-opening card (markers, progress, next-up stake); Bonuses cell increments.
- Two columns on desktop (bonuses left, squad right); stacks on phone width; tables cap + scroll with pinned header.
- Stop sharing or drop network: eyebrow flips to "Reconnecting…"/stale, pulse stops; a genuine bad id shows the warm missing copy (distinct from reconnecting).

- [ ] **Step 3: Manual smoke (intake page)**

Create a collect link in the tracker, copy it. Open `/hunt-suggest/<id>` at 320px:
- Lede explains the page; name/password stack; password helper + working reveal.
- One slot field; "+ Add another slot" reveals more up to 6; count tracks filled.
- Wrong password → field red border + focus + announced message; disabled submit shows what's missing.
- Submit → "Sent N picks"; "Add more picks" returns. Close the link from the tracker → page shows closed + "Catch the next one on stream."

- [ ] **Step 4: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "Hunt tracker redesign (PR 2: share pages)" --body "$(cat <<'EOF'
Implements PR 2 of the hunt tracker UX redesign spec (docs/superpowers/specs/2026-06-01-hunt-tracker-ux-redesign-design.md §8–§10):

Live spectator page:
- Phase-aware lead (Building the hunt vs Profit hero), Bonuses count cell
- Dominant now-opening card with S/5-scat markers + progress + next-up stake
- Client-side stale-data signal + distinct connection-error state (motion-safe pulse)
- Two-column body (bonuses / squad), capped-scroll tables with pinned headers
- Squad payout win/loss coloring, stronger current-row highlight, warmer missing copy

Suggestion intake page:
- Plain "what is this" lede, mobile-stacked name/password
- Password helper + reveal toggle, error-on-field with role=alert + focus
- Progressive slot fields with a slots-used count + aria-labels
- Submit hint when disabled, success count echo, warmer closed/error states

Pure frontend; no data/Firestore/serverless/route changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Branch first if on `main`: `git checkout -b feat/hunt-tracker-redesign-pr2`.)

---

## Self-Review Notes (for the implementer)

- Line numbers are from the spec-time read of each file and shift as you edit; search by the quoted surrounding code.
- The live page's `Star` is already imported; the `gold-scatter` class needs the token from PR 1 (or Task 0 here).
- If `SlotAutocomplete` already spreads `...rest`/`aria-label`, skip those passthrough edits.
- Keep all new copy within the project voice rules (no em dashes, sentence case, plain in forms/errors). The strings in this plan already comply.
- These two pages are independent; you can implement and verify the live page (Tasks 1–6) and the intake page (Tasks 7–9) in either order.
