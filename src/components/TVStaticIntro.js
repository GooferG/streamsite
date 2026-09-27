import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createCrt } from '../utils/crtBoot';
import { playPowerOn } from '../utils/crtAudio';
import {
  BOOT_MS,
  LOCK_MS,
  GATE_MS,
  FLIP_STATIC_MS,
  FLIP_LOCK_MS,
  REDUCED_FADE_MS,
  HISS,
  gateFrame,
} from '../utils/crtTimeline';

// First-load TV intro (mode picked by utils/introMode).
//  gate: black tube on standby until the viewer presses anywhere, then the
//        power-on (dot -> line -> static, with sound) and signal lock.
//  flip: a short burst of CSS static, then signal lock. No press, no sound.
// onReveal fires as the signal starts locking so the page fades in under the
// static; onComplete fires when the overlay can unmount.

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS']);

const SCANLINES =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)';
const VIGNETTE = 'inset 0 0 22vmin 4vmin rgba(0,0,0,0.75)';
const TILE_PX = 256; // drawn at 2x with pixelated scaling: 2px grains, 512px repeat

// Speckle tile, white with brightness as alpha, so fading static lingers
// over the page as speckle instead of a grey haze. Made once.
let noiseTile;
function getNoiseTile() {
  if (noiseTile !== undefined) return noiseTile;
  noiseTile = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(TILE_PX, TILE_PX);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 235;
        d[i + 1] = 242;
        d[i + 2] = 255;
        d[i + 3] = Math.random() < 0.45 ? Math.random() * 60 : 120 + Math.random() * 135;
      }
      ctx.putImageData(img, 0, 0);
      noiseTile = canvas.toDataURL();
    }
  } catch {
    noiseTile = null;
  }
  return noiseTile;
}

function Standby({ onPress, fading }) {
  return (
    <button
      type="button"
      autoFocus={!fading}
      onClick={onPress}
      disabled={fading}
      aria-label="Turn on the channel"
      className="group absolute inset-0 block w-full h-full cursor-pointer bg-[#050505] focus:outline-none"
    >
      {/* Tube glass: a faint reflection up top, dark corners. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 28% 18%, rgba(255,255,255,0.045), transparent 70%), radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.75) 100%)',
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)',
        }}
      />

      <span
        aria-hidden="true"
        className="absolute top-6 left-6 sm:top-10 sm:left-10 font-mono text-xs sm:text-sm font-bold tracking-eyebrow uppercase text-white/55"
      >
        CH 03
      </span>

      <span
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      >
        <span
          className="relative font-mono text-3xl sm:text-5xl font-bold tracking-eyebrow uppercase text-white/85"
          style={{ textShadow: '0 0 14px rgba(255,255,255,0.28)' }}
        >
          {/* Outside the flow so PWR stays centered while the cursor blinks. */}
          <span className="absolute right-full mr-3 sm:mr-4 motion-safe:animate-crt-blink">▸</span>
          PWR
        </span>
        <span className="mt-5 font-mono text-[0.6875rem] sm:text-xs tracking-eyebrow-sm text-white/45 group-focus-visible:text-white/80 transition-colors duration-150">
          press anywhere to turn it on
        </span>
      </span>

      <span
        aria-hidden="true"
        className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 flex items-center gap-2.5"
      >
        <span className="font-mono text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/30">
          Standby
        </span>
        <span
          className="block w-2 h-2 rounded-full bg-red-500 motion-safe:animate-crt-led"
          style={{
            boxShadow: '0 0 6px 1px rgba(239,68,68,0.7), 0 0 18px 4px rgba(239,68,68,0.25)',
          }}
        />
      </span>
    </button>
  );
}

export default function TVStaticIntro({ mode, reduced = false, onPowerOn, onReveal, onComplete }) {
  const [phase, setPhase] = useState(mode === 'gate' ? 'standby' : 'boot');
  const [hasCrt, setHasCrt] = useState(false);
  const [tile] = useState(getNoiseTile);
  const mountRef = useRef(null);
  const crtRef = useRef(null);
  const pressedRef = useRef(false);
  const timersRef = useRef([]);
  const rafRef = useRef(0);

  // Callbacks via ref: App re-renders when Twitch data lands, and a new
  // function identity must never restart the sequence.
  const cbs = useRef({});
  cbs.current = { onPowerOn, onReveal, onComplete };

  const later = useCallback((ms, fn) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  const reveal = useCallback(() => {
    setPhase('lock');
    cbs.current.onReveal?.();
  }, []);
  const finish = useCallback(() => {
    cbs.current.onComplete?.();
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // Flip runs on its own.
  useEffect(() => {
    if (mode !== 'flip') return undefined;
    const t1 = setTimeout(reveal, FLIP_STATIC_MS);
    const t2 = setTimeout(finish, FLIP_STATIC_MS + FLIP_LOCK_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mode, reveal, finish]);

  // Gate: build the renderer while on standby so the press starts instantly.
  useEffect(() => {
    if (mode !== 'gate' || reduced || !mountRef.current) return undefined;
    const crt = createCrt(mountRef.current);
    crtRef.current = crt;
    setHasCrt(!!crt);
    if (!crt) return undefined;
    const onResize = () => crt.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      crt.dispose();
      crtRef.current = null;
    };
  }, [mode, reduced]);

  const press = useCallback(() => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    cbs.current.onPowerOn?.();
    playPowerOn(reduced ? {} : { hiss: HISS });

    if (reduced) {
      reveal();
      later(REDUCED_FADE_MS, finish);
      return;
    }

    setPhase('boot');
    later(BOOT_MS, reveal);
    later(GATE_MS, finish);

    const crt = crtRef.current;
    if (!crt) return;
    const start = performance.now();
    const tick = (now) => {
      const ms = now - start;
      crt.render(ms, gateFrame(ms));
      if (ms < GATE_MS) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [reduced, reveal, finish, later]);

  // Any key powers on (not modifier shortcuts, so devtools etc. still work).
  useEffect(() => {
    if (phase !== 'standby') return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || MODIFIER_KEYS.has(e.key)) return;
      if (e.key === 'Tab') e.preventDefault();
      press();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, press]);

  // No scrolling the invisible page while the tube covers it.
  const covering = phase === 'standby' || phase === 'boot';
  useEffect(() => {
    if (!covering) return undefined;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [covering]);

  const locking = phase === 'lock';
  const lockMs = mode === 'flip' ? FLIP_LOCK_MS : LOCK_MS;
  const cssStatic =
    !reduced && (mode === 'flip' || (phase !== 'standby' && !hasCrt));

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        pointerEvents: locking ? 'none' : 'auto',
        opacity: locking && reduced ? 0 : 1,
        transition: reduced ? `opacity ${REDUCED_FADE_MS}ms ease-out` : undefined,
      }}
    >
      {/* WebGL canvas mounts here (gate only). */}
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />

      {cssStatic && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black"
            style={{
              opacity: locking ? 0 : 1,
              transition: `opacity ${Math.round(lockMs * 0.6)}ms ease-out`,
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 motion-safe:animate-crt-static"
            style={{
              // crt-static moves the second layer (the tile) only.
              backgroundImage: tile ? `${SCANLINES}, url(${tile})` : SCANLINES,
              backgroundSize: tile ? `100% 3px, ${TILE_PX * 2}px ${TILE_PX * 2}px` : '100% 3px',
              // Inset shadow paints above the backgrounds: tube vignette.
              boxShadow: VIGNETTE,
              imageRendering: 'pixelated',
              opacity: locking ? 0 : 1,
              transition: `opacity ${lockMs}ms ease-in`,
            }}
          />
          {locking && (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[18vh] motion-safe:animate-crt-roll"
              style={{
                animationDuration: `${lockMs}ms`,
                background:
                  'linear-gradient(to bottom, transparent, rgba(230,240,255,0.14), transparent)',
              }}
            />
          )}
        </>
      )}

      {mode === 'gate' && (phase === 'standby' || reduced) && (
        <Standby onPress={press} fading={phase !== 'standby'} />
      )}
    </div>
  );
}
