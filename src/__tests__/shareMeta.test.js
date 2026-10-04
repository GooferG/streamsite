/**
 * @jest-environment node
 */
import { applyShareMeta } from '../../scripts/share/shareMeta';
import { SHARE_PAGES } from '../../scripts/share/pages';

// Shaped like CRA's minified build/index.html head.
const TEMPLATE = [
  '<head>',
  '<meta name="description" content="old"/>',
  '<meta property="og:title" content="old"/>',
  '<meta property="og:description" content="old"/>',
  '<meta property="og:url" content="old"/>',
  '<meta property="og:type" content="website"/>',
  '<meta property="og:image" content="old"/>',
  '<meta property="og:image:secure_url" content="old"/>',
  '<meta property="og:image:type" content="image/jpeg"/>',
  '<meta property="og:image:width" content="1"/>',
  '<meta property="og:image:height" content="1"/>',
  '<meta property="og:image:alt" content="old"/>',
  '<meta name="twitter:card" content="summary_large_image"/>',
  '<meta name="twitter:title" content="old"/>',
  '<meta name="twitter:description" content="old"/>',
  '<meta name="twitter:image" content="old"/>',
  '<meta name="twitter:image:alt" content="old"/>',
  '<title>Goofer Live</title>',
  '</head>',
].join('');

const META = {
  title: 'Store · GooferG',
  description: 'Spend your watch-time tickets.',
  url: 'https://goofer.tv/store',
  image: 'https://goofer.tv/share/store.jpg?v=0123abcd',
  imageWidth: 1536,
  imageHeight: 1075,
};

// content="" of the one tag whose attr exactly equals key (the closing quote
// keeps og:image from matching og:image:width).
function contentOf(html, attr, key) {
  const tag = html.match(new RegExp(`<meta[^>]*\\b${attr}="${key}"[^>]*>`));
  if (!tag) return undefined;
  const content = tag[0].match(/content="([^"]*)"/);
  return content ? content[1] : undefined;
}

describe('applyShareMeta', () => {
  test('fills every card tag', () => {
    const html = applyShareMeta(TEMPLATE, META);
    expect(contentOf(html, 'name', 'description')).toBe(META.description);
    expect(contentOf(html, 'property', 'og:title')).toBe(META.title);
    expect(contentOf(html, 'property', 'og:description')).toBe(META.description);
    expect(contentOf(html, 'property', 'og:url')).toBe(META.url);
    expect(contentOf(html, 'property', 'og:image:alt')).toBe(META.description);
    expect(contentOf(html, 'name', 'twitter:title')).toBe(META.title);
    expect(contentOf(html, 'name', 'twitter:description')).toBe(META.description);
    expect(contentOf(html, 'name', 'twitter:image')).toBe(META.image);
    expect(contentOf(html, 'name', 'twitter:image:alt')).toBe(META.description);
  });

  test('keeps og:image apart from the og:image:* tags', () => {
    const html = applyShareMeta(TEMPLATE, META);
    expect(contentOf(html, 'property', 'og:image')).toBe(META.image);
    expect(contentOf(html, 'property', 'og:image:secure_url')).toBe(META.image);
    expect(contentOf(html, 'property', 'og:image:width')).toBe('1536');
    expect(contentOf(html, 'property', 'og:image:height')).toBe('1075');
    expect(contentOf(html, 'property', 'og:image:type')).toBe('image/jpeg');
  });

  test('leaves the tab title and fixed tags alone', () => {
    const html = applyShareMeta(TEMPLATE, META);
    expect(html).toContain('<title>Goofer Live</title>');
    expect(contentOf(html, 'property', 'og:type')).toBe('website');
    expect(contentOf(html, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  test('escapes copy so it cannot break the attribute', () => {
    const html = applyShareMeta(TEMPLATE, {
      ...META,
      description: 'Hunts & "battles" <live> $& more',
    });
    expect(contentOf(html, 'property', 'og:description')).toBe(
      'Hunts &amp; &quot;battles&quot; &lt;live&gt; $&amp; more'
    );
    expect(html.match(/<meta/g)).toHaveLength(16);
  });

  test('matches tags whatever the attribute order or closing style', () => {
    const template = TEMPLATE.replace(
      '<meta property="og:title" content="old"/>',
      '<meta content="old" property="og:title" />'
    );
    const html = applyShareMeta(template, META);
    expect(contentOf(html, 'property', 'og:title')).toBe(META.title);
  });

  test('throws naming the tag the template is missing', () => {
    const template = TEMPLATE.replace('<meta name="twitter:image" content="old"/>', '');
    expect(() => applyShareMeta(template, META)).toThrow('twitter:image');
  });
});

describe('SHARE_PAGES', () => {
  test('ids and paths are unique and home is /', () => {
    const ids = SHARE_PAGES.map((p) => p.id);
    const paths = SHARE_PAGES.map((p) => p.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(SHARE_PAGES.find((p) => p.id === 'home').path).toBe('/');
  });

  test('every page has a clean path, a title and a description', () => {
    for (const page of SHARE_PAGES) {
      expect(page.id).toMatch(/^[a-z0-9-]+$/);
      expect(page.path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/);
      expect(page.title.trim()).not.toBe('');
      expect(page.description.trim()).not.toBe('');
    }
  });
});
