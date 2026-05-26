import { adminDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { applyCors, requireOwner } from '../_lib/verifyAuth.js';

const KINDS = ['virtual', 'stream'];

function sanitize(body) {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const cost = Number(body.cost);
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  const stockRaw = body.stock;
  const stock =
    stockRaw === null || stockRaw === undefined || stockRaw === ''
      ? null
      : Number(stockRaw);
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const active = body.active !== false;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!name) return { error: 'name required' };
  if (!kind) return { error: 'kind must be virtual|stream' };
  if (!Number.isInteger(cost) || cost <= 0) return { error: 'cost must be positive integer' };
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    return { error: 'stock must be null or non-negative integer' };
  }
  return { data: { name, description, cost, kind, stock, imageUrl, active, sortOrder } };
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = await requireOwner(req, res);
  if (!admin) return;

  const col = adminDb.collection('store_items');

  if (req.method === 'POST') {
    const { error, data } = sanitize(req.body || {});
    if (error) return res.status(400).json({ error });
    const now = FieldValue.serverTimestamp();
    const ref = await col.add({ ...data, createdAt: now, updatedAt: now });
    return res.status(200).json({ ok: true, id: ref.id });
  }

  if (req.method === 'PUT') {
    const { id, ...rest } = req.body || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    const { error, data } = sanitize(rest);
    if (error) return res.status(400).json({ error });
    await col.doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id || (req.body && req.body.id);
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    await col.doc(id).delete();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
