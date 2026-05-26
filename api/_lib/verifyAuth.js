import { adminAuth, adminDb } from './firebaseAdmin.js';

const ADMIN_EMAIL = 'luimeneghim@gmail.com';

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Verify the Authorization: Bearer <Firebase ID token> header.
 * Returns the decoded token or sends a 401 and returns null.
 */
export async function requireAuth(req, res) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) {
    res.status(401).json({ error: 'Missing bearer token' });
    return null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    return decoded;
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

/**
 * Resolve the actor's role.
 *
 *   - Email/password sign-in with ADMIN_EMAIL  -> owner
 *   - Twitch custom-token sign-in where the Twitch user id has an active
 *     entry under admin_users/{twitchId} -> moderator
 *
 * Returns a normalized actor object:
 *   { role, email, uid, twitchId, twitchName, actorLabel }
 * `actorLabel` is what we record on audit fields (createdBy / actedBy).
 *
 * Returns null when the token is missing or the user isn't authorized.
 * In the null case the response has already been sent (401/403).
 */
export async function resolveActor(req, res, { ownerOnly = false } = {}) {
  const decoded = await requireAuth(req, res);
  if (!decoded) return null;

  // Owner check first — fastest path, no Firestore read.
  if (decoded.email === ADMIN_EMAIL) {
    return {
      role: 'owner',
      email: decoded.email,
      uid: decoded.uid,
      twitchId: null,
      twitchName: null,
      actorLabel: decoded.email,
    };
  }

  if (ownerOnly) {
    res.status(403).json({ error: 'Owner only' });
    return null;
  }

  // Moderator check. Twitch viewers sign in with custom tokens minted in
  // /api/twitch-auth; uid is the Twitch user id. We look up admin_users/{uid}.
  const twitchId = decoded.uid;
  const twitchName = decoded.twitchLogin || decoded.twitchName || null;
  const snap = await adminDb.collection('admin_users').doc(twitchId).get();
  if (!snap.exists) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  const data = snap.data();
  if (data?.role !== 'moderator' || data?.active === false) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  const label = data.twitchName
    ? `mod:${data.twitchName}`
    : `mod:${twitchId}`;
  return {
    role: 'moderator',
    email: null,
    uid: decoded.uid,
    twitchId,
    twitchName: data.twitchName || twitchName,
    actorLabel: label,
  };
}

/** Owner-only gate. Sends 401/403 on failure and returns null. */
export async function requireOwner(req, res) {
  return resolveActor(req, res, { ownerOnly: true });
}

/** Owner or moderator gate. Sends 401/403 on failure and returns null. */
export async function requireStaff(req, res) {
  return resolveActor(req, res, { ownerOnly: false });
}

/**
 * Legacy alias used by older endpoints — equivalent to requireStaff. Existing
 * call sites that read `admin.email` continue to work for the owner; mods get
 * actorLabel via the same field shape.
 *
 * Kept so callers that reference `admin.email` for `createdBy` audit fields
 * receive a sensible string in both owner and mod cases.
 */
export async function requireAdmin(req, res) {
  const actor = await requireStaff(req, res);
  if (!actor) return null;
  // Back-compat surface: callers historically read `.email`. For mods we
  // expose `actorLabel` here so audit writes like `createdBy: admin.email`
  // get a non-null identifier.
  return {
    ...actor,
    email: actor.email || actor.actorLabel,
  };
}

export { ADMIN_EMAIL };
