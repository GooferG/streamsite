import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Viewer submits a slot suggestion to a community hunt.
// POST { huntId, slotName, note? }
//
// Validates:
//   - Hunt exists, has acceptSuggestions enabled
//   - Hunt is still in 'open' status (predictions-state, but we reuse it as
//     "the hunt is accepting input"). Locked/settled hunts close suggestions.
//   - Viewer is under their per-hunt cap
//   - slotName is non-empty
//
// Side effects:
//   - Writes hunts/{id}/suggestions/{auto-id}
//   - Increments hunts/{id}.suggestionCount
//   - Increments users/{twitchId}.stats.suggestions.submittedCount

const MAX_SLOT_NAME = 80;
const MAX_NOTE = 200;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const twitchId = decoded.uid;

  const { huntId, slotName, note } = req.body || {};
  if (!huntId || typeof huntId !== 'string') {
    return res.status(400).json({ error: 'Missing huntId' });
  }
  const slot = String(slotName || '').trim().slice(0, MAX_SLOT_NAME);
  if (!slot) return res.status(400).json({ error: 'INVALID_SLOT_NAME' });
  const noteTrim = note ? String(note).trim().slice(0, MAX_NOTE) || null : null;

  const huntRef = adminDb.collection('hunts').doc(huntId);
  const userRef = adminDb.collection('users').doc(twitchId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const [huntSnap, userSnap] = await Promise.all([
        tx.get(huntRef),
        tx.get(userRef),
      ]);
      if (!huntSnap.exists) throw new Error('HUNT_NOT_FOUND');
      const hunt = huntSnap.data();
      if (!hunt.acceptSuggestions) throw new Error('SUGGESTIONS_DISABLED');
      if (hunt.status !== 'open') throw new Error('NOT_OPEN');

      // Per-viewer cap: count this viewer's existing suggestions.
      const myExistingSnap = await tx.get(
        huntRef.collection('suggestions').where('twitchId', '==', twitchId)
      );
      const cap = Number(hunt.suggestionCap) || 0;
      if (cap > 0 && myExistingSnap.size >= cap) {
        throw new Error(`CAP_REACHED:${cap}`);
      }

      const user = userSnap.exists ? userSnap.data() : null;
      const ts = FieldValue.serverTimestamp();
      const suggRef = huntRef.collection('suggestions').doc();

      tx.set(suggRef, {
        twitchId,
        twitchName: user?.twitchName || decoded.twitchLogin || null,
        displayName: user?.displayName || decoded.twitchName || null,
        profileImageUrl: user?.profileImageUrl || decoded.profileImageUrl || null,
        slotName: slot,
        note: noteTrim,
        status: 'pending',
        adminNote: null,
        submittedAt: ts,
        updatedAt: ts,
        adminUpdatedAt: null,
      });
      tx.update(huntRef, {
        suggestionCount: FieldValue.increment(1),
      });

      // Always increment lifetime submittedCount on the user doc. If the
      // user doc doesn't exist (viewer just signed in), skip — they'll get
      // counters initialized on next Twitch login (twitch-auth ensures the
      // doc exists). In practice the auth flow always upserts a user doc.
      if (userSnap.exists) {
        tx.update(userRef, {
          'stats.suggestions.submittedCount': FieldValue.increment(1),
          'stats.suggestions.lastUpdated': ts,
        });
      }

      return { id: suggRef.id, used: myExistingSnap.size + 1, cap };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const code = err.message;
    if (code === 'HUNT_NOT_FOUND') return res.status(404).json({ error: 'HUNT_NOT_FOUND' });
    if (code === 'SUGGESTIONS_DISABLED') return res.status(400).json({ error: 'SUGGESTIONS_DISABLED' });
    if (code === 'NOT_OPEN') return res.status(400).json({ error: 'NOT_OPEN' });
    if (code?.startsWith('CAP_REACHED:')) {
      const cap = Number(code.split(':')[1]);
      return res.status(429).json({ error: 'CAP_REACHED', cap });
    }
    console.error('suggestions/submit error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
