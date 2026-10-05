import { useCallback, useRef, useState } from 'react';
import { intersects, pctStyle, within } from './couchLayout';
import { moonPath, moonPhase } from './moon';

// The window (spec: The window). The glass is transparent in the room's art:
// WindowOutside renders behind the plate, WindowFront (the blinds and the toy
// hit areas) in front of it. Always night; pointer and touch only; silent; it
// lights nothing in the room.
const STARS = [[8, 12], [18, 30], [27, 8], [39, 22], [52, 10], [61, 34], [73, 18], [86, 9], [92, 28], [14, 46], [47, 44], [80, 40]];
// The moon's box in percent of the glass; the harvest moon is bigger.
export const MOON = { x: 60, y: 46, w: 18 };
export const HARVEST = { x: 52, y: 40, w: 30 };
const BAT = 'M0 5 Q3 0 6 4 Q8 2 10 4 Q12 2 14 4 Q17 0 20 5 Q15 4 12 7 Q10 5 8 7 Q5 4 0 5 Z';

// The moon's hit box in percent of the art: square on screen, so its height is
// its width times the art's aspect.
export function moonBox([gx, gy, gw, gh], harvest, aspect) {
  const m = harvest ? HARVEST : MOON;
  const w = (m.w / 100) * gw;
  return [gx + (m.x / 100) * gw, gy + (m.y / 100) * gh, w, w * aspect];
}

export function useWindowState() {
  const [wink, setWink] = useState(0);
  const [shooting, setShooting] = useState(0);
  const [witch, setWitch] = useState(0);
  const [blindsUp, setBlindsUp] = useState(false);
  const taps = useRef(0);
  const pokeMoon = useCallback((halloween) => {
    setWink((n) => n + 1);
    taps.current += 1;
    if (halloween && taps.current % 3 === 0) setWitch((n) => n + 1);
  }, []);
  const pokeSky = useCallback(() => setShooting((n) => n + 1), []);
  const pullCord = useCallback(() => setBlindsUp((v) => !v), []);
  return { wink, shooting, witch, blindsUp, pokeMoon, pokeSky, pullCord };
}

export function WindowOutside({ win, state, now, theme, witch = null }) {
  if (!win || !win.glass) return null;
  const harvest = theme === 'halloween';
  const phase = harvest ? 0.5 : moonPhase(now);
  const m = harvest ? HARVEST : MOON;
  return (
    <div aria-hidden="true" data-testid="window-outside" className="couch-sky pointer-events-none absolute overflow-hidden" style={pctStyle(win.glass)}>
      {STARS.map(([x, y], i) => (
        <span
          key={i}
          className="couch-star absolute h-[3px] w-[3px] rounded-full motion-safe:animate-couch-twinkle"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 5) * 0.7}s` }}
        />
      ))}
      <svg
        key={`moon-${state.wink}`}
        viewBox="0 0 100 100"
        data-testid="window-moon"
        data-phase={phase.toFixed(2)}
        className={`absolute ${state.wink ? 'motion-safe:animate-couch-blink' : ''}`}
        style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%` }}
      >
        <circle cx="50" cy="50" r="50" className="couch-moon-dark" />
        <path d={moonPath(phase)} className={harvest ? 'couch-moon couch-moon--harvest' : 'couch-moon'} />
      </svg>
      {state.shooting ? (
        <span key={`star-${state.shooting}`} data-testid="window-shooting" className="couch-shooting absolute left-[8%] top-[16%] h-[2px] w-[22%] motion-reduce:hidden motion-safe:animate-couch-shoot" />
      ) : null}
      <span className="pointer-events-none absolute inset-x-0 top-[24%] motion-reduce:hidden motion-safe:animate-couch-cross">
        <span className="couch-plane block h-[3px] w-[3px] rounded-full" />
      </span>
      {harvest && (
        <span className="pointer-events-none absolute inset-x-0 top-[30%] motion-safe:animate-couch-cross" style={{ animationDuration: '31s' }}>
          <span data-testid="window-bats" className="flex w-[30%] gap-[6%]">
            {[0, 1, 2, 3].map((i) => (
              <svg key={i} viewBox="0 0 20 8" className="couch-bat w-1/4" style={{ marginTop: `${(i % 2) * 6}%` }}>
                <path d={BAT} />
              </svg>
            ))}
          </span>
        </span>
      )}
      {harvest && witch && state.witch ? (
        <span key={`witch-${state.witch}`} className="pointer-events-none absolute inset-x-0 top-[20%] motion-reduce:hidden motion-safe:animate-couch-cross" style={{ animationDuration: '4s', animationIterationCount: 1, animationFillMode: 'forwards' }}>
          <img src={witch} alt="" data-testid="window-witch" className="block w-[22%]" />
        </span>
      ) : null}
      {win.skyline && <img src={win.skyline.src} alt="" className="absolute" style={pctStyle(within(win.glass, win.skyline.rect))} />}
    </div>
  );
}

export function WindowFront({ win, state, theme, aspect }) {
  if (!win || !win.glass) return null;
  const halloween = theme === 'halloween';
  // Lowered blinds hide part of the glass: the moon is inert only if they cover
  // it, and the sky answers only below them. The cord always works.
  const down = Boolean(win.blinds) && !state.blindsUp;
  const [gx, gy, gw, gh] = win.glass;
  const glassBottom = gy + gh;
  const blindsBottom = down ? Math.min(Math.max(win.blinds.rect[1] + win.blinds.rect[3], gy), glassBottom) : gy;
  const skyRect = down ? [gx, blindsBottom, gw, glassBottom - blindsBottom] : win.glass;
  const skyDead = down && skyRect[3] <= 0;
  const box = moonBox(win.glass, halloween, aspect);
  const moonDead = down && intersects(box, win.blinds.rect);
  const live = (dead) => (dead ? 'pointer-events-none' : 'cursor-pointer');
  return (
    <>
      {win.blinds && (
        <span aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={pctStyle(win.blinds.rect)}>
          <img
            src={win.blinds.src}
            alt=""
            data-testid="window-blinds"
            data-up={state.blindsUp ? 'true' : 'false'}
            className={`h-full w-full origin-top transition-transform duration-500 ease-out motion-reduce:transition-none ${state.blindsUp ? 'scale-y-[0.18]' : ''}`}
          />
        </span>
      )}
      <span aria-hidden="true" data-toy="sky" onPointerDown={skyDead ? undefined : state.pokeSky} className={`absolute ${live(skyDead)}`} style={pctStyle(skyRect)} />
      <span
        aria-hidden="true"
        data-toy="moon"
        onPointerDown={moonDead ? undefined : () => state.pokeMoon(halloween)}
        className={`absolute ${live(moonDead)} rounded-full`}
        style={pctStyle(box)}
      />
      {win.cord && <span aria-hidden="true" data-toy="cord" onPointerDown={state.pullCord} className="absolute cursor-pointer" style={pctStyle(win.cord)} />}
    </>
  );
}
