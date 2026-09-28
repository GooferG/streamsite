import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import {
  Gift,
  Plus,
  X,
  Check,
  RefreshCcw,
  SkipForward,
  Trophy,
  Radio,
  Webhook,
  Trash2,
  ChevronRight,
  ChevronDown,
  Users,
  Timer,
  ArrowLeft,
  Flag,
  Dices,
  MonitorPlay,
  Copy,
  ExternalLink,
  RotateCcw,
  MessageSquare,
  TriangleAlert,
  Play,
  Minus,
  Pencil,
} from 'lucide-react';
import { db } from '../config/firebase';
import { authedFetch } from '../utils/authedFetch';
import GiveawayEntriesGrid from '../components/GiveawayEntriesGrid';
import { useRevealState } from '../components/giveaway/RevealScreen';
import { useClock } from '../hooks/useClock';
import { toImageUrl } from '../utils/slotImage';
import { postAction, QUIET_ANNOUNCE } from '../components/admin/giveaways/api';
import useGiveawayClock from '../components/admin/giveaways/useGiveawayClock';
import useWinnerAnnounce from '../components/admin/giveaways/useWinnerAnnounce';
import {
  DURATION_OPTIONS,
  LAST_CALL_SECONDS,
  REVEAL_MS,
  WINNER_COUNT_OPTIONS,
  bonusPrize,
  defaultTitle,
  formFromGiveaway,
  formatClock,
  formatMoney,
  formatMulti,
  isBonusGiveaway,
  keywordWarning,
  normalizeKeyword,
  parseMoney,
  rulesSummary,
  suggestKeyword,
  tsMillis,
} from '../utils/giveaway';

// Slot search pulls the slot catalogue on first use; only load it once a bonus is being played.
const SlotAutocomplete = lazy(() => import('../components/SlotAutocomplete'));

const PRIZE_KIND_OPTIONS = [
  { label: 'Bonus buy', value: 'bonus' },
  { label: 'Other prize', value: 'item' },
];

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

const labelCls =
  'block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono';

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

function ToggleRow({ label, value, onChange, hint }) {
  const on = value > 0;
  return (
    <button
      type="button"
      onClick={() => onChange(on ? 0 : 1)}
      aria-pressed={on}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2 border transition-colors duration-150 ${
        on
          ? 'border-emerald-signal/40 bg-emerald-signal/5 text-white-body'
          : 'border-white/10 bg-zinc-broadcast/40 text-white/50 hover:text-white-body'
      }`}
    >
      <span className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">
        <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-signal' : 'bg-white/25'}`} />
        {label}
        {hint && <span className="text-white/30 normal-case font-normal text-[0.625rem]">{hint}</span>}
      </span>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

function Chips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2 border text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono transition-colors duration-150 ${
              active
                ? 'border-orange-admin/70 bg-orange-admin/10 text-orange-admin'
                : 'border-white/10 bg-zinc-broadcast/40 text-white/55 hover:text-white-body hover:border-white/25'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="ml-1.5 px-1 py-px border border-current text-[0.5625rem] font-mono opacity-50 normal-case tracking-normal">
      {children}
    </kbd>
  );
}

// ─── Chat connection (EventSub) ─────────────────────────────────────────────

function useEventSubStatus() {
  const [status, setStatus] = useState('loading');
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await authedFetch('/api/admin/eventsub', { method: 'GET' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unknown');
        setStatus('error');
      } else {
        setSubs(data.ours || []);
        setStatus(data.ours?.some((s) => s.status === 'enabled') ? 'enabled' : 'missing');
        setError(null);
      }
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/admin/eventsub', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setError(data.detail || data.error || 'Failed');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this subscription? Chat-keyword entries will stop until re-subscribed.')) return;
    setBusy(true);
    try {
      await authedFetch(`/api/admin/eventsub?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return { status, subs, busy, error, subscribe, remove };
}

function chatLabel(chat) {
  if (chat.status === 'loading') return 'Checking…';
  if (chat.status === 'enabled') return 'Connected to Twitch chat';
  if (chat.status === 'missing') return 'Not subscribed. Chat keywords will not register entries';
  if (chat.error === 'EVENTSUB_NOT_CONFIGURED') {
    return 'Chat not configured on the server (TWITCH_BROADCASTER_ID / TWITCH_EVENTSUB_SECRET)';
  }
  return `Error: ${chat.error || 'unknown'}`;
}

function EventSubStatus({ chat }) {
  const tone =
    chat.status === 'enabled'
      ? 'text-emerald-signal border-emerald-signal/40'
      : chat.status === 'missing' || chat.status === 'loading'
        ? 'text-orange-admin border-orange-admin/40'
        : 'text-red-destructive border-red-destructive/40';

  return (
    <div className={`border ${tone} bg-zinc-card/30`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <div className="inline-flex items-center gap-3 min-w-0">
          <Webhook size={14} aria-hidden="true" />
          <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">{chatLabel(chat)}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {chat.status !== 'enabled' && chat.status !== 'loading' && (
            <button
              type="button"
              onClick={chat.subscribe}
              disabled={chat.busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
            >
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {chat.busy ? 'Subscribing…' : 'Subscribe to chat'}
              </span>
            </button>
          )}
          {chat.subs.length > 0 && (
            <button
              type="button"
              onClick={() => chat.remove(chat.subs[0].id)}
              disabled={chat.busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/15 text-white/55 hover:text-red-destructive hover:border-red-destructive/40 transition-colors duration-150 disabled:opacity-50"
              title="Delete subscription"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OverlayLink() {
  const url = `${window.location.origin}/giveaway-overlay`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy the overlay URL', url);
    }
  };
  return (
    <div className="border border-white/10 bg-zinc-card/30 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <MonitorPlay size={14} className="text-emerald-signal" aria-hidden="true" />
        <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono text-white/70">
          Stream overlay
        </span>
        <code className="text-xs text-white/55 font-mono truncate min-w-0">{url}</code>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150"
          >
            {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
          <a
            href="/giveaway-overlay?demo=1"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150"
          >
            <ExternalLink size={12} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Demo</span>
          </a>
        </div>
      </div>
      <p className="mt-2 text-[0.625rem] tracking-eyebrow text-white/35 font-mono">
        OBS browser source, 1920×1080. Add ?sound=1 for reveal sound, ?pos=br|tl|tr to move the entry
        card, ?playpos=… for the bonus card shown while you play the slot.
      </p>
    </div>
  );
}

// ─── New giveaway ───────────────────────────────────────────────────────────

function NewGiveawayForm({ seed, chat, onClose, onCreated }) {
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

// ─── Winner window ──────────────────────────────────────────────────────────

function ClaimTimer({ giveaway, firstMessageAt }) {
  // Counts from when the name lands on stream (after the reveal), freezes on
  // the winner's first chat message.
  const reveal = useRevealState(giveaway);
  const landedAt = tsMillis(giveaway.rolledAt) + REVEAL_MS;
  const answeredAt = tsMillis(firstMessageAt);

  if (!reveal.landed && !answeredAt) {
    const left = Math.max(0, Math.ceil((landedAt - reveal.now) / 1000));
    return (
      <div className="flex items-center gap-3 px-3 py-2 border border-white/15 bg-zinc-broadcast/40">
        <Timer size={13} className="text-white/40" aria-hidden="true" />
        <div className="leading-none">
          <p className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-0.5 font-mono">
            On stream in
          </p>
          <p className="text-2xl font-black tabular-nums text-white/55 font-mono leading-none">{left}s</p>
        </div>
      </div>
    );
  }

  const elapsed = answeredAt ? Math.max(0, (answeredAt - landedAt) / 1000) : reveal.sinceLanded;
  let tone;
  if (answeredAt) {
    tone = { box: 'border-emerald-signal/50 bg-emerald-signal/5', text: 'text-emerald-signal', label: 'Responded in' };
  } else if (elapsed >= 90) {
    tone = { box: 'border-red-destructive/50 bg-red-destructive/5', text: 'text-red-destructive', label: 'Waiting' };
  } else if (elapsed >= 30) {
    tone = { box: 'border-orange-admin/50 bg-orange-admin/5', text: 'text-orange-admin', label: 'Waiting' };
  } else {
    tone = { box: 'border-white/15 bg-zinc-broadcast/40', text: 'text-white-body', label: 'Waiting' };
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 border transition-colors duration-300 ${tone.box}`}>
      <Timer size={13} className={tone.text} aria-hidden="true" />
      <div className="leading-none">
        <p className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-0.5 font-mono">
          {tone.label}
        </p>
        <p className={`text-2xl font-black tabular-nums font-mono leading-none ${tone.text}`}>
          {formatClock(elapsed)}
        </p>
      </div>
    </div>
  );
}

function ChatAnnounceStatus({ announce }) {
  const now = useClock({ intervalMs: 500, active: announce.enabled && !announce.posted });
  let body;
  if (!announce.enabled) {
    body = <span className="text-white/35">Chat announce off</span>;
  } else if (announce.posted) {
    body = <span className="text-emerald-signal">Posted in chat</span>;
  } else if (announce.error) {
    body = (
      <>
        <span className="text-red-destructive truncate">Chat post failed: {announce.error}</span>
        <button
          type="button"
          onClick={announce.retry}
          className="ml-auto px-2 py-0.5 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/10"
        >
          Retry
        </button>
      </>
    );
  } else if (announce.posting) {
    body = <span className="text-white/55">Posting in chat…</span>;
  } else {
    const left = announce.dueAt ? Math.max(0, Math.ceil((announce.dueAt - now) / 1000)) : 0;
    body = <span className="text-white/55">Posts in chat in {left}s (after the reveal)</span>;
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-zinc-broadcast/40 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
      <MessageSquare size={11} className="text-white/40 flex-shrink-0" aria-hidden="true" />
      {body}
    </div>
  );
}

function WinnerModal({ giveaway, announce }) {
  // 'reroll' | 'skip' | 'confirm' | 'roll' | 'back' | 'end'
  const [busy, setBusy] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prizeNote, setPrizeNote] = useState('');
  const [error, setError] = useState(null);
  const bonus = isBonusGiveaway(giveaway);

  useEffect(() => {
    if (!giveaway?.id) return undefined;
    const q = query(
      collection(db, 'giveaways', giveaway.id, 'winner_messages'),
      orderBy('createdAt', 'asc'),
      fLimit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [giveaway?.id]);

  // First message timestamp determines if we freeze the timer.
  const firstMessageAt = messages.length > 0 ? messages[0].createdAt : null;

  const act = useCallback(
    async (action) => {
      setBusy(action);
      setError(null);
      try {
        const body = { id: giveaway.id };
        if (action === 'confirm') body.prizeNote = prizeNote || null;
        const { ok, status, data } = await postAction(action, body);
        if (!ok) {
          setError(
            data.error === 'NO_MORE_ENTRIES' || data.error === 'NO_ENTRIES'
              ? 'Nobody left to draw.'
              : `Action failed: ${data.error || status}`
          );
          return;
        }
        if (['roll', 'reroll', 'skip'].includes(action)) setPrizeNote('');
      } catch (err) {
        setError('Network error.');
      } finally {
        setBusy(null);
      }
    },
    [giveaway.id, prizeNote]
  );

  const winners = useMemo(() => giveaway.winners || [], [giveaway.winners]);
  // Confirmed = written down. The window stays up either way; what changes is
  // which actions make sense. Nothing here closes on a click outside.
  const confirmed = winners.some((x) => x.twitchId === giveaway.winnerTwitchId);
  const target = Number(giveaway.targetWinners) || 1;
  const needMore = winners.length < target;
  const winnerNo = confirmed
    ? winners.findIndex((x) => x.twitchId === giveaway.winnerTwitchId) + 1
    : winners.length + 1;

  // Hotkeys, so nobody has to aim a mouse while live. Letter keys are ignored
  // while typing in the prize note; Enter there confirms.
  const rootRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (busy || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      const k = e.key.toLowerCase();
      // A focused button already acts on Enter/Space; don't fire twice.
      if ((tag === 'BUTTON' || tag === 'A') && (k === 'enter' || k === ' ')) return;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      // Typing somewhere else (another dialog on top) is not for us.
      if (typing && !rootRef.current?.contains(e.target)) return;
      if (!confirmed) {
        if (k === 'enter') act('confirm');
        else if (typing) return;
        else if (k === 'r') act('reroll');
        else if (k === 's') act('skip');
        else if (k === 'escape') act('back');
        else return;
      } else {
        if (typing) return;
        if (k === 'enter') act(needMore ? 'roll' : 'end');
        else if (k === 'r') act('roll');
        else if (k === 'escape') act('back');
        else return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, confirmed, needMore, act]);

  if (!giveaway || giveaway.status !== 'rolling' || !giveaway.winner) return null;
  const w = giveaway.winner;

  const btnGhost =
    'inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/15 text-white/75 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-40';
  const btnLabel = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/85 backdrop-blur-md"
      onClick={(e) => {
        // Disallow click-outside-to-close so the admin doesn't accidentally
        // dismiss the winner mid-stream.
        e.stopPropagation();
      }}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Giveaway winner"
        className="relative w-full max-w-2xl max-h-full overflow-y-auto border border-orange-admin/40 bg-zinc-card"
      >
        {/* Atmospheric backing */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between gap-3 px-5 py-3 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-orange-admin motion-safe:animate-ping opacity-60" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-orange-admin" />
            </span>
            <span>ON STREAM</span>
          </span>
          <span className="text-white/45 truncate max-w-[40ch]">
            {giveaway.title} · {giveaway.prize}
          </span>
        </div>

        <div className="relative px-6 sm:px-10 py-8">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-2 font-mono inline-flex items-center gap-2">
            <Trophy size={11} className="text-orange-admin" aria-hidden="true" />
            Winner #{winnerNo}
            {target > 1 && ` of ${target}`}
            {confirmed ? ' · confirmed' : ' · picked'}
          </p>
          <div className="flex items-center gap-4 mb-5 flex-wrap">
            {w.profileImageUrl ? (
              <img
                src={w.profileImageUrl}
                alt=""
                className="w-16 h-16 rounded-full border border-orange-admin/40 flex-shrink-0"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full border-2 border-orange-admin/40 bg-zinc-broadcast/50 flex items-center justify-center text-2xl font-black text-white/55 font-mono flex-shrink-0"
                aria-hidden="true"
              >
                {(w.displayName || w.twitchName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-3xl sm:text-4xl font-black text-white-body tracking-tight leading-none">
                  {w.displayName || w.twitchName}
                </p>
                {!w.registered && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 border border-orange-admin/50 bg-orange-admin/5 text-orange-admin text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
                    title="Winner has not signed in on goofer.tv. Prize redemption won't show on /me; DM them on Twitch to deliver."
                  >
                    Not on site · DM to deliver
                  </span>
                )}
              </div>
              <p className="mt-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
                {w.twitchName} · weight {w.weight} · via {w.source}
              </p>
            </div>
            <ClaimTimer giveaway={giveaway} firstMessageAt={firstMessageAt} />
          </div>

          <div className="mb-3">
            <ChatAnnounceStatus announce={announce} />
          </div>

          {/* Chat stream */}
          <div className="border border-white/10 bg-zinc-broadcast/40 mb-5">
            <div className="px-3 py-2 border-b border-white/8 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/55 font-mono flex items-center gap-2">
              <Radio size={11} aria-hidden="true" />
              Winner&apos;s live chat
              <span className="ml-auto text-white/30 tabular-nums">{messages.length}</span>
            </div>
            <div className="px-3 py-3 max-h-56 overflow-y-auto space-y-1.5">
              {messages.length === 0 ? (
                <p className="text-sm text-white/45 italic">Waiting on winner to type in chat…</p>
              ) : (
                messages.map((m) => (
                  <p key={m.id} className="text-sm text-white-body leading-snug">
                    <span className="text-orange-admin font-bold">{m.twitchName || m.chatterLogin}:</span>{' '}
                    {m.text}
                  </p>
                ))
              )}
            </div>
          </div>

          {confirmed ? (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 border border-emerald-signal/40 bg-emerald-signal/5 text-emerald-signal text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              <Check size={12} aria-hidden="true" />
              Recorded · redemption created
              {winners[winnerNo - 1]?.prizeNote && (
                <span className="text-white/45 normal-case font-normal tracking-normal truncate">
                  · {winners[winnerNo - 1].prizeNote}
                </span>
              )}
            </div>
          ) : (
            /* Prize note (optional, attached on confirm) */
            <label className="block mb-4">
              <span className={labelCls}>Prize note · attached to redemption</span>
              <input
                value={prizeNote}
                onChange={(e) => setPrizeNote(e.target.value)}
                placeholder="Steam key, will DM after stream"
                className={inputCls}
              />
            </label>
          )}

          {/* Actions */}
          {!confirmed ? (
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => act('reroll')} disabled={!!busy} className={btnGhost}>
                <RefreshCcw size={13} aria-hidden="true" />
                <span className={btnLabel}>
                  {busy === 'reroll' ? 'Rolling…' : 'Reroll'}
                  <Kbd>R</Kbd>
                </span>
              </button>
              <button
                type="button"
                onClick={() => act('skip')}
                disabled={!!busy}
                title="Rule this person out of the rest of the giveaway and pick again."
                className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-red-destructive/40 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150 disabled:opacity-40"
              >
                <SkipForward size={13} aria-hidden="true" />
                <span className={btnLabel}>
                  {busy === 'skip' ? 'Skipping…' : 'Skip'}
                  <Kbd>S</Kbd>
                </span>
              </button>
              <button
                type="button"
                onClick={() => act('back')}
                disabled={!!busy}
                title="Drop this pick and return to the entries. Nothing is recorded."
                className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/10 text-white/50 hover:text-white-body hover:border-white/30 transition-colors duration-150 disabled:opacity-40"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span className={btnLabel}>
                  {busy === 'back' ? 'Going back…' : 'Discard'}
                  <Kbd>Esc</Kbd>
                </span>
              </button>
              <button
                type="button"
                onClick={() => act('confirm')}
                disabled={!!busy}
                className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
              >
                <Check size={13} aria-hidden="true" />
                <span className={btnLabel}>
                  {busy === 'confirm' ? 'Confirming…' : bonus ? 'Confirm · play their bonus' : 'Confirm winner'}
                  <Kbd>Enter</Kbd>
                </span>
              </button>
            </div>
          ) : (
            /*
              After the pick is written down the giveaway is still live. With
              winners still to go, rolling the next one is the main action;
              once the target is met, wrapping up is.
            */
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => act('back')} disabled={!!busy} className={btnGhost}>
                <ArrowLeft size={13} aria-hidden="true" />
                <span className={btnLabel}>
                  {busy === 'back' ? 'Going back…' : 'Back to entries'}
                  <Kbd>Esc</Kbd>
                </span>
              </button>
              {needMore ? (
                <>
                  <button type="button" onClick={() => act('end')} disabled={!!busy} className={btnGhost}>
                    <Flag size={13} aria-hidden="true" />
                    <span className={btnLabel}>{busy === 'end' ? 'Ending…' : 'End early'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => act('roll')}
                    disabled={!!busy}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
                  >
                    <Gift size={13} aria-hidden="true" />
                    <span className={btnLabel}>
                      {busy === 'roll' ? 'Rolling…' : `Roll #${winners.length + 1} of ${target}`}
                      <Kbd>Enter</Kbd>
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => act('roll')} disabled={!!busy} className={btnGhost}>
                    <Gift size={13} aria-hidden="true" />
                    <span className={btnLabel}>
                      {busy === 'roll' ? 'Rolling…' : 'Roll a bonus winner'}
                      <Kbd>R</Kbd>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => act('end')}
                    disabled={!!busy}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
                  >
                    <Flag size={13} aria-hidden="true" />
                    <span className={btnLabel}>
                      {busy === 'end' ? 'Ending…' : 'Wrap it up'}
                      <Kbd>Enter</Kbd>
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Now playing (bonus buy) ────────────────────────────────────────────────

function MoneyInput({ id, value, onChange, autoFocus, label }) {
  return (
    <div className="flex flex-1 min-w-0">
      <span className="px-3 py-2.5 border border-r-0 border-white/10 bg-zinc-broadcast/80 font-mono font-bold text-white/55">
        $
      </span>
      <input
        id={id}
        autoFocus={autoFocus}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        aria-label={label}
        className={`${inputCls} font-mono font-bold text-base`}
      />
    </div>
  );
}

// Centered over the page (z above the site's LIVE pill) while you set the slot
// and log what it paid; minimizing (or clicking the backdrop) drops it to a
// bottom bar so the rest of the page stays usable mid-bonus. The overlay shows
// a small corner card the whole time instead of the full-screen reveal.
function PlayPanel({ giveaway, announce }) {
  const p = giveaway.playing;
  const buy = p.buyAmount ?? giveaway.buyAmount ?? null;
  const [collapsed, setCollapsed] = useState(false);
  const pressOnBackdrop = useRef(false);
  const [slot, setSlot] = useState(p.slotName || '');
  const [amount, setAmount] = useState(p.payout != null ? String(p.payout) : '');
  const [editing, setEditing] = useState(p.payout == null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);

  // Their chat, so a "can you do Gates?" doesn't get missed.
  useEffect(() => {
    const q = query(
      collection(db, 'giveaways', giveaway.id, 'winner_messages'),
      orderBy('createdAt', 'desc'),
      fLimit(4)
    );
    return onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse())
    );
  }, [giveaway.id]);
  const login = (p.twitchName || '').toLowerCase();
  const theirMessages = messages.filter((m) => !login || !m.chatterLogin || m.chatterLogin === login);

  const run = async (action, body = {}) => {
    setBusy(action);
    setError(null);
    try {
      const { ok, status, data } = await postAction(action, {
        id: giveaway.id,
        twitchId: p.twitchId,
        ...body,
      });
      if (!ok) {
        setError(data.error === 'NO_ENTRIES' ? 'Nobody left to draw.' : `Action failed: ${data.error || status}`);
        return null;
      }
      return data;
    } catch {
      setError('Network error.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveSlot = (s) =>
    run('setSlot', {
      slotName: s.name,
      // Catalogue art arrives already percent-encoded; toImageUrl is idempotent
      // (encodeURI would double-encode %26 into %2526 and break the overlay).
      slotImage: toImageUrl(s.thumbnail),
      provider: s.provider || null,
    });

  const logPayout = async () => {
    const value = parseMoney(amount);
    if (value == null) return setError('Enter what the bonus paid.');
    // A typed-but-unsaved slot name still belongs in the payout message.
    if (slot.trim() && slot.trim() !== (p.slotName || '')) await saveSlot({ name: slot.trim() });
    const data = await run('payout', { amount: value });
    if (!data) return;
    setEditing(false);
    const a = data.announce;
    if (a && a.posted === false && !QUIET_ANNOUNCE.includes(a.reason)) {
      setError(`Logged, but the chat post failed: ${a.reason}`);
    }
  };

  const winners = giveaway.winners || [];
  const target = Number(giveaway.targetWinners) || 1;
  const needMore = winners.length < target;
  const winnerNo = winners.findIndex((w) => w.twitchId === p.twitchId) + 1;
  const logged = p.payout != null;
  const hit = logged && buy != null && p.payout >= buy;
  const typedMulti = formatMulti(parseMoney(amount), buy);
  const slotSaved = !!p.slotName && slot.trim() === p.slotName;
  const name = p.displayName || p.twitchName;

  const btnGhost =
    'inline-flex items-center gap-1.5 px-3 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-40';
  const btnPrimary =
    'inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50';
  const btnLabel = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';

  return (
    <div
      className={
        collapsed
          ? 'pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4'
          : 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm'
      }
      onMouseDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const endedOnBackdrop = e.target === e.currentTarget;
        const startedOnBackdrop = pressOnBackdrop.current;
        pressOnBackdrop.current = false;
        if (!collapsed && startedOnBackdrop && endedOnBackdrop) setCollapsed(true);
      }}
    >
      <div
        role={collapsed ? 'region' : 'dialog'}
        aria-modal={collapsed ? undefined : true}
        aria-label="Now playing"
        className={`pointer-events-auto w-full ${
          collapsed ? 'max-w-[25rem]' : 'max-w-md max-h-full overflow-y-auto'
        } border border-orange-admin/50 bg-zinc-card shadow-[0_20px_60px_rgba(0,0,0,0.6)]`}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="relative flex w-1.5 h-1.5 flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-orange-admin motion-safe:animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-orange-admin" />
          </span>
          <span className="text-orange-admin whitespace-nowrap">Now playing</span>
          <span className="text-white/40 truncate">
            {name}
            {target > 1 && winnerNo > 0 && ` · ${winnerNo} of ${target}`}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            className="ml-auto p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25"
          >
            {collapsed ? <ChevronDown size={12} className="rotate-180" aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />}
          </button>
        </div>

        {collapsed ? (
          <p className="px-4 py-2.5 text-xs text-white/60 font-mono truncate">
            {p.slotName || 'No slot yet'} · {logged ? `paid ${formatMoney(p.payout)}` : 'payout pending'}
          </p>
        ) : (
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-3">
              {p.profileImageUrl ? (
                <img src={p.profileImageUrl} alt="" className="w-10 h-10 rounded-full border border-emerald-signal/50" />
              ) : (
                <span
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full border border-emerald-signal/50 bg-zinc-broadcast/60 inline-flex items-center justify-center font-mono font-black text-white/60"
                >
                  {(name || '?').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-black text-white-body text-lg leading-tight truncate">{name}</p>
                <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono">
                  {buy != null ? `${formatMoney(buy)} bonus buy` : giveaway.prize}
                </p>
              </div>
            </div>

            {theirMessages.length > 0 && (
              <div className="border border-white/10 bg-zinc-broadcast/40 px-3 py-2 space-y-1">
                {theirMessages.map((m) => (
                  <p key={m.id} className="text-sm text-white-body leading-snug">
                    <span className="text-orange-admin font-bold">{m.twitchName || m.chatterLogin}:</span> {m.text}
                  </p>
                ))}
              </div>
            )}

            {announce?.enabled && !announce.posted && <ChatAnnounceStatus announce={announce} />}

            <div>
              <p className={labelCls}>
                Slot
                {slotSaved && <span className="text-emerald-signal normal-case tracking-normal"> · on the overlay</span>}
              </p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Suspense fallback={<input disabled placeholder="Loading slots…" className={inputCls} />}>
                    <SlotAutocomplete
                      value={slot}
                      onChange={setSlot}
                      onSelect={saveSlot}
                      placeholder="Search slots…"
                      aria-label="Slot"
                      className={inputCls}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && slot.trim()) {
                          e.preventDefault();
                          saveSlot({ name: slot.trim() });
                        }
                      }}
                    />
                  </Suspense>
                </div>
                {!slotSaved && slot.trim() && (
                  <button type="button" onClick={() => saveSlot({ name: slot.trim() })} disabled={!!busy} className={btnGhost}>
                    <span className={btnLabel}>{busy === 'setSlot' ? 'Saving…' : 'Set'}</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="gw-payout" className={labelCls}>
                What it paid
              </label>
              {editing ? (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      logPayout();
                    }}
                    className="flex gap-2"
                  >
                    <MoneyInput id="gw-payout" value={amount} onChange={setAmount} label="Payout" />
                    <button
                      type="submit"
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 px-3.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
                    >
                      <Check size={13} aria-hidden="true" />
                      <span className={btnLabel}>{busy === 'payout' ? 'Logging…' : 'Log payout'}</span>
                    </button>
                  </form>
                  {typedMulti && (
                    <p className="mt-1.5 text-[0.6875rem] text-white/45 font-mono">{typedMulti} of the buy</p>
                  )}
                </>
              ) : (
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 border ${
                    hit ? 'border-emerald-signal/40 bg-emerald-signal/5' : 'border-orange-admin/40 bg-orange-admin/5'
                  }`}
                >
                  <span className="font-mono font-black text-xl text-white-body tabular-nums">{formatMoney(p.payout)}</span>
                  <span className={`font-mono font-bold ${hit ? 'text-emerald-signal' : 'text-orange-admin'}`}>
                    {formatMulti(p.payout, buy)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="ml-auto inline-flex items-center gap-1 px-2 py-1 border border-white/15 text-white/60 hover:text-white-body"
                  >
                    <Pencil size={11} aria-hidden="true" />
                    <span className={btnLabel}>Edit</span>
                  </button>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
                {error}
              </p>
            )}

            <div className="pt-3 border-t border-white/8 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => run('back')} disabled={!!busy} className={btnGhost}>
                  <ArrowLeft size={12} aria-hidden="true" />
                  <span className={btnLabel}>{busy === 'back' ? 'Going back…' : 'Entries'}</span>
                </button>
                {needMore ? (
                  <>
                    <button type="button" onClick={() => run('end')} disabled={!!busy} className={btnGhost}>
                      <Flag size={12} aria-hidden="true" />
                      <span className={btnLabel}>{busy === 'end' ? 'Ending…' : 'End early'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => run('roll')}
                      disabled={!!busy}
                      className={`ml-auto ${logged ? btnPrimary : btnGhost}`}
                    >
                      <Gift size={12} aria-hidden="true" />
                      <span className={btnLabel}>
                        {busy === 'roll' ? 'Rolling…' : `Roll #${winners.length + 1} of ${target}`}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => run('roll')} disabled={!!busy} className={btnGhost}>
                      <Gift size={12} aria-hidden="true" />
                      <span className={btnLabel}>{busy === 'roll' ? 'Rolling…' : 'Bonus winner'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => run('end')}
                      disabled={!!busy}
                      className={`ml-auto ${logged ? btnPrimary : btnGhost}`}
                    >
                      <Flag size={12} aria-hidden="true" />
                      <span className={btnLabel}>{busy === 'end' ? 'Ending…' : 'Wrap it up'}</span>
                    </button>
                  </>
                )}
              </div>
              {!logged && (
                <p className="text-[0.625rem] text-white/35 font-mono">
                  Log the payout first, or move on and log it later from the winners list.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// One confirmed bonus-buy winner in the detail view: slot, payout, and the
// controls to put their bonus on stream or fix a payout after the fact.
function WinnerLine({ giveaway, winner, index, canPlay }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(winner.payout != null ? String(winner.payout) : '');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const buy = winner.buyAmount ?? giveaway.buyAmount ?? null;
  const onStream = giveaway.status === 'playing' && giveaway.playing?.twitchId === winner.twitchId;
  const hit = winner.payout != null && buy != null && winner.payout >= buy;

  const send = async (action, body = {}) => {
    setBusy(action);
    setError(null);
    try {
      const { ok, status, data } = await postAction(action, {
        id: giveaway.id,
        twitchId: winner.twitchId,
        ...body,
      });
      if (!ok) setError(data.error || `Failed (${status})`);
      return ok;
    } catch {
      setError('Network error.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const value = parseMoney(amount);
    if (value == null) return setError('Enter an amount.');
    if (await send('payout', { amount: value })) setEditing(false);
  };

  return (
    <li className="px-3 py-2.5 border-t border-white/8 first:border-t-0">
      <div className="flex items-center gap-3 flex-wrap">
        {winner.profileImageUrl ? (
          <img src={winner.profileImageUrl} alt="" className="w-7 h-7 rounded-full border border-emerald-signal/40" />
        ) : (
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-full border border-emerald-signal/40 bg-zinc-card text-[0.625rem] font-mono font-bold text-white/55 flex items-center justify-center"
          >
            {(winner.displayName || winner.twitchName || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white-body truncate">
            <span className="font-mono text-emerald-signal/70 mr-1.5">#{index + 1}</span>
            {winner.displayName || winner.twitchName}
            {winner.slotName && <span className="text-white/45 font-normal"> · {winner.slotName}</span>}
          </p>
          <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
            {winner.payout != null ? (
              <span className={hit ? 'text-emerald-signal' : 'text-orange-admin'}>
                Paid {formatMoney(winner.payout)} · {formatMulti(winner.payout, buy)}
              </span>
            ) : (
              <span className="text-white/40">Not played yet</span>
            )}
          </p>
        </div>
        {onStream ? (
          <span className="px-2 py-1 border border-orange-admin/50 text-orange-admin text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            On stream
          </span>
        ) : (
          canPlay && (
            <button
              type="button"
              onClick={() => send('play')}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-orange-admin/50 text-orange-admin hover:bg-orange-admin/10 transition-colors duration-150 disabled:opacity-40"
            >
              <Play size={11} aria-hidden="true" />
              <span className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {busy === 'play' ? 'Starting…' : 'Play'}
              </span>
            </button>
          )
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-white/15 text-white/60 hover:text-white-body transition-colors duration-150"
          >
            <Pencil size={11} aria-hidden="true" />
            <span className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {winner.payout != null ? 'Edit' : 'Log payout'}
            </span>
          </button>
        )}
      </div>
      {editing && (
        <form onSubmit={save} className="mt-2 flex gap-2">
          <MoneyInput value={amount} onChange={setAmount} autoFocus label={`Payout for ${winner.displayName || winner.twitchName}`} />
          <button
            type="submit"
            disabled={!!busy}
            className="px-3 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-50"
          >
            {busy === 'payout' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 border border-white/10 text-white/60 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
          >
            Cancel
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
          {error}
        </p>
      )}
    </li>
  );
}

function ClosesIn({ giveaway }) {
  const closesAt = tsMillis(giveaway.closesAt);
  const now = useClock({ intervalMs: 500, active: !!closesAt });
  if (!closesAt || giveaway.status !== 'open') return null;
  const left = Math.max(0, (closesAt - now) / 1000);
  const hot = left > 0 && left <= LAST_CALL_SECONDS;
  return (
    <div
      className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 border text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono ${
        left === 0
          ? 'border-white/15 text-white/45'
          : hot
            ? 'border-orange-admin/60 text-orange-admin'
            : 'border-white/15 text-white/65'
      }`}
    >
      <Timer size={11} aria-hidden="true" />
      {left > 0 ? (
        <>
          Closes in <span className="text-sm font-black tabular-nums tracking-normal">{formatClock(left)}</span>
        </>
      ) : (
        "Time's up · closing"
      )}
      {giveaway.autoRoll && left > 0 && <span className="text-white/35">· auto-roll</span>}
    </div>
  );
}

// ─── List + detail ──────────────────────────────────────────────────────────

// Sum of logged payouts, or null when nothing has been logged yet.
function paidTotal(giveaway) {
  const paid = (giveaway.winners || []).filter((w) => w.payout != null);
  return paid.length ? paid.reduce((a, w) => a + Number(w.payout), 0) : null;
}

function GiveawayRow({ giveaway, onOpen, onRunAgain }) {
  const ended = giveaway.status === 'rolled';
  return (
    <div className="flex items-stretch border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40">
      <button
        type="button"
        onClick={() => onOpen(giveaway)}
        className="flex-1 min-w-0 grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 text-left"
      >
        <span
          className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${
            giveaway.status === 'open'
              ? 'text-emerald-signal border-emerald-signal/40'
              : giveaway.status === 'rolling' || giveaway.status === 'playing'
                ? 'text-orange-admin border-orange-admin/40'
                : giveaway.status === 'rolled'
                  ? 'text-white/65 border-white/20'
                  : 'text-white/40 border-white/15'
          }`}
        >
          {giveaway.status === 'rolled' ? 'ended' : giveaway.status}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-white-body text-sm truncate">
            {giveaway.prize} <span className="text-white/45 font-normal">· {giveaway.title}</span>
          </p>
          <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
            keyword <span className="text-orange-admin/80">{giveaway.keyword}</span> · {formatTs(giveaway.createdAt)}
          </p>
        </div>
        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono tabular-nums">
          {giveaway.entryCount ?? 0} entries
          {(giveaway.winners?.length ?? 0) > 0 && (
            <span className="text-emerald-signal/70">
              {' '}
              · {giveaway.winners.length} winner{giveaway.winners.length === 1 ? '' : 's'}
            </span>
          )}
          {paidTotal(giveaway) != null && (
            <span className="text-emerald-signal/70"> · {formatMoney(paidTotal(giveaway))} paid</span>
          )}
        </span>
        <ChevronRight size={14} className="text-white/30" aria-hidden="true" />
      </button>
      {ended && onRunAgain && (
        <button
          type="button"
          onClick={() => onRunAgain(giveaway)}
          title="New giveaway with the same prize and settings"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 border-l border-white/8 text-white/45 hover:text-orange-admin transition-colors duration-150"
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Run again</span>
        </button>
      )}
    </div>
  );
}

function AnimatedCount({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    if (value === prevRef.current) return;
    // Roll up briefly when entries increment
    const start = prevRef.current;
    const end = value;
    if (end <= start) {
      setDisplay(end);
      prevRef.current = end;
      return;
    }
    const duration = 300;
    const startTs = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTs) / duration);
      const v = Math.round(start + (end - start) * t);
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className="tabular-nums">
      {String(display).padStart(4, '0')}
    </span>
  );
}

function GiveawayDetail({ giveaway, onBack, onRunAgain }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const winners = useMemo(() => giveaway.winners || [], [giveaway.winners]);
  const wonIds = useMemo(() => winners.map((w) => w.twitchId).filter(Boolean), [winners]);
  const target = Number(giveaway.targetWinners) || 1;

  const act = async (action) => {
    setBusy(action);
    setError(null);
    try {
      const { ok, status, data } = await postAction(action, { id: giveaway.id });
      if (!ok) {
        setError(
          data.error === 'NO_ENTRIES' ? 'Nobody left to draw.' : `Action failed: ${data.error || status}`
        );
      }
      return ok;
    } catch {
      setError('Network error.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const isLive = ['open', 'rolling', 'playing'].includes(giveaway.status);
  const ended = giveaway.status === 'rolled';
  const bonus = isBonusGiveaway(giveaway);
  const paid = paidTotal(giveaway);

  return (
    <div className="space-y-5">
      {/* Top utility strip */}
      <div className="flex items-center justify-between gap-3 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <button
          type="button"
          onClick={onBack}
          className="text-white/55 hover:text-white-body tracking-eyebrow-lg"
        >
          ← Back to list
        </button>
        <span className="inline-flex items-center gap-2 text-orange-admin">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              giveaway.status === 'rolling' ? 'bg-orange-admin animate-pulse' : 'bg-orange-admin'
            }`}
          />
          Giveaway · {ended ? 'ended' : giveaway.status}
        </span>
      </div>

      {/* Hero card — prize + keyword + count */}
      <div className="relative overflow-hidden border border-orange-admin/30 bg-zinc-card/40">
        {/* Atmospheric glow */}
        <div
          className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />
        <div className="relative px-6 sm:px-8 py-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
          <div className="min-w-0">
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin mb-2 font-mono">
              ▸ Prize on the line
            </p>
            <p
              className="font-black text-white-body leading-[0.9] tracking-[-0.03em]"
              style={{
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
              }}
            >
              {giveaway.prize}
            </p>
            <p className="mt-2 text-sm text-white/55">
              {giveaway.title}
              {target > 1 && <span className="text-white/40"> · {target} winners</span>}
            </p>

            {/* Keyword pill, only while entries are actually accepted */}
            {giveaway.status === 'open' && (
              <div className="mt-5 inline-flex items-baseline gap-3 px-4 py-3 border-2 border-emerald-signal/50 bg-emerald-signal/5">
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal/80 font-mono">
                  Type in chat
                </span>
                <span
                  className="text-2xl sm:text-3xl font-black text-emerald-signal tracking-tight tabular-nums font-mono"
                >
                  {giveaway.keyword}
                </span>
              </div>
            )}
            <div>
              <ClosesIn giveaway={giveaway} />
            </div>
          </div>

          {/* Count */}
          <div className="text-right">
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
              Entries
            </p>
            <p
              className="font-black text-orange-admin leading-none tabular-nums font-mono"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 4rem)' }}
            >
              <AnimatedCount value={giveaway.entryCount ?? 0} />
            </p>
            <p className="mt-1 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/35 font-mono">
              total weight {giveaway.totalWeight ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Operator controls */}
      <div className="flex flex-wrap items-center gap-2">
        {giveaway.status === 'open' && (
          <button
            type="button"
            onClick={() => act('close')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50"
          >
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {busy === 'close' ? 'Closing…' : 'Close entries'}
            </span>
          </button>
        )}
        {(giveaway.status === 'open' || giveaway.status === 'closed') && (
          <button
            type="button"
            onClick={() => act('roll')}
            disabled={!!busy || (giveaway.entryCount ?? 0) === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-30"
          >
            <Gift size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {busy === 'roll'
                ? 'Rolling…'
                : target > 1
                  ? `Roll #${Math.min(winners.length + 1, target)} of ${target}`
                  : winners.length > 0
                    ? 'Roll another'
                    : 'Roll winner'}
            </span>
          </button>
        )}
        {(giveaway.status === 'open' || giveaway.status === 'closed') &&
          (!confirmingEnd ? (
            <button
              type="button"
              onClick={() => setConfirmingEnd(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/60 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50"
            >
              <Flag size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                End giveaway
              </span>
            </button>
          ) : (
            <div className="inline-flex gap-2">
              <button
                type="button"
                onClick={() => act('end').then(() => setConfirmingEnd(false))}
                disabled={!!busy}
                className="inline-flex items-center gap-2 px-3 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono disabled:opacity-50"
              >
                {busy === 'end'
                  ? 'Ending…'
                  : winners.length > 0
                    ? `End · ${winners.length} winner${winners.length === 1 ? '' : 's'}`
                    : 'End with no winner'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingEnd(false)}
                className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
              >
                Cancel
              </button>
            </div>
          ))}
        {ended && winners.length === 0 && giveaway.winner && (
          <div className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-signal/40 bg-emerald-signal/5 text-emerald-signal text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={12} aria-hidden="true" />
            Winner: {giveaway.winner.displayName}
          </div>
        )}
        {ended && winners.length === 0 && !giveaway.winner && (
          <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
            Ended · no winner
          </span>
        )}
        {ended && (
          <button
            type="button"
            onClick={() => onRunAgain(giveaway)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Run it again</span>
          </button>
        )}

        {giveaway.status === 'playing' && (
          <span className="inline-flex items-center gap-2 px-3 py-2 border border-orange-admin/40 bg-orange-admin/5 text-orange-admin text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Play size={11} aria-hidden="true" />
            Bonus on stream · panel bottom right
          </span>
        )}

        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/30 font-mono ml-1">
          · created {formatTs(giveaway.createdAt)}
        </span>

        {/* Delete only once it's over, so it never sits next to live controls. */}
        {ended &&
          (!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="ml-auto inline-flex items-center gap-2 px-3 py-2 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Delete</span>
            </button>
          ) : (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => act('delete').then((ok) => ok && onBack())}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 transition-colors text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
              >
                Cancel
              </button>
            </div>
          ))}
      </div>

      {error && (
        <p role="alert" className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
          {error}
        </p>
      )}

      {/* Confirmed winners so far. Out of every later draw. */}
      {winners.length > 0 && (
        <div className="border border-emerald-signal/25 bg-emerald-signal/[0.03] px-4 py-3">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-2 font-mono inline-flex items-center gap-2">
            <Trophy size={11} aria-hidden="true" />
            {isLive ? 'Confirmed so far' : 'Winners'} · {winners.length}
            {target > 1 && ` of ${target}`}
            {paid != null && <span className="text-white/50"> · {formatMoney(paid)} paid out</span>}
          </p>
          {bonus ? (
            <ul className="border border-white/10 bg-zinc-broadcast/30">
              {winners.map((x, i) => (
                <WinnerLine
                  key={`${x.twitchId || x.twitchName}-${i}`}
                  giveaway={giveaway}
                  winner={x}
                  index={i}
                  canPlay={['open', 'closed', 'playing'].includes(giveaway.status)}
                />
              ))}
            </ul>
          ) : (
          <ul className="flex flex-wrap gap-2">
            {winners.map((x, i) => (
              <li
                key={`${x.twitchId || x.twitchName}-${i}`}
                className="inline-flex items-center gap-2 pl-1 pr-3 py-1 border border-white/10 bg-zinc-broadcast/40"
                title={x.prizeNote || undefined}
              >
                {x.profileImageUrl ? (
                  <img src={x.profileImageUrl} alt="" className="w-6 h-6 rounded-full border border-emerald-signal/40" />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-emerald-signal/40 bg-zinc-card text-[0.625rem] font-mono font-bold text-white/55 flex items-center justify-center" aria-hidden="true">
                    {(x.displayName || x.twitchName || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono text-white-body">
                  <span className="text-emerald-signal/70 tabular-nums">#{i + 1}</span> {x.displayName || x.twitchName}
                </span>
              </li>
            ))}
          </ul>
          )}
        </div>
      )}

      {/* Entries grid */}
      <div className="border border-white/8 bg-zinc-card/30 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-white/55">
            <Users size={11} aria-hidden="true" />
            Viewers entering
          </span>
          <span className="text-white/35 tabular-nums">
            {giveaway.entryCount ?? 0} total
          </span>
        </div>
        <GiveawayEntriesGrid
          giveawayId={giveaway.id}
          rolling={giveaway.status === 'rolling'}
          winnerTwitchId={giveaway.winnerTwitchId || null}
          skippedIds={giveaway.skippedIds || []}
          wonIds={wonIds}
        />
      </div>
    </div>
  );
}

export default function AdminGiveawaysPage() {
  const [list, setList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // null | form seed (see formFromGiveaway)
  const [formSeed, setFormSeed] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [warning, setWarning] = useState(null);
  const chat = useEventSubStatus();
  const autoOpened = useRef(false);

  useEffect(() => {
    if (!warning) return undefined;
    const t = setTimeout(() => setWarning(null), 8000);
    return () => clearTimeout(t);
  }, [warning]);

  useEffect(() => {
    const q = query(collection(db, 'giveaways'), orderBy('createdAt', 'desc'), fLimit(50));
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    });
    return unsub;
  }, []);

  // Land on the running giveaway instead of the list, once per visit, so
  // "Back to list" still works afterwards.
  useEffect(() => {
    if (!loaded || autoOpened.current) return;
    autoOpened.current = true;
    const live = list.find((g) => ['open', 'closed', 'rolling', 'playing'].includes(g.status));
    if (live) setSelectedId((cur) => cur || live.id);
  }, [loaded, list]);

  useGiveawayClock(list, setWarning);

  const selected = useMemo(() => list.find((g) => g.id === selectedId) || null, [list, selectedId]);
  // Auto-open the winner modal whenever any giveaway is 'rolling'.
  const activeRolling = useMemo(() => list.find((g) => g.status === 'rolling') || null, [list]);
  // Dock the play panel whenever a bonus buy is on stream.
  const activePlaying = useMemo(
    () => list.find((g) => g.status === 'playing' && g.playing) || null,
    [list]
  );
  // The pick whose winner chat message may still be pending.
  const currentPick = useMemo(
    () =>
      list.find(
        (g) => ['rolling', 'playing'].includes(g.status) && g.winnerTwitchId && g.rolledAt
      ) || null,
    [list]
  );
  const announce = useWinnerAnnounce(currentPick);

  const grouped = useMemo(() => {
    const open = list.filter((g) => ['open', 'rolling', 'playing'].includes(g.status));
    const closed = list.filter((g) => g.status === 'closed');
    const past = list.filter((g) => g.status === 'rolled');
    return { open, closed, past };
  }, [list]);

  const startNew = () => setFormSeed(formFromGiveaway(list[0]));
  const runAgain = (g) => setFormSeed(formFromGiveaway(g, { copyPrize: true }));

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>GIVEAWAYS</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">GVW</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1
            className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
            }}
          >
            <span className="block">Run a</span>
            <span className="block text-orange-admin">giveaway.</span>
          </h1>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
          >
            <Plus size={14} aria-hidden="true" />
            <span className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              New giveaway
            </span>
          </button>
        </div>
      </header>

      <div className="space-y-2 mb-6">
        <EventSubStatus chat={chat} />
        <OverlayLink />
      </div>

      {selected ? (
        <GiveawayDetail
          giveaway={selected}
          onBack={() => setSelectedId(null)}
          onRunAgain={runAgain}
        />
      ) : (
        <div className="space-y-6">
          {grouped.open.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-2 font-mono">
                Live · {grouped.open.length}
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.open.map((g) => (
                  <GiveawayRow key={g.id} giveaway={g} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            </section>
          )}
          {grouped.closed.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-2 font-mono">
                Closed · awaiting roll
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.closed.map((g) => (
                  <GiveawayRow key={g.id} giveaway={g} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            </section>
          )}
          {grouped.past.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-2 font-mono">
                Past
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.past.map((g) => (
                  <GiveawayRow
                    key={g.id}
                    giveaway={g}
                    onOpen={(x) => setSelectedId(x.id)}
                    onRunAgain={runAgain}
                  />
                ))}
              </div>
            </section>
          )}
          {list.length === 0 && (
            <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono">
                No giveaways yet
              </p>
              <p className="text-sm text-white/55">Start a new one to begin.</p>
            </div>
          )}
        </div>
      )}

      {formSeed && (
        <NewGiveawayForm
          seed={formSeed}
          chat={chat}
          onClose={() => setFormSeed(null)}
          onCreated={(id, meta) => {
            setFormSeed(null);
            setSelectedId(id);
            if (meta?.announceError) {
              setWarning(`Giveaway started, but chat announce failed: ${meta.announceError}`);
            }
          }}
        />
      )}
      {activeRolling && (
        <WinnerModal key={activeRolling.id} giveaway={activeRolling} announce={announce} />
      )}
      {activePlaying && !activeRolling && (
        <PlayPanel
          key={`${activePlaying.id}:${activePlaying.playing.twitchId}`}
          giveaway={activePlaying}
          announce={currentPick?.id === activePlaying.id ? announce : null}
        />
      )}
      {warning && (
        <div role="status" className="fixed bottom-6 right-6 z-50 max-w-sm border border-orange-admin/60 bg-zinc-card/95 backdrop-blur px-4 py-3 shadow-lg">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin mb-1 font-mono">
            Warning
          </p>
          <p className="text-sm text-white/80">{warning}</p>
          <button
            type="button"
            onClick={() => setWarning(null)}
            className="absolute top-1 right-2 text-white/40 hover:text-white-body text-xs font-mono"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
