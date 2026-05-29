# Bonus Tracker Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "start a hunt" step + Twitch-account-backed saved hunts (active + history) to the bonus tracker, and restyle the export image to the site register.

**Architecture:** A `useHuntStore` hook abstracts persistence (Firestore for logged-in viewers via `onSnapshot` + debounced writes; localStorage for anon), exposing one interface. `HuntTracker` becomes a state switch: `idle` → `HuntStartScreen`, `active` → the existing panels (now reading from the hook). Completed hunts archive to a `hunts` subcollection and render in `HuntHistory`. Export logic moves to `src/utils/huntExport.js` with two modes (split, recap), restyled to match site tokens.

**Tech Stack:** React 19, firebase/firestore (client SDK), Tailwind, lucide-react, HTML canvas. No automated test harness exists in this repo — **verification is manual** (run `npm start`, interact, observe). Each task ends with explicit manual-verify steps and a commit.

**Testing note:** This codebase has zero test infrastructure (CLAUDE.md: "No tests currently exist"). Standing up Jest/RTL + canvas/Firestore mocks for this feature is out of scope and high-cost. We substitute disciplined manual verification for automated tests, keeping bite-sized steps and frequent commits.

**Prerequisite for the implementer:** The dev server (`npm start`) runs against **production** Firestore (the client SDK talks to the real `goofer-website` project; only `/api/*` serverless functions are stubbed locally). That means Firestore reads/writes work in dev — but Task 1's rules must be deployed before logged-in writes succeed. Use a real or test Twitch login to exercise the logged-in path.

---

## File Structure

- `firestore.rules` — **modify.** Add nested `active_hunt` + `hunts` matches under `users/{uid}`.
- `src/utils/huntCalc.js` — **new.** Shared pure helpers: `fmt`, `fmtX`, `makeId`, and hunt-derived stats (`computeStats`). Extracted so the hook, components, and export all share one source of truth.
- `src/hooks/useHuntStore.js` — **new.** Persistence abstraction (Firestore vs localStorage), single interface.
- `src/utils/huntExport.js` — **new.** Canvas export, `renderSplit` + `renderRecap`, restyled.
- `src/components/HuntStartScreen.js` — **new.** Idle-state form + login nudge + history mount.
- `src/components/HuntHistory.js` — **new.** Completed-hunt summary rows that expand.
- `src/components/HuntTracker.js` — **modify.** Slim to active-state panels + header; consume the hook; drop inline persistence and inline export.
- `src/pages/GambaPage.js` — no change (still mounts `HuntTracker`).

Build order: rules → calc helpers → export util → store hook → start screen → history → wire tracker.

---

## Task 1: Firestore rules for viewer hunts

**Files:**
- Modify: `firestore.rules:57-60`

- [ ] **Step 1: Extend the `users/{uid}` match block with nested subcollections**

Replace the existing block (currently lines 57-60):

```
    // Users — owner can read their own doc, staff can read all.
    // All writes are server-only via firebase-admin (which bypasses rules).
    match /users/{uid} {
      allow read: if isSelf(uid) || isStaff();
      allow write: if false;
    }
```

with:

```
    // Users — owner can read their own doc, staff can read all.
    // The user doc itself is server-only; viewer-owned hunt subcollections
    // below are client-writable by the owner (self-gated, like suggestions).
    match /users/{uid} {
      allow read: if isSelf(uid) || isStaff();
      allow write: if false;

      // Bonus tracker — single in-progress hunt.
      match /active_hunt/{docId} {
        allow read, write: if isSelf(uid) || isStaff();
      }
      // Bonus tracker — completed hunts (track record).
      match /hunts/{huntId} {
        allow read, write: if isSelf(uid) || isStaff();
      }
    }
```

- [ ] **Step 2: Deploy the rules**

Run (no `.firebaserc` in repo — pass project explicitly):

```bash
firebase deploy --only firestore:rules --project goofer-website
```

Expected: `✔  Deploy complete!` and a "cloud.firestore: released rules firestore.rules to cloud.firestore" line.

- [ ] **Step 3: Manual verify rules are live**

In the Firebase console → Firestore → Rules tab, confirm the `active_hunt` and `hunts` nested matches appear in the deployed ruleset. (Or trust the deploy output.) No data exists yet — that's expected.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "rules: allow owner client-writes to user hunt subcollections"
```

---

## Task 2: Shared calc helpers

**Files:**
- Create: `src/utils/huntCalc.js`

These are pure functions currently inlined in `HuntTracker.js` (`fmt`, `fmtX`, `makeId`) plus a new `computeStats` that derives the numbers the export recap and history rows need. Centralizing avoids three copies.

- [ ] **Step 1: Create the helpers file**

Create `src/utils/huntCalc.js`:

```js
export function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function fmt(val) {
  if (val == null || val === '') return '—';
  return `$${Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtX(val) {
  if (val == null || !isFinite(val)) return '—';
  return `${val.toFixed(2)}x`;
}

/**
 * Derive display stats from a hunt object.
 * hunt = { startBalance, finishBalance, bonuses:[{stake,win}], gamblers:[{inFor}] }
 */
export function computeStats(hunt) {
  const bonuses = hunt?.bonuses ?? [];
  const gamblers = hunt?.gamblers ?? [];
  const start =
    hunt?.startBalance === '' || hunt?.startBalance == null
      ? null
      : Number(hunt.startBalance);
  const finish =
    hunt?.finishBalance === '' || hunt?.finishBalance == null
      ? null
      : Number(hunt.finishBalance);

  const totalStakes = bonuses.reduce((s, b) => s + (Number(b.stake) || 0), 0);
  const totalWins = bonuses.reduce((s, b) => s + (Number(b.win) || 0), 0);
  const totalBuyIns = gamblers.reduce((s, g) => s + (Number(g.inFor) || 0), 0);

  const reqX = totalStakes > 0 && start != null ? start / totalStakes : null;
  const profit = start != null && finish != null ? finish - start : null;
  const wlMultiplier =
    start != null && start !== 0 && finish != null ? finish / start : null;

  const bestX = bonuses.reduce((best, b) => {
    const stake = Number(b.stake) || 0;
    const win = Number(b.win) || 0;
    if (stake <= 0 || win <= 0) return best;
    const x = win / stake;
    return x > best ? x : best;
  }, 0);

  return {
    start,
    finish,
    totalStakes,
    totalWins,
    totalBuyIns,
    reqX,
    profit,
    wlMultiplier,
    bestX: bestX > 0 ? bestX : null,
    bonusCount: bonuses.length,
  };
}
```

- [ ] **Step 2: Manual verify (sanity)**

Run `npm start`. The app should still compile with the new unused file present (no import errors). Open the gamba page → hunt tracker; it works exactly as before (this task adds nothing wired yet).

- [ ] **Step 3: Commit**

```bash
git add src/utils/huntCalc.js
git commit -m "feat: shared hunt calc helpers"
```

---

## Task 3: Restyled canvas export util

**Files:**
- Create: `src/utils/huntExport.js`

Two functions. `renderSplit(hunt)` reproduces today's equity-split image, restyled to site tokens. `renderRecap(hunt)` adds a hunt header + stat band above the split. Both build a canvas and trigger a PNG download.

Site register colors (hex equivalents of the Tailwind tokens used in the panels):
- background gradient: `#0b0f17` → `#141019` (zinc-broadcast-ish dark)
- emerald-signal: `#34d399`
- orange-admin: `#f59e0b`
- purple-bright: `#c084fc`
- white body: `#f4f4f5`, muted white: `rgba(244,244,245,0.55)`
- card border: `rgba(255,255,255,0.10)`
- mono font: `'ui-monospace, SFMono-Regular, Menlo, monospace'`
- sans font: `'ui-sans-serif, system-ui, sans-serif'`

- [ ] **Step 1: Create the export util**

Create `src/utils/huntExport.js`:

```js
import { fmt, fmtX, computeStats } from './huntCalc';

const COLORS = {
  bgTop: '#0b0f17',
  bgBottom: '#141019',
  border: 'rgba(255,255,255,0.10)',
  emerald: '#34d399',
  orange: '#f59e0b',
  purple: '#c084fc',
  white: '#f4f4f5',
  muted: 'rgba(244,244,245,0.55)',
  faint: 'rgba(244,244,245,0.30)',
  rowAlt: 'rgba(255,255,255,0.03)',
  line: 'rgba(255,255,255,0.10)',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';

function gamblerRows(hunt) {
  const gamblers = hunt?.gamblers ?? [];
  const totalBuyIns = gamblers.reduce((s, g) => s + (Number(g.inFor) || 0), 0);
  const finish =
    hunt?.finishBalance === '' || hunt?.finishBalance == null
      ? null
      : Number(hunt.finishBalance);
  return gamblers.map((g) => {
    const inFor = Number(g.inFor) || 0;
    const pct = totalBuyIns > 0 ? (inFor / totalBuyIns) * 100 : 0;
    const payout = finish != null && totalBuyIns > 0 ? (pct / 100) * finish : null;
    return { name: g.name, inFor, pct, payout };
  });
}

function triggerDownload(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function dateStr() {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Draws the eyebrow + title + date header. Returns the y after the header.
function drawHeader(ctx, W, padding, eyebrow, title, accent) {
  let y = padding + 12;
  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillText(eyebrow.toUpperCase(), padding, y);

  y += 30;
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 34px ${SANS}`;
  ctx.fillText(title, padding, y);

  y += 24;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `13px ${SANS}`;
  ctx.fillText(dateStr(), padding, y);
  return y;
}

// Draws the split table starting at startY. Returns the y after the total row.
function drawSplitTable(ctx, W, padding, startY, hunt) {
  const rows = gamblerRows(hunt);
  const totalBuyIns = rows.reduce((s, r) => s + r.inFor, 0);
  const finish =
    hunt?.finishBalance === '' || hunt?.finishBalance == null
      ? null
      : Number(hunt.finishBalance);
  const rowH = 48;
  const cols = {
    name: padding,
    inFor: W * 0.45,
    pct: W * 0.65,
    payout: W - padding,
  };

  // Column headers
  let y = startY;
  ctx.fillStyle = COLORS.faint;
  ctx.font = `bold 11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('NAME', cols.name, y);
  ctx.textAlign = 'right';
  ctx.fillText('IN FOR', cols.inFor, y);
  ctx.fillText('%', cols.pct, y);
  ctx.fillText('PAYOUT', cols.payout, y);
  ctx.textAlign = 'left';

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y + 12);
  ctx.lineTo(W - padding, y + 12);
  ctx.stroke();

  // Rows
  y += 40;
  rows.forEach((g, i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = COLORS.rowAlt;
      ctx.fillRect(padding - 8, rowY - rowH + 12, W - padding * 2 + 16, rowH);
    }
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold 16px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(g.name, cols.name, rowY);

    ctx.fillStyle = COLORS.muted;
    ctx.font = `15px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(fmt(g.inFor), cols.inFor, rowY);

    ctx.fillStyle = COLORS.purple;
    ctx.font = `bold 15px ${SANS}`;
    ctx.fillText(`${g.pct.toFixed(2)}%`, cols.pct, rowY);

    if (g.payout != null) {
      ctx.fillStyle = g.payout >= g.inFor ? COLORS.emerald : '#f87171';
      ctx.font = `bold 15px ${SANS}`;
      ctx.fillText(fmt(g.payout), cols.payout, rowY);
    } else {
      ctx.fillStyle = COLORS.faint;
      ctx.font = `15px ${SANS}`;
      ctx.fillText('—', cols.payout, rowY);
    }
  });

  // Total row
  const totalY = y + rows.length * rowH + 12;
  ctx.strokeStyle = COLORS.line;
  ctx.beginPath();
  ctx.moveTo(padding, totalY - 16);
  ctx.lineTo(W - padding, totalY - 16);
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = `bold 13px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', cols.name, totalY + 16);

  ctx.fillStyle = COLORS.white;
  ctx.font = `bold 16px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText(fmt(totalBuyIns), cols.inFor, totalY + 16);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('100.00%', cols.pct, totalY + 16);
  if (finish != null) {
    ctx.fillStyle = COLORS.orange;
    ctx.fillText(fmt(finish), cols.payout, totalY + 16);
  } else {
    ctx.fillStyle = COLORS.faint;
    ctx.fillText('—', cols.payout, totalY + 16);
  }
  return totalY + 16;
}

function drawFooter(ctx, W, H, padding) {
  ctx.fillStyle = COLORS.faint;
  ctx.font = `11px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('goofer.tv · Bonus Hunt Tracker', W / 2, H - padding);
}

function makeCanvas(W, H) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  return { canvas, ctx };
}

/** Squad equity split — available anytime. */
export function renderSplit(hunt) {
  const rows = hunt?.gamblers ?? [];
  const W = 720;
  const padding = 40;
  const headerH = 110;
  const tableTop = padding + headerH;
  const H = tableTop + 40 + 48 * rows.length + 56 + 50 + padding;

  const { canvas, ctx } = makeCanvas(W, H);
  drawHeader(ctx, W, padding, 'Squad split', hunt?.name || 'Bonus Hunt Equity', COLORS.purple);
  drawSplitTable(ctx, W, padding, tableTop, hunt);
  drawFooter(ctx, W, H, padding);
  triggerDownload(canvas, `hunt-split-${new Date().toISOString().slice(0, 10)}.png`);
}

/** Full recap — completed hunts (adds stat band above the split). */
export function renderRecap(hunt) {
  const s = computeStats(hunt);
  const rows = hunt?.gamblers ?? [];
  const W = 720;
  const padding = 40;
  const headerH = 110;
  const statBandH = 84;
  const tableTop = padding + headerH + statBandH;
  const H = tableTop + 40 + 48 * rows.length + 56 + 50 + padding;

  const { canvas, ctx } = makeCanvas(W, H);
  drawHeader(ctx, W, padding, 'Hunt recap', hunt?.name || 'Bonus Hunt', COLORS.emerald);

  // Stat band
  const bandY = padding + headerH;
  const stats = [
    ['START', fmt(s.start)],
    ['FINISH', fmt(s.finish)],
    ['PROFIT', s.profit == null ? '—' : (s.profit >= 0 ? '+' : '') + fmt(s.profit)],
    ['REQ X', s.reqX != null ? `${s.reqX.toFixed(1)}x` : '—'],
    ['BEST X', s.bestX != null ? fmtX(s.bestX) : '—'],
  ];
  const cellW = (W - padding * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = padding + i * cellW;
    ctx.fillStyle = COLORS.faint;
    ctx.font = `bold 10px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x, bandY + 16);
    ctx.fillStyle =
      label === 'PROFIT' && s.profit != null
        ? s.profit >= 0
          ? COLORS.emerald
          : '#f87171'
        : COLORS.white;
    ctx.font = `bold 18px ${SANS}`;
    ctx.fillText(value, x, bandY + 42);
  });
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, bandY + statBandH - 14);
  ctx.lineTo(W - padding, bandY + statBandH - 14);
  ctx.stroke();

  drawSplitTable(ctx, W, padding, tableTop, hunt);
  drawFooter(ctx, W, H, padding);
  triggerDownload(canvas, `hunt-recap-${new Date().toISOString().slice(0, 10)}.png`);
}
```

- [ ] **Step 2: Manual verify (temporary harness)**

Temporarily, in `HuntTracker.js`, change the existing Export button's `onClick` from `downloadImage` to call `renderSplit(...)` with the current state — OR simpler: open the browser devtools console on the gamba page and run:

```js
// paste a quick test object
window.__t = { name:'Test Hunt', startBalance:1000, finishBalance:1500,
  bonuses:[{stake:5,win:120},{stake:10,win:8}],
  gamblers:[{name:'Goofer',inFor:600},{name:'Chat',inFor:400}] };
```

Then in the console: `import('/static/js/...')` is awkward — instead verify in Task 7 when it's wired. For now just confirm the file compiles (no red errors in the terminal running `npm start`).

- [ ] **Step 3: Commit**

```bash
git add src/utils/huntExport.js
git commit -m "feat: restyled hunt export (split + recap modes)"
```

---

## Task 4: useHuntStore hook

**Files:**
- Create: `src/hooks/useHuntStore.js`

Single interface over two backends. Logged-in: Firestore `active_hunt/current` doc + `hunts` subcollection via `onSnapshot`, debounced writes. Anon: localStorage. Chosen by `useTwitchAuth`.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useHuntStore.js`:

```js
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { makeId } from '../utils/huntCalc';

const LS_KEY = 'hunt_tracker_active';

const EMPTY_HUNT = (name, startBalance) => ({
  name: name.trim(),
  casino: null,
  startBalance: startBalance === '' || startBalance == null ? '' : Number(startBalance),
  finishBalance: '',
  bonuses: [],
  gamblers: [],
  bannedSlots: '',
  status: 'active',
  startedAt: Date.now(),
  completedAt: null,
});

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}
function saveLocal(hunt) {
  if (hunt) localStorage.setItem(LS_KEY, JSON.stringify(hunt));
  else localStorage.removeItem(LS_KEY);
}

export function useHuntStore() {
  const { twitchUser, firebaseUser } = useTwitchAuth();
  const uid = firebaseUser?.uid || twitchUser?.twitchId || null;
  const isLoggedIn = !!uid;

  const [activeHunt, setActiveHunt] = useState(null);
  const [history, setHistory] = useState([]);
  const [localHuntPending, setLocalHuntPending] = useState(null);
  const debounceRef = useRef(null);
  const [error, setError] = useState(null);

  // --- subscribe ---
  useEffect(() => {
    if (!isLoggedIn) {
      setActiveHunt(loadLocal());
      setHistory([]);
      return;
    }
    // Logged in: detect a local hunt to offer claiming.
    setLocalHuntPending(loadLocal());

    const activeRef = doc(db, 'users', uid, 'active_hunt', 'current');
    const unsubActive = onSnapshot(
      activeRef,
      (snap) => setActiveHunt(snap.exists() ? { id: 'current', ...snap.data() } : null),
      (err) => {
        console.error('active_hunt sub error:', err);
        setError('Could not load your hunt.');
      }
    );

    const histQ = query(
      collection(db, 'users', uid, 'hunts'),
      orderBy('completedAt', 'desc')
    );
    const unsubHist = onSnapshot(
      histQ,
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('hunts sub error:', err)
    );

    return () => {
      unsubActive();
      unsubHist();
    };
  }, [isLoggedIn, uid]);

  // --- writers ---
  const writeActive = useCallback(
    (hunt) => {
      if (!isLoggedIn) {
        saveLocal(hunt);
        setActiveHunt(hunt);
        return;
      }
      setActiveHunt(hunt); // optimistic
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, 'users', uid, 'active_hunt', 'current'), hunt);
          setError(null);
        } catch (e) {
          console.error('active write failed:', e);
          setError('Save failed — your latest edit is unsaved.');
        }
      }, 500);
    },
    [isLoggedIn, uid]
  );

  const startHunt = useCallback(
    ({ name, startBalance }) => {
      if (!name || !name.trim()) return;
      writeActive(EMPTY_HUNT(name, startBalance));
    },
    [writeActive]
  );

  const updateHunt = useCallback(
    (patch) => {
      if (!activeHunt) return;
      writeActive({ ...activeHunt, ...patch });
    },
    [activeHunt, writeActive]
  );

  const completeHunt = useCallback(async () => {
    if (!activeHunt) return;
    const completed = {
      ...activeHunt,
      status: 'completed',
      completedAt: isLoggedIn ? serverTimestamp() : Date.now(),
    };
    delete completed.id;
    if (!isLoggedIn) {
      // Anon: no history kept; just clear active.
      saveLocal(null);
      setActiveHunt(null);
      return completed;
    }
    const huntId = makeId();
    try {
      await setDoc(doc(db, 'users', uid, 'hunts', huntId), completed);
      await deleteDoc(doc(db, 'users', uid, 'active_hunt', 'current'));
      setActiveHunt(null);
    } catch (e) {
      console.error('complete failed:', e);
      setError('Could not complete the hunt. Try again.');
    }
    return completed;
  }, [activeHunt, isLoggedIn, uid]);

  const claimLocalHunt = useCallback(async () => {
    const local = loadLocal();
    if (!local || !isLoggedIn) return;
    try {
      await setDoc(doc(db, 'users', uid, 'active_hunt', 'current'), local);
      saveLocal(null);
      setLocalHuntPending(null);
    } catch (e) {
      console.error('claim failed:', e);
      setError('Could not save the local hunt to your account.');
    }
  }, [isLoggedIn, uid]);

  const discardLocalHunt = useCallback(() => {
    saveLocal(null);
    setLocalHuntPending(null);
  }, []);

  return {
    status: activeHunt ? 'active' : 'idle',
    activeHunt,
    history,
    isLoggedIn,
    localHuntPending,
    error,
    startHunt,
    updateHunt,
    completeHunt,
    claimLocalHunt,
    discardLocalHunt,
  };
}
```

- [ ] **Step 2: Manual verify compile**

`npm start` runs clean (no import/lint errors in terminal). Nothing is wired to UI yet.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHuntStore.js
git commit -m "feat: useHuntStore persistence hook (firestore + local)"
```

---

## Task 5: HuntStartScreen component

**Files:**
- Create: `src/components/HuntStartScreen.js`

Idle-state UI: name + start-balance inputs, Start button, login nudge for anon, claim prompt when a local hunt exists at login, and the history list below for logged-in users.

- [ ] **Step 1: Create the component**

Create `src/components/HuntStartScreen.js`:

```js
import { useState } from 'react';
import { Play, LogIn, Save, Trash2 } from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import HuntHistory from './HuntHistory';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

export default function HuntStartScreen({
  isLoggedIn,
  history,
  localHuntPending,
  onStart,
  onClaimLocal,
  onDiscardLocal,
  onReexport,
}) {
  const { loginWithTwitch } = useTwitchAuth();
  const [name, setName] = useState('');
  const [startBalance, setStartBalance] = useState('');

  const canStart = name.trim().length > 0;

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>HUNT TRACKER</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">NEW HUNT</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        {/* Login nudge (anon) */}
        {!isLoggedIn && (
          <button
            type="button"
            onClick={loginWithTwitch}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-purple-gamba/40 bg-purple-gamba/5 text-left hover:bg-purple-gamba/10 transition-colors duration-150"
          >
            <span className="flex items-center gap-2.5">
              <LogIn size={15} className="text-purple-bright" aria-hidden="true" />
              <span className="text-sm font-bold text-white-body">
                Connect Twitch to save your hunts
                <span className="block text-[11px] font-normal text-white/50 mt-0.5">
                  Keep a track record across devices + recap exports.
                </span>
              </span>
            </span>
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono">
              Login
            </span>
          </button>
        )}

        {/* Claim prompt */}
        {isLoggedIn && localHuntPending && (
          <div className="px-4 py-3 border border-emerald-signal/40 bg-emerald-signal/5">
            <p className="text-sm font-bold text-white-body mb-2">
              Save this in-progress hunt to your account?
              <span className="block text-[11px] font-normal text-white/50 mt-0.5">
                “{localHuntPending.name || 'Untitled'}” — found on this device.
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClaimLocal}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <Save size={12} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">Save it</span>
              </button>
              <button
                type="button"
                onClick={onDiscardLocal}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/65 hover:text-red-destructive hover:border-red-destructive/50 transition-colors duration-150"
              >
                <Trash2 size={12} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">Discard</span>
              </button>
            </div>
          </div>
        )}

        {/* Start form */}
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              <span className="text-emerald-signal tabular-nums">01</span> Hunt name <span className="text-emerald-signal">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canStart && onStart({ name, startBalance })}
              placeholder="Friday Night Bonanza"
              className={inputCls}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              <span className="text-emerald-signal tabular-nums">02</span> Start balance <span className="text-white/30 normal-case font-normal">· optional, editable later</span>
            </span>
            <input
              type="number"
              value={startBalance}
              onChange={(e) => setStartBalance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canStart && onStart({ name, startBalance })}
              placeholder="0.00"
              className={`${inputCls} tabular-nums`}
            />
          </label>
          <button
            type="button"
            onClick={() => onStart({ name, startBalance })}
            disabled={!canStart}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
          >
            <Play size={14} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">Start hunt</span>
          </button>
        </div>

        {/* History (logged in) */}
        {isLoggedIn && (
          <div className="pt-2">
            <HuntHistory history={history} onReexport={onReexport} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify compile**

`npm start` clean. (`HuntHistory` is created next; if the implementer runs before Task 6 the import errors — create Task 6's file first if executing strictly in isolation, or accept the transient error until Task 6. Recommended: do Task 6 before verifying Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/components/HuntStartScreen.js
git commit -m "feat: hunt start screen (form + login nudge + claim)"
```

---

## Task 6: HuntHistory component

**Files:**
- Create: `src/components/HuntHistory.js`

Summary rows that expand to the full bonus list + squad split, with a recap re-export per row.

- [ ] **Step 1: Create the component**

Create `src/components/HuntHistory.js`:

```js
import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, History } from 'lucide-react';
import { fmt, fmtX, computeStats } from '../utils/huntCalc';

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return new Date(ts);
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function HistoryRow({ hunt, onReexport }) {
  const [open, setOpen] = useState(false);
  const s = computeStats(hunt);
  const d = tsToDate(hunt.completedAt);
  const dateLabel = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    : '—';

  const totalBuyIns = s.totalBuyIns;
  const finish = s.finish;

  return (
    <div className="border-t border-white/8 first:border-t-0">
      <div className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-white/40 hover:text-white-body"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 text-left">
          <p className="font-bold text-white-body text-sm truncate">{hunt.name || 'Untitled'}</p>
          <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5 tabular-nums">
            {dateLabel} · {s.bonusCount} bonuses · best {s.bestX != null ? fmtX(s.bestX) : '—'}
          </p>
        </button>
        <span
          className={`text-sm font-bold tabular-nums ${
            s.profit == null
              ? 'text-white/40'
              : s.profit >= 0
                ? 'text-emerald-signal'
                : 'text-red-destructive'
          }`}
        >
          {s.profit == null ? '—' : (s.profit >= 0 ? '+' : '') + fmt(s.profit)}
        </span>
        <button
          type="button"
          onClick={() => onReexport(hunt)}
          className="p-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150"
          aria-label="Re-export recap"
          title="Export recap"
        >
          <Download size={12} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Bonuses */}
          {(hunt.bonuses?.length ?? 0) > 0 ? (
            <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                    <th className="text-left px-3 py-2 font-bold">Slot</th>
                    <th className="text-right px-3 py-2 font-bold">Stake</th>
                    <th className="text-right px-3 py-2 font-bold">Win</th>
                    <th className="text-right px-3 py-2 font-bold">X</th>
                  </tr>
                </thead>
                <tbody>
                  {hunt.bonuses.map((b) => {
                    const x = b.stake > 0 ? b.win / b.stake : null;
                    return (
                      <tr key={b.id} className="border-b border-white/5">
                        <td className="px-3 py-2 font-bold text-white-body truncate max-w-[140px]">{b.slot}</td>
                        <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(b.stake)}</td>
                        <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(b.win)}</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          {x != null ? fmtX(x) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-white/40 py-3 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
              No bonuses logged.
            </p>
          )}

          {/* Squad split */}
          {(hunt.gamblers?.length ?? 0) > 0 && (
            <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                    <th className="text-left px-3 py-2 font-bold">Name</th>
                    <th className="text-right px-3 py-2 font-bold">In for</th>
                    <th className="text-right px-3 py-2 font-bold">%</th>
                    <th className="text-right px-3 py-2 font-bold">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {hunt.gamblers.map((g) => {
                    const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
                    const payout = finish != null && totalBuyIns > 0 ? (pct / 100) * finish : null;
                    return (
                      <tr key={g.id} className="border-b border-white/5">
                        <td className="px-3 py-2 font-bold text-white-body">{g.name}</td>
                        <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(g.inFor)}</td>
                        <td className="px-3 py-2 text-right text-purple-bright font-bold tabular-nums">{pct.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          {payout != null ? fmt(payout) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HuntHistory({ history, onReexport }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono">
        <History size={12} className="text-white/45" aria-hidden="true" />
        <span>Past hunts</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(history.length).padStart(2, '0')}
        </span>
      </div>
      {history.length === 0 ? (
        <p className="text-center text-white/50 py-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
          No completed hunts yet.
        </p>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30">
          {history.map((h) => (
            <HistoryRow key={h.id} hunt={h} onReexport={onReexport} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verify compile**

`npm start` clean. Task 5's import of `HuntHistory` now resolves.

- [ ] **Step 3: Commit**

```bash
git add src/components/HuntHistory.js
git commit -m "feat: hunt history list with expand + recap re-export"
```

---

## Task 7: Wire HuntTracker to the hook + state switch + restyled export

**Files:**
- Modify: `src/components/HuntTracker.js` (full rewrite of the container; panel JSX preserved but fed from the hook)

This is the integration task. `HuntTracker` becomes: read `useHuntStore`; if `status === 'idle'` render `HuntStartScreen`; else render the active panels (existing layout) reading from `activeHunt` and writing through `updateHunt`. Replace inline `downloadImage` with `renderSplit`/`renderRecap`. Add a header with the hunt name + Complete button.

- [ ] **Step 1: Rewrite HuntTracker.js**

Replace the entire contents of `src/components/HuntTracker.js` with:

```js
import { useState, useMemo } from 'react';
import {
  Plus,
  X,
  Users,
  DollarSign,
  TrendingDown,
  Download,
  CheckCircle2,
} from 'lucide-react';
import SlotAutocomplete from './SlotAutocomplete';
import HuntStartScreen from './HuntStartScreen';
import { useHuntStore } from '../hooks/useHuntStore';
import { fmt, fmtX, makeId, computeStats } from '../utils/huntCalc';
import { renderSplit, renderRecap } from '../utils/huntExport';

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

function PanelLabel({ code, icon: Icon, label, accent = 'emerald' }) {
  const color =
    accent === 'orange'
      ? 'text-orange-admin'
      : accent === 'purple'
        ? 'text-purple-bright'
        : 'text-emerald-signal';
  return (
    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono">
      <span className={`${color} tabular-nums`}>{code}</span>
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={12} aria-hidden="true" className={color} />}
        <span>{label}</span>
      </span>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="px-3 py-2.5 bg-zinc-broadcast/50 border border-white/8">
      <p className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 mb-1 font-mono">
        {label}
      </p>
      <p className="font-bold text-white-body text-base tabular-nums">{value}</p>
    </div>
  );
}

export default function HuntTracker() {
  const store = useHuntStore();
  const {
    status,
    activeHunt,
    history,
    isLoggedIn,
    localHuntPending,
    error,
    startHunt,
    updateHunt,
    completeHunt,
    claimLocalHunt,
    discardLocalHunt,
  } = store;

  // transient input state (not persisted until added)
  const [slotInput, setSlotInput] = useState('');
  const [stakeInput, setStakeInput] = useState('');
  const [gamblerNameInput, setGamblerNameInput] = useState('');
  const [gamblerInInput, setGamblerInInput] = useState('');
  const [editingGamblerId, setEditingGamblerId] = useState(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  // ---------- IDLE ----------
  if (status === 'idle') {
    return (
      <HuntStartScreen
        isLoggedIn={isLoggedIn}
        history={history}
        localHuntPending={localHuntPending}
        onStart={startHunt}
        onClaimLocal={claimLocalHunt}
        onDiscardLocal={discardLocalHunt}
        onReexport={renderRecap}
      />
    );
  }

  // ---------- ACTIVE ----------
  const bonuses = activeHunt.bonuses ?? [];
  const gamblers = activeHunt.gamblers ?? [];
  const startBalance = activeHunt.startBalance ?? '';
  const finishBalance = activeHunt.finishBalance ?? '';
  const bannedSlots = activeHunt.bannedSlots ?? '';

  function addBonus() {
    if (!slotInput.trim()) return;
    const next = [
      ...bonuses,
      { id: makeId(), slot: slotInput.trim(), stake: Number(stakeInput) || 0, win: 0 },
    ];
    updateHunt({ bonuses: next });
    setSlotInput('');
    setStakeInput('');
  }
  function removeBonus(id) {
    updateHunt({ bonuses: bonuses.filter((b) => b.id !== id) });
  }
  function updateBonusWin(id, val) {
    updateHunt({
      bonuses: bonuses.map((b) => (b.id === id ? { ...b, win: Number(val) || 0 } : b)),
    });
  }
  function addGambler() {
    if (!gamblerNameInput.trim() || !gamblerInInput || Number(gamblerInInput) <= 0) return;
    if (gamblers.length >= 10) return;
    updateHunt({
      gamblers: [
        ...gamblers,
        { id: makeId(), name: gamblerNameInput.trim(), inFor: Number(gamblerInInput) },
      ],
    });
    setGamblerNameInput('');
    setGamblerInInput('');
  }
  function removeGambler(id) {
    updateHunt({ gamblers: gamblers.filter((g) => g.id !== id) });
  }
  function updateGamblerInFor(id, value) {
    const num = value === '' ? 0 : Number(value);
    if (Number.isNaN(num) || num < 0) return;
    updateHunt({ gamblers: gamblers.map((g) => (g.id === id ? { ...g, inFor: num } : g)) });
  }

  async function handleComplete() {
    const completed = await completeHunt();
    if (completed) renderRecap(completed);
    setConfirmingComplete(false);
  }

  const stats = computeStats(activeHunt);
  const totalStakes = stats.totalStakes;
  const totalWins = stats.totalWins;
  const reqX = stats.reqX;
  const profit = stats.profit;
  const wlMultiplier = stats.wlMultiplier;
  const totalBuyIns = stats.totalBuyIns;

  const gamblerRows = useMemo(
    () =>
      gamblers.map((g) => {
        const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
        const payout =
          finishBalance !== '' && totalBuyIns > 0 ? (pct / 100) * Number(finishBalance) : null;
        return { ...g, pct, payout };
      }),
    [gamblers, totalBuyIns, finishBalance]
  );

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Hunt header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/8">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-0.5">
            ▸ Active hunt
          </p>
          <p className="font-black text-white-body text-lg leading-tight truncate">
            {activeHunt.name}
          </p>
        </div>
        <div className="ml-auto flex gap-2" data-html2canvas-ignore="true">
          <button
            type="button"
            onClick={() => renderSplit(activeHunt)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150"
          >
            <Download size={12} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg">EXPORT SPLIT</span>
          </button>
          {!confirmingComplete ? (
            <button
              type="button"
              onClick={() => setConfirmingComplete(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-eyebrow-lg">COMPLETE</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg">CONFIRM + EXPORT</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingComplete(false)}
                className="px-3 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg">CANCEL</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="text-white/65">BONUSES</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(bonuses.length).padStart(3, '0')}
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">SQUAD</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(gamblers.length).padStart(2, '0')}
        </span>
        {!isLoggedIn && (
          <>
            <span className="text-white/15">·</span>
            <span className="text-white/40">LOCAL ONLY — LOGIN TO SAVE</span>
          </>
        )}
        {error && (
          <>
            <span className="text-white/15">·</span>
            <span className="text-red-destructive normal-case tracking-normal">{error}</span>
          </>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-5">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT — Bonus list */}
          <div className="space-y-4">
            <PanelLabel code="01" label="Bonus list" />
            <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
              <SlotAutocomplete
                value={slotInput}
                onChange={setSlotInput}
                placeholder="Slot name"
                className={`w-full ${inputCls}`}
                onKeyDown={(e) => e.key === 'Enter' && addBonus()}
              />
              <input
                type="number"
                placeholder="Stake ($)"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                className={`w-full ${inputCls}`}
              />
              <button
                type="button"
                onClick={addBonus}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <Plus size={14} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">Log bonus</span>
              </button>
            </div>

            {bonuses.length === 0 ? (
              <p className="text-center text-white/60 py-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
                No bonuses logged.
              </p>
            ) : (
              <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                      <th className="text-left px-3 py-2 font-bold">Slot</th>
                      <th className="text-right px-3 py-2 font-bold">Stake</th>
                      <th className="text-right px-3 py-2 font-bold">Win</th>
                      <th className="text-right px-3 py-2 font-bold">X</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b) => {
                      const x = b.stake > 0 ? b.win / b.stake : null;
                      return (
                        <tr key={b.id} className="border-b border-white/5 hover:bg-zinc-broadcast/40 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-white-body truncate max-w-[140px]">{b.slot}</td>
                          <td className="px-3 py-2.5 text-right text-white/70 tabular-nums">{fmt(b.stake)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              value={b.win || ''}
                              onChange={(e) => updateBonusWin(b.id, e.target.value)}
                              placeholder="—"
                              className="w-24 bg-zinc-broadcast/60 border border-white/10 px-2 py-1 text-sm text-right focus:border-emerald-signal/70 focus:outline-none placeholder:text-white/20 tabular-nums"
                            />
                          </td>
                          <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                            x != null && x >= (reqX ?? 0) ? 'text-emerald-signal' : 'text-white/70'
                          }`}>
                            {x != null ? fmtX(x) : '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => removeBonus(b.id)}
                              className="p-1 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/15 transition-colors"
                              aria-label="Remove bonus"
                            >
                              <X size={11} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-zinc-broadcast/50 text-[10px] uppercase tracking-eyebrow-md font-mono">
                      <td className="px-3 py-2 font-bold text-white/65">Totals</td>
                      <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">{fmt(totalStakes)}</td>
                      <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">{fmt(totalWins)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT — Stats / Split / Banned */}
          <div className="space-y-5">
            <div className="space-y-3">
              <PanelLabel code="02" icon={DollarSign} label="Financials" />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">Start balance</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={startBalance}
                    onChange={(e) => updateHunt({ startBalance: e.target.value })}
                    className={`w-full ${inputCls} tabular-nums`}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">Finish balance</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={finishBalance}
                    onChange={(e) => updateHunt({ finishBalance: e.target.value })}
                    className={`w-full ${inputCls} tabular-nums`}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <StatCell
                  label="Profit"
                  value={
                    profit == null ? '—' : (
                      <span className={profit >= 0 ? 'text-emerald-signal' : 'text-red-destructive'}>
                        {profit >= 0 ? '+' : ''}{fmt(profit)}
                      </span>
                    )
                  }
                />
                <StatCell label="Req X" value={reqX != null ? `${reqX.toFixed(1)}x` : '—'} />
                <StatCell
                  label="W/L Multiplier"
                  value={wlMultiplier != null ? fmtX(Math.round(wlMultiplier * 100) / 100) : '—'}
                />
                <StatCell label="Total wins" value={fmt(totalWins)} />
              </div>
            </div>

            <div className="space-y-3">
              <PanelLabel code="03" icon={Users} label="Squad split" accent="purple" />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={gamblerNameInput}
                  onChange={(e) => setGamblerNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGambler()}
                  className={`flex-1 ${inputCls}`}
                />
                <input
                  type="number"
                  placeholder="In for ($)"
                  value={gamblerInInput}
                  onChange={(e) => setGamblerInInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGambler()}
                  className={`w-28 ${inputCls} tabular-nums`}
                />
                <button
                  type="button"
                  onClick={addGambler}
                  disabled={gamblers.length >= 10}
                  className="px-3 py-2 border border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/15 transition-colors duration-150 disabled:opacity-40"
                  aria-label="Add gambler"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              {gamblers.length === 0 ? (
                <p className="text-center text-white/60 py-4 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  No squad added.
                </p>
              ) : (
                <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                        <th className="text-left px-3 py-2 font-bold">Name</th>
                        <th className="text-right px-3 py-2 font-bold">In for</th>
                        <th className="text-right px-3 py-2 font-bold">%</th>
                        <th className="text-right px-3 py-2 font-bold">Payout</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {gamblerRows.map((g) => (
                        <tr key={g.id} className="border-b border-white/5 hover:bg-zinc-broadcast/40 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-white-body">{g.name}</td>
                          <td className="px-3 py-2.5 text-right text-white/70 tabular-nums">
                            {editingGamblerId === g.id ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={g.inFor}
                                onChange={(e) => updateGamblerInFor(g.id, e.target.value)}
                                onBlur={() => setEditingGamblerId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') setEditingGamblerId(null);
                                }}
                                className="w-24 bg-zinc-broadcast/80 border border-purple-gamba/50 px-2 py-1 text-right text-white-body focus:outline-none tabular-nums"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingGamblerId(g.id)}
                                title="Click to edit"
                                className="px-2 py-1 text-right text-white/70 hover:bg-zinc-broadcast/60 hover:text-white-body transition-colors cursor-pointer tabular-nums"
                              >
                                {fmt(g.inFor)}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-purple-bright font-bold tabular-nums">
                            {g.pct.toFixed(2)}%
                          </td>
                          <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                            g.payout != null
                              ? g.payout >= g.inFor ? 'text-emerald-signal' : 'text-red-destructive'
                              : 'text-white/60'
                          }`}>
                            {g.payout != null ? fmt(g.payout) : '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => removeGambler(g.id)}
                              className="p-1 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/15 transition-colors"
                              aria-label="Remove gambler"
                            >
                              <X size={11} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-zinc-broadcast/50 text-[10px] uppercase tracking-eyebrow-md font-mono">
                        <td className="px-3 py-2 font-bold text-white/65">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">{fmt(totalBuyIns)}</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">100.00%</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          {finishBalance !== '' ? fmt(Number(finishBalance)) : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <PanelLabel code="04" icon={TrendingDown} label="Soft banned" accent="orange" />
              <textarea
                placeholder="Slots to avoid this hunt — comma or newline separated."
                value={bannedSlots}
                onChange={(e) => updateHunt({ bannedSlots: e.target.value })}
                rows={3}
                className={`w-full ${inputCls} resize-none`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify — anon flow**

`npm start`, go to the gamba page → Hunt Tracker tool, **not logged in**:
1. Idle screen shows with the "Connect Twitch to save your hunts" nudge.
2. Try to start with empty name → button disabled. Type a name → enabled.
3. Start a hunt → panels appear with the name in the header and "LOCAL ONLY — LOGIN TO SAVE" in the status bar.
4. Add a bonus, add a gambler, fill start + finish balance → stats compute.
5. Reload the page → the active hunt persists (from localStorage).
6. Click EXPORT SPLIT → a restyled PNG downloads (dark bg, emerald/purple accents, mono labels).
7. Click COMPLETE → CONFIRM + EXPORT → recap PNG downloads (with stat band) and the tool returns to the idle screen (local active cleared).

- [ ] **Step 3: Manual verify — logged-in flow**

Log in with Twitch (requires `firebase deploy` from Task 1 done):
1. If a local hunt exists, the claim prompt appears → "Save it" writes it to the account and clears local.
2. Start a hunt → no "LOCAL ONLY" label; edits persist to Firestore (check Firebase console → `users/{twitchId}/active_hunt/current`).
3. Reload → active hunt restored from Firestore.
4. Complete → hunt moves to `users/{twitchId}/hunts/{id}`, recap exports, idle screen shows the hunt under "Past hunts".
5. Expand a past hunt → bonus list + squad split render. Re-export → recap PNG downloads.
6. Open in a second browser logged in as the same account → history + active hunt appear (cross-device).

- [ ] **Step 4: Commit**

```bash
git add src/components/HuntTracker.js
git commit -m "feat: hunt tracker start/active states + account persistence + restyled export"
```

---

## Task 8: Cleanup pass

**Files:**
- Review: `src/components/HuntTracker.js`

- [ ] **Step 1: Remove dead imports / verify no leftover localStorage key collision**

Confirm `HuntTracker.js` no longer imports `RefreshCcw` (the old reset button is gone — Complete replaces it) or references the old `LS_KEY = 'hunt_tracker'`. The new local key is `hunt_tracker_active` (in the hook), so any old `hunt_tracker` localStorage value from before is simply ignored (acceptable; old in-progress local hunts won't migrate — note this is fine since the feature is new). Grep to confirm:

Run:
```bash
grep -rn "hunt_tracker'" src/ || echo "no old key refs"
grep -rn "RefreshCcw" src/components/HuntTracker.js || echo "no RefreshCcw"
```
Expected: "no old key refs" and "no RefreshCcw".

- [ ] **Step 2: Lint check via build**

Run:
```bash
npm run build
```
Expected: build completes with no ESLint errors (warnings about existing code are acceptable; no new errors from the new files).

- [ ] **Step 3: Commit (if any cleanup changes were made)**

```bash
git add -A
git commit -m "chore: hunt tracker cleanup"
```

(If Step 1 found nothing to change and build passed, skip the commit.)

---

## Self-Review Notes

**Spec coverage check:**
- Three states (idle/active) → Tasks 5, 7 ✓
- Client-write subcollections + rules → Task 1 ✓
- One active + history list → Task 4 (`active_hunt/current` + `hunts`) ✓
- Hybrid anon + login nudge + claim → Tasks 4, 5, 7 ✓
- Start form (name required, start balance editable later) → Tasks 5, 7 ✓
- Explicit Complete button → Task 7 ✓
- History summary + expand + re-export → Task 6 ✓
- Export two modes restyled → Tasks 3, 7 ✓
- `useHuntStore` isolation → Task 4 ✓
- Edge cases (empty name, zero gamblers, logout mid-hunt, write failure) → handled in Tasks 4 (error state), 5 (disabled start), 7 (status label) ✓

**Type consistency:** `computeStats` shape used identically in huntExport.js, HuntHistory.js, HuntTracker.js. Hunt doc shape (`name`, `startBalance`, `finishBalance`, `bonuses`, `gamblers`, `bannedSlots`, `status`, `startedAt`, `completedAt`) consistent across hook, components, export. Store interface method names (`startHunt`, `updateHunt`, `completeHunt`, `claimLocalHunt`, `discardLocalHunt`) match between Task 4 definition and Task 5/7 consumption.

**Firestore-side manual steps for the user (called out in Task 1):**
1. `firebase deploy --only firestore:rules --project goofer-website` — REQUIRED.
2. Possible composite index for `hunts` orderBy `completedAt` — if Firestore throws an index error in the console, click the auto-generated link. (Single-field orderBy usually needs no composite index, so likely not required.)
