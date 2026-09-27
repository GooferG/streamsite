import { adminDb } from './firebaseAdmin.js';
import { windowId } from './watchtime.js';

// Firestore I/O for live watch time. Every decision is made by the pure
// functions in ./watchtime.js; this file only reads and writes.
//
//   watch_chat/{windowId}       who chatted in a window (id -> login)
//   watch_sessions/{streamId}   per-stream viewer counters
//   watch_bank/{twitchId}       tickets for chatters without an account yet

const CHAT = 'watch_chat';

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
