import crypto from 'crypto';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors } from '../_lib/verifyAuth.js';

// Public, password-gated suggestion submission. No login required — the link's
// password is the gate. Validates server-side, then appends/overwrites the
// submitter's picks (keyed by lowercased name) in the owner's active hunt.
//
// POST { linkId, password, name, slots: string[] }

const MAX_SLOTS = 6;
const MAX_NAME_LEN = 40;
const MAX_SLOT_LEN = 80;
const MAX_PEOPLE = 300; // cap link-sourced submitters to keep the hunt doc well under Firestore's 1MB limit
const SUBMIT_COOLDOWN_MS = 5 * 1000;

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

// Timing-safe hash comparison.
function hashesMatch(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { linkId, password, name, slots } = req.body || {};
  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'MISSING_LINK_ID' });
  }
  const cleanName = String(name || '').trim().slice(0, MAX_NAME_LEN);
  if (!cleanName) return res.status(400).json({ error: 'MISSING_NAME' });

  const cleanSlots = (Array.isArray(slots) ? slots : [])
    .map((s) => String(s || '').trim().slice(0, MAX_SLOT_LEN))
    .filter(Boolean)
    .slice(0, MAX_SLOTS);
  if (!cleanSlots.length) return res.status(400).json({ error: 'NO_SLOTS' });

  const intakeRef = adminDb.doc(`suggestion_intakes/${linkId}`);

  try {
    const intakeSnap = await intakeRef.get();
    if (!intakeSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const intake = intakeSnap.data();
    if (intake.open === false) return res.status(403).json({ error: 'CLOSED' });

    // Open links have no stored hash — skip the password gate entirely.
    // Password-protected links still require a timing-safe match.
    if (intake.passwordHash) {
      const given = hashPassword(password, intake.passwordSalt);
      if (!hashesMatch(given, intake.passwordHash)) {
        return res.status(401).json({ error: 'BAD_PASSWORD' });
      }
    }

    const activeRef = adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`);

    const result = await adminDb.runTransaction(async (tx) => {
      const activeSnap = await tx.get(activeRef);
      if (!activeSnap.exists) throw new Error('NO_ACTIVE_HUNT');
      const hunt = activeSnap.data();
      const suggestions = Array.isArray(hunt.suggestions) ? hunt.suggestions : [];

      const key = cleanName.toLowerCase();
      const existingIdx = suggestions.findIndex(
        (p) => p.source === 'link' && String(p.person || '').toLowerCase() === key
      );

      // Cooldown: block rapid re-submits from the same name on this link.
      if (existingIdx !== -1) {
        const prev = suggestions[existingIdx];
        const last = typeof prev.submittedAt === 'number' ? prev.submittedAt : 0;
        if (Date.now() - last < SUBMIT_COOLDOWN_MS) throw new Error('COOLDOWN');
      } else if (suggestions.length >= MAX_PEOPLE) {
        // Cap only applies to NEW submitters; existing ones can always update.
        throw new Error('LIST_FULL');
      }

      const slotObjs = cleanSlots.map((nm) => ({
        id: crypto.randomUUID(),
        name: nm,
        status: 'open',
      }));
      const person = {
        id: existingIdx !== -1 ? suggestions[existingIdx].id : crypto.randomUUID(),
        person: cleanName,
        slots: slotObjs,
        source: 'link',
        submittedAt: Date.now(),
      };

      const next =
        existingIdx !== -1
          ? suggestions.map((p, i) => (i === existingIdx ? person : p))
          : [...suggestions, person];

      tx.update(activeRef, { suggestions: next });
      return { replaced: existingIdx !== -1 };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const code = err.message;
    if (code === 'NO_ACTIVE_HUNT') return res.status(409).json({ error: 'HUNT_ENDED' });
    if (code === 'COOLDOWN') return res.status(429).json({ error: 'COOLDOWN' });
    if (code === 'LIST_FULL') return res.status(409).json({ error: 'LIST_FULL' });
    console.error('hunt-suggest/submit error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
