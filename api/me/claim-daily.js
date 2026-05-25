import { adminDb, FieldValue, Timestamp } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

const DAILY_AWARD = Number(process.env.DAILY_TICKET_AWARD) || 10;
const COOLDOWN_MS = 22 * 60 * 60 * 1000; // 22h — small grace so claiming "same time next day" works

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const twitchId = decoded.uid;

  const userRef = adminDb.collection('users').doc(twitchId);
  const ledgerRef = adminDb.collection('ticket_ledger').doc();

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('USER_NOT_FOUND');
      const user = snap.data();
      const last = user.lastDailyClaimAt instanceof Timestamp
        ? user.lastDailyClaimAt.toMillis()
        : 0;
      const now = Date.now();
      if (now - last < COOLDOWN_MS) {
        const nextAt = last + COOLDOWN_MS;
        throw new Error(`COOLDOWN:${nextAt}`);
      }
      const ts = FieldValue.serverTimestamp();
      tx.update(userRef, {
        tickets: FieldValue.increment(DAILY_AWARD),
        totalEarned: FieldValue.increment(DAILY_AWARD),
        lastDailyClaimAt: ts,
        updatedAt: ts,
      });
      tx.set(ledgerRef, {
        userId: twitchId,
        delta: DAILY_AWARD,
        reason: 'daily',
        createdAt: ts,
      });
      return { awarded: DAILY_AWARD };
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (err.message?.startsWith('COOLDOWN:')) {
      const nextAt = Number(err.message.split(':')[1]);
      return res.status(429).json({ error: 'COOLDOWN', nextAt });
    }
    console.error('claim-daily error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
