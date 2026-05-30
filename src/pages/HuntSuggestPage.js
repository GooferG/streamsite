import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Send, Check, ClipboardList } from 'lucide-react';
import SlotAutocomplete from '../components/SlotAutocomplete';

const MAX_SLOTS = 6;

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

export default function HuntSuggestPage() {
  const { linkId } = useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null); // { huntName, open }
  const [loadError, setLoadError] = useState(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [slots, setSlots] = useState(Array(MAX_SLOTS).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!linkId) return;
    let alive = true;
    fetch(`/api/hunt-suggest/info?linkId=${encodeURIComponent(linkId)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) {
          setLoadError(data.error === 'NOT_FOUND' ? 'NOT_FOUND' : 'ERROR');
        } else {
          setInfo(data);
        }
      })
      .catch(() => alive && setLoadError('ERROR'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [linkId]);

  function setSlot(i, val) {
    setSlots((arr) => arr.map((s, idx) => (idx === i ? val : s)));
  }

  const filledSlots = slots.map((s) => s.trim()).filter(Boolean);
  const canSubmit = name.trim() && password && filledSlots.length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch('/api/hunt-suggest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          password,
          name: name.trim(),
          slots: filledSlots,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const map = {
          BAD_PASSWORD: 'Wrong password.',
          CLOSED: 'Submissions are closed for this hunt.',
          HUNT_ENDED: 'This hunt has ended.',
          COOLDOWN: 'Slow down a moment, then try again.',
          NO_SLOTS: 'Add at least one slot.',
          MISSING_NAME: 'Enter your name.',
          NOT_FOUND: 'This link is no longer valid.',
        };
        setSubmitError(map[data.error] || 'Could not submit. Try again.');
      } else {
        setDone(true);
      }
    } catch {
      setSubmitError('Could not submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSlots(Array(MAX_SLOTS).fill(''));
    setDone(false);
    // Keep name + password so they can add more easily.
  }

  return (
    <div className="min-h-screen bg-zinc-broadcast text-white-body flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg border border-white/8 bg-zinc-card/40">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
          <ClipboardList size={13} className="text-purple-bright" aria-hidden="true" />
          <span className="text-purple-bright">Slot suggestions</span>
        </div>

        <div className="px-5 py-6">
          {loading ? (
            <p className="text-center text-white/50 py-10 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
              Loading…
            </p>
          ) : loadError ? (
            <p className="text-center text-white/60 py-10 text-sm">
              {loadError === 'NOT_FOUND'
                ? 'This suggestion link is not valid.'
                : 'Something went wrong loading this link.'}
            </p>
          ) : info && info.open === false ? (
            <div className="text-center py-10 space-y-2">
              <p className="font-black text-white-body text-xl">{info.huntName}</p>
              <p className="text-white/55 text-sm">Suggestions are closed for this hunt.</p>
            </div>
          ) : done ? (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 border border-emerald-signal/50 bg-emerald-signal/10">
                <Check size={22} className="text-emerald-signal" aria-hidden="true" />
              </div>
              <div>
                <p className="font-black text-white-body text-lg">Submitted!</p>
                <p className="text-white/55 text-sm mt-1">
                  Your picks were sent to {info?.huntName}. Resubmit anytime to update them.
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/30 transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Edit / add more
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-1">
                  ▸ Suggest slots for
                </p>
                <p className="font-black text-white-body text-2xl leading-tight">
                  {info?.huntName}
                </p>
                <p className="text-white/50 text-sm mt-1">
                  Drop up to {MAX_SLOTS} slots. Same name resubmits to update your picks.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
                    Your name <span className="text-emerald-signal">*</span>
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="cirno"
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono inline-flex items-center gap-1">
                    <Lock size={10} aria-hidden="true" /> Password <span className="text-emerald-signal">*</span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 font-mono">
                  Your picks
                </span>
                {slots.map((s, i) => (
                  <SlotAutocomplete
                    key={i}
                    value={s}
                    onChange={(v) => setSlot(i, v)}
                    placeholder={`Slot ${i + 1}`}
                    className={inputCls}
                  />
                ))}
              </div>

              {submitError && (
                <p className="text-red-destructive text-sm">{submitError}</p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
              >
                <Send size={14} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {submitting ? 'Sending…' : 'Send suggestions'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
