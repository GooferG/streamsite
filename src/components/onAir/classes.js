// Shared On Air class strings (DESIGN.md §7). Labels pick their own size and
// tracking; informational ones never go fainter than ink-5.
export const MONO = 'font-onair-mono uppercase';

export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-onair-signal';

// For controls inside an overflow-hidden track, where an outset ring is clipped.
export const FOCUS_INSET =
  'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-onair-signal';
