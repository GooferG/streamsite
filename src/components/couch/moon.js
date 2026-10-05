// Tonight's moon (spec: The window). Pure.
const SYNODIC_DAYS = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

// 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
export function moonPhase(now) {
  const days = (now - NEW_MOON) / 86400000;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

// The lit part of a moon of radius r in a 2r × 2r box, as an SVG path: the lit
// limb (right while waxing, left while waning), then the terminator, an
// ellipse that bulges toward the lit side for a crescent and away for a gibbous.
export function moonPath(phase, r = 50) {
  const p = ((phase % 1) + 1) % 1;
  const waxing = p < 0.5;
  const k = Math.cos(2 * Math.PI * p);
  const rx = round2(Math.abs(k) * r);
  const limb = waxing ? 1 : 0;
  const terminator = waxing === k > 0 ? 0 : 1;
  return `M ${r} 0 A ${r} ${r} 0 0 ${limb} ${r} ${2 * r} A ${rx} ${r} 0 0 ${terminator} ${r} 0 Z`;
}
