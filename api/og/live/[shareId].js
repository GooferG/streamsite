// api/og/live/[shareId].js
import { adminDb } from '../../_lib/firebaseAdmin.js';
import { renderCard } from '../render.js';
import { liveCardProps } from '../cardProps.js';

// Dynamic OG card for a live-shared hunt. Reads the public shared_hunts mirror.
// Always returns a 200 image — a 404 would break the unfurl embed.
export default async function handler(req) {
  // shareId from the path: /api/og/live/<shareId>
  const path = (req.url || '').split('?')[0];
  const shareId = decodeURIComponent(path.replace(/^.*\/og\/live\//, '').replace(/\/$/, ''));

  let mirror = null;
  try {
    if (shareId) {
      const snap = await adminDb.doc(`shared_hunts/${shareId}`).get();
      if (snap.exists) mirror = snap.data();
    }
  } catch {
    /* fall through to fallback card */
  }
  return renderCard(liveCardProps(mirror));
}
