import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors } from '../_lib/verifyAuth.js';

// Public read of a suggestion-intake link's display info. Deliberately omits
// the password hash/salt and owner uid — the submit page only needs the hunt
// name and whether the link is open. The unguessable linkId is the capability.
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const linkId = req.query?.linkId;
  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'MISSING_LINK_ID' });
  }

  try {
    const snap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
    if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const data = snap.data();
    return res.status(200).json({
      huntName: data.huntName || 'Bonus hunt',
      open: data.open !== false,
    });
  } catch (err) {
    console.error('hunt-suggest/info error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
