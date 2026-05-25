import crypto from 'node:crypto';
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';

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

function computeWeight(user, giveaway) {
  const w = giveaway.weights || {};
  let total = Number.isFinite(Number(w.base)) ? Number(w.base) : 1;
  if (w.discord && user.discordVerifiedAt) total += Number(w.discord) || 0;
  if (w.sub && user.isTwitchSub) total += Number(w.sub) || 0;
  if (w.vip && user.isVip) total += Number(w.vip) || 0;
  if (w.mod && user.isMod) total += Number(w.mod) || 0;
  return Math.max(1, Math.floor(total));
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
    if (g.status === 'open' && g.keyword) {
      const kw = String(g.keyword).toLowerCase();
      if (!lowerText.includes(kw)) continue;

      // Lazy-load the user doc (only if any keyword matches).
      if (userSnap === null) {
        userSnap = await userRef.get();
        userData = userSnap.exists ? userSnap.data() : null;
      }
      if (!userData) continue; // viewer not site-registered, ignore entry

      const entryRef = gdoc.ref.collection('entries').doc(chatterId);
      const existing = await entryRef.get();
      if (existing.exists) continue; // already entered

      const weight = computeWeight(userData, g);
      await entryRef.set({
        twitchId: chatterId,
        twitchName: userData.twitchName || chatterLogin,
        displayName: userData.displayName || chatterName,
        profileImageUrl: userData.profileImageUrl || null,
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
