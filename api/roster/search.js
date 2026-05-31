import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Host searches opted-in viewers by display-name prefix. Returns viewers whose
// slotProfile.discoverable == true and whose twitchNameLower starts with q.
// Requires the users composite index (firestore.indexes.json).
//
// GET /api/roster/search?q=<prefix>   Authorization: Bearer <Firebase ID token>

const MAX_RESULTS = 10;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(200).json({ results: [] });

  try {
    const snap = await adminDb
      .collection('users')
      .where('slotProfile.discoverable', '==', true)
      .where('slotProfile.twitchNameLower', '>=', q)
      // '\uf8ff' is a very-high code point that sorts after any normal
      // character — the standard Firestore prefix-range upper bound.
      .where('slotProfile.twitchNameLower', '<', q + '\uf8ff')
      .limit(MAX_RESULTS)
      .get();

    const results = snap.docs
      .map((d) => {
        const data = d.data();
        const defaultSlots = Array.isArray(data.slotProfile?.defaultSlots)
          ? data.slotProfile.defaultSlots.filter(Boolean)
          : [];
        return {
          twitchId: d.id,
          twitchName: data.displayName || data.twitchName || 'Viewer',
          defaultSlots,
        };
      })
      // A discoverable profile with no slots has nothing to add — hide it.
      .filter((r) => r.defaultSlots.length > 0);

    return res.status(200).json({ results });
  } catch (err) {
    console.error('roster/search error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
