# Control Room: a floating streamer panel on public pages

**Date:** 2026-09-28
**Status:** Approved in brainstorming (pending spec review)

## Problem

GooferG streams with the site on screen (homepage, `/gamba/*`, other public pages) but has to leave that page for `/admin/giveaways` or `/admin/hunts` to run a giveaway or a prediction round. The bean site has a "Stream Tools" console for this. It has several weaknesses to avoid:

- It is a centered `<dialog>` that blocks and scroll-locks the page, so it cannot sit next to the page on stream.
- It has no entrance animation; it appears instantly.
- It is admin-only, so mods cannot use it.
- Every tool switch goes back through the hub.
- It shows viewer handles on camera, and its code flags this as a known exposure.

This repo has its own blocker. The giveaway timers (last call at T-30s, auto-close, auto-roll, winner chat announce) and the prediction results post only run while the admin page that owns them is open. `AdminGiveawaysPage.js` is 2357 lines and exports nothing, so no other surface can reuse that logic.

## Scope and non-goals

- **In scope:**
  - A dockable floating panel ("Control room") on public pages for staff, with a Giveaway tab and a Predict tab.
  - A shared provider that owns the live data and every giveaway and prediction timer, on every route.
  - Extracting the giveaway admin logic into `src/components/admin/giveaways/`.
  - A full-screen "stage moment" reveal on the streaming browser.
  - Transactional `close` and `roll` on the giveaway API.
  - A per-browser switch to hide the "Goofer is live" badge.
- **Non-goals:**
  - Other tools (redemptions, suggestions, tickets, store). The tab strip leaves room for them later.
  - Moving timers to the server. Vercel cron is per-minute, so this would need a delayed-message queue. It can come later if the panel is not reliable enough.
  - Sound on the stage moment.
  - A stage moment for the `playing` (bonus buy) state. The OBS overlay already covers it.
  - Resizing the floating window by hand.
  - Arrow-key window movement. The dock button and "Reset position" cover keyboard use.
- **Unchanged:**
  - The `/admin/giveaways` and `/admin/hunts` layouts and features.
  - The OBS overlay `/giveaway-overlay`. The streamer keeps it on and moves the browser off-canvas when showing the casino page.
  - The API action set.
  - Firestore rules.

## Decisions (from brainstorming)

1. v1 tools are **Giveaways** and **Predictions** only.
2. Form factor is **a floating window that snaps into a side dock** (layout option D). It floats by default, docks when dragged to the right edge, and shrinks to a pill.
3. Visual direction is **Master control**: a TV station control desk with tally lights, hardware-style tabs with amber LEDs and an amber timecode. CRT effects play only during transitions, never at rest, because Twitch's encoder smears fine lines and grain.
4. Viewers see a **stage moment**: a full-screen reveal over the page on roll and on settle. It plays only in a browser with **Stage** switched on.
5. Access is **staff**: the owner and active moderators, matching `/admin`. The server stays the real gate (`requireStaff`).
6. The architecture is a **`ControlRoomProvider` plus giveaway extraction** (approach 1). Rejected alternatives: embedding the admin pages in the panel (they don't fit at 380px, and timers die when the panel closes), and server-side timers (they need new infrastructure).
7. The panel menu has **Hide LIVE badge**, per browser, which hides `LiveIndicator` ("Goofer is live", bottom-right) on that screen only.
8. The streamer keeps the OBS giveaway overlay on and handles overlap by moving the browser window. The UI gives no "turn off the overlay" hint.
9. The hotkey is backtick (`` ` ``).

---

## Architecture

```text
StreamingSite
 └─ AuthProvider
     └─ ControlRoomProvider                 (src/contexts/ControlRoomContext.js)
         ├─ live data        active giveaways (≤5), newest hunts (3)
         ├─ timer engine     giveaway clock · winner announce · results announce
         │                   runs only in the tab holding Web Lock "goofer-control-driver"
         ├─ panel state      mode, geometry, tab (localStorage)
         ├─ prefs            stage, hideLiveBadge (localStorage)
         └─ warnings         queue shared by panel + admin pages
         └─ TwitchAuthProvider
             └─ AppShell
                 ├─ /giveaway-overlay → GiveawayOverlay (no panel, no stage)
                 └─ StreamingSiteContent
                     ├─ Navigation      Control room button (staff)
                     ├─ LiveIndicator   hidden when prefs.hideLiveBadge
                     ├─ <ControlRoom/>  lazy; staff only; not on /admin/* or /suggest-overlay
                     └─ <StageMoment/>  lazy; staff + prefs.stage; not on /admin/* or /suggest-overlay
```

`ControlRoomProvider` mounts on **every** route, `/admin` included, so there is exactly one timer engine per browser. The admin pages stop running their own clocks and read from the context. It is **off** (renders `children` only: no subscriptions, no lock) for non-staff and on the OBS source routes `/giveaway-overlay` and `/suggest-overlay` (checked with `useLocation`, since the router sits above it). That keeps an OBS browser source from ever holding the driver lock as a hidden tab.

`isLive` stays where it is today (the 120s Twitch poll in `StreamingSiteContent`) and is passed to `<ControlRoom isLive={isLive}/>` as a prop for the `LIVE` tally.

### Units

| Unit | File | Purpose | Depends on |
|---|---|---|---|
| Provider | `src/contexts/ControlRoomContext.js` | Live data, timer engine, panel state, prefs, warnings | AuthContext, Firestore, giveaway hooks, `useResultsAnnounce`, `useDriverLock` |
| Driver lock | `src/hooks/useDriverLock.js` | Web Lock election, handing the lock to the visible tab | `navigator.locks`, `document.visibilityState` |
| Panel shell | `src/components/controlRoom/ControlRoom.js` | Window chrome, float/dock/pill, drag, hotkeys | Provider, `geometry.js`, `motion.js` |
| Geometry | `src/components/controlRoom/geometry.js` | Pure: clamp, corner snap, dock threshold, undock distance | none |
| Motion | `src/components/controlRoom/motion.js` + CSS | FLIP helper, keyframe class names | none |
| Pill | `src/components/controlRoom/Pill.js` | Minimized state and live label | `pillLabel.js` |
| Pill label | `src/components/controlRoom/pillLabel.js` | Pure: status to label and LED tone | none |
| Giveaway tab | `src/components/controlRoom/GiveawayTab.js` | One compact view per status | extracted giveaway components |
| Predict tab | `src/components/controlRoom/PredictTab.js` | Round summary and controls | `predictions/*` |
| Stage | `src/components/controlRoom/StageMoment.js` | Full-screen reveal on fresh events | `stageTriggers.js`, `RevealStage`, `PredictionWinnersReveal` |
| Stage triggers | `src/components/controlRoom/stageTriggers.js` | Pure: should this snapshot start a stage moment? | none |
| Giveaway API client | `src/components/admin/giveaways/api.js` | `postAction`, `QUIET_ANNOUNCE` | `authedFetch` |
| Giveaway clock | `src/components/admin/giveaways/useGiveawayClock.js` | Last call, close, auto-roll | `api.js`, `utils/giveaway.js` |
| Winner announce | `src/components/admin/giveaways/useWinnerAnnounce.js` | Timed chat post after the reveal | `api.js` |
| Moved UI | `src/components/admin/giveaways/{NewGiveawayForm,WinnerModal,PlayPanel,ClaimTimer,ChatAnnounceStatus,EventSubStatus,ui}.js` | Moved from the page unchanged; `ui.js` holds `ToggleRow`, `Chips`, `Kbd`, `inputCls`, `labelCls`, `formatTs` | as today |
| Reveal stage | `src/components/giveaway/RevealStage.js` | Moved out of `GiveawayOverlay.js` with its keyframes | `RevealScreen` |

### Provider API

```js
const cr = useControlRoom();
cr.enabled                 // isStaff
cr.giveaways               // docs with status in open|closed|rolling|playing, newest first (≤5)
cr.giveaway                // the one the panel shows: rolling > playing > open > closed, newest
cr.rounds                  // newest 3 hunts
cr.activeRound             // acceptPredictions && status open|locked
cr.latestRound             // rounds[0]
cr.isDriver                // this tab runs the timers
cr.announce                // useWinnerAnnounce(currentPick, { armed: isDriver })
cr.results                 // useResultsAnnounce(latestRound, { armed: isDriver })
cr.warnings, cr.pushWarning(msg), cr.dismissWarning(id)
cr.panel                   // { mode: 'closed'|'pill'|'float'|'dock', rect, corner, tab }
cr.panelActions            // open(), minimize(), close(), toggle(), dock(), undock(), setTab(), moveTo(), resetPosition()
cr.prefs                   // { stage, hideLiveBadge }, setStage(bool), setHideLiveBadge(bool)
cr.ducked                  // true while a stage moment plays
```

`useWinnerAnnounce` and `useResultsAnnounce` gain an `{ armed }` option. When `armed` is false they still report `posted` (read from the doc: `announcedPick`, and the results claim) but never schedule a post. Passenger tabs show "posted" or "pending" correctly. Post errors appear only in the driver tab.

### Data subscriptions

These are the only new reads. Firebase is on Spark, so both queries stay narrow.

- **Giveaways:** `where('status','in',['open','closed','rolling','playing']), orderBy('createdAt','desc'), limit(5)`. This is the filter `Navigation.useLiveGiveaway` already runs (at `limit(1)`, so the composite index exists). `useLiveGiveaway` is removed and the nav reads `cr.giveaway` instead.
- **Hunts:** `orderBy('createdAt','desc'), limit(3)`.
- **Recent entrants:** the Giveaway tab listens to the shown giveaway's 5 newest entries only while the panel is open and the giveaway is `open`.
- **Stage moment:** reuses `useGiveawayFeed({ enabled })` (40 entries for surf frames and the winner's first message) only while Stage is on.

`AdminGiveawaysPage` keeps its own last-50 list for history. It stops calling `useGiveawayClock` and `useWinnerAnnounce` and reads `cr.announce` and `cr.warnings` instead. `AdminHuntsPage` reads `cr.results` instead of calling `useResultsAnnounce` itself.

---

## Panel

### Opening and closing

- **Nav button:** the owner-only `GiveawayShortcut` becomes **Control room** for all staff (`isStaff`, replacing the email check). It keeps the live dot and entry count and toggles the panel (open → pill, pill or closed → open) instead of navigating to `/admin/giveaways`. On `/admin/*`, where the panel is hidden, it still navigates to `/admin/giveaways`. The `Operator` badge and the Admin link stay. Mods, who sign in through Twitch, get the button next to their viewer identity.
- **Hotkey:** `` ` `` toggles between closed or pill and open. It is ignored while focus is in an `input`, `textarea`, `select` or `[contenteditable]`.
- **Escape** minimizes to the pill. It is ignored while focus is in a form field, while a modal dialog (`aria-modal="true"`) is open, while a stage moment plays, and when an inner handler already called `preventDefault()`. The new-giveaway form closes itself on Escape. The inline winner flow does **not** bind Escape to Discard, as `/admin` does, so minimizing can never throw a pick away; Discard stays a button.
- **×** in the header closes the panel completely, with no pill.
- **Mobile menu:** gets a "Control room" row for staff that opens the bottom sheet.

### Modes and geometry

| Mode | Placement | Size |
|---|---|---|
| `float` | Default: right side, 16px from the edge, top at nav height + 16px. Dragged by the header. | 380px wide; height auto, max 70vh, body scrolls |
| `dock` | Right edge, from under the nav to the bottom of the viewport | 400px wide, full height |
| `pill` | The corner nearest the float position; in dock mode, bottom-right above `LiveIndicator` | auto |
| `closed` | Only the nav button | none |

- **Drag:** pointer events on the header (`setPointerCapture`), with no library. The rect is clamped so at least 48px of the header stays inside the viewport.
- **No resting transform:** the panel is positioned with `left`/`top` (float) or `top`/`right`/`bottom` (dock). It never carries `transform`, `filter`, `backdrop-filter` or `will-change: transform` at rest, because any of these would turn it into the containing block for `position: fixed` descendants, trapping `SettleModal` and `NewRoundModal` inside the panel. Keyframe animations use `animation-fill-mode: backwards` (or none), so nothing persists after they finish, and FLIP uses the Web Animations API without `fill`.
- **Corner snap:** on release, if the rect is within 24px of a viewport corner, it snaps to that corner with 16px insets.
- **Dock:** while dragging, if the pointer is within 48px of the right edge, a dashed orange dock outline fades in. Releasing there docks the panel.
- **Undock:** dragging a docked panel's header more than 64px left undocks it, and the drag continues as a float.
- **Header buttons:** a dock/undock button and "Reset position" in the menu cover keyboard use.
- **Dock and page layout:** docking sets `--control-dock-w: 400px` on `document.documentElement` and adds `body.control-docked`, which gets `padding-right: var(--control-dock-w)` with a matching transition. Fixed-position page elements that sit on the right (`LiveIndicator`) shift by the same variable.
- **Narrow screens** (under 768px): always a bottom sheet (full width, max 75vh), with no drag, dock or corner snap.
- **Window resize:** re-clamps a float and re-anchors the pill.
- **Persistence:** `localStorage['goofer:control-room']` stores `{ mode, rect, corner, tab, stage, hideLiveBadge }`. Every read and write is wrapped in try/catch, and the defaults apply on failure. A persisted `closed` or `pill` restores as such, and `float` or `dock` restores open.

### Chrome (Master control)

- **Top strip** (`#0b0b0d`, mono 8px, 0.28em tracking):
  - Tally lights: `LIVE` (red, lit when `isLive`), `GVW` (orange, lit when a giveaway is `open|closed|rolling|playing`) and `PRD` (amber, lit when a round is `open|locked`).
  - Controls on the right: the **Stage** switch (`aria-pressed`), a menu (`Hide LIVE badge`, `Reset position`, `Open admin ↗`), the dock/undock button, minimize and close.
  - The header is the drag handle, with `cursor: grab`.
- **Tabs:** `GIVEAWAY` and `PREDICT` as hardware-style buttons (`#1c1c20`, inset bottom shadow) with a 14×2px LED.
  - LED off (`#3f3f46`) when idle, amber with glow when the tool is running, and a slow pulse (1.4s) when it needs the streamer: `rolling` without a confirmed pick, or a round `locked` and not settled.
  - Tabs are `role="tablist"`/`tab`, with arrow keys moving between them.
- **Body:** `#111113`, 12px padding. The primary number uses Source Code Pro 40px amber (`#ffb24d`) with a soft glow; secondary numbers use Anton.
- **Warnings strip:** sits above the tab body, in red and dismissible. Warnings auto-dismiss after 8s unless they are timer failures, which stay until dismissed.
- **Auto-focus:** when `cr.giveaway` enters `rolling` with a new `pickKey`, the panel opens (from `pill` or `closed`) and selects the Giveaway tab. If the roll opened it, it returns to its earlier state (`closed` or `pill`) once the shown giveaway leaves `rolling`/`playing`, or ends. A skip re-picks, so it keeps the panel open.
- All UI copy follows PRODUCT.md voice rules: no em dashes, sentence case, plain wording on controls.

### Giveaway tab

One view per `cr.giveaway` status. Every view has an "Open in admin ↗" link to `/admin/giveaways` and a compact chat dot from `useEventSubStatus`.

| Status | Shows | Actions |
|---|---|---|
| none | "Nothing running." | **New giveaway** opens the compact `NewGiveawayForm` inside the panel body, seeded from `formFromGiveaway(last)`. **Run last again** does the same with `copyPrize: true`. |
| `open` | Amber countdown (`formatClock`; red and pulsing in the last 10s), keyword, prize, entry count (`AnimatedCount`), progress bar to `closesAt`, 5 newest entrants | **Last call** (only if `announceLastCall` and not yet posted), **Close**, **Roll** |
| `closed` | Entry count, prize, "Closed" | **Roll**, **End** |
| `rolling` | Winner card (avatar, name, first chat message, `ClaimTimer`), winner N of M, `ChatAnnounceStatus` | **Confirm** (Enter), **Reroll** (R), **Skip** (S). Hotkeys work while focus is inside the panel or while a stage moment plays. |
| `playing` | Compact `PlayPanel` (slot, payout input) | **Payout**, **Back** |

The winner flow reuses `WinnerModal`'s internals rendered inline, with no modal wrapper. Each button disables while its request is in flight. Errors show inline under the button row through `errorText`.

### Predict tab

- **Summary line:** round title, status chip (`statusTone`), guess count (`entryCount`) and hunt bonus count from the snapshot.
- **Controls:** `RoundControl` for the active round, falling back to `latestRound`. It renders unchanged; its settle preview (`SettleModal`) and `ChatStatus` come with it.
- **No active round:** "No round running." with **New round**, which opens the existing `NewRoundModal` over the page.
- **Settled:** the latest round shows its winners compactly, plus the results post status from `cr.results`.

## Stage moment

- **Where:** `<StageMoment/>` portals to `document.body` at `z-[80]`, above the nav (`z-50`) and `PlayPanel` (`z-[60]`) and below `TVStaticIntro` (`z-[9999]`). It renders only when `cr.enabled && cr.prefs.stage` on a public route.
- **Ducking:** while a moment plays, `cr.ducked` is true. The panel fades to opacity 0 and ignores clicks, but its hotkeys stay live. It comes back when the moment ends.
- **Dismiss:** a click, or Escape, ends a moment early.

### Giveaway reveal

- **Trigger** (`stageTriggers.giveawayMoment(prev, next, now)`): `next.status === 'rolling'`, `pickKey(next)` differs from the last staged key, and `now - rolledAt < 10_000`. That means a reload, or turning Stage on mid-reveal, never replays an old pick. A reroll is a new key, so it stages again.
- **Content:** `RevealStage`, moved from `GiveawayOverlay.js` into `src/components/giveaway/RevealStage.js` with its `gvo-*` keyframes. It is the same full-screen reveal the OBS overlay shows, driven by `useRevealState` off `rolledAt`, with `entries` and `firstMessage` from `useGiveawayFeed`. `GiveawayOverlay` imports it from the new home.
- **Length:** until `REVEAL_MS + LOCK_HOLD_MS` after `rolledAt`, then the CRT power-off exit (320ms).

### Prediction results

- **Trigger** (`stageTriggers.resultsMoment(prev, next, now)`): `next.status === 'settled'`, the round id differs from the last staged one, and `now - settledAt < 10_000`.
- **Content:** a title card (`PREDICTION RESULTS` in mono eyebrow, the round title in Anton; rounds have no number field), then `PredictionWinnersReveal` centered at max-width 56rem on the same dark radial backdrop.
- **Length:** about 8s, then the power-off exit.
- **Timing:** it plays immediately at settle. The results chat line already posts at `settledAt + STREAM_DELAY_MS`, so it lands in step with the delayed video.

## Timers and driver election

- **`useDriverLock(enabled)`** calls `navigator.locks.request('goofer-control-driver', { mode: 'exclusive' }, …)` and holds the lock with a promise that resolves on unmount. `isDriver` is true while the lock is held.
- **Visible tab wins.** On `visibilitychange` to `visible`, a tab that is not the driver re-requests with `{ steal: true }`. The previous holder's request rejects with `AbortError`, and it re-queues normally. This matters because browsers throttle timers in hidden tabs, which could make last call up to a minute late if a background tab drove.
- **Fallback:** without `navigator.locks`, `isDriver` is true in every tab and the server guards below dedupe.
- **The engine:** `useGiveawayClock(cr.giveaways, pushWarning, { armed: isDriver })`, `useWinnerAnnounce(currentPick, { armed })` and `useResultsAnnounce(latestRound, { armed })`. Their behavior is unchanged from today: last call in the T-30s to T-3s window, close at `closesAt`, auto-roll only for the caller whose `close` succeeded, and only within `AUTO_ROLL_GRACE_MS` with more than 0 entries.
- **A new driver** starts with an empty "fired" set. That is safe, because every action it might repeat is idempotent on the server.

### Server changes (`api/admin/giveaways.js`)

- **`close`:** read and update inside `adminDb.runTransaction`. Only a transaction that sees `status === 'open'` writes `closed` and returns `ok`; the others return `400 NOT_OPEN` as today. This makes auto-roll single-shot across browsers, because only the successful closer rolls.
- **`roll`:** the rollability check and the `status: 'rolling'` write happen in one transaction. `pickWeightedWinner` runs before the transaction, because it reads the entries subcollection. The transaction then re-reads the doc and requires `status` and `rolledAt` to still equal the values read before the pick, and the doc to still be rollable. Otherwise it returns `409 ROLL_RACE`, and the client treats that as quiet (someone else rolled). `clearWinnerStream` runs only after a successful commit.
- **Unchanged:** `lastCall`, `announce` and the hunts results post already claim once.

## Failure handling

| Failure | Behavior |
|---|---|
| Action request fails | Inline error under the button row (`errorText(code)`), and the button re-enables. A network failure shows "Network error, try again". |
| Timer action fails (auto-roll, last call not posted) | `pushWarning`; the warning strip shows in the panel and on `/admin/giveaways`, and the pill LED turns red until it is dismissed. The admin page's own bottom-right toast moves to the top of the page, off the `LiveIndicator` spot. |
| Firestore listener error | The tally row shows `DATA` in red with "Live data lost". The provider resubscribes after 5s, up to 5 attempts, then stops with "Reload to reconnect". |
| `NOT_AUTHENTICATED` / 401 / 403 | The failing action shows "Signed out. Sign in again at /admin." under its buttons. (A real sign-out also drops the staff role, which unmounts the panel.) |
| The user loses staff role | The provider tears down its subscriptions and the lock, and the panel and stage unmount. |
| The panel or stage throws | Each is wrapped in its own `ErrorBoundary`, so the page on stream keeps rendering. The stage's fallback is `null`. The panel's fallback is a small "Control room crashed. Reopen" pill that remounts it. The timer engine lives in the provider, outside both boundaries, so it keeps running. |
| `localStorage` unavailable | Defaults apply every load, with no errors. |

## Motion

All motion animates only `transform`, `opacity`, `filter` and `clip-path`. Nothing runs longer than 600ms. Under `prefers-reduced-motion: reduce`, every transition becomes a 150ms opacity fade and the static burst is skipped.

| Moment | Animation |
|---|---|
| Open (from pill or closed) | CRT power-on (550ms, `cubic-bezier(.2,.7,.2,1)`), growing from the pill's corner: `scale(.02,.006)` with brightness 5 → `scale(1,.006)` with brightness 4 → `scale(1,1.02)` with brightness 1.6 → rest. Tabs and body fade up 6px after a 380ms delay. |
| Minimize | CRT power-off (320ms): scaleY to .006, then scaleX to .02 with a brightness flare, then the pill slides in from that corner (180ms). |
| Tab switch | A 240ms SVG-turbulence static burst (`steps(4)`), with the content at `blur(1.5px) skewX(-4deg) translateX(3px)` during the cut. The swap happens at 110ms. |
| Dock / undock | FLIP from the old rect to the new one (300ms, `cubic-bezier(.2,1.25,.3,1)`), with page padding easing over the same 300ms. |
| Drag | The panel lifts: `scale(1.01)`, a deeper shadow, and `cursor: grabbing`. The dock outline fades in over 150ms. |
| Tally change | 200ms background and glow fade. |
| Countdown, last 10s | The digits turn `red-destructive` with a 1s opacity pulse. |
| Stage exit | The same CRT power-off, full-screen (320ms). |

Keyframes live in `src/components/controlRoom/controlRoom.css`, imported by the lazy panel chunk so viewers never download them. The static texture is an inline SVG data URI, so there are no image requests.

## Accessibility

- The panel is `role="dialog"`, `aria-modal="false"`, `aria-labelledby` the header title. It never traps focus, and the page stays usable.
- Opening moves focus to the active tab. Minimizing returns focus to the nav button.
- Every header control is a real `<button>` with an `aria-label`. The Stage and Hide LIVE badge switches use `aria-pressed`.
- The countdown is `aria-live="off"`, since per-second updates would be noise. Status changes (opened, closed, winner picked) announce through a visually hidden `aria-live="polite"` region.
- The stage moment is `aria-hidden` apart from a polite text announcement of the winner.

## Testing

The Jest setup is already in place (`react-scripts test`). The work runs test-first.

1. **Characterization before extraction.** Pin today's `useGiveawayClock` with fake timers and a mocked `postAction`:
   - last call fires once in the window and is skipped when `announceLastCall` is false or already posted;
   - close fires at `closesAt`;
   - auto-roll fires only after a successful close, inside the grace window, and with entries above 0;
   - it warns when entries are 0 and when the roll fails.

   Then move the code and keep these green.
2. **Pure units:**
   - `geometry.js`: clamp, corner snap, dock threshold, undock distance, pill anchor.
   - `pillLabel.js`: every status to its label and LED tone.
   - `stageTriggers.js`: fresh versus stale, the same key twice, reroll, settle age.
3. **`useDriverLock`** with a fake `navigator.locks`: it gains and releases the lock, steals it on visibility, re-queues after `AbortError`, and falls back when locks are missing.
4. **Provider:**
   - non-staff gets no subscriptions;
   - staff subscribes with the narrow queries;
   - with `armed: false`, no post is scheduled;
   - prefs persist, and `localStorage` failures are tolerated.
5. **Components:**
   - `ControlRoom` renders nothing for non-staff, and nothing on `/admin/*` and `/suggest-overlay`;
   - backtick and Escape behave as specified, including inside an input;
   - each `GiveawayTab` status view shows the right buttons and calls `postAction` with the right action;
   - the Stage switch and Hide LIVE badge update prefs, and `LiveIndicator` hides;
   - `StageMoment` renders `RevealStage` for a fresh pick only.
6. **API** (following the `src/__tests__/adminHuntsApi.test.js` pattern): two concurrent `close` calls give one `ok` and one `NOT_OPEN`; two concurrent `roll` calls give one winner and one `ROLL_RACE`.
7. **Regression:** `AdminHuntsPage.test.js`, `AdminHuntsControlRoom.test.js`, `giveaway.test.js` and the rest of the suite stay green. `GiveawayOverlay` still renders its reveal after the `RevealStage` move.
8. **Manual pass** (`npm start`, staff account):
   - float, drag, corner snap, dock and undock with the page reflowing, pill, close and reopen;
   - the full giveaway lifecycle from the panel;
   - two tabs, checking that the driver follows the visible tab and last call fires once;
   - owner and mod browsers at once, checking there is one auto-roll;
   - Stage on, with a roll and a settle captured in OBS for legibility and alignment with chat;
   - reduced motion;
   - a mobile bottom sheet.

## Build order (for the plan)

1. Characterization tests, then the pure extraction of the giveaway page into `src/components/admin/giveaways/` (no behavior change), then the `RevealStage` move.
2. Server: transactional `close` and `roll`, with tests.
3. `useDriverLock` and `ControlRoomProvider`; rewire the admin pages and `Navigation` to read from it.
4. The panel shell: modes, geometry, drag, dock, pill, persistence, hotkeys and motion.
5. The Giveaway tab and Predict tab.
6. `StageMoment` and the Hide LIVE badge.
7. Docs: add a Control room entry to the CLAUDE.md Gotchas, then the manual pass.
