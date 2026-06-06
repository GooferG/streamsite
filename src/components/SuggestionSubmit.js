import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { Lightbulb, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { authedFetch } from '../utils/authedFetch';

const ERR = {
  HUNT_NOT_FOUND: "Hunt missing — refresh the page.",
  SUGGESTIONS_DISABLED: "Suggestions aren't enabled for this hunt.",
  NOT_OPEN: "Hunt isn't accepting suggestions right now.",
  CAP_REACHED: "You've used all your suggestions for this hunt.",
  INVALID_SLOT_NAME: "Enter a slot name.",
  NOT_AUTHENTICATED: "Sign in with Twitch first.",
};

/**
 * Compact "Suggest a slot" panel. Counts the viewer's existing suggestions
 * for this hunt against the per-viewer cap. Hides itself if cap reached.
 */
export default function SuggestionSubmit({ hunt }) {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const [slot, setSlot] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [mineCount, setMineCount] = useState(0);

  const cap = Number(hunt?.suggestionCap) || 0;
  const huntOpen = hunt?.status === 'open' && hunt?.acceptSuggestions;
  const used = mineCount;
  const remaining = cap > 0 ? Math.max(0, cap - used) : null;

  useEffect(() => {
    if (!twitchUser?.twitchId || !hunt?.id) {
      setMineCount(0);
      return undefined;
    }
    const q = query(
      collection(db, 'hunts', hunt.id, 'suggestions'),
      where('twitchId', '==', twitchUser.twitchId)
    );
    const unsub = onSnapshot(q, (snap) => setMineCount(snap.size));
    return unsub;
  }, [twitchUser?.twitchId, hunt?.id]);

  if (!twitchUser) {
    return (
      <div className="border border-white/10 bg-zinc-card/30 px-4 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
            <Lightbulb size={11} aria-hidden="true" />
            Suggest a slot — sign in first
          </div>
          <button
            type="button"
            onClick={loginWithTwitch}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
          >
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Sign in with Twitch</span>
          </button>
        </div>
      </div>
    );
  }

  if (!huntOpen) {
    return (
      <div className="border border-white/10 bg-zinc-card/30 px-4 py-3 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
        Suggestions closed
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (!slot.trim()) return setFeedback({ kind: 'error', message: 'Enter a slot name.' });
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/suggestions/submit', {
        method: 'POST',
        body: JSON.stringify({
          huntId: hunt.id,
          slotName: slot.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          kind: 'error',
          message: ERR[data.error] || data.error || 'Submit failed.',
        });
      } else {
        setSlot('');
        setNote('');
        setFeedback({
          kind: 'success',
          message: `Slot suggested. ${cap > 0 ? `${data.used} of ${cap} used.` : ''}`,
        });
      }
    } catch (err) {
      setFeedback({ kind: 'error', message: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  const capReached = cap > 0 && remaining === 0;

  return (
    <div className="border border-white/10 bg-zinc-card/30">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <Lightbulb size={11} aria-hidden="true" />
          <span>▸ Suggest a slot</span>
        </span>
        {cap > 0 && (
          <span className="text-white/45">
            <span className={remaining === 0 ? 'text-red-destructive' : 'text-emerald-signal/80'}>{used}</span> / {cap} used
          </span>
        )}
      </div>
      <form onSubmit={submit} className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_3fr_auto] gap-2 items-end">
          <label className="block">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1 font-mono">Slot name</span>
            <input
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              disabled={capReached || submitting}
              placeholder="Sugar Rush 1000"
              maxLength={80}
              className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body placeholder:text-white/25 focus:border-emerald-signal/60 focus:outline-none disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1 font-mono">Note <span className="text-white/30 normal-case font-normal">· optional</span></span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={capReached || submitting}
              placeholder="Great bonus potential"
              maxLength={200}
              className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body placeholder:text-white/25 focus:border-emerald-signal/60 focus:outline-none disabled:opacity-50"
            />
          </label>
          <button
            type="submit"
            disabled={capReached || submitting || !slot.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed h-[38px]"
          >
            <Send size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {submitting ? 'Sending…' : 'Submit'}
            </span>
          </button>
        </div>
        {capReached && (
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
            You've used all your suggestions for this hunt.
          </p>
        )}
        {feedback && (
          <div
            className={`flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono ${
              feedback.kind === 'success' ? 'text-emerald-signal' : 'text-red-destructive'
            }`}
          >
            {feedback.kind === 'success' ? (
              <CheckCircle2 size={12} aria-hidden="true" />
            ) : (
              <AlertCircle size={12} aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
