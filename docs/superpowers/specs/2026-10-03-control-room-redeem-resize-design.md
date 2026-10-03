# Control Room: Redeem tab, a resizable panel, and payout fixes

**Date:** 2026-10-03
**Status:** Approved in brainstorming (pending spec review)
**Builds on:** `docs/superpowers/specs/2026-09-28-control-room-design.md` (which listed redemptions and hand resizing as non-goals for v1)

## Problem

Viewers redeem store items ("Pick a Slot", "Roll a blunt") during the stream, and giveaway and prediction prizes file pending redemptions too. Handling any of them means leaving the page on stream for `/admin/redemptions`. The control room already gives staff giveaways and predictions in a floating panel on public pages. The redemption queue belongs there as well.

The panel is also a fixed 380px wide (400px docked) with content-sized height. On a big monitor it's cramped, and the queue makes that worse.

Two payout paths also need fixing before the queue is useful:

- **Bonus-buy giveaways are paid on the spot, but their redemption stays pending.** `confirm` files a pending `giveaway` redemption. `payout` writes the amount onto it (`paid $X`) but never changes its status. Every paid bonus buy waits for someone to click Fulfill in admin, so the queue would fill with wins that are already paid.
- **Prediction tickets can create a half-made user doc.** `settle` credits winners' tickets with `set(..., { merge: true })` on `users/{twitchId}`. For a winner who has never logged in, that creates a doc holding only `tickets`, `totalEarned` and `updatedAt`. On their first login `api/twitch-auth.js` sees the doc exists and only refreshes profile fields, so `twitchId`, `createdAt`, `totalSpent`, `lastDailyClaimAt` and `watchMinutes` are never written. The tickets themselves are kept.

## Scope and non-goals

- **In scope:**
  - A third panel tab, **Redeem**, that shows pending redemptions and lets staff fulfil them, or cancel and refund them, with an optional note.
  - Quiet signals for new orders: a tally, a tab LED and a pill counter.
  - Resizing the floating panel from its edges and bottom corners, and resizing the dock width from its left edge, by pointer and keyboard. Remembered per browser.
  - Logging a giveaway payout fulfils that winner's redemption.
  - Twitch login fills in any missing starter fields on an existing user doc.
- **Non-goals:**
  - Auto-opening the panel or playing a sound when an order arrives.
  - Chat lines on fulfil, or a new "up next" status. The redemptions API action set stays `fulfill | cancel`.
  - Migrating the existing backlog of paid-but-pending giveaway redemptions. They show in the Redeem tab once (already labelled `paid $X`) and are cleared by hand.
  - Changing how prediction tickets are paid. They're already credited inside the settle transaction.
  - Fulfilled and cancelled history in the panel. It stays in `/admin/redemptions`.
  - Resizing the phone sheet, or resizing from the top edge (the header is the drag handle).
- **Unchanged:**
  - `api/admin/redemptions.js`, `api/store/redeem.js`, `api/admin/hunts.js`, Firestore rules and indexes.
  - `/admin/redemptions`.
  - The Giveaway and Predict tabs and the timer engine.

## Decisions (from brainstorming)

1. **Quiet signal.** New orders light a `RED` tally, pulse the Redeem tab LED and add a counter chip to the pill. Nothing opens by itself and nothing plays a sound.
2. **Everything pending.** The queue holds the same set as `/admin/redemptions` pending (store `stream` orders, `giveaway` prizes, `prediction` payouts), tagged by kind, with `All / Stream / Payouts` filter chips. `virtual` items auto-fulfil and never queue.
3. **Same actions as admin.** Optional note, Fulfill, Cancel and refund. The redemptions API is unchanged.
4. **Edges plus dock width.** The floating panel resizes from its left, right and bottom edges and both bottom corners. The dock resizes from its left edge.
5. **Approach: a third listener in `ControlRoomProvider`.** It's the only option that can signal while the panel is minimized or on another tab. Rejected: a listener inside the tab (no signal when it isn't shown) and a server-kept counter doc (four write sites to keep correct).
6. **Bonus buys fulfil on Log payout.** The win is paid on the spot, so logging it closes the redemption. Rejected: keeping it pending as a "send the money" reminder, and filing no redemption at all (viewers would lose the row on `/account`).
7. **Prediction tickets stay paid at settle.** The fix goes in login, which repairs any partial doc, including ones that already exist. Rejected: banking ticket wins for viewers without an account (like `watch_bank`), which adds a second bank and reads inside the settle transaction.

---

## Part 1: Redeem tab

### Data

`ControlRoomProvider` gains a third `useLiveQuery`, enabled under the same conditions as the other two (staff, allowed route):

```js
query(
  collection(db, 'redemptions'),
  where('status', '==', 'pending'),
  orderBy('createdAt', 'desc'),
  fLimit(50)
)
```

- The `status asc, createdAt desc` composite index already exists in `firestore.indexes.json`. Staff can read `redemptions` under the current rules. Nothing needs deploying.
- Cost: the pending docs once per page load, then one read per change. Fine on Spark.
- `dataLost` and `dataGaveUp` now include this feed.
- The context exposes `redemptions` (newest first, as the query returns them), `redeem: { pending, unseen }`, and two actions: `markRedeemSeen(ms)` and `setRedeemFilter(filter)`.

### Seen tracking

- `redeemSeenAt` (epoch ms or `null`) is stored per browser.
- **Baseline:** if it's `null` when the first good snapshot arrives, it's set to the newest `createdAt` in that snapshot (or now, if the queue is empty). An existing backlog never pulses on first run.
- **Advance:** while the Redeem tab is actually visible (panel open in float or dock, tab is `redeem`, not ducked by a stage moment), `RedeemTab` calls `markRedeemSeen(newest createdAt)`. The value only moves forward.
- **Unseen** = pending redemptions with `createdAt > redeemSeenAt`. A doc without `createdAt` counts as seen.

### Queue view (`RedeemTab.js`)

- **Order:** oldest first. The client reverses the snapshot, so the queue reads as a to-do list.
- **Filter chips:** `ALL · STREAM · PAYOUTS`, each with its count (`STREAM 3`). Payouts are `giveaway` and `prediction`. Any other kind shows under All only. The choice is stored per browser (`redeemFilter`, default `all`).
- **Row:**
  - Line 1: avatar (or an empty square), item name, kind tag (`STREAM`, `GIVEAWAY`, `PREDICTION`).
  - Line 2 (`cr-lbl`): `displayName || twitchName || userId`, relative age (`just now`, `4m ago`, `2h ago`, `3d ago`), and `{cost}t` for kinds other than `giveaway` and `prediction` (they cost nothing).
  - An existing `note` shows in italics.
  - Actions: `Fulfill` (`cr-btn is-go`, the same label as admin) and `Refund` (`cr-btn`).
  - Clicking the row body (not a button) expands an optional note input above the actions. The note is sent with whichever action runs next. Only one row is expanded at a time.
- **Refund confirm:** the first press turns the button into `Confirm refund · 4s`, counting down. A second press inside 4s sends `cancel`. Otherwise it disarms.
- **Per row:** a busy state disables both buttons while the request runs. Errors show inline under the row and clear on the next action:
  - `NOT_PENDING` → `Already handled by someone else.`
  - `NOT_FOUND` → `This one's gone.`
  - other or network → `Didn't go through. Try again.`
  - A handled row leaves when the snapshot drops it. There's no optimistic removal.
- **Empty:** `cr-lbl` `redemptions`, the `IDLE` timecode, and `Nothing waiting.` A filter with no matches reads `Nothing in {filter}.`
- **Footer:** `Open in admin ↗` → `/admin/redemptions`. If the feed returned 50 docs, a line above it reads `Showing newest 50 · rest in admin`.

`useRedemptionAction.js` (beside `useGiveawayAction.js`) wraps `authedFetch('/api/admin/redemptions', { method: 'POST', body: { id, action, note } })` and keeps busy and error state per row id.

### Signals

- **Tally:** a fourth tally after `PRD`, reading `RED` when the queue is empty and `RED {n}` when it isn't. It's lit (amber tone) while anything is pending.
- **Tab LED:** `off` when the queue is empty, `on` while anything is pending, `pulse` while anything is unseen.
- **Pill:** the main label and tone keep their current priority (giveaway, then prediction, then `CONTROL ROOM`). When anything is pending, a small `RED {n}` chip follows the label and pulses while anything is unseen. The pill's accessible name adds `{n} redemptions pending`.
- **Chrome:** the Redeem tab joins the tablist (`REDEEM`), arrow keys cycle all three tabs, and the menu's `Open admin ↗` goes to `/admin/redemptions` while it's active.

### Pure helpers (`controlRoom/redemptions.js`)

`kindGroup(kind)` → `'stream' | 'payouts' | 'other'`, `filterQueue(list, filter)`, `queueOrder(list)` (oldest first), `filterCounts(list)`, `newestAt(list)`, `unseenCount(list, seenAt)`, `ageLabel(ts, now)`, `kindLabel(kind)`, `showsCost(kind)`.

---

## Part 2: Resizable panel

### Stored state

New fields in `goofer:control-room`, sanitized on read:

- `size: { w, h } | null`. The floating size. `h: null` means auto height. `w` is clamped to `[MIN_W, MAX_W]` and `h` to `>= MIN_H`. Anything invalid becomes `null`.
- `dockW: number | null`, clamped to `[DOCK_MIN, DOCK_MAX]`.
- `redeemSeenAt`, `redeemFilter` (Part 1). `TABS` gains `'redeem'`.

Stores written by older builds have none of these and fall back to today's behaviour: 380px wide with auto height, and a 400px dock.

### Limits (`geometry.js`)

| Constant | Value |
| --- | --- |
| `MIN_W` / `MAX_W` | 320 / 720 |
| `MIN_H` | 240 |
| `DOCK_MIN` / `DOCK_MAX` | 320 / 720 |
| `PAGE_MIN` | 480 (page width the dock always leaves) |

- `clampSize(size, view)`: `w` within `[MIN_W, min(MAX_W, vw - 2·EDGE)]`. `h` (when set) within `[MIN_H, vh - NAV_H - EDGE]`.
- `clampDockW(w, vw)`: within `[DOCK_MIN, max(DOCK_MIN, min(DOCK_MAX, vw - PAGE_MIN))]`.
- `resizeFrom(edge, start, dx, dy, view)` → `{ rect, size }` for `edge` in `l | r | b | bl | br`. Left-side edges move `x` so the right edge stays put. The result keeps the panel inside the viewport and inside the limits.
- `defaultRect(vw, w = PANEL_W)` takes the width.

Render re-clamps the stored size against the current viewport on every render, the same way it does for position. A window resize never rewrites the store.

### Floating behaviour

- **Handles:** 6px hit strips on the left, right and bottom edges and 12px squares at both bottom corners, with `ew-resize`, `ns-resize`, `nesw-resize` and `nwse-resize` cursors. They're plain absolutely-positioned children of `.cr-panel`, above the body.
- **Visible grip:** a small ridged grip in the bottom corner that faces the screen centre (bottom-left when the panel's centre is right of the viewport's centre). It's focusable, labelled `Resize panel`, and arrow keys resize by 16px (64px with Shift). The arrow pointing away from the panel grows it: on a bottom-left grip Left widens (the right edge stays put) and Right narrows; on a bottom-right grip it's the reverse. Down makes it taller and Up shorter.
- **Height:** stays auto (content-sized, capped at 70vh) until a bottom edge, a corner or a vertical arrow sets it. Width-only changes keep `h: null`.
- **Gesture:** pointer capture on the handle, and a live preview held in `ControlRoom` state (like `dragRect`). On release it commits through `panelActions.resizeTo(rect, size)`. `body.cr-resizing` holds the cursor and disables text selection for the gesture.
- **Interplay:** drag, undock, snap-to-corner, clamping and `defaultRect` use the stored float width in place of `PANEL_W`.

### Dock behaviour

- One handle on the left edge: a `role="separator"` with `aria-orientation="vertical"`, `aria-valuenow` set to the width, `aria-valuemin`/`aria-valuemax`, and `aria-label="Resize dock"`. Left widens the dock and Right narrows it, 16px per press (64px with Shift).
- While dragging, only the panel's width follows the pointer. On release, `panelActions.setDockW(w)` commits and the `--control-dock-w` effect reflows the page with the existing 300ms body transition. A keyboard step commits at once.
- The dock ghost (shown while dragging toward the edge) uses the stored dock width.

### Safety

- A resize is cleared by every path that clears a drag: minimize, close, auto-restore, a narrow-mode flip, and lost pointer capture.
- Resizing never adds `cr-lifted` or any other transform. `.cr-panel` still has no transform or filter at rest, so fixed modals inside it (`SettleModal`, `WinnerModal`) still escape.
- The phone sheet renders no handles.

### Menu

`Reset position` becomes `Reset position and size`. It clears `rect`, `size` and `dockW`, along with what it already resets.

---

## Part 3: Payout fixes

### Giveaway payout fulfils the redemption

In `api/admin/giveaways.js`, the `payout` action's redemption write becomes a small transaction (still best effort: a failure is logged and never fails the payout):

- Read `redemptions/{winner.redemptionId}`. Do nothing if it's missing.
- Always write the payout fields it writes today: `itemName` (`prize · slot · paid $X`), `payout`, `buyAmount`, `slotName`.
- If the status is `pending`, also write `status: 'fulfilled'`, `fulfilledAt` (server time) and `fulfilledBy` (the actor, as `admin.email`).
- A `fulfilled` or `cancelled` redemption keeps its status. Logging a correction updates the amount without reopening, re-fulfilling or un-cancelling anything.

The decision is a pure helper, `payoutRedemptionUpdate(redemption, { itemName, payout, buyAmount, slotName, actor, now })` → the update object, in `api/_lib/giveawayPayout.js`. It's unit-tested. The server timestamp is passed in as `now`, so the helper stays free of `firebase-admin`.

Unaffected:

- Plain-prize (`item`) giveaways never reach `payout`. Their redemptions stay pending until delivered, which is the to-do the queue is for.
- The payout chat announce, the overlay and `PlayPanel`.

### Login repairs partial user docs

In `api/twitch-auth.js`, the `existing.exists` branch keeps its profile refresh and adds a default for each starter field the doc lacks:

| Field | Default |
| --- | --- |
| `twitchId` | the Twitch id |
| `tickets` | `0` |
| `totalEarned` | `0` |
| `totalSpent` | `0` |
| `lastDailyClaimAt` | `null` |
| `watchMinutes` | `0` |
| `createdAt` | server time |

- Fields that are present are never overwritten. A settle-made doc keeps its `tickets` and `totalEarned`.
- The pure part, `missingStarterFields(data, twitchId, now)` → the defaults to add, lives in `api/_lib/userDoc.js` and is unit-tested.
- The first-login `set` builds its starter fields from the same helper (`missingStarterFields({}, ...)`), so the two paths can't drift.

---

## Files

**New (`src/components/controlRoom/`):** `RedeemTab.js`, `redemptions.js`, `useRedemptionAction.js`, `ResizeHandles.js`.

**Changed:**

- `src/contexts/ControlRoomContext.js`: the redemptions feed, seen baseline, the `redeem` summary, new panel actions (`resizeTo`, `setDockW`, `markRedeemSeen`, `setRedeemFilter`), reset clears size.
- `storage.js`: new fields and the `redeem` tab.
- `geometry.js`: limits and clamp/resize helpers.
- `ControlRoom.js`: the third tab, size and dock width in style, the resize preview and its clearing, the handles.
- `PanelChrome.js`: the tab, the `RED` tally, admin link, menu label.
- `panelStatus.js`: `tallies` and `tabLeds` learn redemptions, plus a `pillCounter` helper.
- `Pill.js`: the counter chip.
- `controlRoom.css`: handle, grip, row and chip styles, and `body.cr-resizing`.
- `api/admin/giveaways.js`: the `payout` action fulfils a pending redemption.
- `api/twitch-auth.js`: backfills missing starter fields.
- New `api/_lib/giveawayPayout.js` and `api/_lib/userDoc.js` (pure helpers).
- `CLAUDE.md`: the Control room gotcha mentions the Redeem tab, the third listener and resizing. The Giveaways gotcha says `payout` fulfils the redemption.

## Testing

CRA's Jest preset resets mocks before each test, so `jest.fn` implementations are re-armed in `beforeEach`.

- **`redemptions.test.js`:** kind groups, filters and counts, oldest-first order, unseen count (`null` seen, missing `createdAt`), age labels at each boundary.
- **`geometry.test.js`:** `clampSize`, `clampDockW` (narrow viewport floor), `resizeFrom` for each edge (left edges pin the right side, limits hold, stays on screen), `defaultRect` with a width.
- **`storage.test.js`:** new fields sanitize, out-of-range values clamp, old-shape stores fall back, the `redeem` tab is accepted.
- **`panelStatus.test.js`:** the `RED` tally, LED states (off, on, pulse), the pill counter.
- **`RedeemTab.test.js`:**
  - oldest-first rows
  - filters
  - Fulfill sends `fulfill` with the note
  - refund needs two presses within 4s (fake timers) and disarms after
  - per-row busy
  - inline error messages
  - empty and filtered-empty copy
  - the 50 cap line
  - seen is marked while shown
- **`ControlRoom.test.js`:**
  - handles render in float and dock and not in sheet
  - pointer resize from left and bottom-right commits the right rect and size
  - grip and separator keyboard steps
  - dock width reaches `--control-dock-w` on release
  - minimize mid-resize clears the preview
  - reset clears size
  - the Redeem tab renders and cycles with arrows
- **Provider:** the seen baseline on first snapshot, and unseen after a newer doc arrives.
- **`giveawayPayout.test.js`:** pending → fulfilled with actor and time; `fulfilled` and `cancelled` keep their status and only take the payout fields; corrections update the amount.
- **`userDoc.test.js`:** an empty doc gets every default; a settle-made doc (`tickets`, `totalEarned`, `updatedAt`) keeps its values and gets the rest; a full doc gets nothing.
- **`adminGiveawaysApi.test.js`:** the `payout` action marks a pending redemption fulfilled, and a redemption failure doesn't fail the payout.
- **Browser check** in dev (`npm start`, staff login) at 1440 and 1024 wide:
  - resize from each edge in float and in dock
  - the queue against real pending redemptions
  - signals with the panel minimized

## Branching

Built on `feat/control-room-redeem` off `main` and shipped as its own PR. `feat/gsn-store` is separate. The checkout is shared with other sessions, so every commit checks the branch in the same command.

## Risks

- **50-doc cap.** If more than 50 are pending, the panel shows the newest 50 sorted oldest first, so the very oldest can be missing. The footer line says so. An ascending index would fix it, but needs an index deploy and isn't worth it at current volume.
- **Seen is per browser.** A mod who handled orders in another browser still sees them as unseen here, until they open the tab or the orders leave the queue. Acceptable for a quiet signal.
- **Backlog.** Bonus buys paid before this ships stay pending until someone clears them. The Redeem tab's first-run baseline keeps them from pulsing, but they do count toward `RED {n}` until cleared.
- **Wider content.** The tabs were laid out for 380px. Above that they stretch, and at 320px they compress. The browser check covers both ends.
