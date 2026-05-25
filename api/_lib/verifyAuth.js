import { adminAuth } from './firebaseAdmin.js';

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
 * Admin == Firebase Auth user signed in with the admin email (email/password).
 * Twitch viewer auth uses custom tokens minted from /api/twitch-auth and does NOT
 * have an email claim, so this naturally rejects viewers.
 */
export async function requireAdmin(req, res) {
  const decoded = await requireAuth(req, res);
  if (!decoded) return null;
  if (decoded.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return decoded;
}

export { ADMIN_EMAIL };
