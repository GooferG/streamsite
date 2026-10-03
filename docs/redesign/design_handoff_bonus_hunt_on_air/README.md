# Handoff: Goofer.tv — Bonus Hunt page ("On Air" redesign)

## Overview
Redesign of the **Gamba → Hunts (CH 02)** page on goofer.tv. Viewers predict the final payout of a slot bonus hunt; the closest guess wins tickets. The page keeps the late-night TV broadcast concept but swaps the hard-lined, boxy look for soft, rounded, layered surfaces with depth (inset highlights, drop shadows, glows).

Two live states, driven by the server (not by the viewer):
1. **Predictions open** — entries accepted, viewer can place/edit a guess.
2. **Settled** — hunt finished, winner + results shown.

The streamer (admin) switches states manually ("Close entries" / "Open entries"). There is **no countdown** — entries close when the admin closes them.

## About the Design Files
`Bonus Hunt On Air.dc.html` is a **design reference built in HTML** (open it in a browser; `support.js` is its runtime). It is a prototype of look and behavior, **not production code**. Recreate it in the goofer.tv codebase using its existing framework, component patterns, data layer and auth (Twitch). All mock data lives in the logic class at the bottom of the file — replace with real API data.

## Fidelity
**High-fidelity.** Final colors, type, spacing, radii, shadows and interactions. Recreate pixel-close. All styles are inline in the HTML file — read exact values there when this README is not specific enough.

## Screenshots
`screenshots/` (captured at ~60% zoom, desktop layout):
- `01-open-top.png` — open state: monitor, required-avg hero, meter, chyron, rail with active slip
- `02-open-middle.png` — guesses list
- `03-open-bonus-table.png` — "On the docket" bonus table (unopened)
- `04-open-slip-locked.png` — viewer's guess locked; their dot (purple) on meter and row in list
- `05-settled-top.png` — winner reveal
- `06-settled-middle.png` — ranked lineup (closest first)
- `07-settled-bonus-table.png` — hunt recap + slot-by-slot results

## Layout
- Page bg `#09080b` with top radial `radial-gradient(1200px 600px at 50% -10%, #1a1420, transparent 70%)`.
- Content max-width **1280px**, centered. Page padding `8px 36px 48px`.
- Two columns via flex-wrap, gap 24px: **main** `flex: 999 1 640px`, **rail** `flex: 1 1 300px` (~340px at desktop). Rail wraps below main on narrow viewports.
- Top nav: logo "GooferG" (Bricolage 800 20px) + tagline "LATE NIGHT · EST. 2023" (mono 10px, .2em, `#5d5963`); links 15px/500 `#a7a2ad`, active `#fff`; username + 36px round avatar on the right.

## Components

### 1. Monitor (main stage)
- **Bezel**: radius 36px, padding `14px 14px 0`, bg `linear-gradient(180deg,#26232c,#141217)`, shadow `inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6), 0 30px 60px rgba(0,0,0,.6)`.
- **Screen**: radius 26px, overflow hidden, bg `radial-gradient(120% 90% at 50% 40%, TINT 0%, #120c0e 60%, #07060a 100%)` where TINT = `#0f2220` (open, teal) / `#2a1810` (settled, orange). Inner shadow `inset 0 0 80px rgba(0,0,0,.85)`.
- **Scanlines** (optional): overlay `repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px)`, `mix-blend-mode: screen`.
- **Screen header**: status pill (LIVE = `#d83a1c` + pulsing white dot + glow `0 0 24px rgba(216,58,28,.6)`; REPLAY = `#3a3540`), "CH 02 · HUNTS" mono 11px `#c9a993`, clock right mono 11px `#8a7d75`.
- **Open screen content** (centered): eyebrow "THURSDAY COMM HUNT · PREDICTIONS OPEN" (mono 12px, .3em, `#3ee0bf`); "What does the hunt pay?" 30px/700 `#c9c4cf`; hero stat **required avg multi** "109.1x" — 96px/800, -.03em, `x` at 56px `#7af0d6`, glow `0 0 40px rgba(62,224,191,.35)`; label "REQUIRED AVG TO BREAK EVEN". Divider 1×84px, then side stats (Total bet, Avg bet, Chat median; label 14px `#8a8690`, value 18px bold). Chips row: "37 bonuses", "Start cost $2,421.82", "N guesses in" (teal tinted). Chips: radius 999, padding 9px 16px, bg `rgba(255,255,255,.07)`.
  - **Required avg = start cost ÷ total bet** (sum of base bets of all bonuses).
- **Settled screen content**: eyebrow "… · AND THE CLOSEST GUESS IS" (`#ff9a5c`); winner avatar 108px with rings `0 0 0 5px #1a100c, 0 0 0 7px #ff6a1a, 0 0 60px rgba(255,106,26,.55)`; name 60px/800; chips: Guessed, Actual (value `#ffb27a`), "+500 tickets" (orange gradient `#ff8a3d→#e0520c`, text `#1a0a02`).
- **Meter**: panel radius 18px, bg `rgba(0,0,0,.35)`. Dotted track. Scale $1.7K–$3.8K (compute from data range). One dot (20px) per guess positioned by value. Vertical marker: **BREAK-EVEN** (start cost, teal `#3ee0bf`) in open state, **ACTUAL** (payout, `#ffb27a`) in settled. Dot colors: winner `#ff8a3d` + glow, runner-up `#d9d5df`, others `#4a4550` (settled) / `#8a8494` (open), current viewer `#a26bff` + glow.
- **Chyron ticker**: 40px bar `rgba(0,0,0,.55)`. Left tag "OPEN" (teal) / "FINAL" (orange), mono 11px bold dark text. Marquee: mono 12px .18em `#e4e0e8`, items separated by ★ (teal/orange), duplicated content translating 0 → -50% over 38s linear infinite, edge fade mask. Content generated from hunt data (see file).
- **Bezel strip** (under screen): red power LED + "GOOFER·VISION" (mono 11px .35em `#6d6873`); right: **status readout** (dot + "CH 02 · ENTRIES OPEN" teal / "ENTRIES CLOSED" grey) and two **decorative** knobs (CH 38px, VOL 30px; radial-gradient metal, orange indicator on CH). **Not interactive for viewers.** CH knob rotates ±60° when state changes (`transition: transform .35s cubic-bezier(.3,1.5,.5,1)`).

### 2. Lineup / guesses list
- Title: "Guesses so far" (open) / "Tonight's lineup" (settled), 24px/800. Right label mono 11px.
- Rows: grid `44px 40px 1fr 120px 110px`, gap 16, padding `12px 18px 12px 14px`, radius 18px, bg `linear-gradient(180deg,#17151b,#121015)`, shadow `inset 0 1px 0 rgba(255,255,255,.05)`. Hover: `filter: brightness(1.15)`.
- Columns: place/entry no (mono 13 bold), avatar 40px, name 17px/700 + "ENTRY #00X" mono 10px, guess 22px/800 right, meta 13px right (open: time ago; settled: ±off amount).
- Settled: sorted by closeness; 1st row orange-lit (`linear-gradient(90deg, rgba(255,106,26,.20), rgba(255,106,26,.04) 60%), #141116` + `0 12px 30px -12px rgba(255,106,26,.45)`).
- Open: sorted low→high (or entry order); viewer's own row purple-lit, name "(you)", meta "just now" in teal.

### 3. Recap + bonus table
- Card radius 24px, padding 22/24. Title "On the docket" (open) / "Hunt recap" (settled) + "37 BONUSES". Toggle button "Show/Hide bonuses".
- Stats row: 4 cells, 1px gaps on `rgba(255,255,255,.05)`, cells `#141216`. Open: Start cost, Total bet, Bonuses, Required avg (teal). Settled: Start cost, Won, Avg multi, Result (red `#ff6b6b` if negative).
- Table: grid `44px 1fr 90px 110px 200px` — #, Slot (34px rounded-10 tile with initials tinted per slot + name 15/700 + provider 12px `#7d7884`), Bet, Payout, Multi (bar max 110px, sqrt-scaled to max multi, + value).
  - Settled: best hit row orange wash + "BEST HIT" tag; ≥100x warm color; 0x red `#ff6b6b`.
  - Open: payout/multi "—", first bonus teal wash + "UP FIRST" tag.
  - Footer "Showing 10 of 37 · Show all".

### 4. Rail
- **TV Guide** (channel nav: Hub 00, Leaderboard 01, Hunts 02, Bonus Battle 03, Slot Picker 04). Active row teal wash + "NOW". Rows radius 14, padding 12.
- **Slip ticket**: radius 24, bg `linear-gradient(170deg,#2a1d3d,#17121f)`, purple glow `0 24px 40px -14px rgba(145,70,255,.4)`. Header block fixed 146px; dashed perforation with two 24px page-color circles cut out at the edges.
  - Signed out / settled: "Sign in with Twitch" button (`#a26bff→#8240f0`).
  - Open, editing: CA$ input (32px/800, inset field), quick picks (Break-even, Chat median, Half back), duplicate-guess warning, "Lock it in" (disabled grey until valid), note "Editable until Goofer closes entries."
  - Open, locked: "● LOCKED" teal, big guess value, entry #, "N guesses below you · M above", "Change guess".
- **Runner-up** card (settled only).
- **Past episodes** list: name, date, result (+teal / −red).
- **Control Room** card — **admin only** (render only for authorized users): orange-lit card, hint text, button "Close entries" / "Open entries".

## Interactions & Behavior
- **State is server-driven.** Viewers cannot switch states. When the server state changes (push via websocket/SSE or polling), all clients flip with the **channel-change static** effect (~420ms noise overlay + rolling bright band, then content swaps) and the CH knob rotates.
- Admin "Close entries" → locks all slips, page switches to closed/settled view. "Open entries" → new hunt, back to predictions.
- Slip validation: positive number; reject exact duplicates of existing guesses; lock disabled otherwise. Editable until entries close.
- Static keyframes and ticker keyframes are in the file's `<helmet><style>`.
- Respect `prefers-reduced-motion`: disable static, ticker scroll, LIVE pulse.

## State
- `huntState: 'open' | 'settled'` (from server), `hunt` (name, start cost, bonuses[], total bet, actual payout), `entries[]` (user, guess, createdAt), `winners`, `archive[]`.
- Client: `myGuess`, `isLocked`, `showBonuses`, `isSwitching` (static animation), `isAdmin`.
- Derived: required avg, chat median, rank/off per entry, meter positions, viewer's position.

## Design Tokens
Colors:
- Page `#09080b`; surfaces `#17151b → #121015`, `#141216`, `#0f0e12`; bezel `#26232c → #141217`
- Text `#ece8e1` (primary), `#e4e0e8`, `#c9c4cf`, `#a7a2ad`, `#8a8690` (muted), `#6d6873`, `#5d5963` (faint)
- Orange (winner/settled) `#ff6a1a`, `#ff8a3d`, `#ff9a5c`, `#ffb27a`, dark gradient end `#e0520c`
- Teal (open/live state) `#3ee0bf`, `#7af0d6`, `#1fc9a8`
- Purple (Twitch/viewer) `#9146ff`, `#a26bff`, `#8240f0`, `#b89cff`, slip `#2a1d3d → #17121f`
- Red: LIVE `#d83a1c`, negative `#ff6b6b`
Type:
- Display/UI: **Bricolage Grotesque** 500/700/800 (Google Fonts)
- Labels/data: **JetBrains Mono** 400/600/700, uppercase, letter-spacing .15–.3em, 9–12px
- Scale: 96 / 60 / 30 / 24 / 22 / 20 / 17 / 15 / 14 / 13 / 12
Radii: 36 (bezel), 26 (screen), 24 (cards), 18 (rows/meter), 14–16 (buttons, inner), 10 (tiles, pills small), 999 (chips)
Shadows/depth: cards `inset 0 1px 0 rgba(255,255,255,.06), 0 14px 30px rgba(0,0,0,.4)`; lit states add colored outer glow `0 12px 30px -12px <accent @ .45>` and colored inset top highlight.
Spacing: 4 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 36.

## Assets
None — avatars are initials placeholders; slot tiles are initials. Use real Twitch avatars and slot artwork/provider data from the existing site.

## Files
- `Bonus Hunt On Air.dc.html` — the design (template markup + logic class with mock data). Prototype controls: `startState`, `adminView`, `boardSort`, `scanlines`, `staticOnSwitch`.
- `support.js` — runtime needed to open the HTML locally.
- `screenshots/` — reference captures.
