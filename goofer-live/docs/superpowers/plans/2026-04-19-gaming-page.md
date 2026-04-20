# Gaming Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GAMING nav section with a Steam library browser and animated game-picker wheel.

**Architecture:** New serverless API endpoint fetches full Steam owned library. GamingPage holds shared filter/sort state and passes `visibleGames` to both a Browse grid and a GameWheel slot-machine component. Nav and router get one entry each.

**Tech Stack:** React, Tailwind CSS, Vercel serverless functions, Steam Web API (`GetOwnedGames`)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/steam-library.js` | Create | Fetch full Steam owned library via GetOwnedGames |
| `src/pages/GamingPage.js` | Create | Page shell: fetch, filter/sort state, tab switcher, Browse + Wheel views |
| `src/components/GameWheel.js` | Create | Slot-machine spin animation, result display |
| `src/components/Navigation.js` | Modify | Add GAMING nav item |
| `src/App.js` | Modify | Add /gaming route |

---

### Task 1: Steam Library API Endpoint

**Files:**
- Create: `api/steam-library.js`

- [ ] **Step 1: Create the endpoint**

```js
// api/steam-library.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const STEAM_API_KEY = process.env.STEAM_API_KEY;
  const STEAM_ID = process.env.STEAM_ID;

  if (!STEAM_API_KEY || !STEAM_ID) {
    return res.status(500).json({ error: 'Missing Steam API credentials' });
  }

  try {
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1`
    );

    if (!response.ok) throw new Error(`Steam API error: ${response.status}`);

    const data = await response.json();
    const games = data.response?.games || [];

    const formattedGames = games
      .map(game => ({
        appid: game.appid,
        name: game.name,
        playtime_forever: Math.floor(game.playtime_forever / 60),
        img_logo_url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      }))
      .sort((a, b) => b.playtime_forever - a.playtime_forever);

    res.status(200).json({ games: formattedGames });
  } catch (error) {
    console.error('Steam Library Error:', error);
    res.status(500).json({ error: 'Failed to fetch Steam library' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/steam-library.js
git commit -m "feat: add steam-library API endpoint for full owned games"
```

---

### Task 2: GameWheel Component

**Files:**
- Create: `src/components/GameWheel.js`

- [ ] **Step 1: Create the component**

```jsx
// src/components/GameWheel.js
import { useState, useRef } from 'react';
import { Shuffle, RotateCcw } from 'lucide-react';

export default function GameWheel({ games }) {
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const intervalRef = useRef(null);

  const spin = () => {
    if (spinning || games.length === 0) return;

    setResult(null);
    setSpinning(true);

    const winner = games[Math.floor(Math.random() * games.length)];
    let speed = 50;
    let elapsed = 0;
    const duration = 3000;

    const tick = () => {
      setCurrent(games[Math.floor(Math.random() * games.length)]);
      elapsed += speed;

      if (elapsed < duration) {
        // Decelerate: increase interval as time passes
        speed = 50 + Math.floor((elapsed / duration) * 250);
        intervalRef.current = setTimeout(tick, speed);
      } else {
        setCurrent(winner);
        setResult(winner);
        setSpinning(false);
      }
    };

    intervalRef.current = setTimeout(tick, speed);
  };

  const reset = () => {
    if (spinning) return;
    setResult(null);
    setCurrent(null);
  };

  const displayGame = result || current;

  return (
    <div className="space-y-6">
      {/* Pool info */}
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">
          Spinning from <span className="text-emerald-400 font-bold">{games.length}</span> game{games.length !== 1 ? 's' : ''}
        </p>
        {result && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all"
          >
            <RotateCcw size={12} />
            RESET
          </button>
        )}
      </div>

      {/* Slot display */}
      <div className="relative h-48 rounded-xl overflow-hidden border border-white/10 bg-black/40">
        {displayGame ? (
          <>
            <img
              src={displayGame.img_logo_url}
              alt={displayGame.name}
              className={`w-full h-full object-cover transition-opacity duration-150 ${spinning ? 'opacity-60' : 'opacity-100'}`}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className={`font-black text-xl tracking-tight text-white ${spinning ? 'blur-[1px]' : ''}`}>
                {displayGame.name}
              </p>
              {!spinning && displayGame.playtime_forever > 0 && (
                <p className="text-emerald-400 text-sm font-bold mt-1">
                  {displayGame.playtime_forever}h played
                </p>
              )}
            </div>
            {spinning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-16 bg-emerald-400/80 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">
            Hit SPIN to pick a game
          </div>
        )}
      </div>

      {/* Result banner */}
      {result && !spinning && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900/40 to-purple-900/40 border border-emerald-500/30 text-center">
          <p className="text-white/60 text-sm mb-1">Tonight you're playing</p>
          <p className="text-2xl font-black text-white tracking-tight">{result.name}</p>
        </div>
      )}

      {/* Spin button */}
      <button
        onClick={result ? reset : spin}
        disabled={spinning || games.length === 0}
        className="w-full py-4 rounded-xl font-black text-lg tracking-wide transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-600 hover:to-purple-600 text-white shadow-lg"
      >
        <Shuffle size={22} />
        {spinning ? 'SPINNING...' : result ? 'SPIN AGAIN' : 'SPIN'}
      </button>

      {games.length === 0 && (
        <p className="text-center text-white/40 text-sm">No games match your search.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GameWheel.js
git commit -m "feat: add GameWheel slot-machine component"
```

---

### Task 3: GamingPage

**Files:**
- Create: `src/pages/GamingPage.js`

- [ ] **Step 1: Create the page**

```jsx
// src/pages/GamingPage.js
import { useState, useEffect, useMemo } from 'react';
import { Gamepad2, List, Shuffle, Search, Clock, ArrowUpDown } from 'lucide-react';
import GameWheel from '../components/GameWheel';

export default function GamingPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState('browse');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('playtime'); // 'playtime' | 'alpha'

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await fetch('/api/steam-library');
        if (!res.ok) throw new Error('Failed to fetch Steam library');
        const data = await res.json();
        setGames(data.games || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const visibleGames = useMemo(() => {
    let filtered = query.trim()
      ? games.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
      : games;

    if (sortBy === 'alpha') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    // 'playtime' order already comes sorted from API

    return filtered;
  }, [games, query, sortBy]);

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="text-center space-y-4">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              GAME PICKER
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Can't decide what to play? Browse your Steam library or let the wheel decide.
          </p>

          {/* Tab switcher */}
          <div className="flex justify-center gap-4 pt-4 flex-wrap">
            <button
              onClick={() => setActiveTool('browse')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'browse'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <List size={18} />
              Browse
            </button>
            <button
              onClick={() => setActiveTool('wheel')}
              className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTool === 'wheel'
                  ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
              }`}
            >
              <Shuffle size={18} />
              Wheel
            </button>
          </div>
        </header>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-white/60 mt-4">Loading Steam library...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-20 space-y-4">
            <p className="text-red-400 font-bold">Failed to load library</p>
            <p className="text-white/50 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-6">
            {/* Shared search + sort bar */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-3 focus:border-emerald-400 focus:outline-none text-sm"
                />
              </div>
              <button
                onClick={() => setSortBy(s => s === 'playtime' ? 'alpha' : 'playtime')}
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all text-sm font-bold"
              >
                <ArrowUpDown size={14} />
                {sortBy === 'playtime' ? 'Most Played' : 'A–Z'}
              </button>
            </div>

            {/* Browse view */}
            {activeTool === 'browse' && (
              <div>
                <p className="text-white/40 text-sm mb-4">
                  {visibleGames.length} game{visibleGames.length !== 1 ? 's' : ''}
                  {query ? ` matching "${query}"` : ' in library'}
                </p>
                {visibleGames.length === 0 ? (
                  <div className="text-center py-16 text-white/40">No games match your search.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {visibleGames.map(game => (
                      <div
                        key={game.appid}
                        className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-emerald-500/40 hover:scale-105 transition-all duration-200"
                      >
                        <div className="aspect-[460/215] relative overflow-hidden bg-black/40">
                          <img
                            src={game.img_logo_url}
                            alt={game.name}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-white text-xs line-clamp-2 group-hover:text-emerald-400 transition-colors">
                            {game.name}
                          </p>
                          {game.playtime_forever > 0 && (
                            <p className="flex items-center gap-1 text-white/40 text-xs mt-1">
                              <Clock size={10} />
                              {game.playtime_forever}h
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Wheel view */}
            {activeTool === 'wheel' && (
              <div className="max-w-lg mx-auto p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                  <Gamepad2 size={18} />
                  Game Wheel
                </div>
                <h2 className="text-3xl font-black tracking-tighter mb-6">
                  Let fate decide.
                </h2>
                <GameWheel games={visibleGames} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/GamingPage.js
git commit -m "feat: add GamingPage with browse grid and wheel tab"
```

---

### Task 4: Wire Up Nav and Router

**Files:**
- Modify: `src/components/Navigation.js`
- Modify: `src/App.js`

- [ ] **Step 1: Add GAMING to nav**

In `src/components/Navigation.js`, update `navItems`:

```js
const navItems = [
  { id: 'home', label: 'HOME' },
  { id: 'schedule', label: 'SCHEDULE' },
  { id: 'vods', label: 'VODS & CLIPS' },
  // { id: 'gear', label: 'GEAR' },
  // { id: 'gear-interactive', label: 'GEAR (NEW)' },
  { id: 'bonus-hunts', label: 'BONUS HUNTS' },
  { id: 'gamba', label: 'GAMBA' },
  { id: 'gaming', label: 'GAMING' },
  { id: 'about', label: 'ABOUT ME' },
  { id: 'admin', label: 'ADMIN' },
];
```

- [ ] **Step 2: Add /gaming route in App.js**

Add import near the other page imports (around line 12):
```js
import GamingPage from './pages/GamingPage';
```

Add route inside `<Routes>` after the `/gamba` route:
```jsx
<Route path="/gaming" element={<GamingPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Navigation.js src/App.js
git commit -m "feat: add GAMING nav item and /gaming route"
```

---

### Task 5: Verify and Deploy

- [ ] **Step 1: Run build locally to check for errors**

```bash
npm run build
```

Expected: no errors, build succeeds.

- [ ] **Step 2: Manual smoke test**

1. Navigate to `/gaming` — page loads, spinner shows, then games grid appears
2. Type in search box — grid narrows correctly
3. Toggle sort — order changes
4. Switch to Wheel tab — pool count matches visible games
5. Hit SPIN — animation runs ~3 seconds, lands on a game
6. "SPIN AGAIN" resets and spins again
7. Type a search term in Wheel tab — pool count updates, spin uses filtered set
8. Clear search — pool returns to full library

- [ ] **Step 3: Commit any fixes found during smoke test, then push**

```bash
git push
```
