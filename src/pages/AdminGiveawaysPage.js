import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flag,
  Gift,
  MonitorPlay,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { db } from '../config/firebase';
import GiveawayEntriesGrid from '../components/GiveawayEntriesGrid';
import { useClock } from '../hooks/useClock';
import {
  LAST_CALL_SECONDS,
  formFromGiveaway,
  formatClock,
  formatMoney,
  formatMulti,
  isBonusGiveaway,
  parseMoney,
  tsMillis,
} from '../utils/giveaway';
import { postAction } from '../components/admin/giveaways/api';
import { MoneyInput, formatTs } from '../components/admin/giveaways/ui';
import EventSubStatus, { useEventSubStatus } from '../components/admin/giveaways/EventSubStatus';
import NewGiveawayForm from '../components/admin/giveaways/NewGiveawayForm';
import WinnerModal from '../components/admin/giveaways/WinnerModal';
import PlayPanel from '../components/admin/giveaways/PlayPanel';
import AnimatedCount from '../components/admin/giveaways/AnimatedCount';
import useGiveawayClock from '../components/admin/giveaways/useGiveawayClock';
import useWinnerAnnounce from '../components/admin/giveaways/useWinnerAnnounce';

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
