import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const twitchId = decoded.uid;

  const { itemId } = req.body || {};
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'Missing itemId' });
  }

  const userRef = adminDb.collection('users').doc(twitchId);
  const itemRef = adminDb.collection('store_items').doc(itemId);
  const redemptionRef = adminDb.collection('redemptions').doc();
  const ledgerRef = adminDb.collection('ticket_ledger').doc();

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const [userSnap, itemSnap] = await Promise.all([tx.get(userRef), tx.get(itemRef)]);
      if (!userSnap.exists) throw new Error('USER_NOT_FOUND');
      if (!itemSnap.exists) throw new Error('ITEM_NOT_FOUND');

      const user = userSnap.data();
      const item = itemSnap.data();
      if (!item.active) throw new Error('ITEM_INACTIVE');

      const cost = Number(item.cost) || 0;
      if (cost <= 0) throw new Error('ITEM_INVALID_COST');
      if ((user.tickets || 0) < cost) throw new Error('INSUFFICIENT_TICKETS');
      if (item.stock !== null && item.stock !== undefined && item.stock <= 0) {
        throw new Error('OUT_OF_STOCK');
      }

      const fulfillImmediately = item.kind === 'virtual';
      const now = FieldValue.serverTimestamp();

      tx.update(userRef, {
        tickets: FieldValue.increment(-cost),
        totalSpent: FieldValue.increment(cost),
        updatedAt: now,
      });

      if (item.stock !== null && item.stock !== undefined) {
        tx.update(itemRef, { stock: FieldValue.increment(-1), updatedAt: now });
      }

      tx.set(redemptionRef, {
        userId: twitchId,
        twitchName: user.twitchName || null,
        displayName: user.displayName || null,
        profileImageUrl: user.profileImageUrl || null,
        itemId,
        itemName: item.name,
        cost,
        kind: item.kind,
        status: fulfillImmediately ? 'fulfilled' : 'pending',
        note: null,
        createdAt: now,
        fulfilledAt: fulfillImmediately ? now : null,
      });

      tx.set(ledgerRef, {
        userId: twitchId,
        delta: -cost,
        reason: 'redeem',
        refId: redemptionRef.id,
        itemName: item.name,
        createdAt: now,
      });

      return {
        redemptionId: redemptionRef.id,
        kind: item.kind,
        status: fulfillImmediately ? 'fulfilled' : 'pending',
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const code = err.message;
    const known = {
      USER_NOT_FOUND: 404,
      ITEM_NOT_FOUND: 404,
      ITEM_INACTIVE: 400,
      ITEM_INVALID_COST: 400,
      INSUFFICIENT_TICKETS: 400,
      OUT_OF_STOCK: 400,
    };
    if (known[code]) return res.status(known[code]).json({ error: code });
    console.error('redeem error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
