import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { ArrowLeft, Check, ChevronDown, Flag, Gift, Minus, Pencil } from 'lucide-react';
import { db } from '../../../config/firebase';
import { toImageUrl } from '../../../utils/slotImage';
import { formatMoney, formatMulti, parseMoney } from '../../../utils/giveaway';
import { giveawayErrorText, postAction, QUIET_ANNOUNCE } from './api';
import { MoneyInput, inputCls, labelCls } from './ui';
import ChatAnnounceStatus from './ChatAnnounceStatus';

// Slot search pulls the slot catalogue on first use; only load it once a bonus is being played.
const SlotAutocomplete = lazy(() => import('../../SlotAutocomplete'));

// Centered over the page (z above the site's LIVE pill) while you set the slot
// and log what it paid; minimizing (or clicking the backdrop) drops it to a
// bottom bar so the rest of the page stays usable mid-bonus. The overlay shows
// a small corner card the whole time instead of the full-screen reveal.
export default function PlayPanel({ giveaway, announce, inline = false }) {
  const p = giveaway.playing;
  const buy = p.buyAmount ?? giveaway.buyAmount ?? null;
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = !inline && collapsed;
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
        setError(
          inline
            ? giveawayErrorText(data.error, status)
            : data.error === 'NO_ENTRIES'
              ? 'Nobody left to draw.'
              : `Action failed: ${data.error || status}`
        );
        return null;
      }
      return data;
    } catch (err) {
      setError(
        inline && err && err.message === 'NOT_AUTHENTICATED' ? giveawayErrorText('NOT_AUTHENTICATED') : 'Network error.'
      );
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

  const header = (
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
      {!inline && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          aria-expanded={!collapsed}
          className="ml-auto p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25"
        >
          {collapsed ? <ChevronDown size={12} className="rotate-180" aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />}
        </button>
      )}
    </div>
  );

  const body = isCollapsed ? (
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
  );

  if (inline) {
    return (
      <div role="group" aria-label="Now playing" className="border border-orange-admin/50 bg-zinc-card">
        {header}
        {body}
      </div>
    );
  }

  return (
    <div
      className={
        isCollapsed
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
        if (!isCollapsed && startedOnBackdrop && endedOnBackdrop) setCollapsed(true);
      }}
    >
      <div
        role={isCollapsed ? 'region' : 'dialog'}
        aria-modal={isCollapsed ? undefined : true}
        aria-label="Now playing"
        className={`pointer-events-auto w-full ${
          isCollapsed ? 'max-w-[25rem]' : 'max-w-md max-h-full overflow-y-auto'
        } border border-orange-admin/50 bg-zinc-card shadow-[0_20px_60px_rgba(0,0,0,0.6)]`}
      >
        {header}
        {body}
      </div>
    </div>
  );
}
