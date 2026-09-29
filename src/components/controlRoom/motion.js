export const MOTION = { powerOn: 550, powerOff: 320, pillIn: 180, tabSwap: 110, tabFlip: 240, reducedFade: 150 };

export function prefersReducedMotion() {
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// FLIP: animate `el` from `from` (a DOMRect captured before a layout change)
// to where it is now. Web Animations without `fill`, so no transform stays on
// the panel afterwards (a resting transform would trap fixed-position modals).
export function flipFrom(el, from, { duration = 300, easing = 'cubic-bezier(.2,1.25,.3,1)' } = {}) {
  if (!el || !from || typeof el.animate !== 'function' || prefersReducedMotion()) return;
  const to = el.getBoundingClientRect();
  if (!to.width || !to.height) return;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  el.animate(
    [
      { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transformOrigin: 'top left', transform: 'none' },
    ],
    { duration, easing }
  );
}
