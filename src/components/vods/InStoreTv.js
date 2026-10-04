import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Monitor from '../onAir/Monitor';
import OnAirButton from '../onAir/OnAirButton';
import { FOCUS, MONO } from '../onAir/classes';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import { pickedBy } from './videoStoreModel';

// How long each spot stays on the in-store TV.
export const SPOT_MS = 6000;

const CONTROL =
  'inline-flex h-8 w-8 items-center justify-center rounded-onair-tile bg-white/[0.07] text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';

const TICKER = [
  'Be kind, rewind',
  'New tapes every stream',
  'Late fees waived, forever',
  'Clipped by chat, shelved by us',
  'Ask the clerk about Cult classics',
];

const CHYRON = { tag: 'In store', tone: 'signal', label: 'Store ticker', items: TICKER };

function useTabHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

function Spot({ spot, viewerName, onOpen }) {
  const facts = spot.kind === 'clip' ? [pickedBy(spot.item, viewerName).text, ...spot.facts] : spot.facts;
  return (
    <div className="mt-4 grid items-center gap-5 sm:mt-5 sm:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] sm:gap-7">
      <div className="relative aspect-video overflow-hidden rounded-onair-inner bg-onair-surface-4 shadow-onair-well">
        {spot.cover ? (
          <img key={spot.key} src={spot.cover} alt="" className="h-full w-full object-cover motion-safe:animate-slow-zoom" />
        ) : (
          <div data-testid="no-picture" className="h-full bg-onair-track" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-signal`}>{spot.kicker}</p>
        <p
          data-testid="spot-title"
          className="mt-2 line-clamp-3 break-words text-[1.5rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-onair-ink-1 sm:text-[1.875rem]"
        >
          {spot.title}
        </p>
        {facts.length > 0 && (
          <p className={`${MONO} mt-3 text-[0.6875rem] tracking-[0.2em] text-onair-ink-3`}>{facts.join(' · ')}</p>
        )}
        <div className="mt-5">
          {spot.kind === 'live' ? (
            <OnAirButton as={Link} to="/" size="sm">
              Watch now
            </OnAirButton>
          ) : (
            <OnAirButton size="sm" aria-label={`Rent it: ${spot.title}`} onClick={() => onOpen(spot.item.id)}>
              Rent it
            </OnAirButton>
          )}
        </div>
      </div>
    </div>
  );
}

// The TV every video store had, playing the store's own trailer reel
// (DESIGN.md §7, Video store). Stills, not video: every Twitch embed on the
// channel opens behind Twitch's content gate, so Rent it hands the tape to the
// rental counter instead. The reel holds while hovered, focused, paused, in a
// hidden tab, or while the counter is open (`held`); under reduced motion it
// only moves when asked.
export default function InStoreTv({ spots = [], loading = false, viewerName = null, onOpen, held = false, interval = SPOT_MS }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduce] = useState(prefersReducedMotion);
  const hidden = useTabHidden();

  const count = spots.length;
  const i = count ? index % count : 0;
  const auto = !reduce && count > 1;
  const playing = auto && !paused && !hovered && !focused && !hidden && !held;

  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => setIndex((i + 1) % count), interval);
    return () => clearTimeout(t);
  }, [playing, i, count, interval]);

  if (!loading && count === 0) return null;

  const spot = loading ? null : spots[i];
  const step = (delta) => setIndex((i + delta + count) % count);
  const controls =
    count > 1 ? (
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Previous spot" onClick={() => step(-1)} className={`${CONTROL} ${FOCUS}`}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {auto && (
          <button
            type="button"
            aria-label={paused ? 'Play the reel' : 'Pause the reel'}
            onClick={() => setPaused((p) => !p)}
            className={`${CONTROL} ${FOCUS}`}
          >
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        )}
        <button type="button" aria-label="Next spot" onClick={() => step(1)} className={`${CONTROL} ${FOCUS}`}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    ) : null;

  return (
    <div
      data-testid="in-store-tv"
      className="mt-10"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <Monitor
        label="In-store TV"
        status={spot && spot.kind === 'live' ? 'live' : null}
        channel="CH 03 · In-store TV"
        clock={spot ? { long: `Spot ${i + 1} of ${count}` } : null}
        channelKey={spot ? spot.key : null}
        controls={controls}
        chyron={CHYRON}
      >
        {spot ? (
          <div data-testid="spot" aria-live={playing ? 'off' : 'polite'}>
            <Spot spot={spot} viewerName={viewerName} onOpen={onOpen} />
          </div>
        ) : (
          <p className={`${MONO} py-16 text-center text-xs tracking-[0.2em] text-onair-screen-ink`}>Tuning in…</p>
        )}
      </Monitor>
    </div>
  );
}
