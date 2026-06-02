# Bonus Battle — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design), pending implementation plan
**Surface:** New Gamba tool — `/gamba/bonus-battle` (channel) + live viewer page `/battle`

## 1. Summary

A "bonus battle" tool for the Gamba section. Streamer adds players (name + slot pick),
spins a wheel to choose who plays next, enters each bonus payout, and the tool tracks a
winner-takes-all pot (sum of payouts minus a 10% rake). Highest payout wins the pot;
biggest loser gets a free ticket for the next game.

Built admin-driven with a live Firestore mirror so viewers follow along in real time.
Data model is structured so a future "viewers self-join" pivot is additive, not a rewrite.

## 2. Goals / Non-Goals

**Goals**
- New Gamba channel tool matching the site's CRT/gamba theme.
- Admin runs the battle (add players, spin, enter payouts); viewers see a live read-only board.
- Wheel picks the next player only from those who haven't run yet.
- Pot math: total payouts − 10% configurable rake; winner = highest payout; biggest loser flagged.
- Responsive: 3-column desktop, stacked mobile (Action → Payout → Players → Standings).
- USD formatting, English labels.

**Non-Goals (this iteration)**
- Viewers self-joining battles (designed-for, not built). See §9 Pivot.
- Persisting battle history / recaps beyond the active battle.
- Automated ticket issuance to the store ledger (loser flag is display-only for now).
- Multiple concurrent battles. One active battle at a time (single mirror doc).

## 3. UX / Layout

### Desktop (≥1024px) — 3 columns
- **Left — Players & Pot:** Total Pot (large), stat trio Total / Ran / Left, add-player
  input (name + slot), roster rows (name · slot · payout-or-pending), and the payout-entry
  form for the current player.
- **Center — Action:** "Who plays next?" CTA, the wheel, Spin button, "Now Playing" card.
- **Right — Standings:** ranked list (winner green, biggest loser red), "Winner Takes All"
  box (pot − 10% rake breakdown), "biggest loser → free ticket" note.

### Mobile (<1024px) — stacked, in this order
1. **Action** (wheel + Now Playing) — repeated live action on top
2. **Enter payout**
3. **Players & pot** (roster, stats)
4. **Standings** (winner-takes-all)

### Controls
- **Add player:** text input for name + slot picker (reuse `SlotAutocomplete`). Adds a player doc.
- **Spin:** picks a random un-played player, sets them as "Now Playing".
- **Save Payout:** full-width button. A $0 bonus is just typing `0` then Save. (No separate
  "Bust" button — removed by decision.)
- Rake % editable (default 10%).

## 4. Architecture

Follows the existing **local-working-copy + public-mirror** pattern from `useHuntStore` /
`shared_hunts`.

### Components (new)
- `src/components/BonusBattle.js` — admin tool surface. Mounted as the new Gamba channel.
  Owns the working state, renders the 3-column/stacked board, wires inputs.
- `src/components/BattleWheel.js` — wheel forked from `GameWheel`. **Why fork:** `GameWheel`
  takes only `games` and self-resolves the winner with no callback; the battle needs the
  parent to learn the picked player and exclude already-played players. `BattleWheel` props:
  `players` (un-played only) + `onResult(player)`. Keeps the existing tuning/scan-line visuals.
- `src/pages/BattlePage.js` — live read-only viewer page at `/battle`. Subscribes to the
  mirror via `onSnapshot`, renders the same board read-only. Precedent: `LiveHuntPage`.

### Hook (new)
- `src/hooks/useBattleStore.js` — modeled on `useHuntStore`. Holds the working battle,
  exposes actions (`addPlayer`, `removePlayer`, `setPayout`, `spinResult`, `setRake`,
  `reset`), and pushes a `buildMirror()` snapshot to Firestore on change. Local fallback
  via `localStorage` so the tool works before/without login, same as hunt store.

### Wiring
- `src/data/gambaTools.js` — add `{ id: 'bonus-battle', label: 'Bonus Battle', icon: Swords }`
  (lucide `Swords` or `Crosshair`). This auto-adds the channel tab + nav dropdown entry.
- `src/pages/GambaPage.js` — add lazy import + `{activeTool === 'bonus-battle' && <BonusBattle/>}`
  inside the tool surface `<Suspense>` block (it pulls the slot DB via SlotAutocomplete, so
  lazy-load like HuntTracker/SlotPicker).
- `src/App.js` — add lazy route `/battle` → `BattlePage` (public viewer page).

## 5. Data Model (Firestore)

Single active battle as a mirror doc, with players as a **subcollection** (uid-keyed) so the
self-join pivot can grant per-player write access later.

```
bonus_battles/{battleId}            // battleId = owner twitch uid (one active battle/owner)
  ownerTwitchId: string             // gates writes in rules
  title: string
  rakePct: number                   // default 10
  currentPlayerId: string | null    // "Now Playing"
  status: 'active' | 'ended'
  createdAt, updatedAt: number

  players/{playerId}                 // playerId: synthetic now; viewer uid after pivot
    name: string                     // free-text display name
    slot: string                     // slot pick (name; from SlotAutocomplete)
    payout: number | null            // null = not run yet
    ran: boolean                     // true once payout saved
    addedByUid: string               // owner uid now; player's own uid after pivot
    order: number                    // insertion order for stable display
    createdAt: number
```

### Derived (computed client-side, not stored)
- `totalPot = sum(payout for ran players)`
- `pot After rake = totalPot * (1 − rakePct/100)`
- `winner = ran player with max payout`
- `biggestLoser = ran player with min payout`
- `ran = count(players where ran)`, `left = count − ran`, `total = count`

## 6. Firestore Rules

Add a block modeled on `shared_hunts` (public read, owner-write-by-uid), extended for the
players subcollection. Now: only owner/staff write players. Pivot-ready: the player-doc rule
is written so it can later allow `isSelf(playerId)`.

```
match /bonus_battles/{battleId} {
  allow read: if true;
  allow create, update: if isSignedIn()
    && request.resource.data.ownerTwitchId == request.auth.uid;
  allow delete: if isSignedIn() && resource.data.ownerTwitchId == request.auth.uid;

  match /players/{playerId} {
    allow read: if true;
    // Now: owner or staff. Pivot: add `|| isSelf(playerId)` to let viewers
    // create/update their own player doc.
    allow write: if isStaff()
      || get(/databases/$(database)/documents/bonus_battles/$(battleId)).data.ownerTwitchId == request.auth.uid;
  }
}
```

## 7. Theme Tokens

Reuse existing Tailwind tokens (no new colors):
- Pot / wheel / winner box: `purple-gamba` `#a855f7`, `purple-bright` `#c084fc`, `purple-haze`.
- Positive/payouts/"Ran": `emerald-signal` `#10b981`.
- Total / Now-Playing accent: `amber-rust` `#e0a458`, "Left" uses `crt-amber` `#ffb24d`.
- Loser state: `red-destructive` `#ef4444`.
- Cards `zinc-card`, body `white-body`, mono font, `tracking-eyebrow-*`, dashed-emerald
  payout form. Match `GameWheel`'s scan-line / "Tuning…" / "Signal lock" idiom in BattleWheel.

## 8. Error / Edge Handling

- **No players yet:** Spin disabled; board shows empty-state copy.
- **All players ran (left = 0):** Spin disabled; show "All bonuses played — battle complete".
- **$0 payout:** valid; player marked `ran` with payout 0 (counts as biggest loser candidate).
- **Tie for winner/loser:** first by `order` wins display tie-break (document, don't over-engineer).
- **Not logged in (admin):** tool works on localStorage only; no mirror push (same as hunt store
  offline mode). Viewer page shows "No live battle" when mirror doc absent.
- **Remove player after they ran:** allowed; recomputes pot.

## 9. Future Pivot — Viewers Self-Join (designed-for, not built)

Because players are a **uid-keyed subcollection**:
1. Rules: add `|| isSelf(playerId)` to the players-write rule.
2. UI: add a "Join battle" button on `BattlePage` for logged-in viewers → writes
   `players/{their-uid}` with their name + chosen slot.
3. No data migration. Admin-added players (synthetic ids) and self-joined players (uid ids)
   coexist.

## 10. Testing

- Unit: pot/rake/winner/loser derivation (pure function in `utils/`, e.g. `battleCalc.js`) —
  mirror the existing `huntCalc` test style under `__tests__/`.
- Manual: add players → spin (only un-played appear) → save payouts → verify pot, winner,
  loser, stat trio; open `/battle` in a second window and confirm live sync; resize to mobile
  and verify stack order + full-width Save.

## 11. Open Decisions (resolved)

- Operator model: **admin-driven + Firestore-live**, pivot-ready for self-join. ✅
- Wheel: **un-played only**, auto-excludes winner. ✅
- Pot: **sum of payouts − 10% configurable rake**; winner = highest; loser flagged. ✅
- Player storage: **uid-keyed subcollection**. ✅
- Identity: **free-text name + slot** (no account link required now). ✅
- **Bust button removed**; $0 = type 0 + Save. ✅
- Save button **full-width**. ✅
- Mobile stack: **Action → Payout → Players → Standings**. ✅
- USD + English. ✅
