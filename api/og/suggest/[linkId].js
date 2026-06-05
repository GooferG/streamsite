// api/og/suggest/[linkId].js
import { adminDb } from '../../_lib/firebaseAdmin.js';
import { renderCard } from '../render.js';
import { suggestCardProps } from '../cardProps.js';

// Dynamic OG card for a suggestion-intake link. Reads the intake -> owner's
// active hunt (admin creds). Always 200.
export default async function handler(req) {
  const path = (req.url || '').split('?')[0];
  const linkId = decodeURIComponent(path.replace(/^.*\/og\/suggest\//, '').replace(/\/$/, ''));

  let intake = null;
  let hunt = null;
  try {
    if (linkId) {
      const intakeSnap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
      if (intakeSnap.exists) {
        intake = intakeSnap.data();
        const activeSnap = await adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`).get();
        if (activeSnap.exists) hunt = activeSnap.data();
      }
    }
  } catch {
    /* fall through to fallback card */
  }
  return renderCard(suggestCardProps(intake, hunt));
}
