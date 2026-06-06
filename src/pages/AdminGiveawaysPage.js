import { useEffect, useMemo, useRef, useState } from 'react';
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
  Users,
  Timer,
} from 'lucide-react';
import { db } from '../config/firebase';
import { authedFetch } from '../utils/authedFetch';
import GiveawayEntriesGrid from '../components/GiveawayEntriesGrid';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

const DEFAULT_START_MSG =
  '🎁 GIVEAWAY → Type "{keyword}" in chat to enter. Prize: {prize}';
const DEFAULT_WINNER_MSG =
  '🎉 @{winner} has been picked for {prize}! Reply in chat to claim.';

const DEFAULT_FORM = {
  title: '',
  prize: '',
  keyword: '',
  weights: { base: 1, registered: 1, discord: 1, sub: 1, vip: 1 },
  announceStart: true,
  startMessage: DEFAULT_START_MSG,
  announceWinner: true,
  winnerMessage: DEFAULT_WINNER_MSG,
  requireFollow: true,
};

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

function NewGiveawayForm({ onClose, onCreated }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setW = (k, v) => setForm((f) => ({ ...f, weights: { ...f.weights, [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.prize.trim() || !form.keyword.trim()) {
      return setError('Title, prize, and keyword are required.');
    }
    setSaving(true);
    try {
      const res = await authedFetch('/api/admin/giveaways', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create.');
      } else {
        // Bubble a warning if chat announce failed (giveaway still created)
        if (data.announce && data.announce.posted === false &&
            data.announce.reason && data.announce.reason !== 'disabled' &&
            data.announce.reason !== 'empty') {
          onCreated(data.id, { announceError: data.announce.reason });
        } else {
          onCreated(data.id);
        }
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
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-white/10 bg-zinc-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            New giveaway
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
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Friday Night Giveaway"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">02</span> Prize <span className="text-emerald-signal">*</span>
            </span>
            <input
              value={form.prize}
              onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))}
              placeholder="Steam key — Hades II"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              <span className="text-orange-admin tabular-nums">03</span> Chat keyword <span className="text-emerald-signal">*</span>
              <span className="text-white/30 normal-case font-normal"> · case-insensitive "contains"</span>
            </span>
            <input
              value={form.keyword}
              onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value.toLowerCase() }))}
              placeholder="goofergiveaway"
              className={inputCls}
            />
          </label>

          <div>
            <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-2 font-mono">
              <span className="text-orange-admin tabular-nums">04</span> Weight rules
            </p>
            <div className="space-y-1.5">
              <ToggleRow
                label="Registered on site"
                value={form.weights.registered}
                onChange={(v) => setW('registered', v)}
                hint="(+1 for viewers who signed in here)"
              />
              <ToggleRow
                label="Discord linked"
                value={form.weights.discord}
                onChange={(v) => setW('discord', v)}
                hint="(+1 entry weight)"
              />
              <ToggleRow
                label="Twitch sub"
                value={form.weights.sub}
                onChange={(v) => setW('sub', v)}
                hint="(+1 entry weight)"
              />
              <ToggleRow
                label="Twitch VIP"
                value={form.weights.vip}
                onChange={(v) => setW('vip', v)}
                hint="(+1 entry weight)"
              />
            </div>
            <p className="mt-2 text-[0.625rem] tracking-eyebrow uppercase text-white/35 font-mono">
              Base entry weight is always 1. Toggles add +1 each.
            </p>
          </div>

          {/* Eligibility */}
          <div>
            <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-2 font-mono">
              <span className="text-orange-admin tabular-nums">04b</span> Eligibility
            </p>
            <div className="border border-white/10 bg-zinc-broadcast/40 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requireFollow}
                  onChange={(e) => setForm((f) => ({ ...f, requireFollow: e.target.checked }))}
                />
                <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
                  Require channel follow to enter
                </span>
              </label>
              <p className="mt-1 ml-6 text-[0.625rem] tracking-eyebrow text-white/35 font-mono">
                Mods and VIPs are exempt. Non-followers' keyword messages are ignored.
              </p>
            </div>
          </div>

          {/* Chat announcements */}
          <div>
            <p className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-2 font-mono">
              <span className="text-orange-admin tabular-nums">05</span> Chat announcements
              <span className="text-white/30 normal-case font-normal"> · vars: {'{keyword} {prize} {title} {winner}'}</span>
            </p>
            <div className="space-y-3">
              {/* Start */}
              <div className="border border-white/10 bg-zinc-broadcast/40 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.announceStart}
                    onChange={(e) => setForm((f) => ({ ...f, announceStart: e.target.checked }))}
                  />
                  <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
                    Announce in chat when starting
                  </span>
                </label>
                <textarea
                  value={form.startMessage}
                  onChange={(e) => setForm((f) => ({ ...f, startMessage: e.target.value }))}
                  rows={2}
                  disabled={!form.announceStart}
                  className={`${inputCls} ${!form.announceStart ? 'opacity-40' : ''}`}
                />
              </div>
              {/* Winner */}
              <div className="border border-white/10 bg-zinc-broadcast/40 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.announceWinner}
                    onChange={(e) => setForm((f) => ({ ...f, announceWinner: e.target.checked }))}
                  />
                  <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/70 font-mono">
                    Announce winner in chat on pick
                  </span>
                </label>
                <textarea
                  value={form.winnerMessage}
                  onChange={(e) => setForm((f) => ({ ...f, winnerMessage: e.target.value }))}
                  rows={2}
                  disabled={!form.announceWinner}
                  className={`${inputCls} ${!form.announceWinner ? 'opacity-40' : ''}`}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
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
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
          >
            <Check size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Starting…' : 'Start giveaway'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

function formatElapsed(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function WinnerTimer({ rolledAt, firstMessageAt }) {
  // Count up from rolledAt. Freeze when firstMessageAt is set.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (firstMessageAt) return undefined; // frozen
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [firstMessageAt]);

  const startMs = rolledAt?.toMillis ? rolledAt.toMillis() : null;
  if (!startMs) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-white/15 bg-zinc-broadcast/40">
        <Timer size={13} className="text-white/40" aria-hidden="true" />
        <span className="text-2xl font-black tabular-nums text-white/40 font-mono leading-none">
          00:00
        </span>
      </div>
    );
  }

  const endMs = firstMessageAt?.toMillis ? firstMessageAt.toMillis() : now;
  const elapsed = Math.max(0, (endMs - startMs) / 1000);

  let tone;
  if (firstMessageAt) {
    tone = {
      border: 'border-emerald-signal/50 bg-emerald-signal/5',
      text: 'text-emerald-signal',
      icon: 'text-emerald-signal',
      label: 'RESPONDED IN',
    };
  } else if (elapsed >= 90) {
    tone = {
      border: 'border-red-destructive/50 bg-red-destructive/5',
      text: 'text-red-destructive',
      icon: 'text-red-destructive',
      label: 'Waiting',
    };
  } else if (elapsed >= 30) {
    tone = {
      border: 'border-orange-admin/50 bg-orange-admin/5',
      text: 'text-orange-admin',
      icon: 'text-orange-admin',
      label: 'Waiting',
    };
  } else {
    tone = {
      border: 'border-white/15 bg-zinc-broadcast/40',
      text: 'text-white-body',
      icon: 'text-white/55',
      label: 'Waiting',
    };
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border transition-colors duration-300 ${tone.border}`}
    >
      <Timer size={13} className={tone.icon} aria-hidden="true" />
      <div className="leading-none">
        <p className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-0.5 font-mono">
          {tone.label}
        </p>
        <p className={`text-2xl font-black tabular-nums font-mono leading-none ${tone.text}`}>
          {formatElapsed(elapsed)}
        </p>
      </div>
    </div>
  );
}

function WinnerModal({ giveaway, onClose, onAnnounceError }) {
  const [busy, setBusy] = useState(null); // 'reroll' | 'skip' | 'confirm'
  const [messages, setMessages] = useState([]);
  const [prizeNote, setPrizeNote] = useState('');

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

  const act = async (action) => {
    setBusy(action);
    try {
      const body = { action, id: giveaway.id };
      if (action === 'confirm') body.prizeNote = prizeNote || null;
      const res = await authedFetch('/api/admin/giveaways', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Action failed: ${data.error || res.status}`);
        return;
      }
      // Announce now fires on roll/reroll/skip (whenever a new winner is picked).
      if (
        ['reroll', 'skip'].includes(action) &&
        data.announce &&
        data.announce.posted === false &&
        data.announce.reason &&
        data.announce.reason !== 'disabled' &&
        data.announce.reason !== 'empty' &&
        onAnnounceError
      ) {
        onAnnounceError(data.announce.reason);
      }
      if (action === 'confirm') {
        onClose();
      }
    } finally {
      setBusy(null);
    }
  };

  if (!giveaway || giveaway.status !== 'rolling' || !giveaway.winner) return null;
  const w = giveaway.winner;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/85 backdrop-blur-md"
      onClick={(e) => {
        // Disallow click-outside-to-close so the admin doesn't accidentally
        // dismiss the winner mid-stream.
        e.stopPropagation();
      }}
    >
      <div className="relative w-full max-w-2xl border border-orange-admin/40 bg-zinc-card overflow-hidden">
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
            Winner picked
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
                    title="Winner has not signed in on goofer.tv — prize redemption won't show on /me. DM them on Twitch to deliver."
                  >
                    Not on site · DM to deliver
                  </span>
                )}
              </div>
              <p className="mt-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
                {w.twitchName} · weight {w.weight} · via {w.source}
              </p>
            </div>
            <WinnerTimer
              rolledAt={giveaway.rolledAt}
              firstMessageAt={firstMessageAt}
            />
          </div>

          {/* Chat stream */}
          <div className="border border-white/10 bg-zinc-broadcast/40 mb-5">
            <div className="px-3 py-2 border-b border-white/8 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/55 font-mono inline-flex items-center gap-2">
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

          {/* Prize note (optional, attached on confirm) */}
          <label className="block mb-4">
            <span className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
              Prize note · attached to redemption
            </span>
            <input
              value={prizeNote}
              onChange={(e) => setPrizeNote(e.target.value)}
              placeholder="Steam key — will DM after stream"
              className={inputCls}
            />
          </label>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => act('reroll')}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/15 text-white/75 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-40"
            >
              <RefreshCcw size={13} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {busy === 'reroll' ? 'Rolling…' : 'Reroll'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => act('skip')}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-red-destructive/40 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150 disabled:opacity-40"
            >
              <SkipForward size={13} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {busy === 'skip' ? 'Skipping…' : 'Skip'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => act('confirm')}
              disabled={!!busy}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
            >
              <Check size={13} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {busy === 'confirm' ? 'Confirming…' : 'Confirm winner'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventSubStatus() {
  const [status, setStatus] = useState('loading');
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
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
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const subscribe = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/admin/eventsub', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setError(data.detail || data.error || 'Failed');
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this subscription? Chat-keyword entries will stop until re-subscribed.')) return;
    setBusy(true);
    try {
      await authedFetch(`/api/admin/eventsub?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const label =
    status === 'loading'
      ? 'Checking…'
      : status === 'enabled'
        ? 'Connected to Twitch chat'
        : status === 'missing'
          ? 'Not subscribed — chat keywords will not register entries'
          : `Error: ${error || 'unknown'}`;
  const tone =
    status === 'enabled'
      ? 'text-emerald-signal border-emerald-signal/40'
      : status === 'missing'
        ? 'text-orange-admin border-orange-admin/40'
        : 'text-red-destructive border-red-destructive/40';

  return (
    <div className={`border ${tone} bg-zinc-card/30 mb-6`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <div className="inline-flex items-center gap-3 min-w-0">
          <Webhook size={14} aria-hidden="true" />
          <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">{label}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {status !== 'enabled' && (
            <button
              type="button"
              onClick={subscribe}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
            >
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {busy ? 'Subscribing…' : 'Subscribe to chat'}
              </span>
            </button>
          )}
          {subs.length > 0 && (
            <button
              type="button"
              onClick={() => remove(subs[0].id)}
              disabled={busy}
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

function GiveawayRow({ giveaway, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(giveaway)}
      className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left"
    >
      <span
        className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${
          giveaway.status === 'open'
            ? 'text-emerald-signal border-emerald-signal/40'
            : giveaway.status === 'rolling'
              ? 'text-orange-admin border-orange-admin/40'
              : giveaway.status === 'rolled'
                ? 'text-white/65 border-white/20'
                : 'text-white/40 border-white/15'
        }`}
      >
        {giveaway.status}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-white-body text-sm truncate">
          {giveaway.title} <span className="text-white/45 font-normal">· {giveaway.prize}</span>
        </p>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
          keyword <span className="text-orange-admin/80">{giveaway.keyword}</span> · created {formatTs(giveaway.createdAt)}
        </p>
      </div>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono tabular-nums">
        {giveaway.entryCount ?? 0} entries
      </span>
      <ChevronRight size={14} className="text-white/30" aria-hidden="true" />
    </button>
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

function GiveawayDetail({ giveaway, onBack, onAnnounceError }) {
  const [busy, setBusy] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const act = async (action) => {
    setBusy(action);
    try {
      const res = await authedFetch('/api/admin/giveaways', {
        method: 'POST',
        body: JSON.stringify({ action, id: giveaway.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Action failed: ${data.error || res.status}`);
        return;
      }
      if (
        action === 'roll' &&
        data.announce &&
        data.announce.posted === false &&
        data.announce.reason &&
        data.announce.reason !== 'disabled' &&
        data.announce.reason !== 'empty' &&
        onAnnounceError
      ) {
        onAnnounceError(data.announce.reason);
      }
    } finally {
      setBusy(null);
    }
  };

  const isLive = giveaway.status === 'open' || giveaway.status === 'rolling';

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
          Giveaway · {giveaway.status}
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
            <p className="mt-2 text-sm text-white/55">{giveaway.title}</p>

            {/* Keyword pill */}
            {isLive && (
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
              {busy === 'roll' ? 'Rolling…' : 'Roll winner'}
            </span>
          </button>
        )}
        {giveaway.status === 'rolled' && giveaway.winner && (
          <div className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-signal/40 bg-emerald-signal/5 text-emerald-signal text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={12} aria-hidden="true" />
            Winner: {giveaway.winner.displayName}
          </div>
        )}

        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/30 font-mono ml-1">
          · created {formatTs(giveaway.createdAt)}
        </span>

        {!confirmingDelete ? (
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
              onClick={() => act('delete').then(onBack)}
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
        )}
      </div>

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
        />
      </div>
    </div>
  );
}

export default function AdminGiveawaysPage() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [activeRollingId, setActiveRollingId] = useState(null);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    if (!warning) return undefined;
    const t = setTimeout(() => setWarning(null), 8000);
    return () => clearTimeout(t);
  }, [warning]);

  useEffect(() => {
    const q = query(collection(db, 'giveaways'), orderBy('createdAt', 'desc'), fLimit(50));
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Auto-open the winner modal whenever any giveaway flips to 'rolling'.
  useEffect(() => {
    const rolling = list.find((g) => g.status === 'rolling');
    setActiveRollingId(rolling?.id || null);
  }, [list]);

  const selected = useMemo(() => list.find((g) => g.id === selectedId) || null, [list, selectedId]);
  const activeRolling = useMemo(
    () => list.find((g) => g.id === activeRollingId) || null,
    [list, activeRollingId]
  );

  const grouped = useMemo(() => {
    const open = list.filter((g) => g.status === 'open' || g.status === 'rolling');
    const closed = list.filter((g) => g.status === 'closed');
    const past = list.filter((g) => g.status === 'rolled');
    return { open, closed, past };
  }, [list]);

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
      </header>

      <EventSubStatus />

      <div className="flex items-center justify-end mb-6">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
        >
          <Plus size={13} aria-hidden="true" />
          <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            New giveaway
          </span>
        </button>
      </div>

      {selected ? (
        <GiveawayDetail
          giveaway={selected}
          onBack={() => setSelectedId(null)}
          onAnnounceError={(reason) =>
            setWarning(`Winner picked, but chat announce failed: ${reason}`)
          }
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
                  <GiveawayRow key={g.id} giveaway={g} onOpen={(x) => setSelectedId(x.id)} />
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

      {creating && (
        <NewGiveawayForm
          onClose={() => setCreating(false)}
          onCreated={(id, meta) => {
            setCreating(false);
            setSelectedId(id);
            if (meta?.announceError) {
              setWarning(`Giveaway started, but chat announce failed: ${meta.announceError}`);
            }
          }}
        />
      )}
      {activeRolling && (
        <WinnerModal
          giveaway={activeRolling}
          onClose={() => setActiveRollingId(null)}
          onAnnounceError={(reason) =>
            setWarning(`Winner confirmed, but chat announce failed: ${reason}`)
          }
        />
      )}
      {warning && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm border border-orange-admin/60 bg-zinc-card/95 backdrop-blur px-4 py-3 shadow-lg">
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
