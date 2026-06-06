import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { HelpCircle } from 'lucide-react';

// Steps are built per viewer. Logged-in owners get the full owner flow;
// logged-out visitors get the same six beats reworded, since the share bar and
// suggestions panel are owner-only (so those targets are absent for them) and
// saving needs an account. The login nudge points them at what unlocks.
function buildSteps(isLoggedIn) {
  return [
    {
      target: null,
      title: 'Welcome to the hunt tracker',
      body: isLoggedIn
        ? 'Log bonuses, open them on stream, and split the result with your squad. Here is the quick tour.'
        : 'Log bonuses, open them, and split the result with your squad. You can try it right here without an account. Here is the quick tour.',
    },
    {
      target: 'share-bar',
      title: isLoggedIn ? 'Your two links' : 'Go live and collect picks',
      body: isLoggedIn
        ? 'Go live so spectators can watch the hunt, and open a collect link so viewers can submit slot picks. Both live right here.'
        : 'Log in with Twitch to unlock two links: one to let spectators watch your hunt live, one to collect slot picks from viewers. They show up right here once you are signed in.',
    },
    {
      target: 'suggestions',
      title: 'Where suggestions land',
      body: isLoggedIn
        ? 'Picks from your collect link show up here, grouped by who sent them. Tap a slot to mark it in bonus.'
        : 'Once you collect picks, they show up here grouped by who sent them. You tap a slot to mark it in bonus.',
    },
    {
      target: null,
      title: 'Accept or reject a pick',
      body: 'When a suggested slot bonuses, hit "Got in" to add it to your list with the suggester as the caller. Hit "Nope" if it did not.',
    },
    {
      target: 'add-form',
      title: 'Log and open bonuses',
      body: 'Type a slot, set the stake, tag who called it, then log it. Start opening when the list is set.',
    },
    {
      target: 'complete-actions',
      title: 'Finish up',
      body: isLoggedIn
        ? 'Complete saves the hunt to your history and exports the recap. Export split shares the squad payout any time.'
        : 'Export split shares the squad payout any time. Log in with Twitch to save hunts to your history and keep a track record across devices.',
    },
  ];
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HuntTour({ open, onClose, isLoggedIn = true }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const steps = useMemo(() => buildSteps(isLoggedIn), [isLoggedIn]);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const next = useCallback(() => {
    setI((n) => {
      if (n >= steps.length - 1) {
        close();
        return n;
      }
      return n + 1;
    });
  }, [close, steps.length]);

  const back = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next]);

  if (!open) return null;

  const reduce = prefersReducedMotion();
  const pad = 6;
  const spotlit = !!rect;

  const cardStyle = spotlit
    ? (() => {
        const below = rect.top + rect.height + 12;
        const wantAbove = below + 180 > window.innerHeight;
        return {
          position: 'fixed',
          left: Math.min(Math.max(8, rect.left), window.innerWidth - 320),
          top: wantAbove ? Math.max(8, rect.top - 192) : below,
          width: 300,
        };
      })()
    : {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
      };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Hunt tracker tour"
    >
      {/* Dim layer + spotlight */}
      {spotlit ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow:
              '0 0 0 9999px rgba(0,0,0,0.38), 0 0 22px 4px rgba(16,185,129,0.45)',
            border: '2px solid #10b981',
            borderRadius: 2,
            transition: reduce ? 'none' : 'all 0.22s ease',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-black/[0.38]" />
      )}

      {/* Tooltip / fallback card */}
      <div
        style={cardStyle}
        className="border border-emerald-signal/40 bg-zinc-card p-4 shadow-xl"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-2.5 right-3 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-white/45 hover:text-white-body"
        >
          Skip ✕
        </button>
        <p className="inline-flex items-center gap-1.5 text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-emerald-signal mb-1">
          <HelpCircle size={11} aria-hidden="true" /> Tour
        </p>
        <h4 className="font-black text-white-body text-base leading-tight mb-1.5">
          {step.title}
        </h4>
        <p className="text-[0.75rem] text-white/65 leading-snug mb-3">{step.body}</p>
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] font-mono text-white/40 mr-auto tabular-nums">
            {i + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={back}
            disabled={i === 0}
            className="px-2.5 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors disabled:opacity-30 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
          >
            {i >= steps.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
