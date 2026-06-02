// Tests for the pure live-share OG formatting helpers. Imports the
// firebase-free helper module so no admin SDK boot is triggered.
import {
  buildDescription,
  injectOgTags,
} from '../../api/_lib/livePreviewFormat.js';

describe('buildDescription', () => {
  test('start balance + bonus count', () => {
    expect(
      buildDescription({ startBalance: 1200, bonuses: [{}, {}, {}] })
    ).toBe('$1,200 in the hunt · 3 bonuses collected');
  });

  test('singular bonus', () => {
    expect(buildDescription({ startBalance: 500, bonuses: [{}] })).toBe(
      '$500 in the hunt · 1 bonus collected'
    );
  });

  test('no start balance omits the amount clause', () => {
    expect(buildDescription({ bonuses: [{}, {}] })).toBe('2 bonuses collected');
  });

  test('empty hunt falls back to a generic line', () => {
    expect(buildDescription({})).toBe('LIVE bonus hunt on GooferG');
  });
});

describe('injectOgTags', () => {
  const html =
    '<title>Goofer Live</title>' +
    '<meta property="og:title" content="GooferG" />' +
    '<meta property="og:description" content="streams, bonus hunts, clips and more." />' +
    '<meta property="og:url" content="https://goofer.tv" />' +
    '<meta name="twitter:title" content="GooferG" />' +
    '<meta name="twitter:description" content="streams, bonus hunts, clips and more." />';

  test('replaces title, description, and url tags', () => {
    const out = injectOgTags(html, {
      title: 'My Hunt — LIVE on GooferG',
      description: '$1,200 in the hunt · 3 bonuses collected',
      url: 'https://goofer.tv/live/abc',
    });
    expect(out).toContain('<title>My Hunt — LIVE on GooferG</title>');
    expect(out).toContain(
      '<meta property="og:title" content="My Hunt — LIVE on GooferG" />'
    );
    expect(out).toContain(
      '<meta property="og:description" content="$1,200 in the hunt · 3 bonuses collected" />'
    );
    expect(out).toContain(
      '<meta property="og:url" content="https://goofer.tv/live/abc" />'
    );
    expect(out).toContain(
      '<meta name="twitter:title" content="My Hunt — LIVE on GooferG" />'
    );
    expect(out).toContain(
      '<meta name="twitter:description" content="$1,200 in the hunt · 3 bonuses collected" />'
    );
  });

  test('escapes HTML-special characters in injected values', () => {
    const out = injectOgTags(html, {
      title: 'A & B "quote"',
      description: 'x',
      url: 'https://goofer.tv/live/abc',
    });
    expect(out).toContain('A &amp; B &quot;quote&quot;');
    expect(out).not.toContain('A & B "quote"');
  });
});
