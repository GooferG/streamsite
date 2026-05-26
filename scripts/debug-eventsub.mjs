#!/usr/bin/env node
/**
 * One-shot diagnostic for Phase 3 EventSub subscribe failures.
 * Replicates exactly what /api/admin/eventsub does, but prints every
 * intermediate response so we can see WHY Twitch is rejecting.
 *
 * Usage: node scripts/debug-eventsub.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;
const REFRESH = process.env.TWITCH_BROADCASTER_REFRESH_TOKEN;
const SECRET = process.env.TWITCH_EVENTSUB_SECRET || 'localdebugsecret_at_least_10_chars';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://goofer.tv';

console.log('\n=== Config ===');
console.log('TWITCH_CLIENT_ID         :', CLIENT_ID ? `${CLIENT_ID.slice(0, 6)}…${CLIENT_ID.slice(-4)}` : 'MISSING');
console.log('TWITCH_CLIENT_SECRET     :', CLIENT_SECRET ? 'set' : 'MISSING');
console.log('TWITCH_BROADCASTER_ID    :', BROADCASTER_ID || 'MISSING');
console.log('TWITCH_BROADCASTER_REFRESH_TOKEN:', REFRESH ? `${REFRESH.slice(0, 6)}…` : 'MISSING');
console.log('TWITCH_EVENTSUB_SECRET   :', SECRET ? 'set' : 'MISSING');
console.log('PUBLIC_BASE_URL          :', PUBLIC_BASE_URL);

async function step(label, fn) {
  console.log(`\n--- ${label} ---`);
  try {
    const r = await fn();
    return r;
  } catch (e) {
    console.error('FAILED:', e.message);
    throw e;
  }
}

const appToken = await step('1. Mint app access token', async () => {
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await r.json();
  console.log('status:', r.status);
  console.log('body  :', data);
  if (!r.ok) process.exit(1);
  return data.access_token;
});

await step('2. Validate app token (whose token, what scopes)', async () => {
  const r = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${appToken}` },
  });
  const data = await r.json();
  console.log('status:', r.status);
  console.log('body  :', data);
});

const userToken = await step('3. Refresh broadcaster user token', async () => {
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const data = await r.json();
  console.log('status:', r.status);
  console.log('body  :', data);
  if (!r.ok) process.exit(1);
  return data.access_token;
});

await step('4. Validate broadcaster user token (whose token, what scopes)', async () => {
  const r = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${userToken}` },
  });
  const data = await r.json();
  console.log('status:', r.status);
  console.log('body  :', data);
  if (data.user_id && data.user_id !== BROADCASTER_ID) {
    console.warn('  !! user_id from token does NOT match TWITCH_BROADCASTER_ID');
  }
});

const subscribeBody = {
  type: 'channel.chat.message',
  version: '1',
  condition: {
    broadcaster_user_id: BROADCASTER_ID,
    user_id: BROADCASTER_ID,
  },
  transport: {
    method: 'webhook',
    callback: `${PUBLIC_BASE_URL}/api/twitch/eventsub`,
    secret: SECRET,
  },
};

await step('5a. POST /eventsub/subscriptions with APP token', async () => {
  const r = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscribeBody),
  });
  const text = await r.text();
  console.log('status:', r.status);
  console.log('body  :', text);
});

await step('5b. POST /eventsub/subscriptions with USER token (just to compare)', async () => {
  const r = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscribeBody),
  });
  const text = await r.text();
  console.log('status:', r.status);
  console.log('body  :', text);
});

console.log('\nDone.');
