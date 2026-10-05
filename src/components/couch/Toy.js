import { useEffect, useRef, useState } from 'react';
import { pctStyle } from './couchLayout';

// A toy (spec: Toys): poke it and it reacts; it goes nowhere. Pointer and
// touch only, so it is hidden from screen readers and never in the tab order.
// It lights itself at most (a lit pumpkin is art), never the room.
export const TOY_MS = { light: 4000, wiggle: 600, drop: 2400, pop: 900 };
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
        {src && <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full" />}
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
