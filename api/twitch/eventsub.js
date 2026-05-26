import crypto from 'node:crypto';
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { getBroadcasterAccessToken, helix } from '../_lib/twitchBroadcasterToken.js';

// Twitch EventSub webhook receiver.
//
// Required env:
//   TWITCH_EVENTSUB_SECRET   shared secret used when creating subscriptions
//
// Handles three message_types:
//   - webhook_callback_verification: echo the `challenge` (plaintext)
//   - revocation: log + ack
//   - notification: process the event
//
// For `channel.chat.message`:
//   1. If giveaway in 'rolling' state and message is from the rolled winner,
//      write to giveaways/{id}/winner_messages.
//   2. For each `open` giveaway where the keyword appears in the message,
//      write entry to giveaways/{id}/entries/{twitchId} (idempotent — doc id
//      = twitch id, so retyping the keyword doesn't double-enter).

// Vercel runs the default body parser; we need the raw request bytes to
// validate the HMAC, so disable it.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(req, rawBody) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return false;
  const messageId = req.headers['twitch-eventsub-message-id'];
  const timestamp = req.headers['twitch-eventsub-message-timestamp'];
  const signature = req.headers['twitch-eventsub-message-signature'];
  if (!messageId || !timestamp || !signature) return false;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(messageId + timestamp + rawBody)
    .digest('hex');
  const expected = `sha256=${hmac}`;
  // timingSafeEqual requires equal lengths; bail out if not.
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function alreadyProcessed(messageId) {
  if (!messageId) return false;
  const ref = adminDb.collection('eventsub_seen').doc(messageId);
  const snap = await ref.get();
  if (snap.exists) return true;
  // 10-min TTL via an `expiresAt` field (no real TTL policy by default; we
  // just write it for housekeeping/manual cleanup).
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await ref.set({ createdAt: FieldValue.serverTimestamp(), expiresAt });
  return false;
}

function computeWeight(user, chatRoles, giveaway) {
  // `user` may be null when the chatter has never signed in on the site —
  // user-doc-dependent bonuses (registered, discord) are skipped in that case.
  // `chatRoles` comes from the chat message badges and is always available.
  const w = giveaway.weights || {};
  let total = Number.isFinite(Number(w.base)) ? Number(w.base) : 1;
  if (user) {
    if (w.registered) total += Number(w.registered) || 0;
    if (w.discord && user.discordVerifiedAt) total += Number(w.discord) || 0;
  }
  if (w.sub && chatRoles.isTwitchSub) total += Number(w.sub) || 0;
  if (w.vip && chatRoles.isVip) total += Number(w.vip) || 0;
  return Math.max(1, Math.floor(total));
}

// Derive chat roles from the badges array on a channel.chat.message event.
// Twitch sends e.g. [{ set_id: 'subscriber', id: '12', info: '14' },
// { set_id: 'vip', id: '1', info: '' }]. We only care about set_id presence.
function rolesFromBadges(badges) {
  const sets = new Set((badges || []).map((b) => b?.set_id).filter(Boolean));
  return {
    isTwitchSub: sets.has('subscriber') || sets.has('founder'),
    isVip: sets.has('vip'),
    isMod: sets.has('moderator') || sets.has('broadcaster'),
  };
}

// Check whether a chatter follows the broadcaster. Cached per-invocation to
// avoid repeated Helix calls when multiple giveaways are open. Returns true
// if following, false if not, or null when the check could not be performed
// (missing config / Helix error) so callers can choose how to handle.
async function isFollower(chatterId, cache) {
  if (cache.has(chatterId)) return cache.get(chatterId);
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!broadcasterId) {
    cache.set(chatterId, null);
    return null;
  }
  try {
    const token = await getBroadcasterAccessToken();
    const r = await helix(
      'GET',
      `/channels/followers?broadcaster_id=${broadcasterId}&user_id=${chatterId}`,
      token
    );
    const following = Array.isArray(r?.data) && r.data.length > 0;
    cache.set(chatterId, following);
    return following;
  } catch (err) {
    console.warn('isFollower check failed', chatterId, err.message);
    cache.set(chatterId, null);
    return null;
  }
}

function extractMessageText(event) {
  // The chat message event payload nests text on event.message.text;
  // fragments[] may also exist for emote breakdown. We only need the text.
  return (event?.message?.text || '').toString();
}

async function handleChatMessage(event) {
  const chatterId = event.chatter_user_id;
  const chatterLogin = (event.chatter_user_login || '').toLowerCase();
  const chatterName = event.chatter_user_name;
  const text = extractMessageText(event);
  if (!chatterId || !text) return { processed: false };
  const chatRoles = rolesFromBadges(event.badges);

  // Pull only what we need. Most messages are not for active giveaways, so
  // bail early if no giveaway is active.
  const activeSnap = await adminDb
    .collection('giveaways')
    .where('status', 'in', ['open', 'rolling'])
    .get();
  if (activeSnap.empty) return { processed: false, reason: 'no_active' };

  const lowerText = text.toLowerCase();

  // Load (or skip) the user. We use the twitch user_id, which is the doc id.
  const userRef = adminDb.collection('users').doc(chatterId);
  let userSnap = null;
  let userData = null;

  // Per-invocation follower cache so we hit Helix at most once per chatter
  // even if several open giveaways require the check.
  const followerCache = new Map();

  for (const gdoc of activeSnap.docs) {
    const g = gdoc.data();

    // 1. If this giveaway is rolling and the message is from the rolled
    //    winner, stream their messages into the modal.
    if (g.status === 'rolling' && g.winnerTwitchId === chatterId) {
      await gdoc.ref.collection('winner_messages').add({
        text,
        twitchName: chatterName,
        chatterLogin,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // 2. If open and keyword present, write an entry.
    // Anyone in chat can enter — registered viewers may receive weight bonuses
    // depending on the giveaway's toggles. Unregistered chatters get base weight.
    if (g.status === 'open' && g.keyword) {
      const kw = String(g.keyword).toLowerCase();
      if (!lowerText.includes(kw)) continue;

      // Lazy-load the user doc; user may be missing (chatter never logged in).
      if (userSnap === null) {
        userSnap = await userRef.get();
        userData = userSnap.exists ? userSnap.data() : null;
      }

      const entryRef = gdoc.ref.collection('entries').doc(chatterId);
      const existing = await entryRef.get();
      if (existing.exists) continue; // already entered

      // Follow-gate. Defaults to true so existing giveaways are gated by
      // default; admin can disable per-giveaway via requireFollow: false.
      // Mods/VIPs are exempt (they may not follow but are trusted chat roles).
      const requireFollow = g.requireFollow !== false;
      const isPrivileged = chatRoles.isMod || chatRoles.isVip;
      if (requireFollow && !isPrivileged) {
        const following = await isFollower(chatterId, followerCache);
        // null = check failed; fail-closed (skip entry) to avoid letting
        // unverified chatters in when the Helix call breaks.
        if (following !== true) continue;
      }

      const weight = computeWeight(userData, chatRoles, g);
      await entryRef.set({
        twitchId: chatterId,
        twitchName: userData?.twitchName || chatterLogin,
        displayName: userData?.displayName || chatterName,
        profileImageUrl: userData?.profileImageUrl || null,
        registered: !!userData,
        isTwitchSub: chatRoles.isTwitchSub,
        isVip: chatRoles.isVip,
        isMod: chatRoles.isMod,
        weight,
        source: 'chat',
        enteredAt: FieldValue.serverTimestamp(),
      });
      await gdoc.ref.update({
        entryCount: FieldValue.increment(1),
        totalWeight: FieldValue.increment(weight),
      });
    }
  }
  return { processed: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  if (!verifySignature(req, rawBody)) {
    return res.status(403).json({ error: 'BAD_SIGNATURE' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'BAD_JSON' });
  }

  const messageType = req.headers['twitch-eventsub-message-type'];

  if (messageType === 'webhook_callback_verification') {
    // Must respond with plaintext challenge.
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(body.challenge);
  }

  if (messageType === 'revocation') {
    console.warn('EventSub revoked', body.subscription?.type, body.subscription?.status);
    return res.status(204).end();
  }

  if (messageType !== 'notification') {
    return res.status(204).end();
  }

  // Dedupe.
  const messageId = req.headers['twitch-eventsub-message-id'];
  if (await alreadyProcessed(messageId)) {
    return res.status(204).end();
  }

  const event = body.event;
  const subType = body.subscription?.type;

  try {
    if (subType === 'channel.chat.message') {
      await handleChatMessage(event);
    }
    return res.status(204).end();
  } catch (err) {
    console.error('eventsub handler error', err);
    // Returning 200 even on error to prevent Twitch from retrying indefinitely;
    // the message id dedupe means a retry wouldn't help anyway.
    return res.status(200).json({ ok: false, error: err.message });
  }
}
