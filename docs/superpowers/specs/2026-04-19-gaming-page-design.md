# Gaming Page Design

**Date:** 2026-04-19  
**Status:** Approved

## Overview

A new "GAMING" section accessible from the main nav. Lets the streamer pick a random game from their Steam library using either a searchable browse list or an animated spin wheel. The wheel spins from the current filtered set, or the full library if no filter is active.

## Architecture

### New files

**`api/steam-library.js`**  
Serverless endpoint. Calls Steam `IPlayerService/GetOwnedGames/v1` with `include_appinfo=1&include_played_free_games=1`. Returns full owned library sorted by `playtime_forever` descending. Reuses existing `STEAM_API_KEY` and `STEAM_ID` env vars. Each game object: `{ appid, name, playtime_forever, img_logo_url }`.

**`src/pages/GamingPage.js`**  
Top-level page. Fetches `/api/steam-library` once on mount. Holds `games` (full list) and `query` + `sortBy` state. Derives `visibleGames` (filtered/sorted) from those. Renders the tool-switcher header (Browse / Wheel tabs, matching Gamba page pattern) and conditionally renders the two tool views.

**`src/components/GameWheel.js`**  
Isolated wheel component. Accepts `games` prop (the current `visibleGames` array). Handles spin animation internally. Emits nothing — just displays the result. Animation: slot-machine style using `setInterval` that cycles through games rapidly then decelerates over ~3 seconds, landing on a random pick. Displays result as a highlight card with Steam header image (`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`) and game name.

### Modified files

**`src/App.js`**  
Add `import GamingPage from './pages/GamingPage'` and `<Route path="/gaming" element={<GamingPage />} />`.

**`src/components/Navigation.js`**  
Add `{ id: 'gaming', label: 'GAMING' }` to `navItems` after `GAMBA`.

## Page Layout

Header matches Gamba page style — large title "GAME PICKER" with gradient text, subtitle, and two tool-switcher buttons: **Browse** and **Wheel**.

### Browse view

- Search input filters `visibleGames` by name (case-insensitive)
- Sort toggle: Most Played / A-Z
- Game grid: responsive, each card shows Steam header image, game name, total playtime hours
- No "Pick This" button — the wheel always uses the full filtered set automatically

### Wheel view

- Shows current pool size ("Spinning from X games")
- Search input (same state as Browse — shared filter) so user can narrow before spinning
- Large "SPIN" button triggers animation
- Slot-machine cycles visually through game names/images
- Result card appears after spin: header image, name, playtime
- "Spin Again" button resets

## Data Flow

```
GamingPage mount
  → fetch /api/steam-library
  → setGames(full library)

user types in search / changes sort
  → visibleGames = games.filter+sort

user switches to Wheel tab
  → GameWheel receives visibleGames
  → spins from that pool
```

## Error Handling

- API fetch fails: show error state with retry button (no crash)
- Empty library: show friendly empty state
- Zero games after filter: disable spin button, show "No games match your search"

## Styling

Follows existing site patterns: dark gradient background, emerald/purple accent colors, `font-black tracking-tighter` headings, `bg-white/5 border border-white/10` cards, `backdrop-blur-sm` panels. Game cards use the same hover scale pattern as `SteamGames.jsx`.
