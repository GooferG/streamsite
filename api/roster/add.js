import crypto from 'crypto';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';
import { takenSlotSet, normalizeSlotName } from '../../src/utils/suggestionBoard.js';

// Host adds a registered viewer's default slots into the host's own active
// hunt. Auth = the host (any signed-in user). The target viewer must have an
// opted-in (discoverable) slot profile with at least one default slot.
//
// Merge-by-name: if a suggestions[] entry with the same lowercased name already
// exists (any source), only slots not already present are appended; existing
// slot statuses are left untouched and no duplicate person row is created.
//
// POST { twitchId }   Authorization: Bearer <Firebase ID token>

const MAX_PEOPLE = 300;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const hostUid = decoded.uid;

  const { twitchId } = req.body || {};
  if (!twitchId || typeof twitchId !== 'string') {
    return res.status(400).json({ error: 'MISSING_TWITCH_ID' });
  }

  try {
    const profileSnap = await adminDb.collection('users').doc(twitchId).get();
    if (!profileSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const profileData = profileSnap.data();
    const sp = profileData?.slotProfile;
    if (!sp || sp.discoverable !== true) return res.status(403).json({ error: 'NOT_DISCOVERABLE' });
    const defaultSlots = Array.isArray(sp.defaultSlots) ? sp.defaultSlots.filter(Boolean) : [];
    if (!defaultSlots.length) return res.status(409).json({ error: 'NO_DEFAULTS' });

    const personName = profileData.displayName || profileData.twitchName || 'Viewer';
    const activeRef = adminDb.doc(`users/${hostUid}/active_hunt/current`);

    const result = await adminDb.runTransaction(async (tx) => {
      const activeSnap = await tx.get(activeRef);
      if (!activeSnap.exists) throw new Error('NO_ACTIVE_HUNT');
      const hunt = activeSnap.data();
      const suggestions = Array.isArray(hunt.suggestions) ? hunt.suggestions : [];

      const key = personName.toLowerCase();
      const existingIdx = suggestions.findIndex(
        (p) => String(p.person || '').toLowerCase() === key
      );

      if (existingIdx === -1 && suggestions.length >= MAX_PEOPLE) {
        throw new Error('LIST_FULL');
      }

      // Global first-caller-wins dedup: skip any default slot already on the
      // board (any person). Exclude this viewer's own existing entry so a re-add
      // doesn't self-block; the merge branch re-applies an own-entry filter below.
      const excludeId = existingIdx !== -1 ? suggestions[existingIdx].id : null;
      const taken = takenSlotSet(suggestions, { excludePersonId: excludeId });
      const freshNames = defaultSlots.filter(
        (nm) => !taken.has(normalizeSlotName(nm))
      );

      let addedCount = 0;
      let next;
      if (existingIdx !== -1) {
        const entry = suggestions[existingIdx];
        // Own-entry filter: don't re-add a game this entry already lists.
        const have = new Set(
          (Array.isArray(entry.slots) ? entry.slots : []).map((s) => normalizeSlotName(s.name))
        );
        const newSlots = freshNames
          .filter((nm) => !have.has(normalizeSlotName(nm)))
          .map((nm) => ({ id: crypto.randomUUID(), name: nm, status: 'open' }));
        addedCount = newSlots.length;
        const merged = {
          ...entry,
          slots: [...(Array.isArray(entry.slots) ? entry.slots : []), ...newSlots],
        };
        next = suggestions.map((p, i) => (i === existingIdx ? merged : p));
      } else {
        const slotObjs = freshNames.map((nm) => ({
          id: crypto.randomUUID(),
          name: nm,
          status: 'open',
        }));
        addedCount = slotObjs.length;
        // Don't create an empty person row if every default was already taken.
        if (addedCount === 0) {
          return { added: 0, merged: false };
        }
        const person = {
          id: crypto.randomUUID(),
          person: personName,
          slots: slotObjs,
          source: 'roster',
          submittedAt: Date.now(),
        };
        next = [...suggestions, person];
      }

      tx.update(activeRef, { suggestions: next });
      return { added: addedCount, merged: existingIdx !== -1 };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const code = err.message;
    if (code === 'NO_ACTIVE_HUNT') return res.status(409).json({ error: 'NO_ACTIVE_HUNT' });
    if (code === 'LIST_FULL') return res.status(409).json({ error: 'LIST_FULL' });
    console.error('roster/add error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
