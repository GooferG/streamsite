import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors } from '../_lib/verifyAuth.js';
import { projectBoard } from '../../src/utils/suggestionBoard.js';

// Public read of a hunt's suggestion board for the submission page. Capability =
// the unguessable linkId (same model as info.js). Returns ONLY the curated
// projection (person + slot names + public status) — never internal fields,
// password material, or the owner uid.
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const linkId = req.query?.linkId;
  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'MISSING_LINK_ID' });
  }

  try {
    const intakeSnap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
    if (!intakeSnap.exists) return res.status(404).json({ error: 'NOT_FOUND' });
    const intake = intakeSnap.data();

    const huntName = intake.huntName || 'Bonus hunt';
    const open = intake.open !== false;

    const activeSnap = await adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`).get();
    if (!activeSnap.exists) {
      // Hunt ended or not started — board is simply empty, not an error.
      return res.status(200).json({ huntName, open, board: [] });
    }
    const hunt = activeSnap.data();
    const board = projectBoard(Array.isArray(hunt.suggestions) ? hunt.suggestions : []);
    return res.status(200).json({ huntName, open, board });
  } catch (err) {
    console.error('hunt-suggest/board error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
