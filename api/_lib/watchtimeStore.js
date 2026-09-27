import { adminDb, FieldValue } from './firebaseAdmin.js';
import { windowId, applyWindow, planSettlement, formatDuration } from './watchtime.js';

// Firestore I/O for live watch time. Every decision is made by the pure
// functions in ./watchtime.js; this file only reads and writes.
//
//   watch_chat/{windowId}       who chatted in a window (id -> login)
//   watch_sessions/{streamId}   per-stream viewer counters
//   watch_bank/{twitchId}       tickets for chatters without an account yet

const CHAT = 'watch_chat';
const SESSIONS = 'watch_sessions';
const BANK = 'watch_bank';
// Viewers per payout transaction: at most 2 writes each plus 1 session write,
// under Firestore's 500-write transaction limit.
const SETTLE_CHUNK = 200;
const DELETE_CHUNK = 400;

// Record that a viewer chatted in the current window. Reads first so a
// talkative viewer costs one write per window, not one per message.
export async function markChatted(chatterId, chatterLogin, now = Date.now()) {
  const window = windowId(now);
  const ref = adminDb.collection(CHAT).doc(String(window));
  const snap = await ref.get();
  const chatters = (snap.exists && snap.data().chatters) || {};
  if (Object.prototype.hasOwnProperty.call(chatters, chatterId)) return false;
  await ref.set({ window, chatters: { [chatterId]: chatterLogin || null } }, { merge: true });
  return true;
}

// Chat markers for every window before `currentWindow`. Only the `completed`
// window counts toward the chat bonus; older ones (missed ticks, chat while
// offline) are just returned for deletion.
export async function takeChatMarkers(currentWindow, completed) {
  const snap = await adminDb.collection(CHAT).where('window', '<', currentWindow).get();
  const chatted = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.window !== completed) return;
    Object.entries(data.chatters || {}).forEach(([id, login]) => chatted.set(id, login));
  });
  return { chatted, refs: snap.docs.map((d) => d.ref) };
}

export async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += DELETE_CHUNK) {
    const batch = adminDb.batch();
    refs.slice(i, i + DELETE_CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function openSessionIds() {
  const snap = await adminDb.collection(SESSIONS).where('status', '==', 'open').get();
  return snap.docs.map((d) => d.id);
}

// Credit one window onto the stream's session: a single document write no
// matter how many people are in chat. Returns false when the window was
// already credited (duplicate or late cron run).
export async function creditSession(streamId, { completed, present, chatted }) {
  const ref = adminDb.collection(SESSIONS).doc(streamId);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = applyWindow(snap.exists ? snap.data() : null, { completed, present, chatted });
    if (!next) return false;
    if (next.isNew) {
      tx.set(ref, {
        streamId,
        status: 'open',
        startedAt: FieldValue.serverTimestamp(),
        lastWindow: next.lastWindow,
        lastSettledAt: null,
        closedAt: null,
        viewers: next.viewers,
      });
    } else {
      // A session closed by an offline blip reopens when the same stream id
      // comes back; payouts are incremental, so nothing is paid twice.
      tx.update(ref, {
        status: 'open',
        closedAt: null,
        lastWindow: next.lastWindow,
        viewers: next.viewers,
      });
    }
    return true;
  });
}

// Pay out what a session owes. Each chunk is its own transaction that
// re-reads the session, so two payouts running at once (a duplicate cron
// fire) serialize and the second owes nothing. A crash between chunks leaves
// the rest for the next payout.
export async function settleSession(streamId, rates, { close = false } = {}) {
  const ref = adminDb.collection(SESSIONS).doc(streamId);
  const first = await ref.get();
  if (!first.exists) return { accounts: 0, banked: 0 };
  const ids = Object.keys(first.data().viewers || {});
  let accounts = 0;
  let banked = 0;

  for (let i = 0; i < ids.length; i += SETTLE_CHUNK) {
    const chunk = ids.slice(i, i + SETTLE_CHUNK);
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const users = await tx.getAll(...chunk.map((id) => adminDb.collection('users').doc(id)));
      const hasAccount = new Set(users.filter((u) => u.exists).map((u) => u.id));
      const plan = planSettlement(snap.data().viewers || {}, chunk, hasAccount, rates);
      if (plan.accountCredits.length === 0 && plan.bankCredits.length === 0) {
        return { accounts: 0, banked: 0 };
      }
      const now = FieldValue.serverTimestamp();
      plan.accountCredits.forEach((c) => {
        tx.update(adminDb.collection('users').doc(c.id), {
          tickets: FieldValue.increment(c.tickets),
          totalEarned: FieldValue.increment(c.tickets),
          watchMinutes: FieldValue.increment(c.minutes),
          updatedAt: now,
        });
        const line = {
          userId: c.id,
          reason: 'watchtime',
          refId: streamId,
          delta: c.ledger.delta,
          minutes: c.ledger.minutes,
          note: c.ledger.note,
          updatedAt: now,
        };
        // The history view orders by createdAt; set it once so the line keeps
        // its place while it grows through the stream.
        if (c.ledger.first) line.createdAt = now;
        tx.set(adminDb.collection('ticket_ledger').doc(`watch_${streamId}_${c.id}`), line, {
          merge: true,
        });
      });
      plan.bankCredits.forEach((c) => {
        tx.set(
          adminDb.collection(BANK).doc(c.id),
          {
            login: c.login,
            tickets: FieldValue.increment(c.tickets),
            minutes: FieldValue.increment(c.minutes),
            updatedAt: now,
          },
          { merge: true }
        );
      });
      tx.update(ref, { viewers: plan.viewers });
      return { accounts: plan.accountCredits.length, banked: plan.bankCredits.length };
    });
    accounts += result.accounts;
    banked += result.banked;
  }

  const done = { lastSettledAt: FieldValue.serverTimestamp() };
  if (close) {
    done.status = 'closed';
    done.closedAt = FieldValue.serverTimestamp();
  }
  await ref.update(done);
  return { accounts, banked };
}

// Move tickets banked before the viewer had an account into their balance.
// Runs on every login (api/twitch-auth.js), which also picks up anything a
// payout banked while their first login was in flight.
export async function claimWatchBank(twitchId) {
  const bankRef = adminDb.collection(BANK).doc(twitchId);
  const userRef = adminDb.collection('users').doc(twitchId);
  return adminDb.runTransaction(async (tx) => {
    const [bank, user] = await tx.getAll(bankRef, userRef);
    if (!bank.exists || !user.exists) return null;
    const tickets = Math.max(0, Math.floor(Number(bank.data().tickets) || 0));
    const minutes = Math.max(0, Math.floor(Number(bank.data().minutes) || 0));
    tx.delete(bankRef);
    if (tickets === 0 && minutes === 0) return null;
    const now = FieldValue.serverTimestamp();
    tx.update(userRef, {
      tickets: FieldValue.increment(tickets),
      totalEarned: FieldValue.increment(tickets),
      watchMinutes: FieldValue.increment(minutes),
      updatedAt: now,
    });
    tx.set(adminDb.collection('ticket_ledger').doc(), {
      userId: twitchId,
      delta: tickets,
      reason: 'watchtime_banked',
      minutes,
      note: `Watch time before you signed up: ${formatDuration(minutes)}`,
      createdAt: now,
    });
    return { tickets, minutes };
  });
}
