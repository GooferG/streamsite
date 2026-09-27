import crypto from 'crypto';
import {
  getAppAccessToken,
  getBroadcasterAccessToken,
  helix,
} from '../_lib/twitchBroadcasterToken.js';
import {
  windowId,
  completedWindow,
  shouldSettle,
  readRates,
  exclusionFromEnv,
  withoutExcluded,
} from '../_lib/watchtime.js';
import {
  takeChatMarkers,
  deleteRefs,
  openSessionIds,
  creditSession,
  settleSession,
} from '../_lib/watchtimeStore.js';

// Live watch-time tick. Vercel cron runs it every 5 minutes (vercel.json).
// Credits the 5-minute window that just ended to everyone in GooferG's chat,
// pays out every 30 minutes, and closes the session once the stream ends.
// Design: docs/superpowers/specs/2026-09-27-live-watchtime-design.md
//
// Auth: Authorization: Bearer <CRON_SECRET> (Vercel sends it on cron runs).
//
// Env:
//   CRON_SECRET, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_BROADCASTER_ID
//   TWITCH_BROADCASTER_REFRESH_TOKEN   needs moderator:read:chatters
//   WATCHTIME_TICKETS_PER_WINDOW       optional, default 1
//   WATCHTIME_CHAT_BONUS               optional, default 1
//   WATCHTIME_EXCLUDE_LOGINS           optional, comma-separated logins
//   TWITCH_BOT_ID                      optional, never credited

function authorized(req) {
  const got = Buffer.from(req.headers.authorization || '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Everyone connected to chat, as user id -> lowercased login.
async function fetchChatters(broadcasterId, token) {
  const viewers = new Map();
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({
      broadcaster_id: broadcasterId,
      moderator_id: broadcasterId,
      first: '1000',
    });
    if (cursor) qs.set('after', cursor);
    const data = await helix('GET', `/chat/chatters?${qs.toString()}`, token);
    (data?.data || []).forEach((c) => {
      viewers.set(String(c.user_id), String(c.user_login).toLowerCase());
    });
    cursor = data?.pagination?.cursor;
    if (!cursor) break;
  }
  return viewers;
}

export default async function handler(req, res) {
  // Fail closed: a missing CRON_SECRET must not skip auth.
  if (!process.env.CRON_SECRET) {
    console.error('watchtime-tick: CRON_SECRET is not set — refusing to run.');
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
    if (!broadcasterId) throw new Error('MISSING_TWITCH_BROADCASTER_ID');

    const now = Date.now();
    const current = windowId(now);
    const completed = completedWindow(now);
    const rates = readRates(process.env);

    const appToken = await getAppAccessToken();
    const streams = await helix('GET', `/streams?user_id=${broadcasterId}`, appToken);
    const stream = streams?.data?.[0] || null;

    const markers = await takeChatMarkers(current, completed);

    // Sessions left open by an ended or restarted stream get their final payout.
    const stale = (await openSessionIds()).filter((id) => !stream || id !== stream.id);
    for (const id of stale) {
      await settleSession(id, rates, { close: true });
    }

    if (!stream) {
      await deleteRefs(markers.refs);
      return res.status(200).json({ ok: true, live: false, window: completed, closed: stale.length });
    }

    const exclusion = exclusionFromEnv(process.env);
    const userToken = await getBroadcasterAccessToken();
    const present = withoutExcluded(await fetchChatters(broadcasterId, userToken), exclusion);
    const chatted = withoutExcluded(markers.chatted, exclusion);

    const credited = await creditSession(stream.id, { completed, present, chatted });
    const settled =
      credited && shouldSettle(completed) ? await settleSession(stream.id, rates) : null;
    await deleteRefs(markers.refs);

    return res.status(200).json({
      ok: true,
      live: true,
      window: completed,
      viewers: present.size,
      chatted: chatted.size,
      credited,
      settled,
      closed: stale.length,
    });
  } catch (err) {
    console.error('watchtime-tick error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
