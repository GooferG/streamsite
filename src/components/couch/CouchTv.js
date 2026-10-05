import { useCallback, useEffect, useRef, useState } from 'react';
import { MONO } from '../onAir/classes';
import StaticNoise from '../onAir/StaticNoise';
import StatusLight from '../onAir/StatusLight';
import { SCREEN_CLASS } from './couchLayout';
import { SEGMENT_MS, STATIC_MS } from './reel';

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

function Still({ src, moving }) {
  return (
    <img src={src} alt="" className={`h-full w-full object-cover ${moving ? 'motion-safe:animate-slow-zoom' : ''}`} data-testid="tv-still" />
  );
}

function Reel({ items, mode, segmentMs, onBlocked }) {
  const [index, setIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const hidden = useTabHidden();
  const item = items.length ? items[index % items.length] : null;
  const advance = useCallback(() => {
    if (items.length > 1) setSwitching(true);
  }, [items.length]);

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

  useEffect(() => {
    if (!item || mode === 'hold' || hidden || switching) return undefined;
    if (item.kind === 'video' && mode === 'video') return undefined; // the loop ends itself
    const t = setTimeout(advance, segmentMs);
    return () => clearTimeout(t);
  }, [item, mode, hidden, switching, segmentMs, advance]);

  if (!item) return <StaticNoise className="absolute inset-0" testId="tv-static" />;

  if (mode === 'hold') {
    const still = items.find((i) => i.kind !== 'card');
    const card = items.find((i) => i.kind === 'card');
    return (
      <>
        {still && <Still src={still.kind === 'video' ? still.poster : still.src} moving={false} />}
        {card && (
          <span className="absolute inset-x-0 bottom-0 bg-onair-surface-4/90 px-[5cqw] py-[3cqw] font-onair text-[max(10px,5cqw)] font-bold leading-tight text-onair-ink-1">
            {card.text}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {item.kind === 'card' && <Card item={item} />}
      {item.kind === 'video' && mode === 'video' && <Video item={item} hidden={hidden} onEnded={advance} onBlocked={onBlocked} />}
      {item.kind === 'video' && mode !== 'video' && <Still src={item.poster} moving />}
      {item.kind === 'still' && <Still src={item.src} moving />}
      {switching && <StaticNoise className="absolute inset-0" testId="tv-switch" />}
    </>
  );
}

function LivePreview({ tv }) {
  return (
    <>
      {tv.preview ? (
        <img src={tv.preview} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid="tv-live" />
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

export default function CouchTv({ tv, items, mode, flipTo = null, onAutoplayBlocked, segmentMs = SEGMENT_MS }) {
  // Report a refused autoplay at most once per mount, whatever the parent passes.
  const blockedRef = useRef(onAutoplayBlocked);
  blockedRef.current = onAutoplayBlocked;
  const reported = useRef(false);
  const reportBlocked = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    if (blockedRef.current) blockedRef.current();
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
      {tv.state === 'offair' && <Reel items={items} mode={mode} segmentMs={segmentMs} onBlocked={reportBlocked} />}
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
