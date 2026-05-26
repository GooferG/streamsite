import { adminDb, FieldValue, Timestamp } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

const EDIT_COOLDOWN_MS = 30 * 1000;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const twitchId = decoded.uid;

  const { roundId, payoutGuess, topSlotGuess } = req.body || {};
  if (!roundId || typeof roundId !== 'string') {
    return res.status(400).json({ error: 'Missing roundId' });
  }

  const roundRef = adminDb.collection('prediction_rounds').doc(roundId);
  const entryRef = roundRef.collection('entries').doc(twitchId);
  const userRef = adminDb.collection('users').doc(twitchId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const [roundSnap, entrySnap, userSnap] = await Promise.all([
        tx.get(roundRef),
        tx.get(entryRef),
        tx.get(userRef),
      ]);
      if (!roundSnap.exists) throw new Error('NOT_FOUND');
      const round = roundSnap.data();
      if (round.status !== 'open') throw new Error('NOT_OPEN');

      const { kinds } = round;

      // Validate guesses.
      let normalizedPayout = null;
      if (kinds.payout) {
        const n = Number(payoutGuess);
        if (!Number.isFinite(n) || n < 0) throw new Error('INVALID_PAYOUT');
        normalizedPayout = Math.round(n * 100) / 100; // 2-decimal precision
      }

      let normalizedSlot = null;
      if (kinds.topSlot) {
        if (!topSlotGuess || typeof topSlotGuess !== 'string') {
          throw new Error('INVALID_SLOT');
        }
        const allowedSlots = (
          round.source === 'bonushunt'
            ? round.bonusHuntSnapshot?.slots?.map((s) => s.name) || []
            : round.manualSlots || []
        );
        const match = allowedSlots.find(
          (s) => s.toLowerCase() === topSlotGuess.toLowerCase()
        );
        if (!match) throw new Error('SLOT_NOT_IN_LIST');
        normalizedSlot = match; // store canonical casing from list
      }

      // Rate limit: 30s since lastEditAt if entry exists.
      const now = Date.now();
      if (entrySnap.exists) {
        const last = entrySnap.data().lastEditAt;
        const lastMs = last instanceof Timestamp ? last.toMillis() : 0;
        const remaining = EDIT_COOLDOWN_MS - (now - lastMs);
        if (remaining > 0) {
          throw new Error(`COOLDOWN:${Math.ceil(remaining / 1000)}`);
        }
      }

      const user = userSnap.exists ? userSnap.data() : null;
      const ts = FieldValue.serverTimestamp();

      if (entrySnap.exists) {
        tx.update(entryRef, {
          payoutGuess: normalizedPayout,
          topSlotGuess: normalizedSlot,
          twitchName: user?.twitchName || entrySnap.data().twitchName,
          displayName: user?.displayName || entrySnap.data().displayName,
          profileImageUrl: user?.profileImageUrl ?? entrySnap.data().profileImageUrl ?? null,
          lastEditAt: ts,
          editCount: FieldValue.increment(1),
        });
      } else {
        tx.set(entryRef, {
          twitchId,
          twitchName: user?.twitchName || decoded.twitchLogin || null,
          displayName: user?.displayName || decoded.twitchName || null,
          profileImageUrl: user?.profileImageUrl || decoded.profileImageUrl || null,
          payoutGuess: normalizedPayout,
          topSlotGuess: normalizedSlot,
          submittedAt: ts,
          lastEditAt: ts,
          editCount: 1,
        });
        tx.update(roundRef, { entryCount: FieldValue.increment(1) });
      }

      return { isNew: !entrySnap.exists };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const code = err.message;
    if (code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' });
    if (code === 'NOT_OPEN') return res.status(400).json({ error: 'NOT_OPEN' });
    if (code === 'INVALID_PAYOUT') return res.status(400).json({ error: 'INVALID_PAYOUT' });
    if (code === 'INVALID_SLOT') return res.status(400).json({ error: 'INVALID_SLOT' });
    if (code === 'SLOT_NOT_IN_LIST') return res.status(400).json({ error: 'SLOT_NOT_IN_LIST' });
    if (code?.startsWith('COOLDOWN:')) {
      const sec = Number(code.split(':')[1]);
      return res.status(429).json({ error: 'COOLDOWN', retryAfter: sec });
    }
    console.error('predictions/submit error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
