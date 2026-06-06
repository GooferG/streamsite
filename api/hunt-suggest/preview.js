// api/hunt-suggest/preview.js
import { adminDb } from '../_lib/firebaseAdmin.js';
import { injectOgTags, buildImageUrl } from '../_lib/livePreviewFormat.js';

const SITE = 'https://goofer.tv';

async function fetchIndexHtml() {
  const r = await fetch(`${SITE}/index.html`, { headers: { 'User-Agent': 'goofer-suggest-preview' } });
  if (!r.ok) throw new Error(`index fetch ${r.status}`);
  return r.text();
}

export default async function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  const linkId = decodeURIComponent(path.replace(/^\/hunt-suggest\//, '').replace(/\/$/, ''));

  let html;
  try {
    html = await fetchIndexHtml();
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(200)
      .send(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${SITE}/hunt-suggest/${encodeURIComponent(linkId)}"></head><body></body></html>`
      );
  }

  try {
    if (!linkId) throw new Error('no linkId');
    const intakeSnap = await adminDb.doc(`suggestion_intakes/${linkId}`).get();
    if (!intakeSnap.exists) throw new Error('not found');
    const intake = intakeSnap.data();

    let totalPicks = 0;
    let peopleCount = 0;
    let version = intake.updatedAt;
    try {
      const activeSnap = await adminDb.doc(`users/${intake.ownerUid}/active_hunt/current`).get();
      if (activeSnap.exists) {
        const hunt = activeSnap.data();
        const suggestions = Array.isArray(hunt.suggestions) ? hunt.suggestions : [];
        peopleCount = suggestions.length;
        totalPicks = suggestions.reduce((n, p) => n + (Array.isArray(p?.slots) ? p.slots.length : 0), 0);
        if (version == null) version = hunt.updatedAt;
      }
    } catch {
      /* counts stay 0 */
    }

    const huntName = intake.huntName || 'Bonus hunt';
    const title = `Suggest slots for ${huntName} — GooferG`;
    const parts = [];
    if (totalPicks > 0) parts.push(`${totalPicks} ${totalPicks === 1 ? 'pick' : 'picks'} in`);
    if (peopleCount > 0) parts.push(`${peopleCount} ${peopleCount === 1 ? 'caller' : 'callers'}`);
    parts.push('drop yours on goofer.tv');
    const description = parts.join(' · ');
    const url = `${SITE}/hunt-suggest/${encodeURIComponent(linkId)}`;
    // Minute-bucket fallback so the card still busts cache if no updatedAt exists.
    const v = version != null ? version : Math.floor(Date.now() / 60000);
    const image = buildImageUrl('suggest', linkId, v);
    html = injectOgTags(html, { title, description, url, image });
  } catch {
    /* unmodified shell */
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).send(html);
}
