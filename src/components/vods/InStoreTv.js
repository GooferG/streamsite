import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Monitor from '../onAir/Monitor';
import OnAirButton from '../onAir/OnAirButton';
import { FOCUS, MONO } from '../onAir/classes';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import { pickedBy } from './videoStoreModel';

const COVER_SIZES = '(min-width: 640px) 55vw, 100vw';

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

function Spot({ spot, viewerName, onOpen, still }) {
  const facts = spot.kind === 'clip' ? [pickedBy(spot.item, viewerName).text, ...spot.facts] : spot.facts;
  return (
    <div className="mt-4 grid items-center gap-5 sm:mt-5 sm:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] sm:gap-7">
      <div className="relative aspect-video overflow-hidden rounded-onair-inner bg-onair-surface-4 shadow-onair-well">
        {spot.cover ? (
          <img
            key={spot.key}
            src={spot.cover}
            srcSet={spot.coverSet || undefined}
            sizes={COVER_SIZES}
            alt=""
            decoding="async"
            className={`h-full w-full object-cover motion-safe:animate-slow-zoom ${still ? '[animation-play-state:paused]' : ''}`}
          />
        ) : (
          <div data-testid="no-picture" className="flex h-full items-center justify-center bg-onair-track">
            <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>No picture</span>
          </div>
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
// (DESIGN.md §7, Video store). Stills only: every Twitch embed on the channel
// opens behind Twitch's content gate, so Rent it hands the tape to the rental
// counter. The reel holds under a mouse, while keyboard focus is inside it,
// when paused, in a hidden tab, or while the counter is open (`held`); under
// reduced motion it only moves when asked. It follows the spot on screen by
// key, so the list growing or shrinking (going live, recent clips landing)
// never swaps what the viewer is looking at.
export default function InStoreTv({ spots = [], loading = false, viewerName = null, onOpen, held = false, interval = SPOT_MS }) {
  const [pos, setPos] = useState({ key: null, index: 0 });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduce] = useState(prefersReducedMotion);
  const hidden = useTabHidden();
  const boxRef = useRef(null);
  // Clicks and taps focus buttons too, and so does the counter handing focus
  // back to Rent it; only focus that follows a key press holds the reel.
  const lastInput = useRef(null);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;

  const count = loading ? 0 : spots.length;
  const found = pos.key ? spots.findIndex((s) => s.key === pos.key) : -1;
  const i = count ? (found >= 0 ? found : Math.min(pos.index, count - 1)) : 0;
  const spot = count ? spots[i] : null;
  const auto = !reduce && count > 1;
  const moving = !paused && !hovered && !focused && !hidden && !held;
  const playing = auto && moving;
  const go = (n) => setPos({ key: spots[n].key, index: n });

  useEffect(() => {
    const onKey = () => {
      lastInput.current = 'key';
    };
    const onPointer = () => {
      lastInput.current = 'pointer';
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('mousedown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('mousedown', onPointer, true);
    };
  }, []);

  // The list is rebuilt every minute and on every poll; read it at the cut so
  // a rebuild doesn't restart the countdown.
  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => {
      const list = spotsRef.current;
      const n = (i + 1) % list.length;
      setPos({ key: list[n].key, index: n });
    }, interval);
    return () => clearTimeout(t);
  }, [playing, i, count, interval]);

  // Warm the next spot's picture while the reel plays, so the cut never waits on it.
  useEffect(() => {
    if (!playing) return;
    const list = spotsRef.current;
    const next = list[(i + 1) % list.length];
    if (!next || !next.cover) return;
    const img = new Image();
    img.decoding = 'async';
    img.sizes = COVER_SIZES;
    if (next.coverSet) img.srcset = next.coverSet;
    img.src = next.cover;
  }, [playing, i, count]);

  // A focused control can leave with its spot (Watch now when the stream
  // ends); browsers fire no blur for that, so let go of the hold.
  const spotKey = spot ? spot.key : null;
  // Pin the first spot by key too, so going live doesn't push it aside.
  useEffect(() => {
    if (spotKey && pos.key == null) setPos({ key: spotKey, index: i });
  }, [spotKey, pos.key, i]);
  useEffect(() => {
    if (focused && boxRef.current && !boxRef.current.contains(document.activeElement)) setFocused(false);
  }, [spotKey, focused]);

  if (!loading && count === 0) return null;

  const step = (delta) => go((i + delta + count) % count);
  const toggle = () => {
    // Play means play, even with keyboard focus still on this button.
    if (paused) setFocused(false);
    setPaused((p) => !p);
  };
  const controls =
    count > 1 ? (
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Previous spot" onClick={() => step(-1)} className={`${CONTROL} ${FOCUS}`}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {auto && (
          <button type="button" aria-label={paused ? 'Play the reel' : 'Pause the reel'} onClick={toggle} className={`${CONTROL} ${FOCUS}`}>
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
      ref={boxRef}
      data-testid="in-store-tv"
      className="mt-10"
      // A tap fires pointerenter and no pointerleave until the next tap
      // elsewhere, so only a real mouse counts as hovering.
      onPointerEnter={(e) => {
        if (!e.pointerType || e.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={(e) => {
        if (!e.pointerType || e.pointerType === 'mouse') setHovered(false);
      }}
      onFocus={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && lastInput.current === 'key') setFocused(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <Monitor
        label="In-store TV"
        status={spot && spot.kind === 'live' ? 'live' : null}
        channel="CH 03 · In-store TV"
        clock={spot ? { long: `Spot ${i + 1} of ${count}` } : null}
        channelKey={spotKey}
        controls={controls}
        chyron={CHYRON}
      >
        {spot ? (
          <div role="group" aria-roledescription="spot" aria-label={`Spot ${i + 1} of ${count}`}>
            <p data-testid="spot-announcer" className="sr-only" aria-live={playing ? 'off' : 'polite'}>
              {`${spot.kicker}: ${spot.title}`}
            </p>
            <Spot spot={spot} viewerName={viewerName} onOpen={onOpen} still={!moving} />
          </div>
        ) : (
          <p className={`${MONO} py-16 text-center text-xs tracking-[0.2em] text-onair-screen-ink`}>Tuning in…</p>
        )}
      </Monitor>
    </div>
  );
}
