import { useCallback, useEffect, useMemo, useRef } from 'react';

// Synthesized OBS overlay sounds (Web Audio, no files): tick, burst(ms) and
// land. Shared by the giveaway and Goofer Ball overlays; silent unless the
// browser source URL has ?sound=1.
export default function useOverlaySound(enabled) {
  const ctxRef = useRef(null);
  const noiseRef = useRef(null);

  useEffect(
    () => () => {
      ctxRef.current?.close?.().catch(() => {});
      ctxRef.current = null;
    },
    []
  );

  const getCtx = useCallback(() => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      ctxRef.current = ctx;
      noiseRef.current = buf;
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, [enabled]);

  const noise = useCallback(
    (ms, gain, freq) => {
      const ctx = getCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseRef.current;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      src.connect(filter).connect(g).connect(ctx.destination);
      src.start(t);
      src.stop(t + ms / 1000 + 0.02);
    },
    [getCtx]
  );

  const thump = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.34);
  }, [getCtx]);

  return useMemo(
    () => ({
      tick: () => noise(30, 0.22, 2600),
      burst: (ms = 300) => noise(ms, 0.3, 1400),
      land: () => {
        noise(180, 0.28, 900);
        thump();
      },
    }),
    [noise, thump]
  );
}
