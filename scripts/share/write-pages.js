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

// What's wrong with vercel.json's rewrites for these pages: each non-root page
// needs `path -> path/index.html` above the SPA catch-all, and no rewrite may
// point at a page this script doesn't generate (that path would 404 for real
// visitors). Checked at build time because Jest doesn't gate deploys.
function rewriteProblems(rewrites, pages = SHARE_PAGES) {
  const catchAll = rewrites.findIndex((r) => r.destination === '/index.html');
  if (catchAll === -1) return ['vercel.json has no catch-all rewrite to /index.html'];

  const problems = [];
  pages
    .filter((page) => page.path !== '/')
    .forEach((page) => {
      const target = `${page.path}/index.html`;
      const i = rewrites.findIndex((r) => r.source === page.path && r.destination === target);
      if (i === -1 || i > catchAll) {
        problems.push(`${page.path} has no rewrite to ${target} above the catch-all`);
      }
    });

  const paths = new Set(pages.map((page) => page.path));
  rewrites
    .filter((r) => r.destination !== '/index.html' && r.destination.endsWith('/index.html'))
    .filter((r) => !paths.has(r.destination.slice(0, -'/index.html'.length)))
    .forEach((r) => {
      problems.push(`${r.source} rewrites to ${r.destination}, which is not a share page`);
    });
  return problems;
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
    const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
    const problems = rewriteProblems(vercel.rewrites || []);
    if (problems.length) throw new Error(`vercel.json: ${problems.join('; ')}`);
    const written = writeSharePages(path.resolve(__dirname, '../../build'));
    console.log(`share pages: wrote ${written.length} cards`);
  } catch (err) {
    console.error(`share pages: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { rewriteProblems, writeSharePages };
