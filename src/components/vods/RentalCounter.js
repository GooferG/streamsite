import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FOCUS, MONO } from '../onAir/classes';
import { pickedBy, playerSrc } from './videoStoreModel';
import TapeTimeline from './TapeTimeline';

const FOCUSABLE = 'a[href], button:not([disabled]), iframe';

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2 last:border-b-0">
      <dt className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>{label}</dt>
      <dd className={`${MONO} text-right text-[0.75rem] tracking-[0.15em] text-onair-ink-2`}>{children}</dd>
    </div>
  );
}

function WatchOnTwitch({ url }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-5 inline-flex rounded-onair-control bg-white/[0.07] px-3.5 py-2 text-[0.875rem] font-bold text-onair-ink-2 hover:bg-white/[0.12] ${FOCUS}`}
    >
      Watch on Twitch
    </a>
  );
}

function VodBack({ tape, at, viewerName, onSeek }) {
  return (
    <section aria-label="Back of the box" className="min-w-0">
      <h2 id="rental-title" className="break-words font-onair-marker text-[1.5rem] leading-tight text-onair-paper">
        {tape.title}
      </h2>
      <dl className="mt-4">
        <Fact label="Taped">{tape.dateLabel}</Fact>
        <Fact label="Length">{tape.length}</Fact>
        <Fact label="Tape">{tape.stock}</Fact>
        <Fact label="Views">{tape.views}</Fact>
        <Fact label="Due back">{tape.dueDate}</Fact>
      </dl>
      <h3 className={`${MONO} mt-6 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-3`}>Clips on this tape</h3>
      {tape.marks.length === 0 ? (
        <p className="mt-2 text-[0.875rem] text-onair-ink-4">Nobody clipped this one yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {tape.marks.map((m) => {
            const pick = pickedBy(m.clip, viewerName);
            const current = at === m.offset;
            return (
              <li key={m.clip.id}>
                <button
                  type="button"
                  onClick={() => onSeek(m.offset)}
                  aria-current={current ? 'true' : undefined}
                  className={`w-full rounded-onair-tile px-3 py-2 text-left transition-colors hover:bg-white/[0.07] ${current ? 'bg-white/[0.07]' : ''} ${FOCUS}`}
                >
                  <span className="block text-[0.875rem] font-bold text-onair-ink-1">{m.clip.label}</span>{' '}
                  <span className={`${MONO} mt-0.5 block text-[0.625rem] tracking-[0.15em] ${pick.you ? 'text-onair-viewer-light' : 'text-onair-ink-4'}`}>
                    {m.at} · {pick.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <WatchOnTwitch url={tape.url} />
    </section>
  );
}

function ClipBack({ clip, viewerName, onSwitch }) {
  const pick = pickedBy(clip, viewerName);
  const found = clip.foundOn;
  return (
    <section aria-label="Back of the box" className="min-w-0">
      <h2 id="rental-title" className={`break-words leading-tight text-onair-paper ${clip.unlabeled ? 'font-extrabold' : 'font-onair-marker'} text-[1.5rem]`}>
        {clip.label}
      </h2>
      <p className={`mt-2 text-[0.9375rem] font-bold ${pick.you ? 'text-onair-viewer-light' : 'text-onair-ink-3'}`}>{pick.text}</p>
      <dl className="mt-4">
        <Fact label="Game">{clip.game}</Fact>
        <Fact label="Clipped">{clip.dateLabel}</Fact>
        <Fact label="Length">{clip.length}</Fact>
        <Fact label="Views">{clip.views}</Fact>
      </dl>
      {found ? (
        <button
          type="button"
          onClick={() => onSwitch(found.id, found.offset)}
          className={`mt-5 w-full rounded-onair-control bg-white/[0.07] px-3.5 py-2.5 text-left text-[0.875rem] font-bold text-onair-ink-1 hover:bg-white/[0.12] ${FOCUS}`}
        >
          {`Found on tape: ${found.title}, ${found.dateLabel}${found.at ? ` at ${found.at}` : ''}`}
        </button>
      ) : (
        <p className={`${MONO} mt-5 text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Original tape lost.</p>
      )}
      <WatchOnTwitch url={clip.url} />
    </section>
  );
}

// The rental counter: the tape already playing on the TV, the back of its box
// beside it (below it on phones). Owns Escape, the focus trap, the scroll lock
// and handing focus back to whatever opened it; VideoStoreFront owns which
// tape and where it starts.
export default function RentalCounter({ item, at, seekNo = 0, viewerName, onSeek, onSwitch, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!list || list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isVod = item.kind === 'vod';
  const src = playerSrc(item, isVod ? at : null, window.location.hostname);

  return createPortal(
    <div
      data-testid="counter-scrim"
      onClick={onClose}
      className="fixed inset-0 z-[100] overflow-y-auto bg-onair-surface-4/90 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rental-title"
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-6xl rounded-onair-card bg-gradient-to-b from-onair-surface-1 to-onair-surface-3 shadow-onair-card motion-safe:animate-modal-in"
      >
        <div className="flex items-center gap-3 px-5 pt-4">
          <span className={`${MONO} text-[0.6875rem] font-bold tracking-[0.2em] text-onair-signal`}>Goofer Video</span>
          <span aria-hidden="true" className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>·</span>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>
            {isVod ? `Rental No. ${item.no}` : 'Clip'}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Esc, close the counter"
            className={`${MONO} ml-auto rounded-onair-control bg-white/[0.07] px-3 py-1.5 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-ink-2 hover:bg-white/[0.12] ${FOCUS}`}
          >
            Esc
          </button>
        </div>
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-onair-inner bg-onair-surface-4 shadow-onair-screen">
              <iframe
                key={`${src}#${seekNo}`}
                src={src}
                title={`${isVod ? item.title : item.label} on the Twitch player`}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              />
            </div>
            {isVod && (
              <div className="mt-4">
                <TapeTimeline tape={item} at={at} onSeek={onSeek} />
              </div>
            )}
          </div>
          {isVod ? (
            <VodBack tape={item} at={at} viewerName={viewerName} onSeek={onSeek} />
          ) : (
            <ClipBack clip={item} viewerName={viewerName} onSwitch={onSwitch} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
