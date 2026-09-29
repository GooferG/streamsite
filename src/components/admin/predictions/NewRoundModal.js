import { useEffect, useState } from 'react';
import { X, Check, RefreshCcw } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { formatHuntDate } from '../../../utils/huntFormat';
import {
  rewardsFormFrom,
  rewardsPayload,
  validateRewardsForm,
} from '../../../utils/predictionRewards';
import RewardsEditor from './RewardsEditor';
import { inputCls, errorText, roundsAction } from './shared';

// The rewards editor starts from the last round's rewards (or 100/50 tickets).
const DEFAULT_FORM = (lastRound) => ({
  title: '',
  contextNote: '',
  acceptPredictions: true,
  acceptSuggestions: false,
  suggestionCap: 3,
  source: 'communityhunts',
  manualTotalCost: '',
  rewards: rewardsFormFrom(lastRound),
  announce: true,
});

export default function NewRoundModal({ onClose, onCreated, lastRound = null }) {
  const [form, setForm] = useState(() => DEFAULT_FORM(lastRound));
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (path, value) =>
    setForm((f) => {
      const next = { ...f };
      const parts = path.split('.');
      let ref = next;
      for (let i = 0; i < parts.length - 1; i++) {
        ref[parts[i]] = { ...ref[parts[i]] };
        ref = ref[parts[i]];
      }
      ref[parts[parts.length - 1]] = value;
      return next;
    });

  const fetchPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    const { ok, data } = await roundsAction({ action: 'preview_hunt' });
    if (ok) {
      setPreview(data.snapshot);
    } else {
      setPreviewError(data.error || 'Failed');
      setPreview(null);
    }
    setPreviewing(false);
  };

  useEffect(() => {
    if (form.source === 'communityhunts' && !preview && !previewing) fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.source]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Title required');
    if (!form.acceptPredictions && !form.acceptSuggestions) {
      return setError('Enable predictions or suggestions');
    }
    if (form.acceptPredictions) {
      const rewardsError = validateRewardsForm(form.rewards);
      if (rewardsError) return setError(rewardsError);
    }

    setSubmitting(true);
    const { ok, data } = await roundsAction({
      action: 'create',
      title: form.title,
      contextNote: form.contextNote,
      acceptPredictions: form.acceptPredictions,
      acceptSuggestions: form.acceptSuggestions,
      suggestionCap: form.acceptSuggestions ? form.suggestionCap : 0,
      source: form.source,
      manualTotalCost: form.source === 'manual' ? form.manualTotalCost : null,
      rewards: form.acceptPredictions ? rewardsPayload(form.rewards) : { tiers: [] },
      announce: form.acceptPredictions && form.announce,
    });
    setSubmitting(false);
    if (ok) onCreated(data.id);
    else setError(errorText(data.error));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New round"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl border border-white/10 bg-zinc-card my-auto"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            New prediction round
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <label className="block">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">01</span> Title <span className="text-emerald-signal">*</span>
            </span>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="Friday night bonus hunt" />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">02</span> Context note
            </span>
            <input value={form.contextNote} onChange={(e) => set('contextNote', e.target.value)} className={inputCls} placeholder='e.g. "Bonus battle vs Bonanza"' />
          </label>

          {/* Source */}
          <div>
            <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">03</span> Source
            </p>
            <div className="flex gap-2">
              {['communityhunts', 'manual'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('source', s)}
                  className={`flex-1 px-3 py-2 border text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono transition-colors duration-150 ${
                    form.source === s
                      ? 'bg-orange-admin text-zinc-broadcast border-orange-admin'
                      : 'border-white/15 text-white/55 hover:text-white-body hover:border-white/30'
                  }`}
                >
                  {s === 'communityhunts' ? 'communityhunts.gg snapshot' : 'Manual entry'}
                </button>
              ))}
            </div>
            {form.source === 'communityhunts' && (
              <div className="mt-2 border border-white/10 bg-zinc-broadcast/40 px-3 py-2.5">
                {previewing ? (
                  <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
                    Loading current hunt…
                  </p>
                ) : previewError ? (
                  <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
                    {{
                      NO_CURRENT_HUNT: 'No communityhunts.gg hunt found yet.',
                      COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Try refresh or use manual entry.',
                    }[previewError] || previewError}
                  </p>
                ) : preview ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap text-[0.6875rem] font-mono">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white-body truncate">
                        {preview.status === 'live'
                          ? 'Your live communityhunts.gg hunt'
                          : 'Your latest communityhunts.gg hunt (not live)'}
                      </p>
                      <p className="text-white/45 tracking-eyebrow-md uppercase mt-0.5">
                        {preview.status === 'live' ? 'Live' : `Ended ${formatHuntDate(preview.endedAt)}`} · {preview.currency || '—'} · cost {formatMoney(preview.totalCost, preview.currency)} · {preview.bonusCount} bonuses
                      </p>
                      {preview.status !== 'live' && (
                        <p className="text-orange-admin normal-case mt-1">
                          Start the hunt on communityhunts.gg and hit refresh, or this round will track the old one.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={fetchPreview}
                      className="inline-flex items-center gap-1.5 px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30"
                    >
                      <RefreshCcw size={11} aria-hidden="true" />
                      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase">Refresh</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {form.source === 'manual' && (
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                    Total cost <span className="text-white/30 normal-case font-normal">· number</span>
                  </span>
                  <input value={form.manualTotalCost} onChange={(e) => set('manualTotalCost', e.target.value)} className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" />
                </label>
              </div>
            )}
          </div>

          {/* Features */}
          <div>
            <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">04</span> Features
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => set('acceptPredictions', !form.acceptPredictions)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 border transition-colors duration-150 ${
                  form.acceptPredictions
                    ? 'border-emerald-signal/40 bg-emerald-signal/5 text-white-body'
                    : 'border-white/10 bg-zinc-broadcast/40 text-white/50 hover:text-white-body'
                }`}
              >
                <span className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${form.acceptPredictions ? 'bg-emerald-signal' : 'bg-white/25'}`} />
                  Predictions <span className="text-white/30 normal-case font-normal text-[0.625rem]">viewers guess outcome</span>
                </span>
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {form.acceptPredictions ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => set('acceptSuggestions', !form.acceptSuggestions)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 border transition-colors duration-150 ${
                  form.acceptSuggestions
                    ? 'border-emerald-signal/40 bg-emerald-signal/5 text-white-body'
                    : 'border-white/10 bg-zinc-broadcast/40 text-white/50 hover:text-white-body'
                }`}
              >
                <span className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${form.acceptSuggestions ? 'bg-emerald-signal' : 'bg-white/25'}`} />
                  Slot suggestions <span className="text-white/30 normal-case font-normal text-[0.625rem]">viewers nominate slots</span>
                </span>
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                  {form.acceptSuggestions ? 'ON' : 'OFF'}
                </span>
              </button>
              {form.acceptSuggestions && (
                <label className="block mt-2 pl-3 border-l-2 border-emerald-signal/30">
                  <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1 font-mono">
                    Per-viewer cap <span className="text-white/30 normal-case font-normal">· max suggestions each viewer can submit</span>
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.suggestionCap}
                    onChange={(e) => set('suggestionCap', Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    className={inputCls}
                  />
                </label>
              )}
              {form.acceptPredictions && (
                <button
                  type="button"
                  onClick={() => set('announce', !form.announce)}
                  aria-pressed={form.announce}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 border transition-colors duration-150 ${
                    form.announce
                      ? 'border-emerald-signal/40 bg-emerald-signal/5 text-white-body'
                      : 'border-white/10 bg-zinc-broadcast/40 text-white/50 hover:text-white-body'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${form.announce ? 'bg-emerald-signal' : 'bg-white/25'}`} />
                    Announce in chat <span className="text-white/30 normal-case font-normal text-[0.625rem]">posts on open, lock and results</span>
                  </span>
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                    {form.announce ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Rewards (only if predictions enabled) */}
          {form.acceptPredictions && (
            <div>
              <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">05</span> Rewards
              </p>
              <RewardsEditor
                value={form.rewards}
                onChange={(rewards) => setForm((f) => ({ ...f, rewards }))}
              />
            </div>
          )}

          {error && (
            <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150">
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</span>
          </button>
          <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50">
            <Check size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{submitting ? 'Starting…' : 'Start round'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
