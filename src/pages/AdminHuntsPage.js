import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import {
  Lock,
  Unlock,
  Trophy,
  Plus,
  X,
  Check,
  Trash2,
  ChevronRight,
  RefreshCcw,
  Layers,
} from 'lucide-react';
import { db } from '../config/firebase';
import { authedFetch } from '../utils/authedFetch';
import SuggestionList from '../components/SuggestionList';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

function formatTs(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(val) {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DEFAULT_FORM = () => ({
  title: '',
  contextNote: '',
  acceptPredictions: true,
  acceptSuggestions: false,
  suggestionCap: 3,
  kinds: { payout: true, topSlot: false },
  source: 'bonushunt',
  manualSlots: '',
  manualTotalCost: '',
  rewards: {
    type: 'tickets',
    tier1: { tickets: 100, cashLabel: '' },
    tier2: { tickets: 50, cashLabel: '' },
    tier3Enabled: false,
    tier3: { tickets: 25, cashLabel: '' },
  },
});

function NewRoundModal({ onClose, onCreated }) {
  const [form, setForm] = useState(DEFAULT_FORM());
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
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action: 'preview_hunt' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error || 'Failed');
        setPreview(null);
      } else {
        setPreview(data.snapshot);
      }
    } catch (e) {
      setPreviewError('Network error');
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    if (form.source === 'bonushunt' && !preview && !previewing) fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.source]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Title required');
    if (!form.acceptPredictions && !form.acceptSuggestions) {
      return setError('Enable predictions or suggestions');
    }
    if (form.acceptPredictions && !form.kinds.payout && !form.kinds.topSlot) {
      return setError('At least one prediction kind');
    }
    const rewards = {
      type: form.rewards.type,
      tiers: [
        { place: 1, tickets: Number(form.rewards.tier1.tickets) || 0, cashLabel: form.rewards.tier1.cashLabel.trim() || null },
        { place: 2, tickets: Number(form.rewards.tier2.tickets) || 0, cashLabel: form.rewards.tier2.cashLabel.trim() || null },
      ],
    };
    if (form.rewards.tier3Enabled) {
      rewards.tiers.push({
        place: 3,
        tickets: Number(form.rewards.tier3.tickets) || 0,
        cashLabel: form.rewards.tier3.cashLabel.trim() || null,
      });
    }

    setSubmitting(true);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          title: form.title,
          contextNote: form.contextNote,
          acceptPredictions: form.acceptPredictions,
          acceptSuggestions: form.acceptSuggestions,
          suggestionCap: form.acceptSuggestions ? form.suggestionCap : 0,
          kinds: form.kinds,
          source: form.source,
          manualSlots: form.source === 'manual' ? form.manualSlots : null,
          manualTotalCost: form.source === 'manual' ? form.manualTotalCost : null,
          rewards: form.acceptPredictions ? rewards : { type: 'tickets', tiers: [] },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed');
      } else {
        onCreated(data.id);
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
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
              {['bonushunt', 'manual'].map((s) => (
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
                  {s === 'bonushunt' ? 'bonushunt.gg snapshot' : 'Manual entry'}
                </button>
              ))}
            </div>
            {form.source === 'bonushunt' && (
              <div className="mt-2 border border-white/10 bg-zinc-broadcast/40 px-3 py-2.5">
                {previewing ? (
                  <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
                    Loading current hunt…
                  </p>
                ) : previewError ? (
                  <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
                    {previewError}
                  </p>
                ) : preview ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap text-[0.6875rem] font-mono">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white-body truncate">{preview.huntName || 'Untitled hunt'}</p>
                      <p className="text-white/45 tracking-eyebrow-md uppercase mt-0.5">
                        {preview.casino || '—'} · cost {formatCurrency(preview.totalCost)} · {preview.slots?.length || 0} slots
                      </p>
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
                {form.kinds.topSlot && (
                  <label className="block">
                    <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                      Slot list <span className="text-white/30 normal-case font-normal">· one per line</span>
                    </span>
                    <textarea value={form.manualSlots} onChange={(e) => set('manualSlots', e.target.value)} className={inputCls} rows={5} placeholder={'Gates of Olympus\nSugar Rush\nBonanza Billion'} />
                  </label>
                )}
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
            </div>
          </div>

          {/* Kinds (only if predictions enabled) */}
          {form.acceptPredictions && (
            <div>
              <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                <span className="text-orange-admin tabular-nums">05</span> Prediction kinds
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => set('kinds.payout', !form.kinds.payout)}
                  className={`px-3 py-2 border text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono transition-colors duration-150 ${
                    form.kinds.payout
                      ? 'border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal'
                      : 'border-white/15 text-white/55 hover:text-white-body'
                  }`}
                >
                  Final payout
                </button>
                <button
                  type="button"
                  onClick={() => set('kinds.topSlot', !form.kinds.topSlot)}
                  className={`px-3 py-2 border text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono transition-colors duration-150 ${
                    form.kinds.topSlot
                      ? 'border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal'
                      : 'border-white/15 text-white/55 hover:text-white-body'
                  }`}
                >
                  Top slot
                </button>
              </div>
            </div>
          )}

          {/* Rewards (only if predictions enabled) */}
          {form.acceptPredictions && (
          <div>
            <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">06</span> Rewards
            </p>
            <div className="flex gap-2 mb-3">
              {['tickets', 'cash', 'both'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('rewards.type', t)}
                  className={`flex-1 px-3 py-2 border text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono transition-colors duration-150 ${
                    form.rewards.type === t
                      ? 'bg-orange-admin text-zinc-broadcast border-orange-admin'
                      : 'border-white/15 text-white/55 hover:text-white-body'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {[
              { key: 'tier1', place: '1st' },
              { key: 'tier2', place: '2nd' },
            ].map((t) => (
              <div key={t.key} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-end mb-2">
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono pb-2.5 w-10">
                  {t.place}
                </span>
                {(form.rewards.type === 'tickets' || form.rewards.type === 'both') && (
                  <label className="block">
                    <span className="block text-[0.5625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono">tickets</span>
                    <input
                      type="number"
                      min="0"
                      value={form.rewards[t.key].tickets}
                      onChange={(e) => set(`rewards.${t.key}.tickets`, e.target.value)}
                      className={inputCls}
                    />
                  </label>
                )}
                {(form.rewards.type === 'cash' || form.rewards.type === 'both') && (
                  <label className="block">
                    <span className="block text-[0.5625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono">cash label</span>
                    <input
                      type="text"
                      value={form.rewards[t.key].cashLabel}
                      onChange={(e) => set(`rewards.${t.key}.cashLabel`, e.target.value)}
                      placeholder="$25 PayPal"
                      className={inputCls}
                    />
                  </label>
                )}
                {form.rewards.type !== 'both' && form.rewards.type === 'tickets' && (
                  <div />
                )}
                {form.rewards.type !== 'both' && form.rewards.type === 'cash' && (
                  <div />
                )}
              </div>
            ))}
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={form.rewards.tier3Enabled}
                onChange={(e) => set('rewards.tier3Enabled', e.target.checked)}
              />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
                Enable 3rd place
              </span>
            </label>
            {form.rewards.tier3Enabled && (
              <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-end">
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono pb-2.5 w-10">3rd</span>
                {(form.rewards.type === 'tickets' || form.rewards.type === 'both') && (
                  <label className="block">
                    <span className="block text-[0.5625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono">tickets</span>
                    <input type="number" min="0" value={form.rewards.tier3.tickets} onChange={(e) => set('rewards.tier3.tickets', e.target.value)} className={inputCls} />
                  </label>
                )}
                {(form.rewards.type === 'cash' || form.rewards.type === 'both') && (
                  <label className="block">
                    <span className="block text-[0.5625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono">cash label</span>
                    <input type="text" value={form.rewards.tier3.cashLabel} onChange={(e) => set('rewards.tier3.cashLabel', e.target.value)} className={inputCls} />
                  </label>
                )}
              </div>
            )}
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

function SettleModal({ round, onClose, onSettled }) {
  const [actualPayout, setActualPayout] = useState('');
  const [actualTopSlot, setActualTopSlot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const slots =
    round.source === 'bonushunt'
      ? round.bonusHuntSnapshot?.slots || []
      : (round.manualSlots || []).map((name) => ({ name }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (round.kinds.payout && !Number.isFinite(Number(actualPayout))) {
      return setError('Actual payout required');
    }
    if (round.kinds.topSlot && !actualTopSlot) {
      return setError('Actual top slot required');
    }
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({
          action: 'settle',
          id: round.id,
          actualPayout: round.kinds.payout ? Number(actualPayout) : null,
          actualTopSlotName: round.kinds.topSlot ? actualTopSlot : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed');
      else onSettled(data);
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md border border-orange-admin/40 bg-zinc-card">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <Trophy size={11} aria-hidden="true" />
            Settle round
          </span>
          <button type="button" onClick={onClose} className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {round.kinds.payout && (
            <label className="block">
              <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                Actual final payout <span className="text-emerald-signal">*</span>
              </span>
              <input type="number" min="0" step="0.01" value={actualPayout} onChange={(e) => setActualPayout(e.target.value)} className={inputCls} placeholder="0.00" />
            </label>
          )}
          {round.kinds.topSlot && (
            <label className="block">
              <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                Actual top slot <span className="text-emerald-signal">*</span>
              </span>
              <select value={actualTopSlot} onChange={(e) => setActualTopSlot(e.target.value)} className={inputCls}>
                <option value="">— select —</option>
                {slots.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150">
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</span>
          </button>
          <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50">
            <Trophy size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{submitting ? 'Settling…' : 'Reveal winners'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function RoundRow({ round, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(round)} className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left">
      <span className={`px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${
        round.status === 'open'
          ? 'text-emerald-signal border-emerald-signal/40'
          : round.status === 'locked'
            ? 'text-orange-admin border-orange-admin/40'
            : 'text-white/65 border-white/20'
      }`}>
        {round.status}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-white-body text-sm truncate">{round.title}</p>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
          {[
            round.acceptPredictions && (round.kinds?.payout || round.kinds?.topSlot)
              ? `PREDICT (${[round.kinds?.payout && 'payout', round.kinds?.topSlot && 'top-slot'].filter(Boolean).join('+')})`
              : null,
            round.acceptSuggestions && `SUGGEST`,
          ].filter(Boolean).join(' + ')} · {round.source} · {formatTs(round.createdAt)}
        </p>
      </div>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono tabular-nums">
        {round.entryCount ?? 0} entries
      </span>
      <ChevronRight size={14} className="text-white/30" aria-hidden="true" />
    </button>
  );
}

function RoundDetail({ round, onBack }) {
  const [busy, setBusy] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [settling, setSettling] = useState(false);

  const act = async (action) => {
    setBusy(action);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action, id: round.id }),
      });
      const data = await res.json();
      if (!res.ok) alert(`Action failed: ${data.error || res.status}`);
      else if (action === 'delete') onBack();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <button type="button" onClick={onBack} className="text-white/55 hover:text-white-body tracking-eyebrow-lg">
          ← Back to list
        </button>
        <span className="inline-flex items-center gap-2 text-orange-admin">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
          Round · {round.status}
        </span>
      </div>

      <div className="relative overflow-hidden border border-orange-admin/30 bg-zinc-card/40">
        <div className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden" aria-hidden="true" />
        <div className="relative px-6 sm:px-8 py-7">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin mb-2 font-mono">
            ▸ Prediction round
          </p>
          <p
            className="font-black text-white-body leading-[0.9] tracking-[-0.03em]"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
            }}
          >
            {round.title}
          </p>
          {round.contextNote && <p className="mt-2 text-sm text-white/55">{round.contextNote}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
            <span className="text-white/55">
              Features{' '}
              <span className="text-emerald-signal">
                {[
                  round.acceptPredictions && 'predictions',
                  round.acceptSuggestions && 'suggestions',
                ].filter(Boolean).join(' + ') || 'none'}
              </span>
            </span>
            <span className="text-white/15">·</span>
            <span className="text-white/55">Source <span className="text-white-body">{round.source}</span></span>
            {round.acceptPredictions && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-white/55">Entries <span className="text-white-body tabular-nums">{round.entryCount ?? 0}</span></span>
              </>
            )}
            {round.acceptSuggestions && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-white/55">Suggestions <span className="text-white-body tabular-nums">{round.suggestionCount ?? 0}</span></span>
                <span className="text-white/15">·</span>
                <span className="text-white/55">Cap <span className="text-white-body tabular-nums">{round.suggestionCap ?? 3}</span></span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {round.acceptPredictions && round.status === 'open' && (
          <button type="button" onClick={() => act('lock')} disabled={!!busy} className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50">
            <Lock size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{busy === 'lock' ? 'Locking…' : 'Lock entries'}</span>
          </button>
        )}
        {round.acceptPredictions && round.status === 'locked' && (
          <button type="button" onClick={() => act('reopen')} disabled={!!busy} className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50">
            <Unlock size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{busy === 'reopen' ? 'Reopening…' : 'Reopen'}</span>
          </button>
        )}
        {round.acceptPredictions && ['open', 'locked'].includes(round.status) && (
          <button type="button" onClick={() => setSettling(true)} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-30">
            <Trophy size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Settle & reveal</span>
          </button>
        )}
        {round.acceptPredictions && round.status === 'settled' && round.winners?.[0] && (
          <div className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-signal/40 bg-emerald-signal/5 text-emerald-signal text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={12} aria-hidden="true" />
            1st: {round.winners[0].displayName}
          </div>
        )}
        {!confirmingDelete ? (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto inline-flex items-center gap-2 px-3 py-2 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150">
            <Trash2 size={12} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Delete</span>
          </button>
        ) : (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => act('delete')} className="inline-flex items-center gap-2 px-3 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Confirm</button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</button>
          </div>
        )}
      </div>

      {round.acceptSuggestions && (
        <SuggestionList huntId={round.id} adminMode />
      )}

      {settling && (
        <SettleModal
          round={round}
          onClose={() => setSettling(false)}
          onSettled={() => setSettling(false)}
        />
      )}
    </div>
  );
}

export default function AdminHuntsPage() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(50));
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const selected = useMemo(() => list.find((r) => r.id === selectedId) || null, [list, selectedId]);
  const grouped = useMemo(() => {
    const live = list.filter((r) => r.status === 'open' || r.status === 'locked');
    const past = list.filter((r) => r.status === 'settled');
    return { live, past };
  }, [list]);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>PREDICTIONS</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">PRD</span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 'clamp(2.25rem, 6vw, 3.25rem)' }}
        >
          <span className="block">Prediction</span>
          <span className="block text-orange-admin">rounds.</span>
        </h1>
      </header>

      {!selected && (
        <div className="flex items-center justify-end mb-6">
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150">
            <Plus size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">New round</span>
          </button>
        </div>
      )}

      {selected ? (
        <RoundDetail round={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <div className="space-y-6">
          {grouped.live.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-2 font-mono">
                Live · {grouped.live.length}
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.live.map((r) => (
                  <RoundRow key={r.id} round={r} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            </section>
          )}
          {grouped.past.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-2 font-mono">
                Past · {grouped.past.length}
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.past.map((r) => (
                  <RoundRow key={r.id} round={r} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            </section>
          )}
          {list.length === 0 && (
            <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 mb-3 text-white/35">
                <Layers size={16} aria-hidden="true" />
              </div>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">No rounds yet</p>
              <p className="text-sm text-white/55">Start one to begin.</p>
            </div>
          )}
        </div>
      )}

      {creating && (
        <NewRoundModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
