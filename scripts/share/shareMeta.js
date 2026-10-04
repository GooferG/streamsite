// Stamps one page's link-preview card into the built index.html.
// <title> is left alone on purpose: crawlers read og:title, and a per-page
// <title> would go stale after in-app navigation.

const SITE_URL = 'https://goofer.tv';
const SHARE_WIDTH = 1536;
const SHARE_HEIGHT = 1075;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// [attribute, key, value] for every tag a card fills in.
function cardTags(meta) {
  return [
    ['name', 'description', meta.description],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', meta.url],
    ['property', 'og:image', meta.image],
    ['property', 'og:image:secure_url', meta.image],
    ['property', 'og:image:width', meta.imageWidth],
    ['property', 'og:image:height', meta.imageHeight],
    ['property', 'og:image:alt', meta.description],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', meta.image],
    ['name', 'twitter:image:alt', meta.description],
  ];
}

function applyShareMeta(html, meta) {
  return cardTags(meta).reduce((out, [attr, key, value]) => {
    // The closing quote after the key keeps og:image from matching og:image:width.
    const tagPattern = new RegExp(`<meta\\b[^>]*\\b${attr}="${escapeRegExp(key)}"[^>]*>`);
    const match = tagPattern.exec(out);
    if (!match || !/\bcontent="[^"]*"/.test(match[0])) {
      throw new Error(`<meta ${attr}="${key}" content="…"> is missing from the template`);
    }
    // Function replacements so "$&" in copy is never read as a pattern.
    const filled = match[0].replace(/\bcontent="[^"]*"/, () => `content="${escapeAttr(value)}"`);
    return out.slice(0, match.index) + filled + out.slice(match.index + match[0].length);
  }, html);
}

module.exports = { SITE_URL, SHARE_WIDTH, SHARE_HEIGHT, applyShareMeta };
