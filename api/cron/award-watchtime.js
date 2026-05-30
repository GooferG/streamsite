import crypto from 'crypto';
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';

// Award tickets to currently-active chatters in GooferG's stream.
// Runs on Vercel Cron every 5 minutes.
//
// Auth: Authorization: Bearer <CRON_SECRET>  (Vercel injects this when configured)
//
// Required env:
//   CRON_SECRET                         shared secret for cron auth
//   TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET
//   TWITCH_BROADCASTER_ID               numeric Twitch user id for GooferG
//   TWITCH_BROADCASTER_REFRESH_TOKEN    refresh token w/ moderator:read:chatters
//                                       (obtained one-time via scripts/get-broadcaster-refresh-token.mjs)
//   WATCHTIME_TICKET_AWARD              optional, default 1
//
// We persist a rotating refresh token back to Firestore (secrets/broadcaster_token)
// because Twitch rotates refresh tokens on each refresh.

const TICKET_AWARD = Number(process.env.WATCHTIME_TICKET_AWARD) || 1;
const HELIX = 'https://api.twitch.tv/helix';

async function getStoredRefreshToken() {
  const snap = await adminDb.collection('secrets').doc('broadcaster_token').get();
  if (snap.exists && snap.data().refreshToken) return snap.data().refreshToken;
  return process.env.TWITCH_BROADCASTER_REFRESH_TOKEN;
}

async function storeRefreshToken(refreshToken) {
  await adminDb.collection('secrets').doc('broadcaster_token').set(
    { refreshToken, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function refreshAccessToken() {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new Error(`REFRESH_FAILED:${r.status}`);
  const data = await r.json();
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await storeRefreshToken(data.refresh_token);
  }
  return data.access_token;
}

async function helixGet(path, accessToken) {
  const r = await fetch(`${HELIX}${path}`, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`HELIX_${r.status}:${path}:${body.slice(0, 200)}`);
  }
  return r.json();
}

async function fetchAllChatters(broadcasterId, accessToken) {
  const logins = new Set();
  let cursor = null;
  for (let i = 0; i < 50; i++) {
    const qs = new URLSearchParams({
      broadcaster_id: broadcasterId,
      moderator_id: broadcasterId,
      first: '1000',
    });
    if (cursor) qs.set('after', cursor);
    const data = await helixGet(`/chat/chatters?${qs.toString()}`, accessToken);
    (data.data || []).forEach((c) => logins.add(String(c.user_login).toLowerCase()));
    cursor = data.pagination?.cursor;
    if (!cursor) break;
  }
  return logins;
}

export default async function handler(req, res) {
  // CORS not relevant — cron is server-to-server.
  // Fail closed: a missing CRON_SECRET must NOT skip auth (that would let
  // anyone trigger ticket awards). Require it and compare timing-safely.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('award-watchtime: CRON_SECRET is not set — refusing to run.');
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  const auth = req.headers.authorization || '';
  const expectedHeader = `Bearer ${expected}`;
  const authBuf = Buffer.from(auth);
  const expBuf = Buffer.from(expectedHeader);
  if (authBuf.length !== expBuf.length || !crypto.timingSafeEqual(authBuf, expBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
    if (!broadcasterId) throw new Error('MISSING_TWITCH_BROADCASTER_ID');

    // App-access token for /streams (public read).
    const appTokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    if (!appTokenRes.ok) throw new Error('APP_TOKEN_FAIL');
    const { access_token: appToken } = await appTokenRes.json();

    const stream = await helixGet(`/streams?user_id=${broadcasterId}`, appToken);
    if (!stream.data?.length) {
      return res.status(200).json({ ok: true, live: false, awarded: 0 });
    }

    const userAccessToken = await refreshAccessToken();
    const chatterLogins = await fetchAllChatters(broadcasterId, userAccessToken);
    if (chatterLogins.size === 0) {
      return res.status(200).json({ ok: true, live: true, chatters: 0, awarded: 0 });
    }

    // Firestore `in` queries cap at 30 entries. Batch the lookups.
    const loginArr = [...chatterLogins];
    const matches = [];
    for (let i = 0; i < loginArr.length; i += 30) {
      const chunk = loginArr.slice(i, i + 30);
      const snap = await adminDb
        .collection('users')
        .where('twitchName', 'in', chunk)
        .get();
      snap.forEach((d) => matches.push(d));
    }

    if (matches.length === 0) {
      return res.status(200).json({ ok: true, live: true, chatters: chatterLogins.size, awarded: 0 });
    }

    // Batched writes — split into commits of <=500 ops. Each match = 2 ops (user update + ledger).
    let awarded = 0;
    const now = FieldValue.serverTimestamp();
    const chunkSize = 200; // 200 * 2 ops = 400 < 500
    for (let i = 0; i < matches.length; i += chunkSize) {
      const batch = adminDb.batch();
      const chunk = matches.slice(i, i + chunkSize);
      chunk.forEach((d) => {
        batch.update(d.ref, {
          tickets: FieldValue.increment(TICKET_AWARD),
          totalEarned: FieldValue.increment(TICKET_AWARD),
          lastWatchTimeAwardAt: now,
          updatedAt: now,
        });
        const ledgerRef = adminDb.collection('ticket_ledger').doc();
        batch.set(ledgerRef, {
          userId: d.id,
          delta: TICKET_AWARD,
          reason: 'watchtime',
          createdAt: now,
        });
        awarded += 1;
      });
      await batch.commit();
    }

    return res.status(200).json({
      ok: true,
      live: true,
      chatters: chatterLogins.size,
      awarded,
    });
  } catch (err) {
    console.error('award-watchtime error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
