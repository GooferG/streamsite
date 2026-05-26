import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireOwner } from '../_lib/verifyAuth.js';
import { getAppAccessToken } from '../_lib/twitchBroadcasterToken.js';

// Moderator allowlist management. Owner-only.
//
//   GET    /api/admin/moderators                     -> { mods: [...] }
//   POST   /api/admin/moderators  { twitchName }     -> add (resolves to twitchId via Helix)
//   DELETE /api/admin/moderators?twitchId=...        -> remove
//
// Storage: admin_users/{twitchId}
//   { role: 'moderator', twitchId, twitchName, displayName, profileImageUrl,
//     active: true, addedBy, addedAt, updatedAt }
//
// The mod logs into /admin via Twitch OAuth (same flow as a viewer). The
// admin shell checks admin_users/{firebase.uid} to decide whether to render
// the admin UI. All admin endpoints look up the same doc via requireStaff().

async function lookupTwitchUser(login) {
  const token = await getAppAccessToken();
  const r = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!r.ok) throw new Error(`HELIX_${r.status}`);
  const data = await r.json();
  return data.data?.[0] || null;
}

function shapeDoc(doc) {
  const d = doc.data();
  return {
    twitchId: doc.id,
    twitchName: d.twitchName || null,
    displayName: d.displayName || null,
    profileImageUrl: d.profileImageUrl || null,
    role: d.role,
    active: d.active !== false,
    addedBy: d.addedBy || null,
    addedAt: d.addedAt || null,
  };
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const owner = await requireOwner(req, res);
  if (!owner) return;

  try {
    if (req.method === 'GET') {
      const snap = await adminDb
        .collection('admin_users')
        .where('role', '==', 'moderator')
        .get();
      const mods = snap.docs.map(shapeDoc);
      return res.status(200).json({ mods });
    }

    if (req.method === 'POST') {
      const twitchName = String(req.body?.twitchName || '').trim().toLowerCase();
      if (!twitchName) return res.status(400).json({ error: 'twitchName required' });

      const user = await lookupTwitchUser(twitchName);
      if (!user) return res.status(404).json({ error: 'TWITCH_USER_NOT_FOUND' });

      const ref = adminDb.collection('admin_users').doc(user.id);
      const existing = await ref.get();
      if (existing.exists && existing.data().active !== false) {
        return res.status(409).json({ error: 'ALREADY_MODERATOR' });
      }

      const now = FieldValue.serverTimestamp();
      await ref.set(
        {
          role: 'moderator',
          twitchId: user.id,
          twitchName: user.login,
          displayName: user.display_name || user.login,
          profileImageUrl: user.profile_image_url || null,
          active: true,
          addedBy: owner.email,
          addedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      const fresh = await ref.get();
      return res.status(200).json({ ok: true, mod: shapeDoc(fresh) });
    }

    if (req.method === 'DELETE') {
      const twitchId = String(req.query.twitchId || req.body?.twitchId || '');
      if (!twitchId) return res.status(400).json({ error: 'twitchId required' });
      await adminDb.collection('admin_users').doc(twitchId).delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('moderators error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
