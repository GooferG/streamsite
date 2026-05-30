# Marketing Contrast Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve readability of body copy and sharpen emerald/tonal focal contrast on the five marketing pages, without touching the brand's base gradient, grain, chyron labels, or shadows.

**Architecture:** Per-element Tailwind class edits on existing page components. No new files, no token changes, no test framework (project has none). "Verification" per task = the dev server renders + a grep guard proving forbidden values were untouched. Each task is one page, committed independently.

**Tech Stack:** Create React App, Tailwind (config in `tailwind.config.js`), existing marketing page components in `src/pages/`.

---

## Critical Rule (applies to every task)

Two kinds of dim text. Edit one, never the other:

- **BODY COPY** — a sentence a human reads (`<p>` prose, hero support, hint lines). **Bump opacity.**
- **CHYRON LABEL** — `tracking-eyebrow*` + `font-mono` + `uppercase`, usually `text-[10px]`/`[11px]`. **Leave dim. Never touch.**

If unsure: "Is this a sentence or a label?" Sentence → bump. Label → leave.

Already-correct copy (`/65`–`/70` body) must NOT be lowered or re-touched. Several marketing paragraphs are already at target — leave them.

**Forbidden (do not introduce anywhere):** `box-shadow`/`shadow-*` additions, gradient-text on new elements, new `backdrop-blur`, font-weight 500/600, base-gradient edits (`from-zinc-950 via-emerald-950 to-purple-950`), grain opacity edits, new accent colors.

Note: GearInteractive.js already contains a pre-existing `shadow-2xl` (line ~95) and `bg-clip-text` gradient (line ~82). These are PRE-EXISTING and OUT OF SCOPE. Do not add to them, do not remove them in this pass.

---

## Pre-flight (once, before Task 1)

- [ ] **Step 1: Start the dev server**

Run: `npm start`
Expected: dev server on `localhost:3000`, compiles clean. Leave it running; visual checks use it.

---

### Task 1: SchedulePage body copy

**Files:**
- Modify: `src/pages/SchedulePage.js:210`

- [ ] **Step 1: Bump the empty-state supporting paragraph**

This is prose ("The tower is quiet. Check back soon..."), not a label. Change `/50` → `/70`.

Before:
```jsx
<p className="max-w-md text-sm sm:text-base text-white/50 leading-relaxed">
```
After:
```jsx
<p className="max-w-md text-sm sm:text-base text-white/70 leading-relaxed">
```

- [ ] **Step 2: Guard — confirm no chyron label was touched**

Run: `git diff src/pages/SchedulePage.js`
Expected: exactly one changed line, `text-white/50` → `text-white/70`. No line containing `tracking-eyebrow` or `font-mono` appears in the diff.

- [ ] **Step 3: Visual check**

Open `localhost:3000/schedule` in a week with no scheduled streams (or temporarily verify the empty-state block renders). The "tower is quiet" paragraph reads comfortably on the gradient.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SchedulePage.js
git commit -m "fix: raise schedule empty-state copy legibility"
```

---

### Task 2: VodsPage body copy

**Files:**
- Modify: `src/pages/VodsPage.js:231`

- [ ] **Step 1: Bump the empty-reel sub-description**

Line 228 (`text-white/70`) is already fine — leave it. Line 231 is the dimmer follow-up sentence. Change `/40` → `/65`.

Before:
```jsx
<p className="text-sm text-white/40 mt-1">
  Check back after the next broadcast.
</p>
```
After:
```jsx
<p className="text-sm text-white/65 mt-1">
  Check back after the next broadcast.
</p>
```

- [ ] **Step 2: Guard**

Run: `git diff src/pages/VodsPage.js`
Expected: one changed line, `text-white/40` → `text-white/65`. The diff must NOT contain `tracking-eyebrow` or `font-mono` (those `/40` eyebrow labels at lines ~224/278 stay untouched).

- [ ] **Step 3: Visual check**

Open `localhost:3000/vods`, filter to a content type with no tapes (or view the empty state). "Check back after the next broadcast." reads clearly.

- [ ] **Step 4: Commit**

```bash
git add src/pages/VodsPage.js
git commit -m "fix: raise vods empty-state copy legibility"
```

---

### Task 3: GearInteractive body copy

**Files:**
- Modify: `src/pages/GearInteractive.js:86`, `:107`, `:280`

- [ ] **Step 1: Bump hero support copy (line 86)**

Before:
```jsx
<p className="text-xl text-white/60 max-w-2xl mx-auto">
  Hover over any item in the setup to see detailed specs
</p>
```
After:
```jsx
<p className="text-xl text-white/75 max-w-2xl mx-auto">
  Hover over any item in the setup to see detailed specs
</p>
```

- [ ] **Step 2: Bump info-card model line (line 107)**

Before:
```jsx
<p className="text-sm text-white/60">
  {gearData[hoveredItem].model}
</p>
```
After:
```jsx
<p className="text-sm text-white/75">
  {gearData[hoveredItem].model}
</p>
```

- [ ] **Step 3: Bump the instruction hint (line 280)**

This hint line swaps to emerald on hover; the resting state is real readable copy. Change `/40` → `/65`.

Before:
```jsx
<p className="text-white/40 text-sm">
```
After:
```jsx
<p className="text-white/65 text-sm">
```

- [ ] **Step 4: Confirm the placeholder line was NOT touched**

Line ~134 (`text-white/40 text-lg font-bold`, text "[Your Desk Setup Photo Here]") is a placeholder, not shipped copy. It must remain `/40`.

Run: `git diff src/pages/GearInteractive.js`
Expected: exactly three changed lines (86, 107, 280). The diff must NOT include the `[Your Desk Setup Photo Here]` line, must NOT include any `tracking-eyebrow`/`font-mono` label, and must NOT touch the `shadow-2xl` (line ~95) or `bg-clip-text` (line ~82).

- [ ] **Step 5: Visual check**

Open `localhost:3000/gear` (interactive setup). Hero hint reads clearly; hover a hotspot — info-card model line and the bottom instruction read clearly; hover state still flips to emerald.

- [ ] **Step 6: Commit**

```bash
git add src/pages/GearInteractive.js
git commit -m "fix: raise gear page body copy legibility"
```

---

### Task 4: Signal & tonal punch — Schedule + Vods cards

**Files:**
- Modify: `src/pages/SchedulePage.js` (card/border surfaces only)
- Modify: `src/pages/VodsPage.js` (card/border surfaces only)

This task is judgment-based, NOT a blanket find-replace. Goal: where a marketing card/section blends into the gradient, firm its edge so it reads without a shadow; where an emerald focal element sits in a quiet field, let it use the brighter tier. Make the smallest set of changes that achieves visible separation. If a page already reads with clear card edges, change nothing and say so.

- [ ] **Step 1: Inspect current surfaces**

Run: `git grep -n "bg-zinc-900/50\|bg-white/5\|border-white/5\|border-emerald-500/10" src/pages/SchedulePage.js src/pages/VodsPage.js`
Read each hit in context (Read the surrounding lines). For each, judge: does this card edge read against the gradient at `localhost:3000/schedule` and `/vods`?

- [ ] **Step 2: Apply minimal separation where it blends**

Allowed moves (pick only what's needed):
- Subtle border firm-up: `border-white/5` → `border-white/10`.
- Sub-section tonal step: a nested block on `bg-zinc-900` may step to `bg-zinc-800` (NOT a nested card — tonal background only).
- A focal emerald element in a quiet field may go `emerald-signal` → `emerald-bright` or raise fill opacity one tier (e.g. `/10` → `/15`).

Forbidden: adding `shadow-*`, adding `backdrop-blur`, changing the page background gradient, recoloring non-signal elements emerald.

If nothing blends, make no change and note it in the commit body.

- [ ] **Step 3: Guard**

Run: `git diff src/pages/SchedulePage.js src/pages/VodsPage.js`
Confirm: no `shadow`, no `backdrop-blur`, no `from-zinc-950`/`via-emerald-950` gradient line changed, no eyebrow/`font-mono` opacity changed.

- [ ] **Step 4: Visual check**

`localhost:3000/schedule` and `/vods`: cards/sections are distinguishable from the background; emerald focal points pop; the page still reads "after-midnight cable," not brighter dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SchedulePage.js src/pages/VodsPage.js
git commit -m "feat: sharpen tonal/signal contrast on schedule + vods marketing cards"
```

---

### Task 5: Final verification sweep (all five pages)

**Files:** none modified — verification only.

- [ ] **Step 1: Confirm hard constraints across the diff**

Run: `git diff main --stat` then `git diff main -- src/pages/HomePage.js src/pages/SchedulePage.js src/pages/VodsPage.js src/pages/AboutPage.js src/pages/Gear.js src/pages/GearInteractive.js`
Confirm across the whole pass:
- No `box-shadow`/`shadow-*` added.
- No `from-zinc-950 via-emerald-950 to-purple-950` gradient line changed.
- No grain-overlay opacity changed.
- No `tracking-eyebrow`/`font-mono` label opacity raised.
- No font-weight 500/600 introduced.

- [ ] **Step 2: Confirm already-correct copy was left alone**

Run: `git grep -n "text-white/65\|text-white/70" src/pages/HomePage.js src/pages/AboutPage.js`
Expected: HomePage:120, AboutPage:116, AboutPage:211 still present and unchanged (these were already at target).

- [ ] **Step 3: Side-by-side judgment on all five pages**

Open `/`, `/schedule`, `/vods`, `/about`, `/gear`. For each: every readable sentence is comfortably legible; chyron labels still read quiet; cards separate from background; emerald pops; CRT north-star intact (still feels like late-night cable, not a brighter SaaS app).

- [ ] **Step 4: Stop the dev server**

Stop the `npm start` process.

---

## Self-Review Notes

- **Spec coverage:** Legibility bumps (Tasks 1–3) cover spec section B. Signal & layering (Task 4) covers the "flat" section. Chyron-protection (Critical Rule + every guard step) covers section A. Hard constraints verified in Task 5. Scope = five marketing pages only; HomePage/AboutPage body copy already at target so they appear only in verification.
- **No placeholders:** all edits show exact before/after class strings.
- **Type consistency:** N/A (no functions/types); class-string values are consistent across tasks and guards.
