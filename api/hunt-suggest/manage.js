import crypto from 'crypto';
import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Owner-driven control of a hunt's suggestion-intake link.
//
// POST actions (Authorization: Bearer <Firebase ID token>):
//   { action: 'create', password }  -> mint a link for the caller's active hunt
//   { action: 'toggle', linkId, open }
//   { action: 'close',  linkId }    -> open:false (alias of toggle)
//   { action: 'delete', linkId }
//
// The link is owned by the authed user (uid). Submissions land in
// users/{uid}/active_hunt/current. The raw password is hashed here and never
// stored or returned after creation.

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

function makeLinkId() {
  // 18 bytes -> 24 url-safe chars. Unguessable capability.
  return crypto.randomBytes(18).toString('base64url');
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const uid = decoded.uid;

  const { action } = req.body || {};

  try {
    if (action === 'create') {
      const { password } = req.body || {};
      // Password is OPTIONAL. If provided it must be >= 8 chars; if omitted/empty
      // the link is open (no hash stored — absence is the "open" state).
      const wantsPassword = Boolean(password);
      if (wantsPassword && String(password).length < 8) {
        return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
      }
      // Pull the active hunt name for display on the submit page.
      const activeSnap = await adminDb
        .doc(`users/${uid}/active_hunt/current`)
        .get();
      if (!activeSnap.exists) return res.status(404).json({ error: 'NO_ACTIVE_HUNT' });
      const huntName = activeSnap.data()?.name || 'Bonus hunt';

      const salt = wantsPassword ? crypto.randomBytes(16).toString('hex') : null;
      const passwordHash = wantsPassword ? hashPassword(password, salt) : null;

      // Idempotency: if this owner already has an open intake link, reuse it
      // instead of minting a duplicate on retry. Query is by ownerUid only
      // (single-field, auto-indexed); filter open in code.
      const existing = await adminDb
        .collection('suggestion_intakes')
        .where('ownerUid', '==', uid)
        .get();
      const reuse = existing.docs.find((d) => d.data().open !== false);
      if (reuse) {
        // When recreating with a password, set hash/salt. When recreating as
        // open, DELETE any stale hash/salt so the old password stops working.
        const patch = wantsPassword
          ? { huntName, passwordHash, passwordSalt: salt, open: true }
          : {
              huntName,
              passwordHash: FieldValue.delete(),
              passwordSalt: FieldValue.delete(),
              open: true,
            };
        await reuse.ref.update(patch);
        return res
          .status(200)
          .json({ ok: true, linkId: reuse.id, open: true, reused: true });
      }

      const linkId = makeLinkId();
      const docData = {
        ownerUid: uid,
        huntName,
        open: true,
        createdAt: FieldValue.serverTimestamp(),
      };
      // Only write hash/salt for password-protected links.
      if (wantsPassword) {
        docData.passwordHash = passwordHash;
        docData.passwordSalt = salt;
      }
      await adminDb.doc(`suggestion_intakes/${linkId}`).set(docData);

      return res.status(200).json({ ok: true, linkId, open: true });
    }

    // All other actions operate on an existing link the caller owns.
    const { linkId } = req.body || {};
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({ error: 'MISSING_LINK_ID' });
    }
    const ref = adminDb.doc(`suggestion_intakes/${linkId}`);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    if (snap.data().ownerUid !== uid) return res.status(403).json({ error: 'NOT_OWNER' });

    if (action === 'toggle' || action === 'close') {
      const open = action === 'close' ? false : Boolean(req.body.open);
      await ref.update({ open });
      return res.status(200).json({ ok: true, open });
    }

    if (action === 'delete') {
      await ref.delete();
      return res.status(200).json({ ok: true, deleted: true });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    console.error('hunt-suggest/manage error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
