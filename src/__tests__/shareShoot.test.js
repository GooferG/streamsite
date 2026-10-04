/**
 * @jest-environment node
 */
import { parseShootArgs } from '../../scripts/share/shoot';

const PAGES = [
  { id: 'home', path: '/' },
  { id: 'store', path: '/store' },
  { id: 'hunts', path: '/gamba/hunts' },
];

describe('parseShootArgs', () => {
  test('defaults to every page on goofer.tv', () => {
    expect(parseShootArgs([], PAGES)).toEqual({ base: 'https://goofer.tv', pages: PAGES });
  });

  test('--only picks pages, kept in list order', () => {
    const { pages } = parseShootArgs(['--only=hunts, store'], PAGES);
    expect(pages.map((p) => p.id)).toEqual(['store', 'hunts']);
  });

  test('--only with an unknown id names the valid ones', () => {
    expect(() => parseShootArgs(['--only=store,shop'], PAGES)).toThrow(
      'Unknown page id(s): shop. Valid: home, store, hunts'
    );
  });

  test('--only with nothing after it is an error', () => {
    expect(() => parseShootArgs(['--only='], PAGES)).toThrow('--only needs');
  });

  test('--base drops trailing slashes', () => {
    expect(parseShootArgs(['--base=http://localhost:3000/'], PAGES).base).toBe(
      'http://localhost:3000'
    );
  });

  test('--base must be an http(s) URL', () => {
    expect(() => parseShootArgs(['--base=goofer.tv'], PAGES)).toThrow('--base must be');
  });

  test('unknown flags are errors', () => {
    expect(() => parseShootArgs(['--dry'], PAGES)).toThrow('Unknown argument: --dry');
  });
});
