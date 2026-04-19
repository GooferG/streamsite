# Game Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Twitch viewers to log in and suggest a slot/game on the site, with a streamer admin panel and a real-time OBS browser source overlay.

**Architecture:** Twitch OAuth redirect → `/api/twitch-auth.js` exchanges code for a Firebase custom token → Firebase Auth signs viewer in → Firestore `suggestions` collection (one doc per viewer, keyed by twitchId) → real-time `onSnapshot` powers both the admin tab and the OBS overlay.

**Tech Stack:** React, Tailwind CSS, Firebase (Auth + Firestore), Firebase Admin SDK (server-side), `bad-words` npm package, Vercel serverless functions.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/constants.js` | Modify | Remove `TWITCH_CLIENT_SECRET` (security fix) |
| `src/utils/twitchApi.js` | Modify | Remove `TWITCH_CLIENT_SECRET` usage |
| `api/twitch-auth.js` | Create | Serverless: exchange Twitch code → Firebase custom token |
| `src/contexts/TwitchAuthContext.js` | Create | Twitch/Firebase login state, exposes `twitchUser`, `loginWithTwitch`, `logout` |
| `src/pages/TwitchCallbackPage.js` | Create | Handles `/twitch-callback` redirect, calls API, signs in to Firebase |
| `src/pages/SuggestPage.js` | Create | Public `/suggest` page — login wall + suggestion form |
| `src/pages/SuggestOverlay.js` | Create | OBS browser source at `/suggest-overlay` |
| `src/components/SuggestAdminTab.js` | Create | Admin tab in GambaPage — live list, highlight, delete, clear all |
| `src/App.js` | Modify | Add routes + wrap in `TwitchAuthProvider` |
| `src/pages/GambaPage.js` | Modify | Add "Suggest" tab button + render `SuggestAdminTab` |

---

## Task 1: Security fix — remove secret from frontend

**Files:**
- Modify: `src/constants.js`
- Modify: `src/utils/twitchApi.js`

The `TWITCH_CLIENT_SECRET` is currently exposed in `src/constants.js` and used in `src/utils/twitchApi.js`. The client credentials token exchange must move server-side. We'll proxy it through a new `/api/twitch-token.js`.

- [ ] **Step 1: Create `/api/twitch-token.js`**

```js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.REACT_APP_TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json({ access_token: data.access_token });
}
```

- [ ] **Step 2: Update `src/utils/twitchApi.js` — use proxy instead of direct token fetch**

Replace `getTwitchAccessToken`:

```js
export async function getTwitchAccessToken() {
  const response = await fetch('/api/twitch-token', { method: 'POST' });
  const data = await response.json();
  return data.access_token;
}
```

- [ ] **Step 3: Remove secret from `src/constants.js`**

Replace the file contents (keep everything except `TWITCH_CLIENT_SECRET`):

```js
// Twitch Configuration
export const TWITCH_USERNAME = 'GooferG';
export const TWITCH_CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID || '6t0kocnv2iyqathfkgbn60tit8x12b';

export const SOCIAL_LINKS = {
  twitch: 'https://twitch.tv/GooferG',
  youtube: 'https://youtube.com/@Goofer-G',
  twitter: 'https://twitter.com/Goofer_G',
};

export const SCHEDULE = [
  {
    day: 'MONDAY',
    time: '5:00 PM - 11:00 PM EST',
    content: 'Yakuza: Like a Dragon Infinite Wealth',
    status: 'regular',
    gameName: 'Like a Dragon: Infinite Wealth',
  },
  {
    day: 'TUESDAY',
    time: '4:20 PM - 9:00 PM EST',
    content: 'Games And Chilling',
    status: 'regular',
    gameName: 'Contraband Police',
  },
  {
    day: 'WEDNESDAY',
    time: '4:20 PM - 9:00 PM EST',
    content: 'Variety Gaming',
    status: 'regular',
    gameName: 'Arc Raiders',
  },
  {
    day: 'THURSDAY',
    time: 'OFF',
    content: 'Rest Day',
    status: 'off',
    gameName: null,
  },
  {
    day: 'FRY-DAY',
    time: '4:20 PM - 11:00 PM EST',
    content: 'Late Night Vibes - React Content (Movie Night)',
    status: 'special',
    gameName: null,
  },
  {
    day: 'SATURDAY',
    time: '4:00 PM - 10:00 PM EST',
    content: 'Community Game Day',
    status: 'special',
    gameName: 'Marbles On Stream',
  },
  {
    day: 'SUNDAY',
    time: '5:00 PM - 10:00 PM EST',
    content: 'Chill Sunday - Just Chatting',
    status: 'regular',
    gameName: null,
  },
];
```

- [ ] **Step 4: Verify app still runs**

```bash
npm start
```

Expected: App loads, no console errors about missing client secret.

- [ ] **Step 5: Commit**

```bash
git add api/twitch-token.js src/constants.js src/utils/twitchApi.js
git commit -m "security: move Twitch client secret to server-side proxy"
```

---

## Task 2: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install bad-words firebase-admin
```

- [ ] **Step 2: Verify install**

```bash
npm ls bad-words firebase-admin
```

Expected: Both listed without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add bad-words and firebase-admin"
```

---

## Task 3: Serverless API — Twitch OAuth → Firebase custom token

**Files:**
- Create: `api/twitch-auth.js`

This function receives `?code=&redirect_uri=` from the frontend after Twitch redirects back. It exchanges the code for a Twitch user token, fetches the viewer's profile, then mints a Firebase custom token using the Admin SDK.

- [ ] **Step 1: Create `api/twitch-auth.js`**

```js
import admin from 'firebase-admin';

// Initialise Firebase Admin once (Vercel reuses the instance across warm invocations)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, redirect_uri } = req.body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  // Exchange code for Twitch user access token
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.REACT_APP_TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return res.status(400).json({ error: 'Twitch token exchange failed', details: tokenData });

  // Fetch Twitch user profile
  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': process.env.REACT_APP_TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const userData = await userRes.json();
  if (!userRes.ok || !userData.data?.[0]) {
    return res.status(400).json({ error: 'Failed to fetch Twitch user' });
  }

  const twitchUser = userData.data[0];

  // Mint Firebase custom token with twitchId as uid
  const firebaseToken = await admin.auth().createCustomToken(twitchUser.id, {
    twitchName: twitchUser.display_name,
    profileImageUrl: twitchUser.profile_image_url,
  });

  return res.status(200).json({
    firebaseToken,
    twitchId: twitchUser.id,
    displayName: twitchUser.display_name,
    profileImageUrl: twitchUser.profile_image_url,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/twitch-auth.js
git commit -m "feat: add Twitch OAuth -> Firebase custom token API"
```

---

## Task 4: TwitchAuthContext

**Files:**
- Create: `src/contexts/TwitchAuthContext.js`

Manages the viewer's Twitch+Firebase login state. Stores profile in `localStorage` so the session survives page refreshes without re-authing.

- [ ] **Step 1: Create `src/contexts/TwitchAuthContext.js`**

```js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

const TwitchAuthContext = createContext({});

export const useTwitchAuth = () => useContext(TwitchAuthContext);

const REDIRECT_URI = `${window.location.origin}/twitch-callback`;
const CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;

export function TwitchAuthProvider({ children }) {
  const [twitchUser, setTwitchUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('twitch_user')) || null; } catch { return null; }
  });
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setTwitchUser(null);
        localStorage.removeItem('twitch_user');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithTwitch = () => {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read:email',
    });
    window.location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
  };

  const signInWithTwitchCode = async (code) => {
    const res = await fetch('/api/twitch-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
    });
    if (!res.ok) throw new Error('Auth failed');
    const { firebaseToken, twitchId, displayName, profileImageUrl } = await res.json();
    await signInWithCustomToken(auth, firebaseToken);
    const profile = { twitchId, displayName, profileImageUrl };
    setTwitchUser(profile);
    localStorage.setItem('twitch_user', JSON.stringify(profile));
    return profile;
  };

  const logout = async () => {
    await signOut(auth);
    setTwitchUser(null);
    localStorage.removeItem('twitch_user');
  };

  return (
    <TwitchAuthContext.Provider value={{ twitchUser, firebaseUser, loading, loginWithTwitch, signInWithTwitchCode, logout }}>
      {children}
    </TwitchAuthContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/TwitchAuthContext.js
git commit -m "feat: add TwitchAuthContext for viewer OAuth login"
```

---

## Task 5: TwitchCallbackPage

**Files:**
- Create: `src/pages/TwitchCallbackPage.js`

Landing page for `/twitch-callback`. Reads `?code=` from the URL, calls `signInWithTwitchCode`, then redirects to `/suggest`.

- [ ] **Step 1: Create `src/pages/TwitchCallbackPage.js`**

```js
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

export default function TwitchCallbackPage() {
  const [searchParams] = useSearchParams();
  const { signInWithTwitchCode } = useTwitchAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No code returned from Twitch.');
      return;
    }
    signInWithTwitchCode(code)
      .then(() => navigate('/suggest', { replace: true }))
      .catch(() => setError('Login failed. Please try again.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-red-400 font-bold">{error}</p>
          <button
            onClick={() => navigate('/suggest')}
            className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 hover:border-purple-400/60 transition-all"
          >
            Back to Suggest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/60">Logging you in with Twitch...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/TwitchCallbackPage.js
git commit -m "feat: add TwitchCallbackPage for OAuth redirect handling"
```

---

## Task 6: SuggestPage (viewer-facing)

**Files:**
- Create: `src/pages/SuggestPage.js`

Public page at `/suggest`. Shows a Twitch login button if not logged in. After login shows a form to submit/edit a game name + optional Rainbet username. Profanity-filtered, one suggestion per viewer (upsert by twitchId).

- [ ] **Step 1: Create `src/pages/SuggestPage.js`**

```js
import { useState, useEffect } from 'react';
import { Gamepad2, LogOut, Send, Edit2, Twitch } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Filter from 'bad-words';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

const filter = new Filter();

export default function SuggestPage() {
  const { twitchUser, loading, loginWithTwitch, logout } = useTwitchAuth();
  const [gameName, setGameName] = useState('');
  const [rainbetName, setRainbetName] = useState('');
  const [existing, setExisting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  // Load existing suggestion for this viewer
  useEffect(() => {
    if (!twitchUser) return;
    const ref = doc(db, 'suggestions', twitchUser.twitchId);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setExisting(data);
        setGameName(data.gameName);
        setRainbetName(data.rainbetName || '');
        setSubmitted(true);
      }
    });
  }, [twitchUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = gameName.trim();
    if (!trimmed) return setError('Game name is required.');
    if (trimmed.length > 100) return setError('Game name must be 100 characters or less.');
    if (filter.isProfane(trimmed)) return setError('That game name contains disallowed words. Please keep it clean.');

    setSubmitting(true);
    try {
      const ref = doc(db, 'suggestions', twitchUser.twitchId);
      await setDoc(ref, {
        twitchId: twitchUser.twitchId,
        twitchName: twitchUser.displayName,
        profileImageUrl: twitchUser.profileImageUrl || null,
        rainbetName: rainbetName.trim() || null,
        gameName: trimmed,
        status: existing?.status || 'pending',
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setExisting({ gameName: trimmed, rainbetName: rainbetName.trim() || null });
      setSubmitted(true);
      setEditing(false);
    } catch (err) {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950 to-purple-950 text-white pt-16 pb-24 px-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-purple-400 font-bold">
            <Gamepad2 size={20} />
            GOOFER.TV
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              Suggest a Game
            </span>
          </h1>
          <p className="text-white/60 text-sm">
            Logged-in viewers can suggest one slot or game for the stream.
          </p>
        </div>

        {!twitchUser ? (
          <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm text-center space-y-4">
            <p className="text-white/70">Login with your Twitch account to suggest a game.</p>
            <button
              onClick={loginWithTwitch}
              className="w-full px-6 py-4 rounded-lg bg-[#9146FF] hover:bg-[#7d2ff7] text-white font-bold transition-all flex items-center justify-center gap-3"
            >
              <Twitch size={20} />
              Login with Twitch
            </button>
          </div>
        ) : (
          <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm space-y-6">
            {/* Viewer identity */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {twitchUser.profileImageUrl && (
                  <img src={twitchUser.profileImageUrl} alt="" className="w-9 h-9 rounded-full border border-white/20" />
                )}
                <div>
                  <p className="font-bold text-white">{twitchUser.displayName}</p>
                  <p className="text-xs text-purple-400">Twitch</p>
                </div>
              </div>
              <button onClick={logout} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
                <LogOut size={16} />
              </button>
            </div>

            {/* Submitted state */}
            {submitted && !editing ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-1">
                  <p className="text-xs text-emerald-400 font-bold uppercase tracking-wide">Your suggestion</p>
                  <p className="font-black text-white text-xl">{existing?.gameName}</p>
                  {existing?.rainbetName && (
                    <p className="text-sm text-white/60">Rainbet: <span className="text-emerald-300">{existing.rainbetName}</span></p>
                  )}
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-emerald-400/60 transition-all flex items-center justify-center gap-2 font-bold"
                >
                  <Edit2 size={16} />
                  Update Suggestion
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Game / Slot Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder="e.g. Gates of Olympus"
                    maxLength={100}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Rainbet Username <span className="text-white/40">(optional)</span></label>
                  <input
                    type="text"
                    value={rainbetName}
                    onChange={(e) => setRainbetName(e.target.value)}
                    placeholder="Your Rainbet username"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setGameName(existing?.gameName || ''); setRainbetName(existing?.rainbetName || ''); setError(''); }}
                      className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all font-bold"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold hover:from-emerald-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    {submitting ? 'Submitting...' : editing ? 'Update' : 'Submit'}
                  </button>
                </div>
              </form>
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
git add src/pages/SuggestPage.js
git commit -m "feat: add viewer-facing SuggestPage with Twitch login and profanity filter"
```

---

## Task 7: SuggestOverlay (OBS browser source)

**Files:**
- Create: `src/pages/SuggestOverlay.js`

Read-only page at `/suggest-overlay`. Real-time Firestore `onSnapshot`. Transparent background for OBS chroma key. Highlighted entries shown in green.

- [ ] **Step 1: Create `src/pages/SuggestOverlay.js`**

```js
import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function SuggestOverlay() {
  const [suggestions, setSuggestions] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => d.data()));
    });
    return unsub;
  }, []);

  // Auto-scroll to top when new suggestions come in
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [suggestions.length]);

  return (
    <div className="w-full h-screen bg-black/80 text-white font-sans overflow-hidden flex flex-col p-4 gap-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        <span className="text-emerald-400 font-black text-lg tracking-widest uppercase">Game Suggestions</span>
        <span className="ml-auto text-white/40 text-sm">{suggestions.length}</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
        {suggestions.length === 0 && (
          <p className="text-white/30 text-sm text-center pt-4">No suggestions yet.</p>
        )}
        {suggestions.map((s) => (
          <div
            key={s.twitchId}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              s.status === 'highlighted'
                ? 'bg-emerald-500/20 border-emerald-500/60'
                : 'bg-white/5 border-white/10'
            }`}
          >
            {s.profileImageUrl && (
              <img src={s.profileImageUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0 border border-white/20" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-black text-white truncate">{s.gameName}</p>
              <p className="text-xs text-white/50 truncate">
                {s.twitchName}
                {s.rainbetName ? ` · ${s.rainbetName}` : ''}
              </p>
            </div>
            {s.status === 'highlighted' && (
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 rounded px-2 py-0.5 flex-shrink-0">
                PICKED
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SuggestOverlay.js
git commit -m "feat: add SuggestOverlay OBS browser source page"
```

---

## Task 8: SuggestAdminTab

**Files:**
- Create: `src/components/SuggestAdminTab.js`

Admin panel tab for GambaPage. Live list via `onSnapshot`. Highlight toggle, individual delete, clear all with confirmation. Matches existing GambaPage panel styling.

- [ ] **Step 1: Create `src/components/SuggestAdminTab.js`**

```js
import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { Star, X, RefreshCcw, MessageSquarePlus } from 'lucide-react';
import { db } from '../config/firebase';

export default function SuggestAdminTab() {
  const [suggestions, setSuggestions] = useState([]);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const toggleHighlight = async (suggestion) => {
    const ref = doc(db, 'suggestions', suggestion.id);
    await updateDoc(ref, {
      status: suggestion.status === 'highlighted' ? 'pending' : 'highlighted',
    });
  };

  const removeSuggestion = async (id) => {
    await deleteDoc(doc(db, 'suggestions', id));
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    suggestions.forEach((s) => batch.delete(doc(db, 'suggestions', s.id)));
    await batch.commit();
    setClearConfirm(false);
  };

  return (
    <div className="p-8 bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 rounded-xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold mb-2">
            <MessageSquarePlus size={18} />
            Game Suggestions
          </div>
          <h2 className="text-3xl font-black tracking-tighter">Viewer Suggestions</h2>
          <p className="text-white/60">{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} — highlight a game to mark it as picked on the overlay.</p>
        </div>
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={suggestions.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-red-400/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={14} />
            CLEAR ALL
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
            >
              Confirm
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-10 text-white/40">
          No suggestions yet. Share <strong className="text-white/60">goofer.tv/suggest</strong> with chat!
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-lg border flex items-center gap-4 transition-all ${
                s.status === 'highlighted'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {s.profileImageUrl && (
                <img src={s.profileImageUrl} alt="" className="w-9 h-9 rounded-full border border-white/20 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white">{s.gameName}</p>
                  {s.status === 'highlighted' && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">PICKED</span>
                  )}
                </div>
                <p className="text-sm text-white/50">
                  {s.twitchName}
                  {s.rainbetName ? <span className="text-emerald-400/70"> · {s.rainbetName}</span> : null}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleHighlight(s)}
                  className={`p-2 rounded-lg border transition-all ${
                    s.status === 'highlighted'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-emerald-300 hover:border-emerald-400/60'
                  }`}
                >
                  <Star size={16} />
                </button>
                <button
                  onClick={() => removeSuggestion(s.id)}
                  className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SuggestAdminTab.js
git commit -m "feat: add SuggestAdminTab with highlight, delete, and clear-all"
```

---

## Task 9: Wire up routes and GambaPage tab

**Files:**
- Modify: `src/App.js`
- Modify: `src/pages/GambaPage.js`

- [ ] **Step 1: Update `src/App.js` — add provider and routes**

Add imports at the top of `src/App.js`:

```js
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import TwitchCallbackPage from './pages/TwitchCallbackPage';
import SuggestPage from './pages/SuggestPage';
import SuggestOverlay from './pages/SuggestOverlay';
```

Wrap the return of `StreamingSite` so `TwitchAuthProvider` is outside `AuthProvider` (both need to wrap `StreamingSiteContent`):

```js
export default function StreamingSite() {
  return (
    <AuthProvider>
      <TwitchAuthProvider>
        <StreamingSiteContent />
      </TwitchAuthProvider>
    </AuthProvider>
  );
}
```

Add three routes inside the `<Routes>` block in `StreamingSiteContent`, after the existing routes:

```jsx
<Route path="/suggest" element={<SuggestPage />} />
<Route path="/twitch-callback" element={<TwitchCallbackPage />} />
<Route path="/suggest-overlay" element={<SuggestOverlay />} />
```

- [ ] **Step 2: Update `src/pages/GambaPage.js` — add Suggest tab**

Add the import at the top of `GambaPage.js`:

```js
import SuggestAdminTab from '../components/SuggestAdminTab';
import { MessageSquarePlus } from 'lucide-react';
```

In the `activeTool` state initialiser, no change needed (`'wheel'` default is fine).

Add the Suggest tab button in the tool selection buttons block (after the Viewer Polls button):

```jsx
<button
  onClick={() => setActiveTool('suggest')}
  className={`px-6 py-3 rounded-lg font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
    activeTool === 'suggest'
      ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-lg'
      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60'
  }`}
>
  <MessageSquarePlus size={18} />
  Suggestions
</button>
```

In the main panel area (inside `<div className="lg:col-span-2 space-y-6">`), add after the existing `activeTool === 'poll'` block:

```jsx
{activeTool === 'suggest' && <SuggestAdminTab />}
```

- [ ] **Step 3: Verify app compiles**

```bash
npm start
```

Expected: App loads, GambaPage shows "Suggestions" tab, clicking it renders the admin panel.

- [ ] **Step 4: Commit**

```bash
git add src/App.js src/pages/GambaPage.js
git commit -m "feat: wire up Suggestions tab and routes in App"
```

---

## Task 10: Manual end-to-end test

No code changes — verification only.

- [ ] **Step 1: Test viewer login flow**

1. Open `http://localhost:3000/suggest`
2. Click "Login with Twitch"
3. Complete Twitch OAuth (must be running on localhost:3000 or a deployed URL matching the redirect URI you registered)
4. Confirm: redirected to `/suggest`, Twitch name + avatar shown

- [ ] **Step 2: Test suggestion submit**

1. Type a game name and optional Rainbet username
2. Click Submit
3. Confirm: success state shown with game name displayed
4. Open Firebase Console → Firestore → `suggestions` collection → confirm doc exists

- [ ] **Step 3: Test profanity filter**

1. Click "Update Suggestion"
2. Enter a profane word as game name
3. Click Submit
4. Confirm: red error shown, no Firestore write

- [ ] **Step 4: Test admin tab**

1. Open `http://localhost:3000/gamba`
2. Click "Suggestions" tab
3. Confirm: suggestion appears in list
4. Click star icon → confirm `status` turns `highlighted`, green styling applied
5. Open `http://localhost:3000/suggest-overlay` in another tab → confirm green "PICKED" badge appears

- [ ] **Step 5: Test delete and clear all**

1. In admin tab, click X on a suggestion → confirm removed from list and Firestore
2. Submit another suggestion as viewer, then click "CLEAR ALL" → confirm → list empties

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: game suggestions feature complete"
```
