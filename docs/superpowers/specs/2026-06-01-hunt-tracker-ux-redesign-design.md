# Hunt Tracker UX Redesign — Design

Date: 2026-06-01
Status: Approved (brainstorm); refined with UI-designer critique of all three surfaces
Component: `src/components/HuntTracker.js` (+ `SuggestionsPanel.js`, `HuntStartScreen.js`,
`src/pages/LiveHuntPage.js`, `src/pages/HuntSuggestPage.js`, new files)
Register: product (utility surfaces inside `/gamba` and the public share/intake links per PRODUCT.md)

Scope note: the original brainstorm covered the owner tracker only. After approval, a
UI-designer pass critiqued all three hunt surfaces (owner tracker, live spectator page,
suggestion intake page). This spec now also folds in the high-impact polish for the two
share pages. The critique's "optional bigger ideas" (OBS overlay/compact mode, chip-style
slot input, remember-me) are explicitly deferred, not in scope.

## Problem

The bonus hunt tracker is hard for new users to pick up, and its two shareable
links are scattered and behave inconsistently:

- The **live spectator link** (`/live/:shareId`, read-only) is a one-click button
  in the top header button cluster.
- The **suggestion intake link** (`/hunt-suggest/:linkId`, password-gated public
  submissions) is buried in the right column inside `SuggestionsPanel` (section 06).

A host who just created a hunt wants to make both live at once, but they live far
apart and one needs a password. The page is also tall and scroll-heavy because the
right column stacks Financials, Squad split, Soft banned, Suggestions, and Caller
stats vertically. Inputs are small for a tool often used on a phone or second
monitor. New users get no guidance.

## Goals

1. Co-locate the two links so they are created together right after starting a hunt.
2. Restructure the layout so bonus slots + the headline stats are the focus and the
   squad equity sheet sits quietly to the side, cutting page height.
3. A first-time, owner-only, dismissible **coachmark walkthrough** that explains the
   flow, replayable on demand.
4. Targeted enlargement of the high-traffic inputs without bloating the dense tool
   into a marketing surface.
5. Polish the **live spectator page** for glanceable, live, second-monitor viewing
   (profit hero, dominant now-opening card, stale-data signal, phone tables).
6. Polish the **suggestion intake page** for a fast mobile form-fill by a newcomer
   (password guidance, mobile stacking, progressive slot fields, error feedback).

Non-goals: changing link semantics (live stays one-click read-only; suggestion link
keeps its password gate), changing data model / Firestore shape, reworking the dense
owner data tables. Deferred (explicitly out of scope this pass): OBS overlay/compact
mode and transparent background for the live page, chip-style add-as-you-go slot
input, and localStorage remember-me on the intake page.

## Decisions (from brainstorm)

- **Link flow:** Grouped, each its own button. Live = 1 click; suggestion keeps its
  inline password step. Co-located, not merged.
- **Bar location:** Dedicated full-width "Broadcast & collect" row directly under the
  hunt title header, above the status bar.
- **Layout (Option B):** Full-width overall-stats band on top (under the share bar),
  then bonus list left / quiet right column. Validated via visual companion.
- **Walkthrough trigger:** First visit, logged-in owner only, dismissible,
  localStorage-gated, replayable.
- **Walkthrough style:** Spotlight real elements (coachmarks) with a **hybrid
  fallback** to a centered card + mini-mockup when the target element is absent.
- **Tour button:** `?` icon (HelpCircle) in the header. Fires auto-tour on first
  active-hunt view (not on the start screen).
- **Sizing:** Targeted — primary inputs, add-bonus form, start form, share bar.
  Tables/rows/pills stay dense.
- **Share pages in scope:** both the live spectator page and the suggestion intake
  page get their high-impact critique fixes folded into this same effort.

## Architecture

### 1. Broadcast & collect bar

New presentational section rendered in `HuntTracker.js` between the hunt header
(`px-4 py-3 border-b`) and the status bar. Owner-only (`isLoggedIn`), since both
links are already owner-gated.

Full-width strip, `grid grid-cols-1 sm:grid-cols-2 gap-2` (stacks on mobile),
tagged `data-tour="share-bar"`. Two cells:

Design the two cells as distinct **tracks**, not matching twin buttons (critique #1):
they are different functions and should read that way at a glance.

- **Live cell — WATCH track (broadcast / output).** Lifts the existing live-share UI
  out of the header button cluster. Reuses the current `shareId` / `startSharing` /
  `stopSharing` / `copyShareLink` logic verbatim — only the markup location moves.
  - Accent: red (the live pulse) when sharing; `Radio` icon. One-word mono eyebrow
    "Watch" above the control.
  - Not sharing: "Go live" button.
  - Sharing: `● LIVE` pulse dot + read-only `/live/:id` URL field (select-on-focus,
    visible — do not hide it behind a tooltip) + Copy + Stop.
- **Collect cell — COLLECT track (intake / input).** Reuses the existing
  `LinkControls` component, moved out of `SuggestionsPanel`. No logic change:
  create-with-password → Collecting/Closed status + URL + Copy + Close/Re-open +
  Kill. Props are the same intake-link props `HuntTracker` already passes down
  (`linkId`, `linkOpen`, `linkBusy`, `linkError`, `onCreateLink`, `onToggleLink`,
  `onDeleteLink`).
  - Accent: `purple-gamba` / `purple-bright`; `LinkIcon`. One-word mono eyebrow
    "Collect" above the control.

**Anti-mispaste (critique risk #1).** Both tracks have a pulsing dot and a copy
button, so a host could paste the wrong link mid-hunt. The copy buttons name what
they copy: "Copy watch link" / "Copy collect link" (sentence case). Distinct verbs
at the point of action, not color alone.

**Shared copy-link control.** The header and `SuggestionsPanel` currently have two
near-duplicate Copy/Copied controls (`Check`/`LinkIcon` + label) with slightly
different padding/borders. Factor one small `CopyLinkButton` so both tracks are
pixel-consistent; reuse it for any other copy affordance.

`LinkControls` is **exported** from `SuggestionsPanel.js` (or extracted to its own
`src/components/HuntLinkControls.js` — preferred, see Components) so both the bar
and the now-trimmed suggestions panel can import it. After this change,
`SuggestionsPanel` no longer renders `LinkControls`; it keeps RosterSearch, import
flow, and the suggestion pill list.

**Header cluster, regrouped (critique #3).** Once the live-share block leaves the
header (its logic moves to the WATCH cell) the cluster is still crowded. Regroup:

- The phase toggle (Start opening / Edit bonuses) is a mode switch; group it with
  the title/identity on the left, not with the action buttons.
- Right cluster, primary: **Export split** and **Complete** only (the two the host
  reaches for).
- **Demote Discard** and **park the `?` tour button** in an overflow `⋯` menu (or, if
  an overflow menu is more than this pass wants, push Discard far right at low
  contrast and place `?` at the far-left of the cluster at `text-white/40`). Discard
  must not sit inline next to Complete where a mis-click is costly.
- The inline confirm-swap pattern stays. Gate it both ways: while `confirmingComplete`
  hide the Discard trigger (already done) AND while `confirmingDiscard` hide the
  Complete trigger, so the two confirms never produce a 4-button scramble.
- The header's Complete + Export wrapper gets `data-tour="complete-actions"`.
The old `SHARE LIVE` / live-status block is removed from the header.

### 2. Layout restructure (Option B)

Active-hunt body reorders to:

```
header (title, phase toggle, ?, Export, Complete, Discard)
broadcast & collect bar          [owner only]
status bar (Bonuses / Squad / local-only / error)
overall-stats band (full width)  [Profit · Req X · W/L mult · Total wins + Start/Finish balance]
body grid (lg:grid-cols-2):
  LEFT  — Bonus list (01): add form / opening current-slot / table  [data-tour="add-form" on the form]
  RIGHT — quieter stack:
            Squad split equity (03)   [was 02/03 area]
            Soft banned (04)
            Suggestions (06)          [data-tour="suggestions"; LinkControls removed]
            Caller stats (07)
```

- The **overall-stats band** is a new full-width container under the status bar. It
  hosts the four headline stats (Profit, Req X, W/L Multiplier, Total wins) plus the
  Start/Finish balance inputs (moved out of the old right-column "Financials" §02).
  Visually it leads the body; styled as a band (subtle emerald tint, denser than a
  marketing hero, per register).
- **Render as one instrument, not a gap grid (critique #2).** A single horizontal
  row of cells separated by hairline `divide-x divide-white/10` (not gaps + bordered
  cards), `py-2.5` per cell. `StatCell` today is a fixed bordered box at `text-base`
  (`px-3 py-2.5 border`); add a borderless / divider-friendly variant (or a `size`
  / `hero` / `bare` prop) so the band reads as a continuous readout rather than four
  detached boxes. Keep `StatCell` for the existing right-column / modal / live-page
  uses unchanged.
  - **Profit is the hero:** ~1.5× the value font size of the other cells, carried by
    its existing emerald/red sign color. The other three stay uniform so profit pops
    without any JACKPOT treatment.
  - Order left-to-right by what the host watches live: Profit · Req X · W/L mult ·
    Total wins, then Start and Finish balance as the two rightmost cells of the same
    band.
  - **Editable vs computed signal (critique risk #2):** the two balance cells use the
    `inputCls` border (the border *is* the "type here" cue); the four computed cells
    render with no border so Profit never looks editable and the inputs never look
    static. No extra labels needed for this distinction.
  - On small screens the band collapses to a 2×2 (or a single horizontal-scroll strip
    of cells) so three stacked full-width bands (share bar + stats + first list rows)
    don't push the first bonus row off the initial viewport (critique risk: mobile
    Option B). Goal: a bonus row is reachable within one thumb-scroll.
- The right column drops "Financials" as a separate section (its stats moved to the
  band; its balance inputs moved to the band). It now reads as the quiet equity +
  context side: Squad split, Soft banned, Suggestions, Caller stats. Section labels
  on the right may dim slightly to signal secondary status.
- Existing computed values (`stats`, `gamblerRows`, `callerStats`, `displayBonuses`,
  `rowList`) are unchanged — only JSX placement moves.

### 3. Coachmark tour

New files:

- `src/hooks/useFirstVisit.js` — tiny hook wrapping `localStorage`. Returns
  `[seen, markSeen]` for a given key (`'huntTourSeen'`). Guards against SSR / disabled
  storage (try/catch, treat failures as "seen" so the tour never hard-blocks).
- `src/components/HuntTour.js` — the overlay + step engine.

**Mechanism (no new dependency).** A fixed full-viewport overlay. For the current
step, look up its target by `document.querySelector('[data-tour="<key>"]')`:

- **Target present:** measure `getBoundingClientRect()`. Render a dimmed overlay
  with a transparent cut-out box (4-rectangle mask or a box-shadow `0 0 0 9999px`
  spotlight) over the element, plus a tooltip card anchored adjacent (auto-flips
  above/below based on available space). Re-measure on resize/scroll. If the measured
  rect is zero-size (target hidden mid-tour), fall back to the centered card for that
  step rather than ring an empty hole.
- **Target absent:** render a centered card with a short mini-mockup illustration
  (small inline JSX, e.g. a fake suggestion pill, a fake stat row) instead of a
  spotlight.

**Overlay look (critique risk: cheap-tour tells).** The page is already dark, so a
standard ~50% black scrim looks muddy and the spotlit element does not pop. Dim less
(≈35-40%) and pull the eye with the highlight, not the contrast: a thin
`emerald-signal` ring plus a slight outward glow on the spotlit element. Emerald is
the brand primary, so this stays on-register instead of generic product-tour blue.

**Steps:**

| # | Title | Target (`data-tour`) | Fallback card |
|---|-------|----------------------|---------------|
| 1 | Welcome — what this does | (none, always card) | intro copy |
| 2 | Your two links | `share-bar` | mini live + collect cells |
| 3 | Where suggestions land | `suggestions` | demo person + pills |
| 4 | Accept / reject a pick | (always card) | animated fake pill: open → in bonus → Got in / Nope |
| 5 | Log & open bonuses | `add-form` | mini add-form / opening note |
| 6 | Finish up | `complete-actions` | Complete + Export note |

Step 4 is always the fallback card (the most important explanation, kept reliable
regardless of whether a real suggestion exists). Header `?` button and the
Complete/Export buttons get `data-tour="..."` attributes; `complete-actions` wraps
the header's Complete + Export buttons.

**Controls.** Skip (top-right, ends + `markSeen`), Back (disabled on step 1), Next
(label "Done" on last step), step counter "n / 6". `Escape` = skip. Buttons are
keyboard-focusable; overlay traps focus while open.

**Triggering.** In `HuntTracker`, when `status === 'active'` and `isLoggedIn` and
`!seen`, open the tour (once). Skip/finish calls `markSeen()`. The `?` button sets
an explicit `tourOpen` state that opens the tour ignoring `seen` (replay). The auto
path and replay path share one `tourOpen` boolean; `seen` only gates the auto-open.

**Two audiences, one tour (updated after testing).** The tracker is usable logged
out (local-only hunt), and an anon visitor reaching an active hunt should also be
oriented. So the tour auto-opens once on the first active view for **both** owners
and logged-out visitors (gated only by the `huntTourSeen` flag), and `HuntTour`
takes an `isLoggedIn` prop that swaps copy on the owner-only beats:
- Step 2 ("Your two links") becomes "Go live and collect picks" with a "log in with
  Twitch to unlock" nudge, since the share bar is owner-only and absent for anon.
- Step 3 and step 6 reword to future tense / add a save-needs-an-account nudge.
- The steps that apply to everyone (welcome, accept/reject a pick, log + open
  bonuses, stats) stay as-is.
Auth-gated targets (share bar, suggestions panel) are absent for anon, so those
steps render the centered fallback card automatically (never a spotlight on a
missing node). The replay control (`⋯` "How it works") is in the header action
cluster, which renders for anon too, so logged-out visitors can replay.

**Motion.** Step 4's pill animation and the spotlight transition are gated behind
`prefers-reduced-motion`. A short eased translate/resize of the spotlight
(~200-250ms) reads polished; under reduced motion the spotlight cross-fades between
steps instead of animating geometry, and step 4 shows static end states. Honoring
this is required by PRODUCT.md (best-effort, not a hard gate).

### 4. Targeted sizing

- Shared `inputCls` in `HuntTracker.js` and `SuggestionsPanel.js`: `px-3 py-2` →
  `px-3.5 py-2.5`. Keep `text-sm`. (Both files declare the same string; update both.)
- Add-bonus form container (`collecting`): `p-3 space-y-2` → `p-4 space-y-3`;
  "Log bonus" button `py-2` → `py-2.5`; Super / 5-scat toggles `py-2` → `py-2.5`.
- Start-hunt form (`HuntStartScreen`): already roomy (`py-2.5`); nudge Start button
  + outer spacing to match, no big change.
- Share bar: built new at comfortable size — read-only URL fields and copy buttons
  ~`py-2.5`, easy tap targets.
- Left untouched: bonus table rows, squad table, caller leaderboard, suggestion
  pills, the opening-phase win input (already `text-base`).

No color/font token changes. Padding/spacing only on high-traffic inputs.

### 5. Add-bonus form ergonomics (critique #4)

- **Tab order:** the Super / 5-scat toggles currently sit between the stake and
  caller inputs, breaking the natural type-flow. Reorder the form to slot → stake →
  caller → markers row → Log bonus, so the markers are a qualifier just above submit,
  not a mid-form interruption.
- **Autofocus** the slot autocomplete on entering the collecting phase so the host
  types straight away.
- The bonus list's add-form wrapper gets `data-tour="add-form"`.

### 6. Opening current-slot card (critique #5)

This card is the live-driving surface during opening. Refinements (logic unchanged,
layout only):

- Win input gets its own full-width row (it is typed every slot); the control row
  beneath holds Prev · Later · Next as three evenly-weighted controls, Next staying
  the purple primary. No more `flex-wrap` where Later wraps and detaches Prev/Next.
- Add a 2px progress hairline tied to `openedCount / bonuses.length` under the card
  header so progress reads at a glance from across the room.
- Keep the markers (S pill, star, Later) on the same baseline row as the `text-2xl`
  slot title rather than stacked above it, so the title stays the one big thing.

### 7. Secondary polish (tracker)

- **Panel numbering** is inconsistent (01, 02, 03, 04, then 06, 07; no 05) and will
  not match reading order after the Option B reshuffle. Drop the numeric codes from
  the secondary right-column panels; keep codes only on the two primary regions
  (bonus list, stats band), or renumber sequentially once layout settles.
- **Signal the quiet right column** without looking broken: one notch lower contrast
  on its panel labels (`text-white/50` vs `/65`) and tighter `space-y`. Do not gray
  out values (reads as disabled/empty).
- **Voice-rule fix:** the soft-banned textarea placeholder uses an em dash ("Slots to
  avoid this hunt — comma or newline separated"). Replace with a period: "Slots to
  avoid this hunt. Comma or newline separated."
- **Empty states** ("No bonuses logged.", "No squad added.", "No calls tagged.", "No
  suggestions imported.") are uniformly loud uppercase mono. Soften to sentence-case
  body ("Nothing logged yet", etc.); keep dense.
- **5-scat star** uses raw `yellow-400`, the only off-palette token. **Decision:**
  keep the gold but make it intentional, a documented `gold-scatter` token in
  `tailwind.config.js` (value ~`#fbbf24`), and use it everywhere the 5-scat star and
  S/star markers render (tracker rows, opening card, live page). Never let it co-occur
  with a gold/red slot-machine treatment (casino-chrome anti-reference); it is a
  rare-hit flag only.
- **Caller-stats highlight icons** mix a lucide `Trophy`, a 🧱 emoji, and no icon.
  Pick one register (all lucide, or accept emoji as intentional grit consistently).

### 8. Live spectator page (`LiveHuntPage.js`)

Polish for a glanceable, live, second-monitor surface. No data-model, Firestore, or
route changes; presentational + state-detection only.

- **Phase-aware lead.** The live page has two phases, and during **collecting** no
  wins exist yet, so Profit / Best X / W-L are all `—` and there is no current slot.
  Leading with a dead Profit `—` for the whole collecting phase is wrong. So the lead
  is phase-aware:
  - **Collecting → "Building the hunt".** Lead with a "Building the hunt" eyebrow, the
    bonus count as the big number (e.g. "12 bonuses lined up") and total staked
    beneath, plus a calm one-line note that opening has not started yet. No profit
    hero, no now-opening card (there is no current slot in this phase).
  - **Opening → Profit hero.** Once opening starts, the lead switches to the Profit
    hero (below) and the now-opening card appears.
  Both derive from data already in `computeStats` (`bonusCount`, `totalStakes`,
  `profit`); the switch keys off `hunt.phase`.
- **Profit as a hero number (opening phase).** Today Profit is one of four equal
  `StatCell`s while the hunt name is `text-3xl/4xl`. In the opening phase, pull Profit
  out into a dedicated large number (`text-3xl`+) near the title, keeping its
  emerald/red sign color, with a small mono eyebrow ("Profit") so it reads even on a
  muted monitor where color alone is ambiguous. Demote Start / Finish / Best X to a
  supporting strip.
- **Bonuses count cell.** Add a single "Bonuses" cell to the supporting stats strip
  showing opened over total, e.g. "12 / 30" (opened = bonuses with a win entered,
  matching `openedCount` on the owner side; total = all logged bonuses). This shows in
  both phases, so spectators always see how deep the hunt is, not only during opening.
  The now-opening card's own progress readout (below) is in addition to this and is
  fine to keep; the two are consistent because both derive from the same counts.
- **Two-column body to cut the scroll.** Today the page is one tall `max-w-3xl`
  stack (lead → stats → now-opening → bonus table → squad split → footer), a long
  scroll on a second monitor. Widen the page (to roughly `max-w-5xl`) and split the
  body: bonus table in a left column, **squad split (equity) beside it on the right**,
  both sitting directly under the shared header / phase / stats / now-opening band.
  Equity is then visible without scrolling past the whole bonus list. This applies in
  both phases (collecting and opening). Below the responsive breakpoint it stacks back
  to one column (bonuses first, then squad split), so mobile is unchanged in order.
  The shared top band (live eyebrow, name, phase, lead, stats strip, now-opening card)
  stays full-width above the two columns.
- **Make the "Now opening" card the focal point.** During the opening phase, reorder
  it directly under the title, above the supporting stats. Bump the slot name to
  `text-3xl sm:text-4xl`, add vertical padding. Re-introduce the `super` (S pill) and
  `fiveScat` (star) markers (the live card currently drops them even though the data
  and the table rows show them). Add `{openedCount} / {bonuses.length} opened`
  progress (reuse the tracker's logic). Show the next-up stake (`· {fmt(stake)}`) for
  parity with the owner card.
- **Stale-data / connection signal.** The red pulse currently animates regardless of
  whether Firestore is still pushing. Track last-snapshot time; if no update has
  arrived in N seconds, downgrade the eyebrow (e.g. "Reconnecting…" / "Last update
  Xs ago") and stop the pulse. Critically, give the `onSnapshot` **error** path its
  own state ("Lost the signal, retrying…") distinct from genuine missing/ended, so a
  transient network blip no longer reads as "This hunt isn't live".
- **Phone tables.** Both tables are `min-w-[420px]` inside `overflow-x-auto` with no
  scroll affordance, and the Slot cell is `max-w-[200px] truncate`. Add a right-edge
  fade on the scroll container so it is obvious there is more, add `title={b.slot}` on
  truncated names, and consider a stacked Slot + (win/X) card layout below `sm` for
  the bonus table (the densest content most likely read on a phone).
- **States feel thin and one copy line breaks voice rules.** Give loading / missing /
  active a shared top live-eyebrow frame so transitions feel continuous. Rewrite the
  missing-state body copy ("The stream may have ended sharing") to something plain and
  warm, e.g. "Nothing live right now. Catch the next hunt on stream." Verify the curly
  apostrophe in "isn't" renders at `text-[10px]` (no tofu box on an overlay).
- **Secondary:** color the squad-split payout emerald/red vs `inFor` (parity with the
  owner tool, which the live page omits); bump the current-row highlight from
  `bg-purple-gamba/15` toward `/25` or add a left accent so it is visible on a dim
  overlay; gate the pulse animation behind `prefers-reduced-motion`; reserve height
  for the now-opening card so a phase flip does not jump the layout on an always-on
  tab. The collecting-phase eyebrow "▸ Collecting bonuses" is owner jargon for a
  spectator; "Building the hunt" or "Picking slots" reads clearer.

### 9. Suggestion intake page (`HuntSuggestPage.js`)

Polish for a fast mobile form-fill by a newcomer not in on the joke. No data-model or
API changes; form UX + copy only.

- **Explain where the password comes from** (the biggest drop-off). Add a one-line
  helper under the password field, sentence case, e.g. "It's in chat or on stream
  right now" (owner can adjust the literal source). Change the `BAD_PASSWORD` error
  from "Wrong password." to point them back: "That password didn't match. Check chat
  for the current one." This doubles as the strongest anti-phishing trust cue.
- **Stack name + password on mobile.** The `grid grid-cols-2` has no responsive
  prefix, cramming both at 320px. Single column by default, `sm:grid-cols-2` and up.
- **Progressive slot fields.** Six always-visible empty boxes read as "fill all six"
  homework and push submit below the fold. Show one field, reveal the next only once
  the previous has a value, capping at `MAX_SLOTS` (6). Rendering change only; the
  existing `SlotAutocomplete` already works field-by-field. (Chip-style add-as-you-go
  is the cleaner long-term pattern but is deferred — progressive disclosure gets most
  of the benefit at low risk.)
- **Fix the dead disabled button + unassociated error.** Either keep the submit
  enabled and surface what is missing on tap ("Add your name to send" / "Enter the
  password to send"), or show a quiet line near the button. On `BAD_PASSWORD`, mark
  the password field errored (red border) and move focus to it. Give `submitError`
  `role="alert"` so it is announced.
- **Cold-newcomer framing.** Add one plain sentence under the hunt name of what this
  is and what happens to picks, e.g. "Pick the slots you want played on this stream.
  The streamer reviews the list live." Keep `huntName` as the big anchor.
- **Secondary:** password reveal (eye) toggle, keyboard-reachable; echo the count on
  success ("Sent 3 picks to {huntName}."); the "Edit / add more" button uses slash
  parallelism and `reset()` wipes the slots, so rename to "Add more picks" (or
  genuinely preserve the submitted slots); give the closed and ERROR states a next
  step ("Catch the next hunt on stream." / "Try refreshing."); add `aria-label={`Slot
  ${i+1}`}` to each autocomplete input (currently a screen reader hears unlabeled
  fields); square off the autocomplete dropdown (`rounded-lg`/`shadow-xl` drifts from
  the square card) and reuse the card surface. Note: `SlotAutocomplete`'s dropdown is
  `onMouseDown`-only with no arrow-key/Enter handling; full keyboard support there is
  a known gap, fix opportunistically if the component is touched.

### 10. Height-capped lists with internal scroll (tracker + live page)

Long hunts make both surfaces stretch into a tall page. Cap the **bonus list** and
the **squad-split equity** on both the owner tracker and the live page so the page
height stays bounded. (No collapse toggle: with the scroll cap, collapse is redundant
and adds toggle state and collapsed-header edge cases for no real gain.)

- **Height cap + internal scroll.** Each list body has a max height (roughly 60vh on
  the tracker, a tighter cap on the live page so the two-column body stays balanced);
  past it the body scrolls inside its own panel with a thin scrollbar rather than
  growing the page. The existing tables already sit in `overflow-x-auto` wrappers, so
  this adds a vertical `max-h-* overflow-y-auto`.
- **Pinned header + totals on scroll.** While a capped list scrolls internally, the
  column header row stays pinned to the top of the scroll area and the Totals row
  stays pinned to the bottom (`position: sticky`), so the column meaning and the
  running totals are always visible. Rows scroll between them. (The owner squad
  table's footer total pins the same way; the live squad table has no totals row, so
  just its header pins.)
- A short hunt under the cap looks exactly as it does today (no scrollbar until the
  content exceeds the cap).

## Components

- `src/components/HuntTracker.js` — restructure JSX (bar, stats band, column
  reorder), add `?` button + tour state + `data-tour` attributes, sizing tweaks.
  Remove header live-share block (logic moves into the bar cell).
- `src/components/HuntLinkControls.js` — **new**: extract `LinkControls` from
  `SuggestionsPanel.js` into its own file so both the share bar and the panel can
  import it. (`SuggestionsPanel` imports it back if it still needs it — it does not
  after this change, so the panel just stops rendering it.)
- `src/components/SuggestionsPanel.js` — remove inline `LinkControls`, import the
  extracted one only if needed (not needed post-change); keep RosterSearch + import
  + pills; add `data-tour="suggestions"` wrapper; update `inputCls`.
- `src/components/HuntStartScreen.js` — minor sizing parity.
- `src/components/HuntTour.js` — **new**: overlay, spotlight, step cards, controls.
- `src/hooks/useFirstVisit.js` — **new**: localStorage-backed first-visit flag.
- `src/components/CopyLinkButton.js` — **new** (small): one Copy/Copied control
  reused by both share-bar tracks (and anywhere else a link is copied), so the two
  tracks stay pixel-consistent. Takes the URL + a label ("Copy watch link" etc.).
- A small height-capped scroll wrapper (or just `max-h-* overflow-y-auto` utility
  classes with `position: sticky` header/footer cells) for the bonus list and squad
  split on both the tracker and the live page (§10). No new stateful component needed
  since collapse was dropped; if a wrapper helps share the sticky-edge styling, keep
  it tiny and presentational.
- `src/components/StatCell.js` — add a borderless / `hero` variant (or `size` prop)
  for the stats band; existing call sites keep current behavior.
- `src/pages/LiveHuntPage.js` — spectator polish (see §8). No data/route change.
- `src/pages/HuntSuggestPage.js` — intake-form polish (see §9). No data/route change.

## Data flow

No data-model or Firestore changes. The tour reads only `localStorage` and the DOM.
Live-share and intake-link state continue to flow through the existing
`useHuntStore` hook and `authedFetch` calls; only the rendering location of those
controls moves. The stats band consumes the same `computeStats` output already in
the component.

The live page keeps its existing `onSnapshot` subscription on `shared_hunts/:id`;
the stale-data signal is derived client-side from the time of the last snapshot (a
local timer / `lastUpdate` state), with the error callback routed to a new distinct
state. No change to what is written or the Firestore rules. The intake page keeps its
existing `/api/hunt-suggest/info` + `/api/hunt-suggest/submit` calls; all changes are
client-side form UX and copy.

## Error handling

- `useFirstVisit` swallows `localStorage` access errors and treats them as "seen"
  (private-mode / disabled storage never traps the user behind a tour).
- Tour target lookup tolerates `null` (element absent) → fallback card. No throw if
  a `data-tour` element is missing.
- Spotlight re-measurement guards against `0`-size rects (element hidden mid-tour) by
  falling back to the centered card for that step.
- Existing link error states (`linkError`) render unchanged inside the moved
  `LinkControls`.

## Accessibility

- Tour overlay: focusable controls, `Escape` to skip, focus trapped while open,
  `aria-modal` on the dialog card. Honors `prefers-reduced-motion` (per PRODUCT.md,
  best-effort, not a hard gate).
- Bigger inputs improve tap targets (most users on phone / second monitor).
- The bar, forms, and tour stay keyboard-navigable (product-register requirement:
  nav/forms/admin keyboard-sensible).

## Testing

No CI gate exists; tests are best-effort unit tests under `src/**/__tests__/`.

- `useFirstVisit` unit test: returns `false` then `true` after `markSeen`; tolerates
  a throwing `localStorage` mock (returns "seen").
- `HuntTour` smoke test: renders step 1, Next advances, Skip/Done calls `markSeen`,
  Escape closes. Target-present vs target-absent both render without throwing.
- Manual (tracker): create a hunt as owner → tour auto-opens once → skip → reload →
  does not reopen → `?` replays. Both links creatable from the bar. Layout matches
  Option B on desktop and stacks on mobile so a bonus row is reachable in one scroll.
- Manual (live page): open `/live/:id` on a phone width → name + profit hero + now-
  opening card read at a glance; flip phases and add a bonus on the owner side and
  confirm the live page updates without a jarring jump; simulate dropped updates and
  confirm the stale signal appears and the error state differs from "not live".
- Manual (intake page): open `/hunt-suggest/:id` at 320px → name/password stack, one
  slot field reveals progressively, password helper shows, a wrong password errors on
  the field with focus, success echoes the count.

## Rollout

**Decision: two PRs.**

- **PR 1 — owner tracker:** share bar (WATCH/COLLECT + `CopyLinkButton`,
  `LinkControls` extraction), Option B layout + stats band, header regroup, add-form
  reorder, opening-card refinements, the coachmark tour (`HuntTour` + `useFirstVisit`),
  height-capped scroll on the tracker's bonus list + squad split, the `gold-scatter`
  token, and the secondary polish (panel numbering, em-dash placeholder, empty-state
  copy). Touches `HuntTracker.js`, `SuggestionsPanel.js`, `HuntStartScreen.js`,
  `StatCell.js`, `tailwind.config.js`, and the new tracker files.
- **PR 2 — share-page polish:** `LiveHuntPage.js` (§8: phase-aware lead, profit hero,
  now-opening card, bonuses cell, stale-data signal, two-column body, capped scroll,
  phone tables, state copy) and `HuntSuggestPage.js` (§9: lede, mobile stacking,
  progressive slots, password helper + reveal, error-on-field, success/closed copy).

Both are pure frontend: no env / serverless / Firestore-rule changes, no migration.
The tracker lazy chunk already isolates `HuntTracker`; new tracker files ride in the
same chunk. `LiveHuntPage` and `HuntSuggestPage` are separate route entries and their
edits are self-contained, so PR 2 is independent of PR 1. The shared `gold-scatter`
token lands in PR 1; PR 2 reuses it for the live page's star (sequence PR 1 first, or
duplicate the literal in PR 2 and swap to the token on merge).
