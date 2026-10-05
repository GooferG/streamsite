import { useCallback, useEffect, useRef, useState } from 'react';
import { MONO } from '../onAir/classes';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import { betMoney, multiplier, plural, shortMoney, shortUntil, wager } from './couchCopy';
import { SCREEN_CLASS } from './couchLayout';

// The laptop on the coffee table (spec: The laptop). A little desktop: off air
// it cycles windows (the BEAN board, the last hunt, the hunt history, the GG
// screensaver), and a live hunt or a prediction round takes the screen over.
// On Air readouts only, never casino imagery; it turns on but never glows.
// Decorative: the laptop door's link says what is on, and follows the window.
export const WINDOW_MS = 7000;
const NONE = [];

// The screen's type, in container units and never below 10px. Figures are
// mono without the labels' capitals, so a multiplier stays "1,240x".
const LABEL = `${MONO} text-[max(10px,4.5cqw)] tracking-[0.15em]`;
const FIGURE = 'font-onair-mono text-[max(10px,4.5cqw)] tracking-[0.15em] tabular-nums';
const TEXT = 'font-onair text-[max(10px,5cqw)]';

// Pinned to its (positioned) box: a grid row would let the art outgrow it.
function Mark({ bug }) {
  return bug ? <img src={bug} alt="" className="absolute inset-0 h-full w-full object-contain" /> : 'GG';
}

// The desktop's wallpaper: the GG (or the theme's bug), small in a corner.
function Wallpaper({ bug }) {
  return (
    <span
      data-testid="laptop-wallpaper"
      className="absolute bottom-[0.8cqw] right-[3.5cqw] grid h-[4.4cqw] w-[9cqw] place-items-center font-onair text-[max(10px,4cqw)] font-extrabold leading-none text-onair-ink-5"
    >
      <Mark bug={bug} />
    </span>
  );
}

// An OS window: a title bar with three dots, then its readout. It pops in
// when it comes up (keyed by the caller), and cuts in under reduced motion.
function Window({ id, title, tone = 'text-onair-ink-2', aside = null, calm, children }) {
  return (
    <div
      data-testid="laptop-window"
      data-window={id}
      className={`absolute inset-x-[3cqw] bottom-[6cqw] top-[2.5cqw] flex flex-col overflow-hidden rounded-onair-case bg-onair-surface-4 shadow-onair-card ${
        calm ? '' : 'motion-safe:animate-couch-laptop-in'
      }`}
    >
      <div data-testid="laptop-titlebar" className="flex shrink-0 items-center gap-[2cqw] bg-onair-surface-raised px-[2.5cqw] py-[1cqw]">
        <span className="flex shrink-0 gap-[1cqw]">
          {[0, 1, 2].map((i) => (
            <span key={i} data-dot className="h-[1.8cqw] w-[1.8cqw] rounded-full bg-onair-ink-6" />
          ))}
        </span>
        <span className={`${LABEL} min-w-0 flex-1 truncate leading-none ${tone}`}>{title}</span>
        {aside}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col gap-[1cqw] px-[3cqw] py-[1.6cqw]">{children}</div>
    </div>
  );
}

function Board({ win, calm }) {
  return (
    <Window id={win.id} title={win.title} calm={calm}>
      <ol className="flex min-h-0 flex-1 flex-col justify-between">
        {win.rows.map((r) => (
          <li key={r.rank} className="flex items-baseline gap-[2cqw] leading-none">
            <span className={`${FIGURE} shrink-0 text-onair-ink-5`}>{r.rank}</span>
            {/* The handle as the board masked it, case and all. */}
            <span className={`${TEXT} min-w-0 flex-1 truncate font-bold text-onair-ink-1`}>{r.handle}</span>
            <span className={`${FIGURE} shrink-0 text-onair-ink-3`}>{wager(r.wagered)}</span>
          </li>
        ))}
      </ol>
      {win.resetsIn ? <span className={`${LABEL} shrink-0 leading-none text-onair-ink-5`}>Resets in {shortUntil(win.resetsIn)}</span> : null}
    </Window>
  );
}

function Recap({ win, calm }) {
  const up = win.result != null && win.result >= 0;
  return (
    <Window id={win.id} title={win.title} calm={calm}>
      {/* Cost to total, then the chip: under the figures when they're long (a CA$ or ARS hunt). */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-[2cqw] gap-y-[1cqw] leading-none">
        <span className="min-w-0 truncate font-onair text-[max(10px,6.5cqw)] font-extrabold text-onair-ink-1">
          {win.start != null && <span className="text-onair-ink-4">{shortMoney(win.start, win.currency)} → </span>}
          {shortMoney(win.won, win.currency)}
        </span>
        {win.result != null && (
          <span
            data-testid="laptop-result"
            className={`${FIGURE} ml-auto shrink-0 rounded-onair-label px-[1.5cqw] py-[0.8cqw] font-bold leading-none text-onair-paper-ink ${
              up ? 'bg-onair-signal' : 'bg-onair-loss'
            }`}
          >
            {up ? '▲' : '▼'} {shortMoney(Math.abs(win.result), win.currency)}
          </span>
        )}
      </div>
      {/* The top three hits; the first is the best, lit as the result. Short
          on room, the label clips off the top before a row does. */}
      {win.top.length ? (
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-[1.2cqw] overflow-hidden">
          <span className={`${LABEL} shrink-0 leading-none text-onair-ink-5`}>Best hits</span>
          <ol className="flex flex-col gap-[1cqw]">
            {win.top.map((b, i) => (
              <li key={i} className="flex items-baseline gap-[2cqw] leading-none">
                <span className={`${TEXT} min-w-0 flex-1 truncate font-medium ${i === 0 ? 'text-onair-ink-1' : 'text-onair-ink-3'}`}>{b.slot}</span>
                {b.bet != null && <span className={`${FIGURE} shrink-0 text-onair-ink-5`}>{betMoney(b.bet, win.currency)}</span>}
                <span className={`${FIGURE} shrink-0 font-bold ${i === 0 ? 'text-onair-winner' : 'text-onair-ink-2'}`}>{multiplier(b.multi)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Window>
  );
}

function History({ win, calm }) {
  return (
    <Window id={win.id} title={win.title} calm={calm}>
      <div className="flex min-h-0 flex-1 gap-[3.5cqw]">
        <div className="flex shrink-0 flex-col justify-end gap-[1cqw] leading-none">
          <span className={`font-onair text-[max(10px,11cqw)] font-extrabold ${win.up ? 'text-onair-signal' : 'text-onair-loss'}`}>{win.latest}%</span>
          <span className={`${LABEL} text-onair-ink-5`}>Last hunt</span>
        </div>
        {/* Newest on the right; the dashed line is break-even. */}
        <div className="relative flex min-w-0 flex-1 items-end gap-[1.6cqw]">
          {win.bars.map((b) => (
            <span
              key={b.id}
              data-bar={b.id}
              className={`flex-1 rounded-t-onair-label ${b.up ? 'bg-onair-signal' : 'bg-onair-loss'}`}
              style={{ height: `${b.height * 100}%` }}
            />
          ))}
          <span
            data-testid="laptop-par"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-onair-ink-3"
            style={{ bottom: `${win.line * 100}%` }}
          />
        </div>
      </div>
    </Window>
  );
}

function Screensaver({ win, bug, calm }) {
  return (
    <Window id={win.id} title={win.title} calm={calm}>
      <div className="relative min-h-0 flex-1">
        <div className={`absolute inset-y-0 left-0 w-[24cqw] ${calm ? '' : 'motion-safe:animate-onair-bounce-x'}`}>
          <span
            className={`absolute left-0 top-0 grid h-[10cqw] w-full place-items-center rounded-onair-tile bg-onair-surface-raised font-onair text-[max(10px,6cqw)] font-extrabold text-onair-ink-2 ${
              calm ? '' : 'motion-safe:animate-onair-bounce-y'
            }`}
          >
            <Mark bug={bug} />
          </span>
        </div>
      </div>
      {win.resetsIn ? (
        <span className={`${LABEL} shrink-0 text-center leading-none text-onair-ink-4`}>Board resets in {shortUntil(win.resetsIn)}</span>
      ) : null}
    </Window>
  );
}

const IDLE = { leaderboard: Board, recap: Recap, history: History, screensaver: Screensaver };

function Tracker({ laptop, calm }) {
  const { opened, total, back, cost, currency, next, recent = [] } = laptop;
  const share = total ? Math.min(1, opened / total) : 0;
  const count = (
    <span data-testid="laptop-opened" className={`${FIGURE} shrink-0 leading-none text-onair-ink-2`}>
      {opened}/{total ?? '?'}
    </span>
  );
  return (
    <Window id="hunt" title="Hunt live" tone="text-onair-signal" aside={count} calm={calm}>
      {total ? (
        <span className="block h-[2.2cqw] w-full shrink-0 overflow-hidden rounded-onair-label bg-onair-surface-raised">
          <span
            data-testid="laptop-progress"
            className={`block h-full w-full origin-left bg-onair-signal ${calm ? '' : 'motion-safe:transition-transform motion-safe:duration-700'}`}
            style={{ transform: `scaleX(${share})` }}
          />
        </span>
      ) : null}
      {/* Money back of the cost; "of …" wraps under a long figure (a five-digit CA$ hunt). */}
      <div data-testid="laptop-money" className="flex shrink-0 flex-wrap items-baseline gap-x-[1.5cqw] gap-y-[0.8cqw] leading-none">
        <span className="font-onair text-[max(10px,8cqw)] font-extrabold text-onair-ink-1">{shortMoney(back, currency)}</span>
        {cost != null && <span className={`${TEXT} font-medium text-onair-ink-4`}>of {shortMoney(cost, currency)}</span>}
      </div>
      {next && (
        <div data-testid="laptop-next" className="flex shrink-0 items-baseline gap-[2cqw] leading-none">
          <span className={`${LABEL} shrink-0 text-onair-signal`}>Next</span>
          <span className={`${TEXT} min-w-0 flex-1 truncate font-bold text-onair-ink-1`}>{next.slot}</span>
          {next.bet != null && <span className={`${FIGURE} shrink-0 text-onair-ink-5`}>{betMoney(next.bet, currency)}</span>}
        </div>
      )}
      {/* Newest first; short on room, whole rows wrap out of sight, the oldest first. */}
      <ol className="flex min-h-0 flex-1 flex-col flex-wrap content-start gap-[1cqw] overflow-hidden">
        {recent.map((b, i) => (
          <li key={i} className="flex w-full items-baseline gap-[2cqw] leading-none">
            <span className={`${TEXT} min-w-0 flex-1 truncate font-medium text-onair-ink-3`}>{b.slot}</span>
            {b.multi != null && <span className={`${FIGURE} shrink-0 font-bold text-onair-ink-2`}>{multiplier(b.multi)}</span>}
          </li>
        ))}
      </ol>
    </Window>
  );
}

function Round({ laptop, calm }) {
  const open = laptop.mode === 'open';
  return (
    <Window id="round" title={open ? 'Predictions open' : 'Predictions locked'} tone={open ? 'text-onair-signal' : 'text-onair-ink-3'} calm={calm}>
      <div className="flex flex-1 flex-col justify-center gap-[2.5cqw]">
        <span className="font-onair text-[max(10px,11cqw)] font-extrabold leading-none text-onair-ink-1">
          {plural(laptop.guesses || 0, 'guess', 'guesses')}
        </span>
        <span className={`${LABEL} leading-none ${open ? 'text-onair-signal' : 'text-onair-ink-4'}`}>
          {open ? 'Get your guess in' : 'Guesses locked'}
        </span>
      </div>
    </Window>
  );
}

// One window at a time, each up for WINDOW_MS, wrapping. The window on screen
// is pinned by id as soon as it shows, so a window that loads late (ahead of it
// in the order or after it) joins the rotation without moving it. Its clock
// runs from when it came up: fresh data (a new laptop object every poll) and a
// new window joining never restart it, and it hands over to whichever window
// follows it when the time is up. `still` stops the clock (the laptop door is
// hovered or focused, or reduced motion); the window gets its full time after.
function useWindowCycle(windows, still) {
  const [currentId, setCurrentId] = useState(null);
  const found = windows.findIndex((w) => w.id === currentId);
  const at = Math.max(0, found);
  const current = windows[at] || null;
  const shownId = current ? current.id : null;
  const nextRef = useRef(null);
  nextRef.current = windows.length > 1 ? windows[(at + 1) % windows.length].id : null;
  const cycles = windows.length > 1 && !still;

  // Pin what's on screen: the first window to show, or the one standing in for a window that left.
  useEffect(() => {
    if (shownId && found < 0) setCurrentId(shownId);
  }, [shownId, found]);

  useEffect(() => {
    if (!cycles) return undefined;
    const t = setTimeout(() => {
      if (nextRef.current) setCurrentId(nextRef.current);
    }, WINDOW_MS);
    return () => clearTimeout(t);
  }, [shownId, cycles]);
  return current;
}

// `held`: the laptop door is hovered or focused, so the window (and the door
// that follows it) stays put. Under reduced motion one window holds.
export default function LaptopScreen({ laptop, bug = null, held = false, onWindow }) {
  const calm = prefersReducedMotion();
  const current = useWindowCycle(laptop.mode === 'idle' ? laptop.windows || NONE : NONE, held || calm);
  const Idle = current ? IDLE[current.id] : null;

  // The window on screen, for the laptop door (it follows the window); nothing
  // during a hunt or a round, or once the screen is gone.
  const reportRef = useRef(onWindow);
  reportRef.current = onWindow;
  const report = useCallback((id) => {
    if (reportRef.current) reportRef.current(id);
  }, []);
  const shownId = current ? current.id : null;
  useEffect(() => {
    report(shownId);
  }, [shownId, report]);
  useEffect(() => () => report(null), [report]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gradient-to-b from-onair-bezel-top to-onair-bezel-bottom"
      style={{ containerType: 'inline-size' }}
      aria-hidden="true"
      data-testid="laptop-screen"
    >
      <Wallpaper bug={bug} />
      {laptop.mode === 'hunt' && <Tracker laptop={laptop} calm={calm} />}
      {(laptop.mode === 'open' || laptop.mode === 'locked') && <Round laptop={laptop} calm={calm} />}
      {Idle && <Idle key={current.id} win={current} bug={bug} calm={calm} />}
      <span className={`${SCREEN_CLASS} pointer-events-none absolute inset-0`} />
    </div>
  );
}
