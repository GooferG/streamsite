// Post-build: one HTML file per share page, each carrying its own og:/twitter:
// card. Link crawlers (Discord, X, iMessage, Slack) don't run JS, so the card has
// to be in the static HTML; vercel.json rewrites each path to its file.
// Runs from `npm run build` after react-scripts build.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SHARE_PAGES } = require('./pages');
const { applyShareMeta, SITE_URL, SHARE_WIDTH, SHARE_HEIGHT } = require('./shareMeta');

function imageVersion(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
}

function writeSharePages(buildDir, pages = SHARE_PAGES) {
  // Read once up front: the home card overwrites index.html.
  const template = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
  const imageFor = (page) => path.join(buildDir, 'share', `${page.id}.jpg`);

  const missing = pages.filter((page) => !fs.existsSync(imageFor(page)));
  if (missing.length) {
    throw new Error(
      `missing screenshot for ${missing.map((p) => `${p.id} (public/share/${p.id}.jpg)`).join(', ')}; run npm run share:shots`
    );
  }

  // Render every card before writing any, so a bad template writes nothing.
  const cards = pages.map((page) => ({
    file: path.join(buildDir, ...page.path.split('/').filter(Boolean), 'index.html'),
    html: applyShareMeta(template, {
      title: page.title,
      description: page.description,
      url: SITE_URL + page.path,
      image: `${SITE_URL}/share/${page.id}.jpg?v=${imageVersion(imageFor(page))}`,
      imageWidth: SHARE_WIDTH,
      imageHeight: SHARE_HEIGHT,
    }),
  }));

  cards.forEach(({ file, html }) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  });
  return cards.map(({ file }) => file);
}

if (require.main === module) {
  try {
    const written = writeSharePages(path.resolve(__dirname, '../../build'));
    console.log(`share pages: wrote ${written.length} cards`);
  } catch (err) {
    console.error(`share pages: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { writeSharePages };
