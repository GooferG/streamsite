import { adminDb, FieldValue } from './firebaseAdmin.js';

// Helpers for managing the broadcaster's rotating refresh token + minting
// short-lived user-access tokens for Helix endpoints that require user scope
// (Get Chatters, Create EventSub Subscription with user-auth scopes, etc.)
//
// Storage: secrets/broadcaster_token doc { refreshToken, updatedAt }.
// Falls back to env TWITCH_BROADCASTER_REFRESH_TOKEN on cold start.

const SECRET_PATH = ['secrets', 'broadcaster_token'];

async function getStoredRefreshToken() {
  const snap = await adminDb.doc(SECRET_PATH.join('/')).get();
  if (snap.exists && snap.data().refreshToken) return snap.data().refreshToken;
  return process.env.TWITCH_BROADCASTER_REFRESH_TOKEN || null;
}

async function storeRefreshToken(refreshToken) {
  await adminDb.doc(SECRET_PATH.join('/')).set(
    { refreshToken, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Mint a fresh broadcaster user-access token. Rotates the stored refresh
 * token if Twitch issues a new one.
 */
export async function getBroadcasterAccessToken() {
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
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`REFRESH_FAILED:${r.status}:${body.slice(0, 200)}`);
  }
  const data = await r.json();
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await storeRefreshToken(data.refresh_token);
  }
  return data.access_token;
}

/**
 * Get an app-access token (client_credentials). Used for public Helix reads
 * and for EventSub webhook subscriptions (webhook transport requires app token).
 */
export async function getAppAccessToken() {
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) throw new Error('APP_TOKEN_FAIL');
  const data = await r.json();
  return data.access_token;
}

const HELIX = 'https://api.twitch.tv/helix';

export async function helix(method, path, accessToken, body = null) {
  const headers = {
    'Client-ID': process.env.TWITCH_CLIENT_ID,
    Authorization: `Bearer ${accessToken}`,
  };
  const init = { method, headers };
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const r = await fetch(`${HELIX}${path}`, init);
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) {
    const err = new Error(`HELIX_${r.status}:${path}`);
    err.status = r.status;
    err.body = json;
    throw err;
  }
  return json;
}
