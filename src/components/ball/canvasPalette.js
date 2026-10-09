// The drum is a canvas, which can't use Tailwind classes, so it draws with
// these. CANVAS mirrors tailwind.config.js (onair.paper, onair.wgoof.shade);
// the On Air contract test fails if they drift. DECALS tint a ball until its
// slot art loads (raw colours, a recorded exemption like the per-slot tints).
export const CANVAS = { paper: '#ece3cf', shade: '#a99c82', ink: '#231c17', white: '#ffffff' };
export const DECALS = ['#5b3fd6', '#ff8a3d', '#3ee0bf', '#e64b8b', '#ffd166', '#5aa9ff', '#9be15d'];
