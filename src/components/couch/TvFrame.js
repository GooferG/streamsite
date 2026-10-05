import { useEffect, useRef } from 'react';
import { SOCIAL_LINKS } from '../../constants';
import { trapTab } from '../../utils/focusTrap';
import { FOCUS } from '../onAir/classes';

// Everything outside `el` goes inert (no focus, no clicks) and the undo is
// returned. It marks the siblings of `el` and of each of its ancestors, so the
// dialog stays where it renders (and moves with the page as it tunes in).
function inertOutside(el) {
  const marked = [];
  for (let node = el; node && node.parentElement && node !== document.body; node = node.parentElement) {
    Array.from(node.parentElement.children).forEach((sib) => {
      if (sib === node || sib.hasAttribute('inert')) return;
      sib.setAttribute('inert', '');
      marked.push(sib);
    });
  }
  return () => marked.forEach((sib) => sib.removeAttribute('inert'));
}

// "Inside the TV" while live (spec: Watch inside the TV): the Twitch player at
// full resolution under the nav. Esc, Back or the button pull back out. It is
// modal: the page behind is inert, Tab goes round inside it (the buttons, then
// the player), and on the way out (however it closes) focus goes to the TV door.
export default function TvFrame({ onExit, channel = 'GooferG', navH }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    const dialog = dialogRef.current;
    const wake = inertOutside(dialog);
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') exitRef.current();
      else trapTab(e, dialog);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      wake();
      // Unless focus already went somewhere else on purpose.
      const active = document.activeElement;
      if (active && active !== document.body && !dialog.contains(active)) return;
      const door = document.querySelector('[data-door="tv"]');
      if (door) door.focus({ preventScroll: true });
    };
  }, []);

  const toStart = () => {
    if (closeRef.current) closeRef.current.focus();
  };
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Goofer's stream"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-onair-surface-4"
      style={{ top: navH }}
    >
      {/* First in the DOM, so Tab reaches them before the player; drawn under it. */}
      <div className="order-last flex items-center justify-between gap-3 px-4 py-3">
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
          className={`rounded-onair-control bg-onair-viewer-deep px-4 py-2.5 font-onair text-[0.9375rem] font-bold text-white-body ${FOCUS}`}
        >
          Open on Twitch<span className="sr-only"> in a new tab</span>
        </a>
      </div>
      <iframe
        title="Goofer's live stream"
        src={`https://player.twitch.tv/?channel=${channel}&parent=${host}&autoplay=true`}
        allowFullScreen
        className="min-h-0 w-full flex-1"
      />
      {/* Tabbing on past the player's own controls comes round to the start. */}
      <span tabIndex={0} data-focus-guard onFocus={toStart} className="sr-only" />
    </div>
  );
}
