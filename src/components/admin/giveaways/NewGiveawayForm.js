import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Dices, TriangleAlert, X } from 'lucide-react';
import {
  DURATION_OPTIONS,
  LAST_CALL_SECONDS,
  WINNER_COUNT_OPTIONS,
  bonusPrize,
  defaultTitle,
  keywordWarning,
  normalizeKeyword,
  parseMoney,
  rulesSummary,
  suggestKeyword,
} from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';
import { Chips, ToggleRow, inputCls, labelCls } from './ui';
import { chatLabel } from './EventSubStatus';

const PRIZE_KIND_OPTIONS = [
  { label: 'Bonus buy', value: 'bonus' },
  { label: 'Other prize', value: 'item' },
];

export default function NewGiveawayForm({ seed, chat, onClose, onCreated }) {
  const [form, setForm] = useState(seed);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // A click-outside close must start AND end on the backdrop. A drag that
  // begins inside a text field (selecting text) and releases over the
  // backdrop still fires `click` on the backdrop, which closed the form and
  // lost everything typed. Track where the press began.
  const pressOnBackdrop = useRef(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setW = (k, v) => setForm((f) => ({ ...f, weights: { ...f.weights, [k]: v } }));
  const kwWarning = keywordWarning(form.keyword);
  const titlePlaceholder = useMemo(() => defaultTitle(), []);
  const chatDown = chat.status !== 'enabled' && chat.status !== 'loading';

  const bonus = form.kind === 'bonus';
  const buyValue = parseMoney(form.buyAmount);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (bonus && !(buyValue > 0)) return setError("What's the bonus buy worth?");
    if (!bonus && !form.prize.trim()) return setError('What are you giving away?');
    if (!normalizeKeyword(form.keyword)) return setError('Pick a chat keyword.');
    setSaving(true);
    try {
      const { ok, data } = await postAction('create', {
        ...form,
        buyAmount: bonus ? buyValue : null,
        prize: bonus ? bonusPrize(buyValue) : form.prize.trim(),
        title: form.title.trim() || titlePlaceholder,
      });
      if (!ok) {
        setError(data.error || 'Failed to create.');
      } else if (
        data.announce &&
        data.announce.posted === false &&
        data.announce.reason &&
        !QUIET_ANNOUNCE.includes(data.announce.reason)
      ) {
        // Giveaway exists either way; just surface the chat failure.
        onCreated(data.id, { announceError: data.announce.reason });
      } else {
        onCreated(data.id);
      }
    } catch (err) {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const endedOnBackdrop = e.target === e.currentTarget;
        const startedOnBackdrop = pressOnBackdrop.current;
        pressOnBackdrop.current = false;
        if (startedOnBackdrop && endedOnBackdrop) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg max-h-full overflow-y-auto border border-white/10 bg-zinc-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            New giveaway
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {chatDown && (
            <div className="flex items-start gap-3 px-3 py-2.5 border border-red-destructive/50 bg-red-destructive/5">
              <TriangleAlert size={14} className="text-red-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
                  Chat isn&apos;t connected
                </p>
                <p className="text-xs text-white/60 mt-0.5">
                  Nobody can enter until it is. {chatLabel(chat)}.
                </p>
              </div>
              {chat.status === 'missing' && (
                <button
                  type="button"
                  onClick={chat.subscribe}
                  disabled={chat.busy}
                  className="px-2.5 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-50 flex-shrink-0"
                >
                  {chat.busy ? 'Connecting…' : 'Connect'}
                </button>
              )}
            </div>
          )}

          <div>
            <p className={labelCls}>
              <span className="text-orange-admin tabular-nums">01</span> Prize <span className="text-emerald-signal">*</span>
            </p>
            <Chips
              label="Prize type"
              options={PRIZE_KIND_OPTIONS}
              value={form.kind}
              onChange={(v) => set({ kind: v })}
            />
            {bonus ? (
              <>
                <div className="mt-2 flex">
                  <span className="px-3 py-2.5 border border-r-0 border-white/10 bg-zinc-broadcast/80 font-mono font-bold text-white/55">
                    $
                  </span>
                  <input
                    key="buy"
                    autoFocus
                    inputMode="decimal"
                    value={form.buyAmount}
                    onChange={(e) => set({ buyAmount: e.target.value })}
                    placeholder="100"
                    aria-label="Bonus buy value"
                    className={`${inputCls} text-base font-bold font-mono`}
                  />
                </div>
                <p className="mt-1.5 text-[0.6875rem] text-white/40 font-mono">
                  Each winner gets a bonus buy worth this. You log what it actually paid after playing it.
                </p>
              </>
            ) : (
              <input
                key="prize"
                autoFocus
                value={form.prize}
                onChange={(e) => set({ prize: e.target.value })}
                placeholder="Hades II · Steam key"
                aria-label="Prize"
                className={`mt-2 ${inputCls} text-base font-bold`}
              />
            )}
          </div>

          <div>
            <label htmlFor="gw-keyword" className={labelCls}>
              <span className="text-orange-admin tabular-nums">02</span> Chat keyword <span className="text-emerald-signal">*</span>
              <span className="text-white/30 normal-case font-normal"> · whole word, any case</span>
            </label>
            <div className="flex gap-2">
              <input
                id="gw-keyword"
                value={form.keyword}
                onChange={(e) => set({ keyword: e.target.value.toLowerCase() })}
                className={`${inputCls} font-mono`}
                aria-describedby={kwWarning ? 'gw-keyword-warn' : undefined}
              />
              <button
                type="button"
                onClick={() => set({ keyword: suggestKeyword(form.keyword) })}
                title="Suggest another keyword"
                aria-label="Suggest another keyword"
                className="px-3 border border-white/10 text-white/60 hover:text-orange-admin hover:border-orange-admin/50 transition-colors duration-150"
              >
                <Dices size={15} aria-hidden="true" />
              </button>
            </div>
            {kwWarning && (
              <p id="gw-keyword-warn" className="mt-1.5 text-[0.6875rem] text-orange-admin font-mono">
                {kwWarning}
              </p>
            )}
          </div>

          <div>
            <p className={labelCls}>
              <span className="text-orange-admin tabular-nums">03</span> Entry timer
            </p>
            <Chips
              label="Entry timer"
              options={DURATION_OPTIONS}
              value={form.durationSec}
              onChange={(v) => set({ durationSec: v, autoRoll: v > 0 ? form.autoRoll : false })}
            />
            {form.durationSec > 0 && (
              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoRoll}
                  onChange={(e) => set({ autoRoll: e.target.checked })}
                />
                <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
                  Roll a winner when time&apos;s up
                </span>
              </label>
            )}
          </div>

          <div>
            <p className={labelCls}>
              <span className="text-orange-admin tabular-nums">04</span> Winners
            </p>
            <Chips
              label="Number of winners"
              options={WINNER_COUNT_OPTIONS.map((n) => ({ label: String(n), value: n }))}
              value={form.targetWinners}
              onChange={(v) => set({ targetWinners: v })}
            />
          </div>

          {/* Everything that stays the same giveaway to giveaway */}
          <div className="border border-white/10">
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              aria-expanded={showMore}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-broadcast/40 transition-colors duration-150"
            >
              <ChevronDown
                size={14}
                className={`text-white/45 flex-shrink-0 transition-transform duration-150 ${showMore ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/60 font-mono">
                  Title, rules &amp; chat messages
                </span>
                <span className="block text-[0.6875rem] text-white/40 font-mono truncate mt-0.5">
                  {rulesSummary(form)}
                </span>
              </span>
            </button>

            {showMore && (
              <div className="px-3 pb-4 pt-1 space-y-4 border-t border-white/8">
                <label className="block pt-3">
                  <span className={labelCls}>Title</span>
                  <input
                    value={form.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder={titlePlaceholder}
                    className={inputCls}
                  />
                </label>

                <div>
                  <p className={labelCls}>Bonus tickets</p>
                  <div className="space-y-1.5">
                    <ToggleRow label="Registered on site" value={form.weights.registered} onChange={(v) => setW('registered', v)} />
                    <ToggleRow label="Discord linked" value={form.weights.discord} onChange={(v) => setW('discord', v)} />
                    <ToggleRow label="Twitch sub" value={form.weights.sub} onChange={(v) => setW('sub', v)} />
                    <ToggleRow label="Twitch VIP" value={form.weights.vip} onChange={(v) => setW('vip', v)} />
                  </div>
                  <p className="mt-2 text-[0.625rem] tracking-eyebrow uppercase text-white/35 font-mono">
                    Everyone gets 1 ticket. Each toggle adds +1.
                  </p>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.requireFollow}
                    onChange={(e) => set({ requireFollow: e.target.checked })}
                  />
                  <span>
                    <span className="block text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
                      Require channel follow
                    </span>
                    <span className="block text-[0.625rem] tracking-eyebrow text-white/35 font-mono">
                      Mods and VIPs are exempt.
                    </span>
                  </span>
                </label>

                <div className="space-y-3">
                  <p className={`${labelCls} mb-0`}>
                    Chat messages
                    <span className="text-white/30 normal-case font-normal">
                      {' '}· {'{keyword} {prize} {title} {winner}'}
                      {bonus && ' {payout} {multi} {slot}'}
                    </span>
                  </p>
                  {[
                    ['announceStart', 'startMessage', 'When it starts'],
                    ...(form.durationSec > 0
                      ? [['announceLastCall', 'lastCallMessage', `Last call (${LAST_CALL_SECONDS}s left)`]]
                      : []),
                    ['announceWinner', 'winnerMessage', 'Winner, after the reveal'],
                    ...(bonus ? [['announcePayout', 'payoutMessage', 'Payout, once you log it']] : []),
                  ].map(([flag, field, label]) => (
                    <div key={field} className="border border-white/10 bg-zinc-broadcast/40 p-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form[flag]} onChange={(e) => set({ [flag]: e.target.checked })} />
                        <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
                          {label}
                        </span>
                      </label>
                      <textarea
                        value={form[field]}
                        onChange={(e) => set({ [field]: e.target.value })}
                        rows={2}
                        disabled={!form[flag]}
                        className={`${inputCls} ${!form[flag] ? 'opacity-40' : ''}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
          >
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
          >
            <Check size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Starting…' : chatDown ? 'Start anyway' : 'Start giveaway'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
