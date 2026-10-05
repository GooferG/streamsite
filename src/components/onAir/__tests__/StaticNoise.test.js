import { render, screen } from '@testing-library/react';
import StaticNoise, { TILE, staticTile } from '../StaticNoise';

const config = require('../../../../tailwind.config.js');

test('static is decorative and takes a test id, class and style', () => {
  render(<StaticNoise testId="tv-static" className="absolute inset-0" style={{ top: 57 }} />);
  const el = screen.getByTestId('tv-static');
  expect(el.getAttribute('aria-hidden')).toBe('true');
  expect(el.className).toMatch(/absolute inset-0/);
  expect(el.style.top).toBe('57px');
});

test('the noise is one tile, drawn once, moved by a transform-only stepped animation with no filter', () => {
  render(
    <>
      <StaticNoise testId="a" />
      <StaticNoise testId="b" />
    </>
  );
  const layers = [screen.getByTestId('a'), screen.getByTestId('b')].map((el) => el.querySelector('[data-static-noise]'));
  layers.forEach((layer) => {
    expect(layer.style.backgroundImage).toBe(`url(${staticTile()})`);
    expect(layer.style.filter).toBe('');
    expect(layer.className).toContain('motion-safe:animate-onair-static');
  });
  // The rolling band stays, and only moves under motion-safe too.
  expect(screen.getByTestId('a').querySelector('.motion-safe\\:animate-onair-roll')).toBeTruthy();
  const { keyframes, animation } = config.theme.extend;
  Object.values(keyframes['onair-static']).forEach((frame) => expect(Object.keys(frame)).toEqual(['transform']));
  // No jump reaches past the layer's 64px overhang.
  Object.values(keyframes['onair-static']).forEach(({ transform }) =>
    transform.match(/-?\d+/g).forEach((n) => expect(Math.abs(Number(n))).toBeLessThan(64))
  );
  expect(animation['onair-static']).toMatch(/steps\(1\)/);
});

test('the tile is a grey noise bitmap, made once', () => {
  const url = staticTile();
  expect(staticTile()).toBe(url);
  expect(url.startsWith('data:image/bmp;base64,')).toBe(true);
  const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(String.fromCharCode(bytes[0], bytes[1])).toBe('BM');
  expect(view.getUint32(2, true)).toBe(bytes.length);
  expect([view.getInt32(18, true), view.getInt32(22, true), view.getUint16(28, true)]).toEqual([TILE, TILE, 4]);
  // A palette of greys (blue, green and red equal), and pixels that use the whole range.
  for (let i = 0; i < 16; i += 1) {
    const [b, g, r] = bytes.slice(54 + i * 4, 57 + i * 4);
    expect(b === g && g === r).toBe(true);
  }
  const pixels = Array.from(bytes.slice(view.getUint32(10, true))).flatMap((byte) => [byte >> 4, byte & 15]);
  expect(pixels).toHaveLength(TILE * TILE);
  expect(new Set(pixels).size).toBe(16);
  const black = pixels.filter((p) => p === 0).length / pixels.length;
  expect(black).toBeGreaterThan(0.1);
  expect(black).toBeLessThan(0.3);
});
