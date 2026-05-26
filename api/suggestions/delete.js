import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Viewer deletes their OWN pending suggestion.
// POST { huntId, suggestionId }
//
// Rules:
//   - Viewer can only delete suggestions they created (twitchId matches)
//   - Only pending suggestions can be deleted — admin-acted ones stay
//   - submittedCount is NOT decremented (lifetime stat)
//   - hunts/{id}.suggestionCount IS decremented (it's a live counter)

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const twitchId = decoded.uid;

  const { huntId, suggestionId } = req.body || {};
  if (!huntId || !suggestionId) {
    return res.status(400).json({ error: 'Missing huntId/suggestionId' });
  }

  const huntRef = adminDb.collection('hunts').doc(huntId);
  const suggRef = huntRef.collection('suggestions').doc(suggestionId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(suggRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const sug = snap.data();
      if (sug.twitchId !== twitchId) throw new Error('FORBIDDEN');
      if (sug.status !== 'pending') throw new Error('LOCKED_BY_ADMIN');
      tx.delete(suggRef);
      tx.update(huntRef, { suggestionCount: FieldValue.increment(-1) });
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    const code = err.message;
    if (code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' });
    if (code === 'FORBIDDEN') return res.status(403).json({ error: 'FORBIDDEN' });
    if (code === 'LOCKED_BY_ADMIN') return res.status(400).json({ error: 'LOCKED_BY_ADMIN' });
    console.error('suggestions/delete error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
