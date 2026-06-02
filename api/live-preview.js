import { adminDb } from './_lib/firebaseAdmin.js';
import { buildDescription, injectOgTags } from './_lib/livePreviewFormat.js';

const SITE = 'https://goofer.tv';

async function fetchIndexHtml() {
  // Fetch the deployed SPA shell over HTTPS. Robust against serverless
  // bundling not including the static build output on disk.
  const r = await fetch(`${SITE}/index.html`, {
    headers: { 'User-Agent': 'goofer-live-preview' },
  });
  if (!r.ok) throw new Error(`index fetch ${r.status}`);
  return r.text();
}

export default async function handler(req, res) {
  // Derive shareId from the path: /live/<shareId>
  const path = (req.url || '').split('?')[0];
  const shareId = decodeURIComponent(
    path.replace(/^\/live\//, '').replace(/\/$/, '')
  );

  let html;
  try {
    html = await fetchIndexHtml();
  } catch {
    // Can't fetch the shell — bounce the visitor to the canonical URL so they
    // still land on the working SPA.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(200)
      .send(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${SITE}/live/${encodeURIComponent(
          shareId
        )}"></head><body></body></html>`
      );
  }

  // Best-effort enrichment. Any failure → return the unmodified shell so a
  // human visitor still gets the working SPA (generic homepage card).
  try {
    if (!shareId) throw new Error('no shareId');
    const snap = await adminDb.doc(`shared_hunts/${shareId}`).get();
    if (!snap.exists) throw new Error('not found');
    const mirror = snap.data();
    const title = `${mirror?.name || 'Bonus hunt'} — LIVE on GooferG`;
    const description = buildDescription(mirror);
    const url = `${SITE}/live/${encodeURIComponent(shareId)}`;
    html = injectOgTags(html, { title, description, url });
  } catch {
    // fall through with the unmodified shell
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short cache: unfurlers cache on their own; this just smooths repeat hits.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).send(html);
}
