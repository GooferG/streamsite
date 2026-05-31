import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Viewer saves their own Rainbet payout handle onto users/{uid}.payoutProfile.
// users/{uid} is server-only write (firestore.rules), so this endpoint is the
// sole path for a viewer to persist it. Host reads it (self+staff read rule)
// via /api/roster/search. Host is read-only — there is no staff write path.
//
// POST { rainbetUsername: string }
//   Authorization: Bearer <Firebase ID token>
//
// An empty/blank username is allowed and clears the stored handle.

const MAX_LEN = 50;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const uid = decoded.uid;

  const { rainbetUsername } = req.body || {};
  const clean = String(rainbetUsername || '').trim().slice(0, MAX_LEN);

  const userRef = adminDb.collection('users').doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    await userRef.set(
      {
        payoutProfile: {
          rainbetUsername: clean,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, rainbetUsername: clean });
  } catch (err) {
    console.error('me/payout-profile error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
