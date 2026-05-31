import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Viewer saves their own default-slots profile onto users/{uid}.slotProfile.
// users/{uid} is server-only write (firestore.rules), so this endpoint is the
// sole path for a viewer to persist defaults + the discoverable opt-in.
//
// POST { defaultSlots: string[], discoverable: boolean }
//   Authorization: Bearer <Firebase ID token>

const MAX_SLOTS = 6;
const MAX_SLOT_LEN = 80;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const uid = decoded.uid;

  const { defaultSlots, discoverable } = req.body || {};

  const cleanSlots = (Array.isArray(defaultSlots) ? defaultSlots : [])
    .map((s) => String(s || '').trim().slice(0, MAX_SLOT_LEN))
    .filter(Boolean)
    .slice(0, MAX_SLOTS);

  const userRef = adminDb.collection('users').doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    // Search key: lowercased display name. Prefer the token claim; fall back to
    // the stored profile name. Never trust a client-supplied name here.
    const displayName =
      decoded.twitchName || snap.data()?.displayName || snap.data()?.twitchName || '';
    const twitchNameLower = String(displayName).toLowerCase();

    await userRef.set(
      {
        slotProfile: {
          defaultSlots: cleanSlots,
          discoverable: Boolean(discoverable),
          twitchNameLower,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, defaultSlots: cleanSlots });
  } catch (err) {
    console.error('me/slot-profile error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
