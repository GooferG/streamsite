# Bonus Tracker — Accounts, Saved Hunts & Restyled Export

**Date:** 2026-05-29
**Status:** Approved (design)
**Component touched:** `src/components/HuntTracker.js` (+ new hook, components, util, rules)

## Goal

Upgrade the bonus hunt tracker now that viewers can log in with Twitch. Add a
"start a hunt" step (name it before the panels appear), persist hunts to the
logged-in viewer's account, keep a track record of completed hunts, and restyle
the export image to match the site register.

## Decisions (from brainstorming)

- **Persistence:** client-write to the viewer's own subcollection, gated by
  `isSelf` in `firestore.rules` (mirrors the `suggestions/{uid}` pattern). No new
  serverless endpoint.
- **Model:** one active hunt at a time + an archived history list.
- **Anon access:** hybrid. Anyone can use the tool locally; logging in adds
  cross-device save + history + recap export. Prominent "Connect Twitch to save
  your hunts" nudge. On login with a local hunt present, offer to claim it.
- **Start form:** hunt **name** (required) + **start balance** (optional, editable
  later in the financials panel).
- **Complete:** explicit "Complete hunt" button. Snapshots state → history →
  clears active.
- **History:** summary rows that expand to the full bonus list + squad split, with
  re-export per hunt.
- **Export:** restyled to site register. Two modes — squad split (anytime) and
  full hunt recap (completed hunts only; adds ending balance + stats).

## Tool States

A small state machine driven by whether an active hunt exists:

- **`idle`** — no active hunt. Renders `HuntStartScreen`: name + start-balance
  inputs, "Start hunt" button, login nudge (anon), and (logged-in) the
  `HuntHistory` panel below.
- **`active`** — hunt in progress. Renders the existing panels (bonus list,
  financials, squad split, banned slots) plus a header with the hunt name and a
  **Complete hunt** button.

Logged-in viewers resume their active hunt on any device (Firestore); anon users
resume from localStorage.

## Data Model

Client-written under the viewer's own user doc:

```
users/{twitchId}/
  active_hunt/current      (single doc — in-progress hunt, or absent)
  hunts/{huntId}           (subcollection — completed hunts; the track record)
```

Hunt doc shape (same shape for active and completed; same shape used in
localStorage for anon users):

```js
{
  name: string,                 // required
  casino: string | null,        // reserved; not collected in v1 start form
  startBalance: number | '',    // editable in financials panel
  finishBalance: number | '',
  bonuses: [{ id, slot, stake, win }],
  gamblers: [{ id, name, inFor }],
  bannedSlots: string,
  status: 'active' | 'completed',
  startedAt: Timestamp | number,
  completedAt: Timestamp | number | null,
}
```

`casino` is kept in the shape (cheap forward-compat) but is NOT collected by the
v1 start form — the start form is name + start balance only. Do not build UI for
it in v1.

### Firestore rules

Add owner-gated access to the two new subcollections, mirroring
`suggestions/{uid}`. Subcollection `match` blocks are independent — they do NOT
inherit the parent `users/{uid}` `write: if false`, so opening these does not
expose the parent user doc.

```
match /users/{uid} {
  allow read: if isSelf(uid) || isStaff();
  allow write: if false;

  match /active_hunt/{docId} {
    allow read, write: if isSelf(uid) || isStaff();
  }
  match /hunts/{huntId} {
    allow read, write: if isSelf(uid) || isStaff();
  }
}
```

(Existing top-level `users/{uid}` block is extended with the nested matches; the
server-only `write: if false` on the user doc itself is unchanged.)

### Anon → account migration

When an anon user with a local active hunt logs in, prompt:
**"Save this hunt to your account?"** On confirm → write the local hunt to
`active_hunt/current` and clear localStorage. On decline → leave it local (it
will be shadowed by any account active hunt; the account hunt wins).

## Storage Layer (isolation)

Extract a single hook that hides *where* data lives so `HuntTracker` never
touches Firestore or `localStorage` directly:

```js
useHuntStore() => {
  status,            // 'idle' | 'active'
  activeHunt,        // current hunt or null
  history,           // completed hunts (logged-in only; [] for anon)
  isLoggedIn,
  localHuntPending,  // anon-local hunt present at login time (for claim prompt)
  startHunt({ name, startBalance }),
  updateHunt(patch), // debounced persist of any field(s)
  completeHunt(),    // snapshot active → history, clear active
  claimLocalHunt(),  // anon→account migration
  discardLocalHunt(),
}
```

- **Logged-in backend:** `onSnapshot` on `active_hunt/current` and on the `hunts`
  subcollection (ordered by `completedAt desc`). Writes via `setDoc`/`updateDoc`,
  debounced (~500ms) to avoid a write per keystroke. `completeHunt` does a
  `setDoc` to `hunts/{newId}` then deletes `active_hunt/current`.
- **Anon backend:** localStorage, same interface. `history` is always `[]`
  (no anon history). `completeHunt` clears the local active hunt.
- Backend is chosen by auth state from `useTwitchAuth`. On auth change, the hook
  re-subscribes; `localHuntPending` is computed at the transition anon→logged-in.

This is the one structural change to today's component, which persists inline.

## Components

- **`HuntStartScreen`** — idle-state form (name + start balance), "Start hunt"
  button, login nudge for anon, and `HuntHistory` below for logged-in users.
- **`HuntTracker`** — slimmed to the active-state panels; reads/writes through
  `useHuntStore`. Gains a header (hunt name + Complete button). Removes inline
  `load`/`save`/`persist`; those move into the hook.
- **`HuntHistory`** — summary rows (name, date, profit, # bonuses, best X) that
  expand to the full bonus list + squad split. Each row has a re-export (recap)
  button.
- **`huntExport.js`** (util) — canvas rendering extracted from the component and
  restyled. Two exported functions (see below).

## Export (restyled, two modes)

Extracted to `src/utils/huntExport.js`. Restyled to the site register:
zinc-broadcast dark gradient, emerald/orange/purple accents, mono uppercase
eyebrow labels, tabular nums — matching the tool panels (replacing today's
purple "Gambler Split" card).

- **`renderSplit(hunt)`** — equity split table. Available during an active hunt
  (today's behavior, restyled). Triggered by the in-tool Export button.
- **`renderRecap(hunt)`** — completed hunts only. Adds a header (hunt name, date)
  and a stat band (start, finish, profit, req X, best X) above the split.
  Triggered by the Complete flow and by re-export in history.

Both return/trigger a PNG download (same canvas → `toDataURL` → anchor click
mechanism as today). Stats (req X, best X, profit) are computed from the hunt
doc, reusing the existing `fmt`/`fmtX` formatters (also moved or shared).

## Edge Cases

- Empty hunt name → "Start hunt" disabled. Start balance optional.
- Complete with zero gamblers → allowed; split renders empty, recap still shows
  stats.
- Logout mid-hunt → active hunt remains in Firestore; local view clears;
  re-login restores it.
- Firestore write failure → keep last good state in memory, show a small inline
  error, do not lose input. (Debounced writer catches and surfaces.)
- Two devices editing the same account hunt → `onSnapshot` keeps them in sync;
  last write wins per field (acceptable for a single-user tool).

## Out of Scope (v1)

- Casino field UI in the start form (shape reserved only).
- Editing/reopening a completed hunt back into the editor.
- Multiple concurrent drafts.
- Server-side validation endpoint (client-write is sufficient given self-gated
  rules and the low-stakes nature of the data).

## Files

- `firestore.rules` — add nested `active_hunt` + `hunts` matches under `users`.
- `src/hooks/useHuntStore.js` — **new.** Storage abstraction.
- `src/utils/huntExport.js` — **new.** Extracted + restyled canvas export.
- `src/components/HuntStartScreen.js` — **new.**
- `src/components/HuntHistory.js` — **new.**
- `src/components/HuntTracker.js` — slim to active-state panels + header; consume
  the hook; drop inline persistence and inline export.
- `src/pages/GambaPage.js` — no change expected (still mounts `HuntTracker`),
  unless the idle/active switch is hoisted; default is to keep the switch inside
  the tracker entry so the mount point is unchanged.
