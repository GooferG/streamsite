// The public order feed (store_public/feed): the last few orders, read by the
// store's chyron. Only display name, item name and time leave the server.
// Writes are best effort and run after the order (or refund) has committed,
// so a feed problem can never fail or roll back the real transaction.
export const FEED_SIZE = 8;

export function pushOrder(orders, entry) {
  const rest = (orders || []).filter((o) => o.id !== entry.id);
  return [entry, ...rest].slice(0, FEED_SIZE);
}

export function dropOrder(orders, id) {
  return (orders || []).filter((o) => o.id !== id);
}

const feedRef = (db) => db.collection('store_public').doc('feed');

export async function recordOrder(db, entry) {
  try {
    const ref = feedRef(db);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const orders = snap.exists ? snap.data().orders : [];
      tx.set(ref, { orders: pushOrder(orders, entry), updatedAt: entry.at });
    });
  } catch (err) {
    console.error('store feed write failed', err);
  }
}

export async function forgetOrder(db, id) {
  try {
    const ref = feedRef(db);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const orders = snap.data().orders || [];
      const next = dropOrder(orders, id);
      if (next.length !== orders.length) tx.set(ref, { orders: next, updatedAt: Date.now() });
    });
  } catch (err) {
    console.error('store feed cleanup failed', err);
  }
}
