import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FOCUS, MONO } from '../onAir/classes';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import { GAMBA_CHANNELS, channelLabel } from '../../data/gambaTools';

const COUNT = GAMBA_CHANNELS.length;
const needleLeft = (i) => `${((i + 0.5) / COUNT) * 100}%`;
const wrap = (i) => GAMBA_CHANNELS[(i + COUNT) % COUNT];

// Where the needle last rested. App.js remounts the routes on every pathname
// change (ErrorBoundary key), so the tuner remembers across mounts and slides
// from the previous channel instead of appearing in place.
let lastTuned = null;

// Tests reset the remembered position between cases.
export function resetTunerMemory() {
  lastTuned = null;
}

function useNeedle(index) {
  const [at, setAt] = useState(() => (lastTuned == null || prefersReducedMotion() ? index : lastTuned));
  useEffect(() => {
    lastTuned = index;
    if (at === index) return undefined;
    const raf = requestAnimationFrame(() => setAt(index));
    return () => cancelAnimationFrame(raf);
  }, [index, at]);
  return at;
}

function StepLink({ to, direction }) {
  const Icon = direction === 'Previous' ? ChevronLeft : ChevronRight;
  return (
    <Link
      to={to.path}
      aria-label={`${direction} channel: ${to.label}`}
      className={`inline-flex min-h-11 w-11 flex-none items-center justify-center self-stretch rounded-onair-control bg-white/[0.07] text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] motion-reduce:transition-none ${FOCUS}`}
    >
      <Icon size={18} aria-hidden="true" />
    </Link>
  );
}

// The Gamba tuner (spec Part 3): labelled channel links under a tuning band.
// The band and needle are set dressing; the links do the work.
export default function GambaTuner({ current }) {
  const index = Math.max(0, GAMBA_CHANNELS.findIndex((c) => c.id === (current && current.id)));
  const tuned = GAMBA_CHANNELS[index];
  const at = useNeedle(index);

  return (
    <nav
      aria-label="Gamba channels"
      className="flex gap-1.5 rounded-onair-row bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 p-1.5 font-onair shadow-onair-card"
    >
      <StepLink to={wrap(index - 1)} direction="Previous" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="relative mx-1.5 mb-1.5 mt-1 h-2.5 rounded-full bg-onair-track" aria-hidden="true" data-testid="tuner-band">
          <span
            data-testid="tuner-needle"
            className="absolute -top-[3px] h-4 w-0.5 -translate-x-1/2 rounded-full bg-onair-signal motion-safe:transition-[left] motion-safe:duration-300 motion-safe:ease-out"
            style={{ left: needleLeft(at) }}
          />
        </div>
        <ul className="hidden gap-1 md:flex">
          {GAMBA_CHANNELS.map((ch) => {
            const on = ch.id === tuned.id;
            return (
              <li key={ch.id} className="min-w-0 flex-1">
                <Link
                  to={ch.path}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-center gap-2.5 rounded-onair-control px-3 py-2 text-[0.9375rem] font-bold transition-colors duration-150 motion-reduce:transition-none ${FOCUS} ${
                    on
                      ? 'bg-gradient-to-r from-onair-signal-deep/[0.18] to-onair-signal-deep/[0.05] text-onair-ink-1 shadow-onair-lit-signal'
                      : 'text-onair-ink-3 hover:bg-white/5 hover:text-onair-ink-1'
                  }`}
                >
                  <span className={`${MONO} hidden whitespace-nowrap text-[0.6875rem] font-bold tracking-[0.15em] lg:inline ${on ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
                    {channelLabel(ch)}
                  </span>
                  <span className="truncate">{ch.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p data-testid="tuner-readout" className="flex items-baseline justify-center gap-2 pb-1 md:hidden">
          <span className={`${MONO} text-[0.6875rem] font-bold tracking-[0.15em] text-onair-signal`}>{channelLabel(tuned)}</span>
          <span className="font-bold text-onair-ink-1">{tuned.label}</span>
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-5`}>
            · {index + 1} of {COUNT}
          </span>
        </p>
      </div>
      <StepLink to={wrap(index + 1)} direction="Next" />
    </nav>
  );
}
