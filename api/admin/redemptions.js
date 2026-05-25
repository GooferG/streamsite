import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id, action, note } = req.body || {};
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
  if (!['fulfill', 'cancel'].includes(action)) {
    return res.status(400).json({ error: 'action must be fulfill|cancel' });
  }

  const ref = adminDb.collection('redemptions').doc(id);

  try {
    if (action === 'fulfill') {
      await ref.update({
        status: 'fulfilled',
        note: note || null,
        fulfilledAt: FieldValue.serverTimestamp(),
        fulfilledBy: admin.email,
      });
      return res.status(200).json({ ok: true });
    }

    // Cancel: refund tickets, restore stock if tracked.
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const r = snap.data();
      if (r.status !== 'pending') throw new Error('NOT_PENDING');

      const now = FieldValue.serverTimestamp();
      const userRef = adminDb.collection('users').doc(r.userId);
      const itemRef = adminDb.collection('store_items').doc(r.itemId);
      const ledgerRef = adminDb.collection('ticket_ledger').doc();

      const itemSnap = await tx.get(itemRef);

      tx.update(userRef, {
        tickets: FieldValue.increment(r.cost),
        totalSpent: FieldValue.increment(-r.cost),
        updatedAt: now,
      });
      if (itemSnap.exists) {
        const item = itemSnap.data();
        if (item.stock !== null && item.stock !== undefined) {
          tx.update(itemRef, { stock: FieldValue.increment(1), updatedAt: now });
        }
      }
      tx.set(ledgerRef, {
        userId: r.userId,
        delta: r.cost,
        reason: 'refund',
        refId: id,
        itemName: r.itemName,
        createdAt: now,
      });
      tx.update(ref, {
        status: 'cancelled',
        note: note || null,
        cancelledAt: now,
        cancelledBy: admin.email,
      });
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' });
    if (err.message === 'NOT_PENDING') return res.status(400).json({ error: 'NOT_PENDING' });
    console.error('redemptions admin error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
