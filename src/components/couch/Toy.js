import { useEffect, useRef, useState } from 'react';
import { pctStyle } from './couchLayout';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';

// A toy (spec: Toys): poke it and it reacts; it goes nowhere. Pointer and
// touch only, so it is hidden from screen readers and never in the tab order.
// It lights itself at most (a lit pumpkin is art, the neon sign is two pieces
// of art and an opacity), never a glow token.
export const TOY_MS = { light: 4000, wiggle: 600, drop: 2400, pop: 900, neon: 900 };
const NEON_ON_MS = 1200;
const NEON_CLASS = {
  on: 'motion-safe:animate-couch-neon-on',
  hum: 'motion-safe:animate-couch-neon-hum',
  off: 'motion-safe:animate-couch-neon-off',
};
const MOTION = {
  light: 'motion-safe:animate-couch-flicker',
  wiggle: 'motion-safe:animate-couch-wiggle',
  drop: 'motion-safe:animate-couch-drop',
};
const THREAD = 'before:absolute before:bottom-full before:left-1/2 before:h-[300%] before:w-px before:bg-onair-ink-5';

function Bubbles() {
  return (
    <span className="pointer-events-none absolute bottom-full left-[30%] h-[60%] w-[40%] motion-safe:animate-couch-pop" data-testid="toy-bubbles">
      <span className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-full bg-onair-paper/80" />
      <span className="absolute bottom-[30%] left-[45%] h-1 w-1 rounded-full bg-onair-paper/70" />
      <span className="absolute bottom-[60%] right-0 h-1.5 w-1.5 rounded-full bg-onair-paper/60" />
    </span>
  );
}

// The sign: the off art underneath, the lit art on top, and only the lit
// layer's opacity moves. Under reduced motion it is one picture that swaps.
function NeonSign({ toy, on, run, art }) {
  const [humming, setHumming] = useState(false);
  const calm = useRef(prefersReducedMotion()).current;
  useEffect(() => {
    if (calm || on) {
      setHumming(false);
      return undefined;
    }
    const t = setTimeout(() => setHumming(true), NEON_ON_MS);
    return () => clearTimeout(t);
  }, [calm, on, run]);

  if (calm) {
    const src = on ? art.active : art.idle;
    return src ? <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full" /> : null;
  }
  const phase = on ? 'off' : humming ? 'hum' : 'on';
  return (
    <>
      <img src={art.active} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      <img key={`${run}-${phase}`} src={art.idle} alt="" draggable={false} className={`pointer-events-none absolute inset-0 h-full w-full ${NEON_CLASS[phase]}`} />
    </>
  );
}

export default function Toy({ toy }) {
  const [on, setOn] = useState(false);
  const [run, setRun] = useState(0);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const poke = () => {
    if (toy.effect === 'toggle') {
      setOn((v) => !v);
      return;
    }
    clearTimeout(timer.current);
    setOn(true);
    setRun((n) => n + 1);
    const ms = TOY_MS[toy.effect] || 800;
    timer.current = setTimeout(() => setOn(false), ms);
  };

  const art = toy.art || {};
  const neon = toy.effect === 'neon' && art.idle && art.active;
  const src = on && art.active ? art.active : art.idle;
  const moving = on && MOTION[toy.effect] ? MOTION[toy.effect] : '';
  return (
    <span
      aria-hidden="true"
      data-toy={toy.id}
      data-on={on ? 'true' : 'false'}
      onPointerDown={poke}
      className="pointer-events-auto absolute cursor-pointer select-none"
      style={pctStyle(toy.rect)}
    >
      <span key={run} className={`absolute inset-0 ${toy.effect === 'drop' ? THREAD : ''} ${moving}`}>
        {neon && <NeonSign toy={toy} on={on} run={run} art={art} />}
        {!neon && src && <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full" />}
      </span>
      {on && toy.effect === 'pop' &&
        (art.extra ? (
          <img key={`x-${run}`} src={art.extra} alt="" className="pointer-events-none absolute bottom-full left-1/4 h-1/2 w-1/2 motion-safe:animate-couch-pop" />
        ) : (
          <Bubbles key={`b-${run}`} />
        ))}
    </span>
  );
}
