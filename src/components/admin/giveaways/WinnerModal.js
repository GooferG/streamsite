import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { ArrowLeft, Check, Flag, Gift, Radio, RefreshCcw, SkipForward, Trophy } from 'lucide-react';
import { db } from '../../../config/firebase';
import { isBonusGiveaway } from '../../../utils/giveaway';
import { postAction } from './api';
import { Kbd, inputCls, labelCls } from './ui';
import ClaimTimer from './ClaimTimer';
import ChatAnnounceStatus from './ChatAnnounceStatus';

export default function WinnerModal({ giveaway, announce, inline = false, scopeRef = null, globalHotkeys = true }) {
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
      if (inline) {
        // In the control room, Escape belongs to the panel (minimize), so it
        // can never discard a pick. Other keys count only while the operator
        // is in the panel, or while the stage moment plays.
        if (k === 'escape') return;
        const scope = scopeRef?.current;
        if (!globalHotkeys && !(scope && scope.contains(document.activeElement))) return;
      }
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
  }, [busy, confirmed, needMore, act, inline, globalHotkeys, scopeRef]);

  if (!giveaway || giveaway.status !== 'rolling' || !giveaway.winner) return null;
  const w = giveaway.winner;

  const btnGhost =
    'inline-flex items-center gap-2 px-3.5 py-2.5 border border-white/15 text-white/75 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-40';
  const btnLabel = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';

  const content = (
    <>
      {!inline && (
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />
      )}
      {!inline && (
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
      )}
      <div className={inline ? 'relative' : 'relative px-6 sm:px-10 py-8'}>
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
                  {!inline && <Kbd>Esc</Kbd>}
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
                  {!inline && <Kbd>Esc</Kbd>}
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
    </>
  );

  if (inline) {
    return (
      <div ref={rootRef} role="group" aria-label="Giveaway winner">
        {content}
      </div>
    );
  }
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
        {content}
      </div>
    </div>
  );
}
