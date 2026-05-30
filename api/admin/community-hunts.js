import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireStaff, requireOwner } from '../_lib/verifyAuth.js';

// Admin community-hunts dashboard endpoint (read-only).
//
// GET -> { stats, hunts }
//   Gathers completed viewer tracker hunts from users/{twitchId}/hunts via a
//   collection-group query, enriches each with its owner's display name, and
//   computes community-wide aggregate stats. Capped at the most recent 200.
//
// Read-only: never writes/updates/deletes. Uses firebase-admin (bypasses rules).

const HUNT_LIMIT = 200;

function tsToMs(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return null;
}

function numberOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Mirror of the client huntCalc logic, kept minimal (server can't import src/).
function bonusX(b) {
  const stake = numberOr0(b.stake);
  const win = numberOr0(b.win);
  return stake > 0 && win > 0 ? win / stake : null;
}

function aggregate(hunts) {
  let biggestWin = null; // { amount, x, slot, caller, owner, huntName }
  let bestCallX = null; // same shape, ranked by x
  const owners = new Set();
  const profitable = [];

  for (const h of hunts) {
    owners.add(h.ownerTwitchId);
    const ownerName = h.owner?.displayName || h.owner?.twitchName || h.ownerTwitchId;

    const start =
      h.startBalance === '' || h.startBalance == null ? null : Number(h.startBalance);
    const finish =
      h.finishBalance === '' || h.finishBalance == null ? null : Number(h.finishBalance);
    if (start != null && finish != null) {
      profitable.push({ huntName: h.name || 'Untitled', owner: ownerName, profit: finish - start });
    }

    for (const b of h.bonuses || []) {
      const win = numberOr0(b.win);
      if (win > 0 && (biggestWin == null || win > biggestWin.amount)) {
        biggestWin = {
          amount: win,
          x: bonusX(b),
          slot: b.slot,
          caller: (b.caller || '').trim() || null,
          owner: ownerName,
          huntName: h.name || 'Untitled',
        };
      }
      const x = bonusX(b);
      if (x != null && (bestCallX == null || x > bestCallX.x)) {
        bestCallX = {
          x,
          amount: win,
          slot: b.slot,
          caller: (b.caller || '').trim() || null,
          owner: ownerName,
          huntName: h.name || 'Untitled',
        };
      }
    }
  }

  const topHuntsByProfit = profitable
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return {
    totalHunts: hunts.length,
    uniquePlayers: owners.size,
    biggestWin,
    bestCallX,
    topHuntsByProfit,
  };
}

async function gatherHunts() {
  const snap = await adminDb
    .collectionGroup('hunts')
    .where('status', '==', 'completed')
    .orderBy('completedAt', 'desc')
    .limit(HUNT_LIMIT)
    .get();

  // Keep only users/{id}/hunts (exclude the top-level prediction-rounds `hunts`).
  const docs = snap.docs.filter(
    (d) => d.ref.parent.parent?.parent?.id === 'users'
  );

  const hunts = docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ownerTwitchId: d.ref.parent.parent.id,
      name: data.name || 'Untitled',
      startBalance: data.startBalance ?? '',
      finishBalance: data.finishBalance ?? '',
      completedAt: tsToMs(data.completedAt),
      startedAt: tsToMs(data.startedAt),
      bonuses: Array.isArray(data.bonuses) ? data.bonuses : [],
      gamblers: Array.isArray(data.gamblers) ? data.gamblers : [],
      bannedSlots: data.bannedSlots || '',
    };
  });

  await attachOwners(hunts);
  return hunts;
}

// Attach { owner } to each hunt — one user-doc read per distinct ownerTwitchId.
async function attachOwners(hunts) {
  const ownerIds = [...new Set(hunts.map((h) => h.ownerTwitchId))];
  const ownerMap = {};
  if (ownerIds.length > 0) {
    const snaps = await Promise.all(
      ownerIds.map((id) => adminDb.collection('users').doc(id).get())
    );
    for (const s of snaps) {
      if (s.exists) {
        const u = s.data();
        ownerMap[s.id] = {
          displayName: u.displayName || null,
          twitchName: u.twitchName || null,
          profileImageUrl: u.profileImageUrl || null,
        };
      }
    }
  }
  for (const h of hunts) {
    h.owner = ownerMap[h.ownerTwitchId] || null;
  }
}

// In-progress hunts — one doc per user at users/{id}/active_hunt/current.
async function gatherLiveHunts() {
  const snap = await adminDb.collectionGroup('active_hunt').get();
  const docs = snap.docs.filter(
    (d) => d.ref.parent.parent?.parent?.id === 'users'
  );
  const live = docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ownerTwitchId: d.ref.parent.parent.id,
      name: data.name || 'Untitled',
      startBalance: data.startBalance ?? '',
      finishBalance: data.finishBalance ?? '',
      startedAt: tsToMs(data.startedAt),
      phase: data.phase === 'opening' ? 'opening' : 'collecting',
      bonuses: Array.isArray(data.bonuses) ? data.bonuses : [],
      gamblers: Array.isArray(data.gamblers) ? data.gamblers : [],
      shared: !!data.shareId,
    };
  });
  await attachOwners(live);
  // Most recently started first (startedAt is a ms number).
  live.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  return live;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST = owner-only delete action. GET = staff-readable dashboard.
  if (req.method === 'POST') {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    return handleDelete(req, res);
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await requireStaff(req, res);
  if (!actor) return;

  try {
    const [hunts, live] = await Promise.all([gatherHunts(), gatherLiveHunts()]);
    const stats = aggregate(hunts);
    return res.status(200).json({
      stats,
      hunts,
      live,
      capped: hunts.length >= HUNT_LIMIT,
    });
  } catch (err) {
    console.error('community-hunts error:', err);
    // A missing composite index surfaces here with a console link to create it.
    return res.status(500).json({ error: 'Failed to load community hunts' });
  }
}

// Owner-only deletion of a viewer's tracker hunt.
//   { action: 'delete', kind: 'live', ownerTwitchId }
//     -> deletes users/{ownerTwitchId}/active_hunt/current (+ its shared mirror)
//   { action: 'delete', kind: 'completed', ownerTwitchId, huntId }
//     -> deletes users/{ownerTwitchId}/hunts/{huntId}
async function handleDelete(req, res) {
  const { action, kind, ownerTwitchId, huntId } = req.body || {};
  if (action !== 'delete') return res.status(400).json({ error: 'Unknown action' });
  if (!ownerTwitchId) return res.status(400).json({ error: 'ownerTwitchId required' });

  try {
    if (kind === 'live') {
      const ref = adminDb.collection('users').doc(ownerTwitchId).collection('active_hunt').doc('current');
      const snap = await ref.get();
      // Clean up the public live mirror if this hunt was being shared.
      const shareId = snap.exists ? snap.data().shareId : null;
      await ref.delete();
      if (shareId) {
        await adminDb.collection('shared_hunts').doc(shareId).delete().catch(() => {});
      }
      return res.status(200).json({ ok: true });
    }
    if (kind === 'completed') {
      if (!huntId) return res.status(400).json({ error: 'huntId required' });
      await adminDb.collection('users').doc(ownerTwitchId).collection('hunts').doc(huntId).delete();
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid kind' });
  } catch (err) {
    console.error('community-hunts delete error:', err);
    return res.status(500).json({ error: 'Delete failed' });
  }
}
