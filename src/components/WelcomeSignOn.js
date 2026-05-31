import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'gg_welcome_seen';

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

export default function WelcomeSignOn({ introDone }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);

  // Show once the intro is done, if not seen before.
  useEffect(() => {
    if (introDone && !alreadySeen()) setOpen(true);
  }, [introDone]);

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

  const goToTools = () => {
    markSeen();
    setOpen(false);
    const el = document.getElementById('gamba-tools');
    if (el) {
      const reduce =
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label="First time on the channel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-zinc-card border border-emerald-signal/40 rounded-lg p-6 sm:p-8 focus:outline-none"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden rounded-lg"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-3">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-signal"
              aria-hidden="true"
            />
            <span>Channel sign-on</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white-body mb-3">
            First time on the channel?
          </h2>
          <p className="text-sm text-white/65 leading-relaxed mb-6">
            Watch live, dig through the tape, follow the bonus hunts, and climb
            the leaderboard. The gamba tools are part of the show.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
            >
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                Got it
              </span>
            </button>
            <button
              type="button"
              onClick={goToTools}
              className="inline-flex items-center gap-1.5 px-2 py-2.5 text-white/55 hover:text-white-body transition-colors duration-150"
            >
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                Show me the gamba tools
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
