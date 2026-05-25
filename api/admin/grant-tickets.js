import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { twitchId, delta, reason, note } = req.body || {};
  const deltaNum = Number(delta);
  if (!twitchId || typeof twitchId !== 'string') {
    return res.status(400).json({ error: 'Missing twitchId' });
  }
  if (!Number.isInteger(deltaNum) || deltaNum === 0) {
    return res.status(400).json({ error: 'delta must be a non-zero integer' });
  }

  const userRef = adminDb.collection('users').doc(twitchId);
  const ledgerRef = adminDb.collection('ticket_ledger').doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('USER_NOT_FOUND');
      const user = snap.data();
      const newBalance = (user.tickets || 0) + deltaNum;
      if (newBalance < 0) throw new Error('NEGATIVE_BALANCE');

      const now = FieldValue.serverTimestamp();
      tx.update(userRef, {
        tickets: FieldValue.increment(deltaNum),
        ...(deltaNum > 0
          ? { totalEarned: FieldValue.increment(deltaNum) }
          : { totalSpent: FieldValue.increment(-deltaNum) }),
        updatedAt: now,
      });
      tx.set(ledgerRef, {
        userId: twitchId,
        delta: deltaNum,
        reason: reason || 'admin_grant',
        note: note || null,
        grantedBy: admin.email,
        createdAt: now,
      });
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (err.message === 'NEGATIVE_BALANCE') return res.status(400).json({ error: 'NEGATIVE_BALANCE' });
    console.error('grant-tickets error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
