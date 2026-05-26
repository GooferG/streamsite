import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

// Admin updates the status of a hunt suggestion, with atomic counter
// rebalancing on the suggester's users/{twitchId}.stats.suggestions doc.
//
// POST { huntId, suggestionId, status, adminNote? }
//
// Status transitions: pending <-> added <-> played-bonus | played-no-bonus | skipped
// All transitions are allowed (so admin can undo).

const STATUSES = [
  'pending',
  'added',
  'played-bonus',
  'played-no-bonus',
  'skipped',
];

// Map status -> the user-stat counter that tracks it. `pending` and `added`
// are tracked separately; the played/skipped statuses contribute to specific
// lifetime counters.
const STATUS_COUNTER = {
  pending: null, // pending has no separate counter (it's the default)
  added: 'addedCount',
  'played-bonus': 'bonusHitCount',
  'played-no-bonus': 'bonusMissCount',
  skipped: 'skippedCount',
};

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { huntId, suggestionId, status, adminNote } = req.body || {};
  if (!huntId || !suggestionId) {
    return res.status(400).json({ error: 'Missing huntId/suggestionId' });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'INVALID_STATUS' });
  }

  const huntRef = adminDb.collection('hunts').doc(huntId);
  const suggRef = huntRef.collection('suggestions').doc(suggestionId);

  try {
    await adminDb.runTransaction(async (tx) => {
      // ALL reads must happen before any writes in a Firestore transaction.
      const snap = await tx.get(suggRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const sug = snap.data();
      const prevStatus = sug.status || 'pending';
      if (prevStatus === status && !adminNote) {
        // No-op — same status, no note change.
        return;
      }

      const userRef = adminDb.collection('users').doc(sug.twitchId);
      const userSnap = await tx.get(userRef);

      // Now writes.
      const ts = FieldValue.serverTimestamp();

      const update = {
        status,
        updatedAt: ts,
        adminUpdatedAt: ts,
        adminUpdatedBy: admin.email,
      };
      if (typeof adminNote === 'string') {
        update.adminNote = adminNote.trim().slice(0, 200) || null;
      }
      tx.update(suggRef, update);

      if (userSnap.exists) {
        const updates = { 'stats.suggestions.lastUpdated': ts };
        const prevCounter = STATUS_COUNTER[prevStatus];
        const nextCounter = STATUS_COUNTER[status];
        if (prevCounter) {
          updates[`stats.suggestions.${prevCounter}`] =
            FieldValue.increment(-1);
        }
        if (nextCounter) {
          updates[`stats.suggestions.${nextCounter}`] = FieldValue.increment(1);
        }
        tx.update(userRef, updates);
      }
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    const code = err.message;
    if (code === 'NOT_FOUND')
      return res.status(404).json({ error: 'NOT_FOUND' });
    console.error('admin/suggestions error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
