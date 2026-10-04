// Screenshots each share page on the live site for its link-preview card.
//   npm run share:shots                          every page from https://goofer.tv
//   npm run share:shots -- --only=store,hunts    just those ids
//   npm run share:shots -- --base=http://localhost:3000
// Drives the installed Google Chrome through playwright-core (nothing downloads).
// Commit the JPGs; the build hashes them into each card's ?v= so Discord refetches.
const fs = require('fs');
const path = require('path');
const { SHARE_PAGES } = require('./pages');
const { SITE_URL, SHARE_WIDTH, SHARE_HEIGHT } = require('./shareMeta');

const OUT_DIR = path.resolve(__dirname, '../../public/share');
const DEFAULT_SETTLE_MS = 2500;
const HIDE_SCROLLBARS = 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}';

function parseShootArgs(argv, pages = SHARE_PAGES) {
  let base = SITE_URL;
  let only = null;
  for (const arg of argv) {
    if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else if (arg.startsWith('--only=')) {
      only = arg
        .slice('--only='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  base = base.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) {
    throw new Error(`--base must be an http(s) URL, got "${base}"`);
  }
  if (!only) return { base, pages };
  if (only.length === 0) throw new Error('--only needs at least one page id');
  const unknown = only.filter((id) => !pages.some((p) => p.id === id));
  if (unknown.length) {
    throw new Error(
      `Unknown page id(s): ${unknown.join(', ')}. Valid: ${pages.map((p) => p.id).join(', ')}`
    );
  }
  return { base, pages: pages.filter((p) => only.includes(p.id)) };
}

async function main() {
  const { base, pages } = parseShootArgs(process.argv.slice(2));
  const { chromium } = require('playwright-core');

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch (err) {
    throw new Error(
      `Couldn't start Google Chrome (playwright-core uses the installed one).\n${err.message}`
    );
  }

  const context = await browser.newContext({
    viewport: { width: SHARE_WIDTH, height: SHARE_HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  // Skip the power-on gate, the static flip and the welcome sign-on.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('gg_tv_powered', '1');
      window.localStorage.setItem('gg_welcome_seen', '1');
      window.sessionStorage.setItem('tvIntroPlayed', '1');
    } catch {
      // storage blocked: the intro may show in this shot
    }
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const failed = [];
  for (const page of pages) {
    const url = base + page.path;
    const tab = await context.newPage();
    try {
      // Not 'networkidle': Firestore's long-poll keeps the network busy.
      await tab.goto(url, { waitUntil: 'load', timeout: 60000 });
      await tab.addStyleTag({ content: HIDE_SCROLLBARS });
      await tab.evaluate(() => document.fonts.ready);
      if (page.waitFor) await tab.waitForSelector(page.waitFor, { timeout: 15000 });
      await tab.waitForTimeout(page.settleMs ?? DEFAULT_SETTLE_MS);
      const file = path.join(OUT_DIR, `${page.id}.jpg`);
      await tab.screenshot({ path: file, type: 'jpeg', quality: 82 });
      const kb = Math.round(fs.statSync(file).size / 1024);
      console.log(`  ${page.id.padEnd(13)} ${url} -> public/share/${page.id}.jpg (${kb} KB)`);
    } catch (err) {
      failed.push(page.id);
      console.error(`  ${page.id.padEnd(13)} FAILED: ${err.message.split('\n')[0]} (old image kept)`);
    } finally {
      await tab.close();
    }
  }
  await browser.close();

  if (failed.length) {
    console.error(`\n${failed.length} failed: ${failed.join(', ')}. Re-run with --only=${failed.join(',')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { parseShootArgs };
