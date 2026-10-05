import { useCallback, useEffect, useRef, useState } from 'react';
import { MONO } from '../onAir/classes';
import StaticNoise from '../onAir/StaticNoise';
import StatusLight from '../onAir/StatusLight';
import TvCommercial from './TvCommercial';
import { SCREEN_CLASS } from './couchLayout';
import { SEGMENT_MS, STATIC_MS, isPicture } from './reel';

// The couch's TV (spec: The TV). It sits in the art's screen rectangle and
// sizes its type in container units. Decorative: the TV door's link says what
// is on.
const GSN_IDENT = '/gsn/ident.webp';
const AV1 = 'video/webm; codecs="av01.0.04M.08"';

function useTabHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

function Card({ item }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-onair-surface-4 px-[8cqw]" data-testid="tv-card">
      <span className={`${MONO} text-[max(10px,3.4cqw)] tracking-[0.22em] text-onair-signal`}>{item.kicker}</span>
      <span className="mt-[2.5cqw] font-onair text-[7cqw] font-extrabold leading-[1.05] tracking-[-0.02em] text-onair-ink-1">
        {item.text}
      </span>
    </div>
  );
}

function Video({ item, hidden, onEnded, onBlocked }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (hidden) {
      v.pause();
      return;
    }
    const playing = v.play();
    if (playing && typeof playing.catch === 'function') {
      // An AbortError is our own pause or item swap, not a refusal.
      playing.catch((e) => {
        if (e && e.name === 'NotAllowedError') onBlocked();
      });
    }
  }, [item.id, hidden, onBlocked]);
  return (
    <video
      ref={ref}
      key={item.id}
      className="h-full w-full object-cover"
      muted
      playsInline
      preload="auto"
      poster={item.poster}
      onEnded={onEnded}
      onError={onEnded}
      data-testid="tv-video"
    >
      {item.sources.av1 && <source src={item.sources.av1} type={AV1} />}
      {item.sources.h264 && <source src={item.sources.h264} type="video/mp4" />}
    </video>
  );
}

// An image that fails to load is dropped, not shown as a broken glyph; a new
// src gets a fresh try.
function useImageFailed(src) {
  const [failed, setFailed] = useState(null);
  return [failed === src, () => setFailed(src)];
}

function Still({ src, moving }) {
  const [failed, onError] = useImageFailed(src);
  if (failed) return null;
  return (
    <img src={src} alt="" onError={onError} className={`h-full w-full object-cover ${moving ? 'motion-safe:animate-slow-zoom' : ''}`} data-testid="tv-still" />
  );
}

function Reel({ items, mode, segmentMs, onBlocked, onSegment }) {
  const [index, setIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const hidden = useTabHidden();
  const hold = mode === 'hold';
  const item = items.length ? items[index % items.length] : null;
  // Holding (reduced motion): one picture with the first card over it, or the
  // card alone. Never a commercial.
  const held = hold ? items.find(isPicture) || null : null;
  const heldCard = hold ? items.find((i) => i.kind === 'card') || null : null;
  const shown = hold ? held || heldCard : item;
  const advance = useCallback(() => {
    if (items.length > 1) setSwitching(true);
  }, [items.length]);

  // What is on screen, for the TV door (it follows a commercial); nothing once
  // the reel is gone.
  useEffect(() => {
    onSegment(shown);
  }, [shown, onSegment]);
  useEffect(() => () => onSegment(null), [onSegment]);

  useEffect(() => {
    setIndex(0);
    setSwitching(false);
  }, [items.length]);

  useEffect(() => {
    if (!switching || !items.length) return undefined;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
      setSwitching(false);
    }, STATIC_MS);
    return () => clearTimeout(t);
  }, [switching, items.length]);

  // A segment's clock follows its place in the running order, so fresh reel
  // data (a new array every poll) never restarts it. A commercial runs its own
  // length.
  const kind = item ? item.kind : null;
  const ms = (item && item.ms) || segmentMs;
  useEffect(() => {
    if (!kind || hold || hidden || switching) return undefined;
    if (kind === 'video' && mode === 'video') return undefined; // the loop ends itself
    const t = setTimeout(advance, ms);
    return () => clearTimeout(t);
  }, [index, kind, ms, hold, mode, hidden, switching, advance]);

  if (!item) return <StaticNoise className="absolute inset-0" testId="tv-static" />;

  if (hold) {
    if (!held) return heldCard ? <Card item={heldCard} /> : null;
    return (
      <>
        <Still src={held.kind === 'video' ? held.poster : held.src} moving={false} />
        {heldCard && (
          <span className="absolute inset-x-0 bottom-0 bg-onair-surface-4/90 px-[5cqw] py-[3cqw] font-onair text-[max(10px,5cqw)] font-bold leading-tight text-onair-ink-1">
            {heldCard.text}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {item.kind === 'card' && <Card item={item} />}
      {/* Keyed by its slot, and remounted when the tab comes back (the clock restarts then), so the beats run from the top in step. Save-Data gets the still frame. */}
      {item.kind === 'ad' && <TvCommercial key={`${index}:${item.id}:${hidden ? 'away' : 'on'}`} item={item} still={mode === 'lite'} />}
      {item.kind === 'video' && mode === 'video' && <Video item={item} hidden={hidden} onEnded={advance} onBlocked={onBlocked} />}
      {item.kind === 'video' && mode !== 'video' && <Still src={item.poster} moving />}
      {item.kind === 'still' && <Still src={item.src} moving />}
      {switching && <StaticNoise className="absolute inset-0" testId="tv-switch" />}
    </>
  );
}

function LivePreview({ tv }) {
  const [previewFailed, onPreviewError] = useImageFailed(tv.preview);
  return (
    <>
      {tv.preview && previewFailed ? null : tv.preview ? (
        <img src={tv.preview} alt="" onError={onPreviewError} className="absolute inset-0 h-full w-full object-cover" data-testid="tv-live" />
      ) : (
        <StaticNoise className="absolute inset-0" testId="tv-static" />
      )}
      <span className="absolute left-[4cqw] top-[4cqw]">
        <StatusLight status="live">{tv.viewers != null ? `Live · ${tv.viewers}` : 'Live'}</StatusLight>
      </span>
      <span className="absolute bottom-[4cqw] right-[4cqw] rounded-onair-tile bg-onair-signal px-[3cqw] py-[1.6cqw] font-onair text-[max(10px,3.6cqw)] font-bold text-onair-surface-4">
        Watch here
      </span>
    </>
  );
}

export default function CouchTv({ tv, items, mode, flipTo = null, onAutoplayBlocked, onSegment, segmentMs = SEGMENT_MS }) {
  // Report a refused autoplay at most once per mount, whatever the parent passes.
  const blockedRef = useRef(onAutoplayBlocked);
  blockedRef.current = onAutoplayBlocked;
  const reported = useRef(false);
  const reportBlocked = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    if (blockedRef.current) blockedRef.current();
  }, []);
  // The segment on screen, to whatever the parent passes now.
  const segmentRef = useRef(onSegment);
  segmentRef.current = onSegment;
  const reportSegment = useCallback((item) => {
    if (segmentRef.current) segmentRef.current(item);
  }, []);
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-onair-surface-4"
      style={{ containerType: 'inline-size' }}
      aria-hidden="true"
      data-testid="couch-tv"
    >
      {tv.state === 'waiting' && <StaticNoise className="absolute inset-0" testId="tv-static" />}
      {tv.state === 'live' && <LivePreview tv={tv} />}
      {tv.state === 'offair' && (
        <Reel items={items} mode={mode} segmentMs={segmentMs} onBlocked={reportBlocked} onSegment={reportSegment} />
      )}
      {flipTo === 'gsn' && (
        <>
          <img src={GSN_IDENT} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid="tv-flip" />
          <StaticNoise className="couch-flip-static absolute inset-0" testId="tv-flip-static" />
        </>
      )}
      <span className={`${SCREEN_CLASS} pointer-events-none absolute inset-0`} />
    </div>
  );
}
