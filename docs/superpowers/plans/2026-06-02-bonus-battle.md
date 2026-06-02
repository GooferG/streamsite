# Bonus Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Bonus Battle" tool to the Gamba section — admin spins a wheel to pick the next player, enters payouts, and the tool tracks a winner-takes-all pot (sum of payouts − 10% rake), with a live read-only viewer page.

**Architecture:** Pure-function pot math in `utils/battleCalc.js` (unit-tested). A `useBattleStore` hook mirroring `useHuntStore`'s local-fallback + Firestore-onSnapshot pattern, with players as a uid-keyed subcollection under `bonus_battles/{ownerUid}`. A `BonusBattle` admin component (new Gamba channel), a `BattleWheel` forked from `GameWheel` (adds `onResult` callback + un-played pool), and a `BattlePage` live viewer at `/battle/:ownerId`. Rules modeled on the existing `shared_hunts` block.

**Tech Stack:** React 19, react-router-dom v7, Firebase Firestore (`onSnapshot`/`setDoc`/`deleteDoc`), Tailwind, Jest (react-scripts), lucide-react.

---

## File Structure

- Create: `src/utils/battleCalc.js` — pure pot/rake/winner/loser math + `currency()` formatter.
- Create: `src/utils/__tests__/battleCalc.test.js` — unit tests for the math.
- Create: `src/hooks/useBattleStore.js` — battle + players state, local fallback, Firestore sync.
- Create: `src/components/BattleWheel.js` — wheel (forked from GameWheel) with `players` + `onResult`.
- Create: `src/components/BonusBattle.js` — admin tool surface (3-col desktop / stacked mobile).
- Create: `src/pages/BattlePage.js` — live read-only viewer.
- Modify: `src/data/gambaTools.js` — register the channel.
- Modify: `src/pages/GambaPage.js` — lazy-load + render the tool.
- Modify: `src/App.js` — add `/battle/:ownerId` route + gamba sub-route stub.
- Modify: `firestore.rules` — add `bonus_battles` + `players` subcollection rules.

---

## Task 1: Pot math (`battleCalc.js`) — pure functions + tests

**Files:**
- Create: `src/utils/battleCalc.js`
- Test: `src/utils/__tests__/battleCalc.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/battleCalc.test.js`:

```js
import { computeBattle, currency } from '../battleCalc';

// 3 ran players + 1 not-yet-run. Payouts 43.68, 41.76, 20. rake 10%.
const PLAYERS = [
  { id: 'a', name: 'SEPULTO', payout: 43.68, ran: true },
  { id: 'b', name: 'RENMVATO', payout: 41.76, ran: true },
  { id: 'c', name: 'IURIFISTER', payout: 20, ran: true },
  { id: 'd', name: 'UNSLOVIAK', payout: null, ran: false },
];

describe('computeBattle', () => {
  test('totalPot sums only ran payouts', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.totalPot).toBeCloseTo(105.44, 2);
  });

  test('potAfterRake applies the rake percent', () => {
    const r = computeBattle(PLAYERS, 10);
    // 105.44 * 0.9 = 94.896
    expect(r.potAfterRake).toBeCloseTo(94.896, 3);
    expect(r.rakeAmount).toBeCloseTo(10.544, 3);
  });

  test('winner is the highest ran payout, loser the lowest', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.winner.id).toBe('a');
    expect(r.loser.id).toBe('c');
  });

  test('counts: total / ran / left', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.total).toBe(4);
    expect(r.ran).toBe(3);
    expect(r.left).toBe(1);
  });

  test('zero-payout player counts as ran and can be the loser', () => {
    const players = [
      { id: 'a', name: 'A', payout: 50, ran: true },
      { id: 'b', name: 'B', payout: 0, ran: true },
    ];
    const r = computeBattle(players, 10);
    expect(r.loser.id).toBe('b');
    expect(r.totalPot).toBeCloseTo(50, 2);
  });

  test('no ran players: winner/loser null, pot 0', () => {
    const r = computeBattle([{ id: 'a', payout: null, ran: false }], 10);
    expect(r.winner).toBeNull();
    expect(r.loser).toBeNull();
    expect(r.totalPot).toBe(0);
  });

  test('tie on payout: lower order index wins the tie-break', () => {
    const players = [
      { id: 'a', name: 'A', payout: 30, ran: true, order: 1 },
      { id: 'b', name: 'B', payout: 30, ran: true, order: 0 },
    ];
    const r = computeBattle(players, 10);
    expect(r.winner.id).toBe('b'); // order 0 wins tie
  });
});

describe('currency', () => {
  test('formats USD with two decimals and thousands separator', () => {
    expect(currency(1080)).toBe('$1,080.00');
    expect(currency(167.7)).toBe('$167.70');
    expect(currency(0)).toBe('$0.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --watchAll=false --testPathPattern=battleCalc`
Expected: FAIL — `Cannot find module '../battleCalc'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/battleCalc.js`:

```js
// Pure pot math for Bonus Battle. No React, no Firestore — unit-testable.

// USD formatter. Two decimals, thousands separator, leading $.
export function currency(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Tie-break: highest payout wins; ties broken by lowest `order` (insertion order).
function better(a, b) {
  if (b == null) return a;
  if (a.payout !== b.payout) return a.payout > b.payout ? a : b;
  return (a.order ?? 0) <= (b.order ?? 0) ? a : b;
}
function worse(a, b) {
  if (b == null) return a;
  if (a.payout !== b.payout) return a.payout < b.payout ? a : b;
  return (a.order ?? 0) <= (b.order ?? 0) ? a : b;
}

// players: [{ id, name, slot, payout, ran, order }]
// rakePct: number (e.g. 10 for 10%)
export function computeBattle(players, rakePct) {
  const list = Array.isArray(players) ? players : [];
  const ranPlayers = list.filter((p) => p.ran);

  const totalPot = ranPlayers.reduce((sum, p) => sum + (Number(p.payout) || 0), 0);
  const pct = Number(rakePct) || 0;
  const rakeAmount = totalPot * (pct / 100);
  const potAfterRake = totalPot - rakeAmount;

  let winner = null;
  let loser = null;
  for (const p of ranPlayers) {
    winner = better(p, winner);
    loser = worse(p, loser);
  }

  return {
    total: list.length,
    ran: ranPlayers.length,
    left: list.length - ranPlayers.length,
    totalPot,
    rakeAmount,
    potAfterRake,
    winner,
    loser,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watchAll=false --testPathPattern=battleCalc`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleCalc.js src/utils/__tests__/battleCalc.test.js
git commit -m "feat: bonus battle pot math + tests"
```

---

## Task 2: Firestore rules for `bonus_battles`

**Files:**
- Modify: `firestore.rules` (insert before the final two closing braces, after the `shared_hunts` block ~line 168)

- [ ] **Step 1: Add the rules block**

In `firestore.rules`, immediately after the closing `}` of the `match /shared_hunts/{shareId}` block, add:

```
    // Bonus Battle: public read so spectators can watch; only the owner (by
    // uid == ownerTwitchId) or staff can write. Players live in a subcollection
    // keyed by playerId so a future viewer-self-join can grant per-player writes.
    match /bonus_battles/{battleId} {
      allow read: if true;
      allow create, update: if isSignedIn()
        && request.resource.data.ownerTwitchId == request.auth.uid;
      allow delete: if isSignedIn()
        && resource.data.ownerTwitchId == request.auth.uid;

      match /players/{playerId} {
        allow read: if true;
        // Now: owner or staff only. Pivot for self-join: add `|| isSelf(playerId)`.
        allow write: if isStaff()
          || get(/databases/$(database)/documents/bonus_battles/$(battleId)).data.ownerTwitchId == request.auth.uid;
      }
    }
```

- [ ] **Step 2: Verify braces balance**

Run: `node -e "const s=require('fs').readFileSync('firestore.rules','utf8');const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;console.log('open',o,'close',c);process.exit(o===c?0:1)"`
Expected: `open N close N` with equal counts, exit 0.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore rules for bonus battles"
```

> Note: rules deploy is manual (`firebase deploy --only firestore:rules --project goofer-website`). Flag to the user at the end; do NOT deploy from the plan.

---

## Task 3: `useBattleStore` hook

**Files:**
- Create: `src/hooks/useBattleStore.js`

This hook owns the active battle (a single doc per owner uid) + its players subcollection. Local-only fallback (localStorage) when logged out, exactly like `useHuntStore`. When logged in, subscribes via `onSnapshot` and writes through to Firestore.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useBattleStore.js`:

```js
import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { makeId } from '../utils/huntCalc';

const LS_KEY = 'bonus_battle_active';

const EMPTY_BATTLE = (ownerUid) => ({
  ownerTwitchId: ownerUid || null,
  title: 'Bonus Battle',
  rakePct: 10,
  currentPlayerId: null,
  status: 'active',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}
function saveLocal(state) {
  if (state) localStorage.setItem(LS_KEY, JSON.stringify(state));
  else localStorage.removeItem(LS_KEY);
}

// Local shape mirrors the Firestore split: { battle, players: [] }.
export function useBattleStore() {
  const { twitchUser, firebaseUser } = useTwitchAuth();
  const uid = firebaseUser?.uid || twitchUser?.twitchId || null;
  const isLoggedIn = !!uid;

  const [battle, setBattle] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);

  // --- subscribe / load ---
  useEffect(() => {
    if (!isLoggedIn) {
      const local = loadLocal();
      setBattle(local?.battle || null);
      setPlayers(local?.players || []);
      return;
    }
    const battleRef = doc(db, 'bonus_battles', uid);
    const unsubBattle = onSnapshot(
      battleRef,
      (snap) => setBattle(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (err) => {
        console.error('battle sub error:', err);
        setError('Could not load the battle.');
      }
    );
    const playersQ = query(
      collection(db, 'bonus_battles', uid, 'players'),
      orderBy('order', 'asc')
    );
    const unsubPlayers = onSnapshot(
      playersQ,
      (snap) => setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('players sub error:', err)
    );
    return () => {
      unsubBattle();
      unsubPlayers();
    };
  }, [isLoggedIn, uid]);

  // --- local persistence (logged out) ---
  const persistLocal = useCallback(
    (nextBattle, nextPlayers) => {
      saveLocal({ battle: nextBattle, players: nextPlayers });
    },
    []
  );

  // --- battle-level writes ---
  const writeBattle = useCallback(
    (patch) => {
      setBattle((prev) => {
        const base = prev || EMPTY_BATTLE(uid);
        const next = { ...base, ...patch, updatedAt: Date.now() };
        if (!isLoggedIn) {
          setPlayers((pl) => {
            persistLocal(next, pl);
            return pl;
          });
        } else {
          setDoc(doc(db, 'bonus_battles', uid), next, { merge: true }).catch((e) => {
            console.error('battle write failed:', e);
            setError('Save failed.');
          });
        }
        return next;
      });
    },
    [isLoggedIn, uid, persistLocal]
  );

  const startBattle = useCallback(() => {
    writeBattle(EMPTY_BATTLE(uid));
  }, [writeBattle, uid]);

  const setRake = useCallback((pct) => writeBattle({ rakePct: Number(pct) || 0 }), [writeBattle]);
  const setTitle = useCallback((title) => writeBattle({ title }), [writeBattle]);
  const setCurrentPlayer = useCallback(
    (playerId) => writeBattle({ currentPlayerId: playerId }),
    [writeBattle]
  );

  // --- player-level writes ---
  const addPlayer = useCallback(
    ({ name, slot }) => {
      if (!name || !name.trim()) return;
      const id = makeId();
      const order = players.length;
      const player = {
        name: name.trim(),
        slot: (slot || '').trim(),
        payout: null,
        ran: false,
        addedByUid: uid || 'local',
        order,
        createdAt: Date.now(),
      };
      if (!isLoggedIn) {
        setPlayers((prev) => {
          const next = [...prev, { id, ...player }];
          persistLocal(battle || EMPTY_BATTLE(uid), next);
          return next;
        });
      } else {
        setDoc(doc(db, 'bonus_battles', uid, 'players', id), player).catch((e) =>
          console.error('addPlayer failed:', e)
        );
      }
    },
    [players.length, isLoggedIn, uid, battle, persistLocal]
  );

  const removePlayer = useCallback(
    (playerId) => {
      if (!isLoggedIn) {
        setPlayers((prev) => {
          const next = prev.filter((p) => p.id !== playerId);
          persistLocal(battle || EMPTY_BATTLE(uid), next);
          return next;
        });
      } else {
        deleteDoc(doc(db, 'bonus_battles', uid, 'players', playerId)).catch((e) =>
          console.error('removePlayer failed:', e)
        );
      }
    },
    [isLoggedIn, uid, battle, persistLocal]
  );

  const setPayout = useCallback(
    (playerId, payout) => {
      const value = Number(payout) || 0;
      if (!isLoggedIn) {
        setPlayers((prev) => {
          const next = prev.map((p) =>
            p.id === playerId ? { ...p, payout: value, ran: true } : p
          );
          persistLocal(battle || EMPTY_BATTLE(uid), next);
          return next;
        });
      } else {
        updateDoc(doc(db, 'bonus_battles', uid, 'players', playerId), {
          payout: value,
          ran: true,
        }).catch((e) => console.error('setPayout failed:', e));
      }
    },
    [isLoggedIn, uid, battle, persistLocal]
  );

  const reset = useCallback(() => {
    if (!isLoggedIn) {
      saveLocal(null);
      setBattle(null);
      setPlayers([]);
      return;
    }
    // Delete players then the battle doc. Best-effort.
    Promise.all(
      players.map((p) =>
        deleteDoc(doc(db, 'bonus_battles', uid, 'players', p.id)).catch(() => {})
      )
    ).then(() => deleteDoc(doc(db, 'bonus_battles', uid)).catch(() => {}));
  }, [isLoggedIn, uid, players]);

  return {
    battle,
    players,
    error,
    isLoggedIn,
    ownerId: uid,
    startBattle,
    setRake,
    setTitle,
    setCurrentPlayer,
    addPlayer,
    removePlayer,
    setPayout,
    reset,
  };
}
```

- [ ] **Step 2: Verify it compiles (lint via build-time parser)**

Run: `npx eslint src/hooks/useBattleStore.js --no-eslintrc --parser-options ecmaVersion:2021,sourceType:module,ecmaFeatures:{jsx:true}`
Expected: no syntax errors (rule warnings about hooks deps are acceptable; fix only parse errors). If eslint flags only `react-hooks/exhaustive-deps`-style warnings, that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBattleStore.js
git commit -m "feat: useBattleStore hook (local + firestore)"
```

---

## Task 4: `BattleWheel` component (forked from GameWheel)

**Files:**
- Create: `src/components/BattleWheel.js`

`GameWheel` self-resolves a winner and exposes no callback. `BattleWheel` takes `players` (already filtered to un-played by the parent) and calls `onResult(player)` on lock, keeping the GameWheel visual idiom (tuning scan-line, "Signal lock", pool indicator) but rendering a player **name** instead of a game image.

- [ ] **Step 1: Create the component**

Create `src/components/BattleWheel.js`:

```js
import { useState, useRef, useEffect } from 'react';

// Wheel that picks the next player from a pool of un-played players.
// props:
//   players: [{ id, name, slot }]  — already filtered to un-played
//   onResult: (player) => void     — called once when the spin locks
//   disabled: boolean
export default function BattleWheel({ players = [], onResult, disabled = false }) {
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const spin = () => {
    if (spinning || disabled || players.length === 0) return;
    setResult(null);
    setSpinning(true);

    const winner = players[Math.floor(Math.random() * players.length)];
    let speed = 50;
    let elapsed = 0;
    const duration = 3000;

    const tick = () => {
      setCurrent(players[Math.floor(Math.random() * players.length)]);
      elapsed += speed;
      if (elapsed < duration) {
        speed = 50 + Math.floor((elapsed / duration) * 250);
        timeoutRef.current = setTimeout(tick, speed);
      } else {
        setCurrent(winner);
        setResult(winner);
        setSpinning(false);
        if (onResult) onResult(winner);
      }
    };
    timeoutRef.current = setTimeout(tick, speed);
  };

  const display = result || current;

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes wheel-tune-scan { 0% { transform: translateY(-100%);} 100% { transform: translateY(100%);} }
        .bw-scan-line { background: linear-gradient(to bottom, transparent 0%, rgba(168,85,247,0.25) 50%, transparent 100%); animation: wheel-tune-scan 0.9s linear infinite; }
        @keyframes wheel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        .bw-pulse { animation: wheel-pulse 1.4s ease-in-out infinite; }
      `}</style>

      {/* Pool indicator */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border border-white/8 bg-zinc-broadcast/40 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
        <span className="inline-flex items-center gap-2 text-purple-bright">
          <span className={`w-1.5 h-1.5 rounded-full bg-purple-bright ${spinning ? 'bw-pulse' : ''}`} />
          <span>{spinning ? 'Spinning…' : 'Wheel ready'}</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">In pool</span>
        <span className="text-white/75 tabular-nums">{String(players.length).padStart(2, '0')}</span>
      </div>

      {/* Reel viewport */}
      <div className="relative border border-white/10 bg-zinc-broadcast overflow-hidden">
        {spinning && (
          <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden motion-reduce:hidden" aria-hidden="true">
            <div className="bw-scan-line absolute inset-x-0 h-32" />
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 border-b border-white/8 bg-zinc-broadcast/80 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          <span className={`inline-flex items-center gap-2 ${spinning ? 'text-purple-bright bw-pulse' : 'text-emerald-signal'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${spinning ? 'bg-purple-bright' : 'bg-emerald-signal'}`} />
            <span>{spinning ? 'Spinning…' : result ? 'Player locked' : 'Stand by'}</span>
          </span>
          <span className="text-white/55">BATTLE · NEXT UP</span>
        </div>

        <div className="relative h-48 sm:h-56 flex items-center justify-center">
          {display ? (
            <div className="text-center px-4">
              <p
                className={`font-black text-2xl sm:text-3xl tracking-tight text-white-body leading-tight ${spinning ? 'blur-[1.5px]' : ''}`}
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              >
                {display.name}
              </p>
              {!spinning && display.slot && (
                <p className="text-[11px] tracking-eyebrow-md uppercase text-purple-bright mt-2 font-mono">
                  {display.slot}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 font-mono">
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/60">No signal</span>
              <span className="text-sm text-white/70 text-center">
                {players.length === 0 ? 'Everyone has played.' : 'Spin to pick the next player.'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Spin button */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning || disabled || players.length === 0}
        className="w-full px-6 py-3 bg-purple-gamba text-white font-bold text-xs tracking-eyebrow-lg uppercase font-mono disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-bright transition-colors"
      >
        {spinning ? 'Spinning…' : '⟳ Spin the wheel'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it parses**

Run: `npx eslint src/components/BattleWheel.js`
Expected: no parse errors (hook-dep warnings acceptable).

- [ ] **Step 3: Commit**

```bash
git add src/components/BattleWheel.js
git commit -m "feat: BattleWheel component"
```

---

## Task 5: `BonusBattle` admin tool surface

**Files:**
- Create: `src/components/BonusBattle.js`

Renders the 3-column desktop / stacked-mobile board. Uses `useBattleStore` for state, `computeBattle`/`currency` for derived values, `SlotAutocomplete` for the slot pick, and `BattleWheel` for the spin. The same layout is reused (read-only) by `BattlePage` via a shared presentational sub-component exported here.

- [ ] **Step 1: Create the component (with an exported read-only board)**

Create `src/components/BonusBattle.js`:

```js
import { useState } from 'react';
import { Swords, Trophy, Ticket, X } from 'lucide-react';
import SlotAutocomplete from './SlotAutocomplete';
import BattleWheel from './BattleWheel';
import { useBattleStore } from '../hooks/useBattleStore';
import { computeBattle, currency } from '../utils/battleCalc';

// ---- Shared presentational board. `interactive` toggles admin controls. ----
// Exported so BattlePage can render the identical board read-only.
export function BattleBoard({
  battle,
  players,
  derived,
  interactive = false,
  // interactive-only handlers:
  onAddPlayer,
  onRemovePlayer,
  onSetPayout,
  onSpinResult,
  onSetRake,
}) {
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('');
  const [payoutInput, setPayoutInput] = useState('');

  const current = players.find((p) => p.id === battle?.currentPlayerId) || null;
  const unplayed = players.filter((p) => !p.ran);
  const rakePct = battle?.rakePct ?? 10;
  const sorted = [...players].sort((a, b) => (b.payout || 0) - (a.payout || 0));

  const submitPlayer = () => {
    if (!name.trim()) return;
    onAddPlayer?.({ name, slot });
    setName('');
    setSlot('');
  };
  const submitPayout = () => {
    if (!current) return;
    onSetPayout?.(current.id, payoutInput === '' ? 0 : payoutInput);
    setPayoutInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_360px] gap-4 items-start">
      {/* ----- LEFT (desktop) / order-3 (mobile): Players & Pot ----- */}
      <div className="order-3 lg:order-1 border border-white/8 bg-zinc-card/50 p-5">
        <p className="text-xs font-bold tracking-eyebrow-lg uppercase text-white/60 mb-4 flex items-center gap-2">
          <Swords size={14} className="text-emerald-signal" /> Players &amp; Pot
        </p>
        <div className="border border-purple-gamba/70 bg-purple-gamba/10 p-4 mb-4">
          <div className="text-[11px] tracking-eyebrow-md uppercase text-purple-bright">Total Pot</div>
          <div className="text-3xl font-black text-white-body mt-1 tabular-nums">{currency(derived.totalPot)}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat n={derived.total} k="Total" border="border-amber-rust/60" text="text-amber-rust" />
          <Stat n={derived.ran} k="Ran" border="border-emerald-signal/60" text="text-emerald-signal" />
          <Stat n={derived.left} k="Left" border="border-white/10" text="text-crt-amber" />
        </div>

        {interactive && (
          <div className="space-y-2 mb-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              className="w-full bg-black/30 border border-white/10 text-white-body text-sm px-3 py-2.5 font-mono focus:outline-none focus:border-emerald-signal/60"
            />
            <SlotAutocomplete
              value={slot}
              onChange={setSlot}
              placeholder="Slot pick…"
              className="w-full"
            />
            <button
              type="button"
              onClick={submitPlayer}
              className="w-full px-3 py-2.5 bg-white/10 hover:bg-white/15 text-white-body text-[11px] font-bold tracking-eyebrow-md uppercase font-mono transition-colors"
            >
              + Add player
            </button>
          </div>
        )}

        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 border border-white/7 px-3 py-2.5 ${p.ran ? '' : 'opacity-60'}`}
            >
              <span className="text-sm font-bold text-white-body truncate">{p.name}</span>
              {p.slot && <span className="text-[10px] uppercase text-white/50 tracking-eyebrow-sm truncate">· {p.slot}</span>}
              <span className={`ml-auto text-sm font-black tabular-nums ${p.ran ? 'text-emerald-signal' : 'text-white/40'}`}>
                {p.ran ? currency(p.payout) : '—'}
              </span>
              {interactive && (
                <button type="button" onClick={() => onRemovePlayer?.(p.id)} aria-label={`Remove ${p.name}`} className="text-white/30 hover:text-red-destructive">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-xs text-white/40 font-mono py-4 text-center">No players yet.</p>
          )}
        </div>

        {interactive && current && (
          <div className="border border-dashed border-emerald-signal/40 p-4 mt-4">
            <div className="text-[11px] tracking-eyebrow-md uppercase text-emerald-signal mb-2">
              {current.name} — How much did it pay?
            </div>
            <input
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPayout()}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-black/30 border border-white/12 text-white-body text-lg px-3 py-2.5 font-mono tabular-nums focus:outline-none focus:border-emerald-signal"
            />
            <button
              type="button"
              onClick={submitPayout}
              className="w-full mt-2.5 px-3 py-3.5 bg-emerald-signal text-zinc-950 text-sm font-black tracking-eyebrow-md uppercase font-mono hover:opacity-90 transition-opacity"
            >
              ✓ Save Payout
            </button>
          </div>
        )}
      </div>

      {/* ----- CENTER (desktop) / order-1 (mobile): Action ----- */}
      <div className="order-1 lg:order-2 border border-white/8 bg-zinc-card/50 p-5">
        <p className="text-center text-[13px] tracking-eyebrow-lg uppercase text-purple-bright mb-2">
          Who plays next?
        </p>
        {interactive ? (
          <BattleWheel players={unplayed} onResult={onSpinResult} disabled={unplayed.length === 0} />
        ) : (
          <div className="border border-white/10 bg-zinc-broadcast h-56 flex items-center justify-center text-white/50 font-mono text-sm">
            {current ? `Now playing: ${current.name}` : 'Waiting for the host to spin…'}
          </div>
        )}
        {current && (
          <div className="border border-amber-rust/60 bg-amber-rust/10 p-4 mt-5 text-center">
            <div className="text-[11px] tracking-eyebrow-md uppercase text-amber-rust">Now Playing</div>
            <div className="text-2xl font-black text-white-body mt-1">{current.name}</div>
            {current.slot && <div className="text-[12px] uppercase text-white/70 tracking-eyebrow-sm mt-1">{current.slot}</div>}
          </div>
        )}
      </div>

      {/* ----- RIGHT (desktop) / order-4 (mobile): Standings ----- */}
      <div className="order-4 lg:order-3 border border-white/8 bg-zinc-card/50 p-5">
        <p className="text-xs font-bold tracking-eyebrow-lg uppercase text-white/60 mb-4 flex items-center gap-2">
          <Trophy size={14} className="text-crt-amber" /> Standings
        </p>
        <div className="space-y-2">
          {sorted.filter((p) => p.ran).map((p, i) => {
            const isWin = derived.winner && p.id === derived.winner.id;
            const isLose = derived.loser && p.id === derived.loser.id && derived.ran > 1;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 border px-3 py-2.5 ${
                  isWin ? 'border-emerald-signal/60' : isLose ? 'border-red-destructive/60' : 'border-white/7'
                }`}
              >
                <span className="text-base font-black text-crt-amber w-5 tabular-nums">{i + 1}</span>
                <span className="text-sm font-bold text-white-body truncate">{p.name}</span>
                {p.slot && <span className="text-[10px] uppercase text-white/45 truncate">· {p.slot}</span>}
                <span className={`ml-auto text-base font-black tabular-nums ${isWin ? 'text-emerald-signal' : isLose ? 'text-red-destructive' : 'text-white-body'}`}>
                  {currency(p.payout)}
                </span>
              </div>
            );
          })}
          {derived.ran === 0 && <p className="text-xs text-white/40 font-mono py-4 text-center">No payouts entered yet.</p>}
        </div>

        <div className="border border-purple-gamba/70 bg-purple-gamba/10 p-4 mt-4 text-center">
          <div className="text-[12px] tracking-eyebrow-md uppercase text-purple-bright flex items-center justify-center gap-1.5">
            <Trophy size={13} /> Winner Takes All
          </div>
          <div className="text-3xl font-black text-white-body my-1.5 tabular-nums">{currency(derived.potAfterRake)}</div>
          <div className="text-[12px] text-white/55 tabular-nums">
            Pot {currency(derived.totalPot)} − {rakePct}% rake ({currency(derived.rakeAmount)})
          </div>
          {interactive && (
            <label className="block mt-3 text-[10px] tracking-eyebrow-md uppercase text-white/50">
              Rake %
              <input
                type="number"
                value={rakePct}
                onChange={(e) => onSetRake?.(e.target.value)}
                className="ml-2 w-16 bg-black/30 border border-white/12 text-white-body text-sm px-2 py-1 font-mono tabular-nums"
              />
            </label>
          )}
        </div>
        <div className="border border-red-destructive/50 bg-red-destructive/10 p-3 mt-2.5 text-center text-[12px] tracking-eyebrow-sm uppercase text-red-destructive/90 flex items-center justify-center gap-1.5">
          <Ticket size={13} /> Biggest loser → free ticket
        </div>
      </div>
    </div>
  );
}

function Stat({ n, k, border, text }) {
  return (
    <div className={`border p-3 text-center ${border}`}>
      <div className={`text-2xl font-black tabular-nums ${text}`}>{n}</div>
      <div className="text-[10px] tracking-eyebrow-md uppercase text-white/55 mt-1">{k}</div>
    </div>
  );
}

// ---- Admin tool: owns state, renders the interactive board. ----
export default function BonusBattle() {
  const store = useBattleStore();
  const { battle, players, startBattle, addPlayer, removePlayer, setPayout, setCurrentPlayer, setRake, reset } = store;

  const derived = computeBattle(players, battle?.rakePct ?? 10);

  if (!battle) {
    return (
      <div className="border border-white/8 bg-zinc-card/40 p-10 text-center font-mono">
        <p className="text-sm text-white/70 mb-4">No active battle.</p>
        <button
          type="button"
          onClick={startBattle}
          className="px-6 py-3 bg-purple-gamba hover:bg-purple-bright text-white text-xs font-bold tracking-eyebrow-lg uppercase transition-colors"
        >
          Start a Bonus Battle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-eyebrow-lg uppercase text-emerald-signal">◉ Bonus Battle</h2>
        <button
          type="button"
          onClick={() => { if (window.confirm('Reset the battle? This clears all players.')) reset(); }}
          className="text-[10px] tracking-eyebrow-md uppercase text-white/40 hover:text-red-destructive font-mono"
        >
          Reset
        </button>
      </div>
      <BattleBoard
        battle={battle}
        players={players}
        derived={derived}
        interactive
        onAddPlayer={addPlayer}
        onRemovePlayer={removePlayer}
        onSetPayout={setPayout}
        onSpinResult={(p) => setCurrentPlayer(p.id)}
        onSetRake={setRake}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it parses**

Run: `npx eslint src/components/BonusBattle.js`
Expected: no parse errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BonusBattle.js
git commit -m "feat: BonusBattle admin tool + shared board"
```

---

## Task 6: Register the Gamba channel

**Files:**
- Modify: `src/data/gambaTools.js`
- Modify: `src/pages/GambaPage.js`

- [ ] **Step 1: Add the tool to the registry**

In `src/data/gambaTools.js`, change the import and array:

```js
import { Target, Gamepad2, Layers, Radio, Swords } from 'lucide-react';

export const GAMBA_TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'bonus-battle', label: 'Bonus Battle', icon: Swords },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
];
```

- [ ] **Step 2: Lazy-import + render in GambaPage**

In `src/pages/GambaPage.js`, after the `HuntTracker` lazy import (line ~14), add:

```js
const BonusBattle = lazy(() => import('../components/BonusBattle'));
```

Then in the tool-surface block (after the `wheel` block, around line 337-340), add:

```jsx
              {activeTool === 'bonus-battle' && (
                <Suspense fallback={<ToolLoading label="Loading bonus battle…" />}>
                  <BonusBattle />
                </Suspense>
              )}
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: "Compiled successfully" (warnings OK). This confirms the lazy import path and JSX are valid.

- [ ] **Step 4: Commit**

```bash
git add src/data/gambaTools.js src/pages/GambaPage.js
git commit -m "feat: register bonus battle gamba channel"
```

---

## Task 7: Live viewer page `BattlePage`

**Files:**
- Create: `src/pages/BattlePage.js`
- Modify: `src/App.js`

- [ ] **Step 1: Create the viewer page**

Create `src/pages/BattlePage.js`:

```js
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { RadioTower } from 'lucide-react';
import { db } from '../config/firebase';
import { computeBattle } from '../utils/battleCalc';
import { BattleBoard } from '../components/BonusBattle';

export default function BattlePage() {
  const { ownerId } = useParams();
  const [battle, setBattle] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    const unsubBattle = onSnapshot(
      doc(db, 'bonus_battles', ownerId),
      (snap) => {
        setLoading(false);
        if (snap.exists()) {
          setBattle({ id: snap.id, ...snap.data() });
          setMissing(false);
        } else {
          setBattle(null);
          setMissing(true);
        }
      },
      (err) => {
        console.error('battle live sub error:', err);
        setLoading(false);
      }
    );
    const playersQ = query(
      collection(db, 'bonus_battles', ownerId, 'players'),
      orderBy('order', 'asc')
    );
    const unsubPlayers = onSnapshot(playersQ, (snap) =>
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubBattle();
      unsubPlayers();
    };
  }, [ownerId]);

  const derived = computeBattle(players, battle?.rakePct ?? 10);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono text-emerald-signal">
          <RadioTower size={14} className="motion-safe:animate-pulse" /> Bonus Battle · Live
        </div>
        {loading && <p className="text-white/50 font-mono text-sm">Connecting…</p>}
        {!loading && missing && (
          <p className="text-white/60 font-mono text-sm">No live battle right now.</p>
        )}
        {!loading && battle && (
          <BattleBoard battle={battle} players={players} derived={derived} interactive={false} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the route to App.js**

In `src/App.js`, after the `LiveHuntPage` lazy import (line ~60), add:

```js
const BattlePage = lazy(() => import('./pages/BattlePage'));
```

After the `/live/:shareId` route (line ~284), add:

```jsx
          <Route path="/battle/:ownerId" element={<BattlePage />} />
```

And add a gamba sub-route stub alongside the others (after `hunt-tracker`, line ~260):

```jsx
            <Route path="bonus-battle" element={null} />
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add src/pages/BattlePage.js src/App.js
git commit -m "feat: live bonus battle viewer page"
```

---

## Task 8: Manual verification + final commit

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --watchAll=false`
Expected: all tests pass (existing + new battleCalc tests).

- [ ] **Step 2: Dev smoke test**

Run: `npm start`, open `http://localhost:3000/gamba/bonus-battle`. Verify:
- "Start a Bonus Battle" → board appears.
- Add 3+ players (name + slot). They list on the left, stats update (Total ↑, Left ↑).
- Spin → only un-played players appear; a player locks → "Now Playing" shows them.
- Enter a payout + Save → player moves to Ran, pot + standings update, winner green.
- Set one payout to `0` → that player can be biggest loser (red), no Bust button needed.
- Change rake % → Winner-Takes-All recomputes.
- Resize browser narrow → columns stack Action → Payout → Players → Standings; Save is full-width.

- [ ] **Step 3: Live sync smoke test (requires login + deployed rules)**

While logged in as admin on `/gamba/bonus-battle`, open `/battle/<your-uid>` in a second window. Confirm edits propagate live. (If rules aren't deployed yet, this step is expected to fail on writes — see deploy note.)

- [ ] **Step 4: Final docs/commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: bonus battle verification cleanup" --allow-empty
```

---

## Post-implementation notes (surface to user)

1. **Deploy Firestore rules:** `firebase deploy --only firestore:rules --project goofer-website`. Live viewer writes fail until this runs.
2. **Viewer link:** the live page is `/battle/<owner-uid>`. Consider adding a "Copy live link" button later (reuse `CopyLinkButton`).
3. **Self-join pivot (future):** add `|| isSelf(playerId)` to the players-write rule + a "Join battle" button on `BattlePage`. No data migration needed.
