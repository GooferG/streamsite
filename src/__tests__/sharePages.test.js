/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeSharePages } from '../../scripts/share/write-pages';
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
    expect(board).toContain('<title>Goofer Live</title>');
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

describe('repo wiring', () => {
  const { rewrites } = vercel;
  const catchAll = rewrites.findIndex((r) => r.destination === '/index.html');

  test('every non-root share page has a rewrite above the catch-all', () => {
    expect(catchAll).toBeGreaterThan(-1);
    const wrong = SHARE_PAGES.filter((p) => p.path !== '/')
      .filter((p) => {
        const i = rewrites.findIndex((r) => r.source === p.path);
        return i === -1 || i > catchAll || rewrites[i].destination !== `${p.path}/index.html`;
      })
      .map((p) => p.path);
    expect(wrong).toEqual([]);
  });

  test('no rewrite points at a share page that is not generated', () => {
    const paths = new Set(SHARE_PAGES.map((p) => p.path));
    const stale = rewrites
      .filter((r, i) => i !== catchAll && r.destination.endsWith('/index.html'))
      .filter((r) => !paths.has(r.destination.replace(/\/index\.html$/, '')))
      .map((r) => r.source);
    expect(stale).toEqual([]);
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
