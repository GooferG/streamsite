// Timing for the TV intro. The gate's power-on is shader-driven off
// gateFrame(); the flip is plain CSS and only needs its durations.

export const BOOT_MS = 1200; // dot -> line -> static
export const LOCK_MS = 700; // static thins out, page resolves underneath
export const GATE_MS = BOOT_MS + LOCK_MS;

export const FLIP_STATIC_MS = 220;
export const FLIP_LOCK_MS = 480;

export const REDUCED_FADE_MS = 250;

// Hiss envelope for crtAudio, in seconds from the press.
export const HISS = {
  in: (BOOT_MS * 0.3) / 1000,
  full: (BOOT_MS * 0.38) / 1000,
  fade: BOOT_MS / 1000,
  out: GATE_MS / 1000,
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Shader uniforms `ms` after the power button press.
export function gateFrame(ms) {
  const t = clamp01(ms / BOOT_MS);
  const p = clamp01((ms - BOOT_MS) / LOCK_MS);

  const dot = t < 0.1 ? 1 - t / 0.1 : 0;
  const line = t < 0.15 ? Math.min(1, t / 0.1) : Math.max(0, 1 - (t - 0.15) / 0.12);
  const rise = clamp01((t - 0.3) / 0.08);

  return {
    dot,
    line,
    stat: rise * (1 - smooth(0, 0.85, p)),
    backing: 1 - smooth(0, 0.6, p),
    // Roll bar sweeps from just above the top to below the bottom; -1 = hidden.
    roll: ms >= BOOT_MS && p < 1 ? p * 1.4 - 0.2 : -1,
    locking: ms >= BOOT_MS,
    done: ms >= GATE_MS,
  };
}
