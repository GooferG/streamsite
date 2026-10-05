import { useEffect, useRef, useState } from 'react';
import { FOCUS, MONO } from './onAir/classes';

const SEEN_KEY = 'gg_welcome_seen';
// Beat after the TV intro's signal lock, so the card follows the reveal
// instead of landing on top of it.
const SIGN_ON_DELAY_MS = 400;

function alreadySeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode) — show, don't crash
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore — non-persisting fallback
  }
}

export default function WelcomeSignOn({ introDone, delayMs = SIGN_ON_DELAY_MS }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);

  // Show shortly after the intro is done, if not seen before.
  useEffect(() => {
    if (!introDone || alreadySeen()) return undefined;
    const t = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(t);
  }, [introDone, delayMs]);

  // Focus the card and wire Esc-to-dismiss while open.
  useEffect(() => {
    if (!open) return undefined;
    cardRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    markSeen();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 motion-safe:animate-fade-in" onClick={dismiss}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label="First time on the couch"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-onair-card bg-onair-surface-1 p-6 font-onair shadow-onair-card focus:outline-none motion-safe:animate-modal-in sm:p-8"
      >
        <div className={`${MONO} mb-3 flex items-center gap-2 text-[0.625rem] tracking-[0.2em] text-onair-signal`}>
          <span className="h-1.5 w-1.5 rounded-full bg-onair-signal" aria-hidden="true" />
          Channel sign-on
        </div>
        <h2 className="mb-3 text-[1.875rem] font-extrabold leading-tight tracking-[-0.02em] text-onair-ink-1">First time on the couch?</h2>
        <p className="mb-6 text-[0.9375rem] leading-relaxed text-onair-ink-3">
          This is Goofer's living room. Everything in it is clickable: the TV, the tapes, the laptop, the guide. The menu up top works too.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className={`rounded-onair-control bg-onair-signal px-4 py-2.5 text-[0.9375rem] font-bold text-onair-surface-4 shadow-onair-raised ${FOCUS}`}
        >
          Look around
        </button>
      </div>
    </div>
  );
}
