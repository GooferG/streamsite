/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rewriteProblems, writeSharePages } from '../../scripts/share/write-pages';
import { SHARE_PAGES } from '../../scripts/share/pages';
import vercel from '../../vercel.json';

const ROOT = path.resolve(__dirname, '../..');

const PAGES = [
  { id: 'home', path: '/', title: 'GooferG', description: 'Home copy.' },
  {
    id: 'leaderboard',
    path: '/gamba/leaderboard',
    title: 'Leaderboard · GooferG',
    description: 'Board copy.',
  },
];

const tempDirs = [];
afterAll(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

// A fake build/ using the real template, with the given screenshot bytes.
function makeBuild(images) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'share-build-'));
  tempDirs.push(dir);
  fs.copyFileSync(path.join(ROOT, 'public', 'index.html'), path.join(dir, 'index.html'));
  fs.mkdirSync(path.join(dir, 'share'));
  Object.entries(images).forEach(([id, bytes]) => {
    fs.writeFileSync(path.join(dir, 'share', `${id}.jpg`), bytes);
  });
  return dir;
}

const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const ogImage = (html) => html.match(/property="og:image" content="([^"]*)"/)[1];

describe('writeSharePages', () => {
  test('writes a card per page, nested paths included, home over the template', () => {
    const dir = makeBuild({ home: 'aaa', leaderboard: 'bbb' });
    writeSharePages(dir, PAGES);
    const home = read(dir, 'index.html');
    const board = read(dir, 'gamba', 'leaderboard', 'index.html');
    expect(home).toContain('property="og:url" content="https://goofer.tv/"');
    expect(board).toContain('property="og:url" content="https://goofer.tv/gamba/leaderboard"');
    expect(board).toContain('property="og:title" content="Leaderboard · GooferG"');
    expect(board).toContain('<title>GooferG</title>');
    expect(ogImage(home)).toMatch(/^https:\/\/goofer\.tv\/share\/home\.jpg\?v=[0-9a-f]{8}$/);
    expect(ogImage(board)).toMatch(/^https:\/\/goofer\.tv\/share\/leaderboard\.jpg\?v=[0-9a-f]{8}$/);
  });

  test('the image version changes when the screenshot does', () => {
    const a = makeBuild({ home: 'one', leaderboard: 'x' });
    const b = makeBuild({ home: 'two', leaderboard: 'x' });
    writeSharePages(a, PAGES);
    writeSharePages(b, PAGES);
    expect(ogImage(read(a, 'index.html'))).not.toBe(ogImage(read(b, 'index.html')));
  });

  test('a missing screenshot fails naming the page and writes nothing', () => {
    const dir = makeBuild({ home: 'aaa' });
    const before = read(dir, 'index.html');
    expect(() => writeSharePages(dir, PAGES)).toThrow('leaderboard');
    expect(fs.existsSync(path.join(dir, 'gamba'))).toBe(false);
    expect(read(dir, 'index.html')).toBe(before);
  });
});

describe('rewriteProblems', () => {
  const CATCH_ALL = { source: '/((?!api/).*)', destination: '/index.html' };
  const BOARD = { source: '/gamba/leaderboard', destination: '/gamba/leaderboard/index.html' };

  test('a matching rewrite set has no problems', () => {
    expect(rewriteProblems([BOARD, CATCH_ALL], PAGES)).toEqual([]);
  });

  test('names a page whose rewrite is missing or below the catch-all', () => {
    const problem = '/gamba/leaderboard has no rewrite to /gamba/leaderboard/index.html above the catch-all';
    expect(rewriteProblems([CATCH_ALL], PAGES)).toEqual([problem]);
    expect(rewriteProblems([CATCH_ALL, BOARD], PAGES)).toEqual([problem]);
  });

  test('names a rewrite to a page that is not generated', () => {
    const shop = { source: '/shop', destination: '/shop/index.html' };
    expect(rewriteProblems([BOARD, shop, CATCH_ALL], PAGES)).toEqual([
      '/shop rewrites to /shop/index.html, which is not a share page',
    ]);
  });

  test('a missing catch-all is a problem', () => {
    expect(rewriteProblems([BOARD], PAGES)).toEqual([
      'vercel.json has no catch-all rewrite to /index.html',
    ]);
  });
});

describe('repo wiring', () => {
  test('vercel.json rewrites match the share pages', () => {
    expect(rewriteProblems(vercel.rewrites, SHARE_PAGES)).toEqual([]);
  });

  // The files aren't fingerprinted, so a day, then a week of revalidating in the background.
  test('vercel.json caches the TV, couch and GSN art for a day', () => {
    const cache = (source) => {
      const rule = (vercel.headers || []).find((h) => h.source === source);
      const header = rule && rule.headers.find((h) => h.key === 'Cache-Control');
      return header && header.value;
    };
    ['/tv/(.*)', '/couch/(.*)', '/gsn/(.*)'].forEach((source) =>
      expect([source, cache(source)]).toEqual([source, 'public, max-age=86400, stale-while-revalidate=604800'])
    );
  });

  test('every share page has its screenshot', () => {
    const missing = SHARE_PAGES.filter(
      (p) => !fs.existsSync(path.join(ROOT, 'public', 'share', `${p.id}.jpg`))
    ).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  test('the template card is the home screenshot', () => {
    const html = read(ROOT, 'public', 'index.html');
    expect(html).toContain('content="https://goofer.tv/share/home.jpg"');
    expect(html).toContain('property="og:image:width" content="1536"');
    expect(html).not.toContain('homepage-share.jpg');
  });
});
