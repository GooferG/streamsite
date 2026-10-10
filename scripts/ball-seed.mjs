#!/usr/bin/env node
/**
 * Goofer Ball play-test helper: drops fake viewers' balls into the open
 * round, the same docs a real `!slot` writes (ball + slot claim), so the
 * draw flow can be run without chat. Talks to the real Firestore
 * (firebase-admin creds from .env.local), so every fake viewer's id starts
 * with `seed-` and --clear removes exactly those.
 *
 * Usage:
 *   node scripts/ball-seed.mjs [count]   add `count` balls (default 10)
 *   node scripts/ball-seed.mjs --clear   remove undrawn seed balls and their
 *                                        claims from the newest round, plus
 *                                        any seed payout (users/seed-*,
 *                                        their ticket_ledger rows and
 *                                        pending goofer_ball redemptions)
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SEED = 'seed-';
const NAMES = [
  'CouchGoblin', 'NightOwl420', 'BonusBuyBarry', 'ReelRat', 'SpinDoctor', 'LuckyLou',
  'MaxWinMaybe', 'ScatterBrain', 'DeadSpinDan', 'TumbleWeed', 'WildCardWendy', 'BigBetBetty',
  'MultiMike', 'FreeSpinFran', 'HouseEdgeHank', 'CascadeCarl', 'StickyWildSue', 'BuyFeatureBo',
  'RetriggerRita', 'PaylinePete',
];

function loadEnv() {
  const file = path.join(root, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnv();
for (const key of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env.local (firebase-admin service account).`);
    process.exit(1);
  }
}
// Imported after loadEnv: firebaseAdmin initializes from process.env on import.
const { adminDb, FieldValue, default: admin } = await import('../api/_lib/firebaseAdmin.js');
const { slotKey } = await import('../api/_lib/ballRules.js');

async function newestRound() {
  const snap = await adminDb.collection('ball_rounds').orderBy('openedAt', 'desc').limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function seed(count) {
  const round = await newestRound();
  if (!round || round.data().status !== 'open') {
    console.error('No open drum. Open one from the control room Ball tab first.');
    process.exit(1);
  }
  const { getSlotCatalog } = await import('../api/_lib/communityHunts.js');
  const { toCatalogSlot } = await import('../api/_lib/slotMatch.js');
  const slots = (await getSlotCatalog()).map(toCatalogSlot).filter((s) => s && s.bonusBuy);
  const claims = round.ref.collection('claims');
  const taken = new Set((await claims.get()).docs.map((d) => d.id));
  const pool = slots.filter((s) => !taken.has(slotKey(s.id))).sort(() => Math.random() - 0.5);

  let added = 0;
  for (let i = 0; i < NAMES.length && added < count && pool.length; i += 1) {
    const twitchId = `${SEED}${String(i + 1).padStart(2, '0')}`;
    const ballRef = round.ref.collection('balls').doc(twitchId);
    const slot = pool.shift();
    const claimRef = claims.doc(slotKey(slot.id));
    const ok = await adminDb.runTransaction(async (tx) => {
      const [ball, claim] = await Promise.all([tx.get(ballRef), tx.get(claimRef)]);
      if (ball.exists || claim.exists) return false;
      const ts = FieldValue.serverTimestamp();
      const displayName = NAMES[i];
      tx.set(claimRef, { twitchId, displayName, scratched: false, createdAt: ts });
      tx.set(ballRef, {
        twitchId,
        twitchName: displayName.toLowerCase(),
        displayName,
        slotId: slot.id,
        slotName: slot.name,
        thumb: slot.thumb || null,
        status: 'drum',
        drawNo: null,
        enteredAt: ts,
        updatedAt: ts,
      });
      return true;
    });
    if (ok) {
      added += 1;
      console.log(`+ ${NAMES[i]} → ${slot.name}`);
    }
  }
  console.log(`Added ${added} ball(s) to round ${round.id}.`);
}

async function clear() {
  const round = await newestRound();
  if (round) {
    const balls = await round.ref.collection('balls').where('twitchId', '>=', SEED).where('twitchId', '<', `${SEED}`).get();
    let removed = 0;
    let kept = 0;
    for (const b of balls.docs) {
      const ball = b.data();
      if (ball.status !== 'drum') {
        kept += 1;
        continue;
      }
      const batch = adminDb.batch();
      batch.delete(b.ref);
      batch.delete(round.ref.collection('claims').doc(slotKey(ball.slotId)));
      await batch.commit();
      removed += 1;
    }
    console.log(`Round ${round.id}: removed ${removed} undrawn seed ball(s).`);
    if (kept) console.log(`${kept} seed ball(s) were drawn or scratched and stay on the rack; cancel the round to drop them.`);
  }

  const docId = admin.firestore.FieldPath.documentId();
  const users = await adminDb.collection('users').where(docId, '>=', SEED).where(docId, '<', `${SEED}`).get();
  const ids = users.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const [ledger, redemptions] = await Promise.all([
      adminDb.collection('ticket_ledger').where('userId', 'in', chunk).get(),
      adminDb.collection('redemptions').where('userId', 'in', chunk).get(),
    ]);
    const batch = adminDb.batch();
    ledger.docs.forEach((d) => batch.delete(d.ref));
    redemptions.docs.filter((d) => d.data().kind === 'goofer_ball' && d.data().status === 'pending').forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`Removed ${ledger.size} ledger row(s) and seed redemptions for ${chunk.length} seed viewer(s).`);
  }
  const batch = adminDb.batch();
  users.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`Removed ${users.size} seed user doc(s).`);
}

const arg = process.argv[2];
if (arg === '--clear') await clear();
else await seed(Math.max(1, Math.min(NAMES.length, Number(arg) || 10)));
process.exit(0);
