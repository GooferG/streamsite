// The !slot chat command for Goofer Ball (spec: Chat intake). Called from
// api/twitch/eventsub.js for messages that start with !slot. Replies thread
// under the viewer's message; an exact or nickname entry stays silent
// because the ball dropping on stream is the confirmation.
import { adminDb, FieldValue } from './firebaseAdmin.js';
import { getSlotCatalog } from './communityHunts.js';
import { sendChannelMessage } from './twitchChat.js';
import { isFollower, rolesFromBadges } from './chatRoles.js';
import { buildSlotIndex, matchSlot } from './slotMatch.js';
import { CHOICE_TTL_MS, REPLY_COOLDOWN_MS, entryDecision, replyText, slotKey } from './ballRules.js';

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_QUERY = 80;
const COOLDOWN_CAP = 5000;

let catalog = { index: null, at: 0, pending: null };
const lastReply = new Map();

export function __resetSlotCommandForTests() {
  catalog = { index: null, at: 0, pending: null };
  lastReply.clear();
}

// '' for a bare !slot, the argument for !slot <text>, null when the message
// isn't the command (!slots, or text before it).
export function parseSlotCommand(text) {
  const m = /^!slot(?:\s+([\s\S]*))?$/i.exec(String(text || '').trim());
  if (!m) return null;
  return (m[1] || '').trim().slice(0, MAX_QUERY);
}

// The catalogue index, built once per warm instance and refreshed every 6h.
// A failed refresh keeps the old index: a stale list beats refusing everyone.
async function slotIndex(now) {
  if (catalog.index && now - catalog.at < CATALOG_TTL_MS) return catalog.index;
  if (!catalog.pending) {
    catalog.pending = getSlotCatalog()
      .then((rows) => {
        if (!rows || rows.length === 0) throw new Error('EMPTY_CATALOG');
        catalog = { index: buildSlotIndex(rows), at: now, pending: null };
        return catalog.index;
      })
      .catch((err) => {
        catalog.pending = null;
        if (catalog.index) return catalog.index;
        throw err;
      });
  }
  return catalog.pending;
}

const silent = (outcome) => ({ handled: true, outcome, replied: false });

async function reply(event, viewer, code, ctx, now) {
  const last = lastReply.get(viewer.twitchId);
  if (last != null && now - last < REPLY_COOLDOWN_MS) return silent(code);
  if (lastReply.size > COOLDOWN_CAP) lastReply.clear();
  lastReply.set(viewer.twitchId, now);
  try {
    await sendChannelMessage(replyText(code, { ...ctx, name: viewer.displayName }), { replyTo: event.message_id });
  } catch (err) {
    console.warn('slot reply failed', viewer.twitchId, err.message);
  }
  return { handled: true, outcome: code, replied: true };
}

export async function handleSlotCommand(event, { now = Date.now() } = {}) {
  const arg = parseSlotCommand(event && event.message && event.message.text);
  const twitchId = event && event.chatter_user_id;
  if (arg == null || !twitchId) return { handled: false };
  const viewer = {
    twitchId,
    twitchName: String(event.chatter_user_login || '').toLowerCase() || null,
    displayName: event.chatter_user_name || event.chatter_user_login || 'viewer',
  };

  const open = await adminDb.collection('ball_rounds').where('status', '==', 'open').limit(1).get();
  if (open.empty) return silent('NO_ROUND');
  const roundRef = open.docs[0].ref;
  const round = open.docs[0].data();
  const say = (code, ctx = {}) => reply(event, viewer, code, ctx, now);

  // Followers only by default; mods and VIPs are trusted (the giveaway rule).
  if (round.requireFollow !== false) {
    const roles = rolesFromBadges(event.badges);
    if (!roles.isMod && !roles.isVip && (await isFollower(twitchId, new Map())) !== true) {
      return say('NOT_FOLLOWING');
    }
  }

  const ballRef = roundRef.collection('balls').doc(twitchId);
  if (arg === '') {
    const snap = await ballRef.get();
    if (!snap.exists) return say('HOW_TO');
    const mine = snap.data();
    return say('STATUS', { slotName: mine.slotName, status: mine.status });
  }

  let slot = null;
  let guessed = false;
  if (/^[1-3]$/.test(arg)) {
    const snap = await roundRef.collection('choices').doc(twitchId).get();
    const choice = snap.exists ? snap.data() : null;
    const fresh = !!choice && Number.isFinite(choice.createdAtMs) && now - choice.createdAtMs < CHOICE_TTL_MS;
    slot = fresh ? (choice.options || [])[Number(arg) - 1] || null : null;
    if (!slot) return say('BAD_PICK');
  } else {
    let index;
    try {
      index = await slotIndex(now);
    } catch (err) {
      console.warn('slot catalogue unavailable', err.message);
      return say('CATALOG_DOWN');
    }
    const match = matchSlot(index, arg);
    if (match.kind === 'none') return say('NOT_FOUND', { query: arg });
    if (match.kind === 'ambiguous') {
      await roundRef.collection('choices').doc(twitchId).set({ options: match.options, createdAtMs: now });
      return say('AMBIGUOUS', { options: match.options });
    }
    slot = match.slot;
    guessed = match.kind === 'guess';
  }
  if (!slot.bonusBuy) return say('NO_BONUS_BUY', { slotName: slot.name });

  const claims = roundRef.collection('claims');
  const claimRef = claims.doc(slotKey(slot.id));
  // Only the viewer's ball and the slot's claim. Entries never touch the
  // round doc, so a !slot rush can't hold up a draw; a draw that lands on
  // this ball mid-swap makes the transaction retry and see it drawn.
  const decision = await adminDb.runTransaction(async (tx) => {
    const [ballSnap, claimSnap] = await Promise.all([tx.get(ballRef), tx.get(claimRef)]);
    const current = ballSnap.exists ? ballSnap.data() : null;
    const claim = claimSnap.exists ? claimSnap.data() : null;
    const d = entryDecision({ ball: current, claim, slotId: slot.id, twitchId });
    if (d.code !== 'NEW' && d.code !== 'SWAP') return d;
    const ts = FieldValue.serverTimestamp();
    if (d.code === 'SWAP') tx.delete(claims.doc(slotKey(current.slotId)));
    tx.set(claimRef, { twitchId, displayName: viewer.displayName, scratched: false, createdAt: ts });
    tx.set(ballRef, {
      twitchId,
      twitchName: viewer.twitchName,
      displayName: viewer.displayName,
      slotId: slot.id,
      slotName: slot.name,
      thumb: slot.thumb || null,
      status: 'drum',
      drawNo: null,
      enteredAt: (d.code === 'SWAP' && current.enteredAt) || ts,
      updatedAt: ts,
    });
    return d;
  });

  switch (decision.code) {
    case 'NEW':
      return guessed ? say('GUESS', { slotName: slot.name }) : silent('NEW');
    case 'SWAP':
      return say('SWAP', { slotName: slot.name });
    case 'TAKEN':
      return say('TAKEN', { slotName: slot.name, holder: decision.holder });
    case 'SCRATCHED':
      return say('SCRATCHED', { slotName: slot.name });
    case 'ALREADY_DRAWN':
      return say('ALREADY_DRAWN', { slotName: decision.slotName });
    default:
      return silent(decision.code);
  }
}
