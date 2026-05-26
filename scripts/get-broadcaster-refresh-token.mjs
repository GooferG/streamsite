#!/usr/bin/env node
/**
 * One-time helper: mint a Twitch refresh token from your BROADCASTER account
 * with the `moderator:read:chatters` scope, so the production watchtime cron
 * can list active chatters.
 *
 * Usage:
 *   1. Make sure TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are in your .env.local
 *      (the same values used by /api/twitch-auth).
 *   2. In the Twitch dev console for that client, add this redirect URI:
 *        http://localhost:8765/callback
 *   3. Run:    node scripts/get-broadcaster-refresh-token.mjs
 *   4. A URL prints — open it, sign in as GooferG, approve.
 *   5. The script captures the code, exchanges it, and prints:
 *        TWITCH_BROADCASTER_ID
 *        TWITCH_BROADCASTER_REFRESH_TOKEN
 *      Paste both into Vercel project env vars (and .env.local for local cron tests).
 *
 * This script does not write env files for you — it just prints values to copy.
 */
import http from 'node:http';
import { URL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Tiny .env.local parser so we don't pull a dep.
function loadEnv() {
  const file = path.join(root, '.env.local');
  if (!existsSync(file)) return;
  const txt = readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8765/callback';
// moderator:read:chatters — needed by /api/cron/award-watchtime (Helix Get Chatters)
// user:read:chat           — needed by EventSub channel.chat.message
// user:bot                 — required alongside user:read:chat for app-token
//                            webhook subscriptions on channel.chat.message
// channel:bot              — broadcaster authorizing app to read chat in their channel
const SCOPES = [
  'moderator:read:chatters',
  'user:read:chat',
  'user:bot',
  'channel:bot',
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in env / .env.local');
  process.exit(1);
}

const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES.join(' '));
authUrl.searchParams.set('force_verify', 'true');

console.log('\n=== Twitch broadcaster token helper ===\n');
console.log('Open this URL in your browser, sign in as GooferG, and approve:\n');
console.log(authUrl.toString());
console.log('\nWaiting for callback on http://localhost:8765 …\n');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:8765');
  if (u.pathname !== '/callback') {
    res.writeHead(404).end('not found');
    return;
  }
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  if (err) {
    res.writeHead(400).end(`Twitch denied: ${err}`);
    console.error('Twitch denied:', err);
    process.exit(1);
  }
  if (!code) {
    res.writeHead(400).end('no code');
    return;
  }

  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`token exchange: ${JSON.stringify(tokenData)}`);

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-ID': CLIENT_ID,
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    const userData = await userRes.json();
    const me = userData.data?.[0];
    if (!me) throw new Error('failed to load user');

    res.writeHead(200, { 'Content-Type': 'text/html' }).end(
      `<html><body style="font-family: ui-monospace; padding: 2rem; background:#111; color:#eee">
        <h2>Done.</h2>
        <p>Copy the values from your terminal into Vercel env vars and .env.local.</p>
        <p>You can close this tab.</p>
      </body></html>`
    );

    console.log('\n=== SUCCESS ===\n');
    console.log(`Twitch user:        ${me.display_name} (login=${me.login})`);
    console.log(`\nPaste into Vercel project env (and .env.local):\n`);
    console.log(`TWITCH_BROADCASTER_ID=${me.id}`);
    console.log(`TWITCH_BROADCASTER_REFRESH_TOKEN=${tokenData.refresh_token}`);
    console.log(`\nScopes granted: ${(tokenData.scope || []).join(' ')}\n`);
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500).end(`failed: ${e.message}`);
    console.error('Failed:', e);
    process.exit(1);
  }
});

server.listen(8765);
