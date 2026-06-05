// Pure formatting helpers for the live-share OG preview. Kept free of any
// firebase-admin / network imports so they can be unit-tested without booting
// the admin SDK. Consumed by api/live-preview.js + api/hunt-suggest/preview.js.

const SITE = 'https://goofer.tv';

// Versioned OG image URL for a card endpoint. kind = 'live' | 'suggest'.
export function buildImageUrl(kind, id, version) {
  const base = `${SITE}/api/og/${kind}/${encodeURIComponent(id)}`;
  return version != null && version !== '' ? `${base}?v=${version}` : base;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Build the OG description from a shared_hunts mirror doc.
// "$1,200 in the hunt · 3 bonuses collected"
export function buildDescription(mirror) {
  const amount = formatMoney(mirror?.startBalance);
  const count = Array.isArray(mirror?.bonuses) ? mirror.bonuses.length : 0;
  const parts = [];
  if (amount) parts.push(`${amount} in the hunt`);
  if (count > 0) parts.push(`${count} ${count === 1 ? 'bonus' : 'bonuses'} collected`);
  if (parts.length === 0) return 'LIVE bonus hunt on GooferG';
  return parts.join(' · ');
}

// Replace the title + OG/Twitter text tags in the built index.html. Values are
// HTML-escaped. Image tags are intentionally left untouched (static homepage
// image).
export function injectOgTags(html, { title, description, url, image }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${t}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${d}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${u}" />`
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${t}" />`
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${d}" />`
    );
  // Only swap the image tags when a per-hunt image is supplied; otherwise the
  // static homepage image is left in place (back-compat).
  if (image) {
    const img = escapeHtml(image);
    out = out
      .replace(
        /<meta property="og:image" content="[^"]*" \/>/,
        `<meta property="og:image" content="${img}" />`
      )
      .replace(
        /<meta property="og:image:secure_url" content="[^"]*" \/>/,
        `<meta property="og:image:secure_url" content="${img}" />`
      )
      .replace(
        /<meta name="twitter:image" content="[^"]*" \/>/,
        `<meta name="twitter:image" content="${img}" />`
      )
      .replace(
        /<meta property="og:image:width" content="[^"]*" \/>/,
        `<meta property="og:image:width" content="1200" />`
      )
      .replace(
        /<meta property="og:image:height" content="[^"]*" \/>/,
        `<meta property="og:image:height" content="630" />`
      )
      .replace(
        /<meta property="og:image:type" content="[^"]*" \/>/,
        `<meta property="og:image:type" content="image/png" />`
      );
  }
  return out;
}
