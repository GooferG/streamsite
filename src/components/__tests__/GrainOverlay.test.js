import { render } from '@testing-library/react';
import GrainOverlay from '../GrainOverlay';

const real = { getContext: HTMLCanvasElement.prototype.getContext, toDataURL: HTMLCanvasElement.prototype.toDataURL };
let contexts;
beforeEach(() => {
  contexts = [];
  // jsdom has no canvas: a stand-in that paints nothing.
  HTMLCanvasElement.prototype.getContext = (...args) => {
    contexts.push(args);
    return {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {},
    };
  };
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
});
afterEach(() => Object.assign(HTMLCanvasElement.prototype, real));

test('the grain only drifts when motion is welcome (Motion Has An Off Switch)', () => {
  const { container } = render(<GrainOverlay />);
  const grain = container.querySelector('#grain-overlay');
  // No inline animation, which no media query could switch off.
  expect(grain.style.animation).toBe('');
  expect(grain.className).toContain('motion-safe:animate-[grain_8s_steps(10)_infinite]');
  // The texture itself stays.
  expect(grain.style.backgroundImage).toContain('data:image/png');
});

test('the noise canvas is made for reading back, so toDataURL needs no GPU readback', () => {
  render(<GrainOverlay />);
  expect(contexts).toEqual([['2d', { willReadFrequently: true }]]);
});

