import { useEffect, useRef } from 'react';
import { SOCIAL_LINKS } from '../../constants';
import { FOCUS } from '../onAir/classes';

// "Inside the TV" while live (spec: Watch inside the TV): the Twitch player at
// full resolution under the nav. Esc, Back or the button pull back out.
export default function TvFrame({ onExit, channel = 'GooferG', navH }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onExit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit]);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return (
    <div role="dialog" aria-modal="true" aria-label="Goofer's stream" className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-onair-surface-4" style={{ top: navH }}>
      <iframe
        title="Goofer's live stream"
        src={`https://player.twitch.tv/?channel=${channel}&parent=${host}&autoplay=true`}
        allowFullScreen
        className="min-h-0 w-full flex-1"
      />
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          ref={closeRef}
          type="button"
          onClick={onExit}
          className={`rounded-onair-control bg-onair-surface-raised px-4 py-2.5 font-onair text-[0.9375rem] font-bold text-onair-ink-1 shadow-onair-raised ${FOCUS}`}
        >
          Back to the couch
        </button>
        <a
          href={SOCIAL_LINKS.twitch}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-onair-control bg-onair-viewer px-4 py-2.5 font-onair text-[0.9375rem] font-bold text-white-body ${FOCUS}`}
        >
          Open on Twitch
        </a>
      </div>
    </div>
  );
}
