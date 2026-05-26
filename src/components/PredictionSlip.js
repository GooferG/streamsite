import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Ticket, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { authedFetch } from '../utils/authedFetch';

function formatCurrency(val) {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fakeSerial(roundId, twitchId) {
  if (!roundId) return '0000-0000';
  const a = (roundId || '').slice(-4).toUpperCase();
  const b = (twitchId || '').slice(-4).toUpperCase();
  return `${a}-${b || '----'}`;
}

function useCooldown(targetMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs || targetMs <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [targetMs]);
  const remaining = targetMs ? Math.max(0, Math.ceil((targetMs - now) / 1000)) : 0;
  return remaining;
}

const QUICK_CHIPS = (totalCost) => {
  const c = Number(totalCost) || 0;
  if (c <= 0) return [];
  return [
    { label: 'Break even', value: c },
    { label: '+20%', value: Math.round(c * 1.2) },
    { label: '2×', value: c * 2 },
    { label: '100× avg', value: Math.round((c * 100) / Math.max(1, c / 1)) },
  ];
};

function SlotTile({ slot, selected, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(slot.name)}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-1.5 p-2 border-2 transition-all duration-150 ${
        selected
          ? 'border-emerald-signal/70 bg-emerald-signal/10'
          : 'border-white/10 hover:border-white/25 bg-zinc-broadcast/40'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {slot.imageUrl ? (
        <img
          src={slot.imageUrl}
          alt=""
          className="w-16 h-16 object-cover border border-white/10"
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-16 bg-zinc-card/60 border border-white/10 flex items-center justify-center text-white/30 text-xs font-mono">
          —
        </div>
      )}
      <span
        className="text-[10px] font-bold tracking-eyebrow-md uppercase font-mono text-white/75 max-w-[5.5rem] text-center truncate"
        title={slot.name}
      >
        {slot.name}
      </span>
      {selected && (
        <span
          className="absolute top-0.5 right-0.5 text-[8px] font-bold tracking-eyebrow-lg uppercase text-red-destructive border border-red-destructive bg-zinc-broadcast/80 px-1 py-0.5 font-mono rotate-[-8deg]"
          aria-hidden="true"
        >
          MY PICK
        </span>
      )}
    </button>
  );
}

/**
 * Props:
 *   round: prediction round doc
 *   onSubmit?: optional callback after successful submit
 */
export default function PredictionSlip({ round }) {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const [entry, setEntry] = useState(null);
  const [payoutInput, setPayoutInput] = useState('');
  const [slotInput, setSlotInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const cooldown = useCooldown(cooldownUntil);

  const status = round?.status;
  const editable = status === 'open' && !!twitchUser;
  const locked = status === 'locked';
  const settled = status === 'settled';

  const slots = useMemo(() => {
    if (!round) return [];
    if (round.source === 'bonushunt') return round.bonusHuntSnapshot?.slots || [];
    return (round.manualSlots || []).map((name) => ({ name }));
  }, [round]);

  const totalCost = useMemo(() => {
    if (!round) return 0;
    return round.source === 'bonushunt'
      ? Number(round.bonusHuntSnapshot?.totalCost || 0)
      : Number(round.manualTotalCost || 0);
  }, [round]);

  // Subscribe to the viewer's own entry.
  useEffect(() => {
    if (!twitchUser?.twitchId || !round?.id) {
      setEntry(null);
      return undefined;
    }
    const ref = doc(db, 'prediction_rounds', round.id, 'entries', twitchUser.twitchId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setEntry(data);
      if (data) {
        if (round.kinds?.payout && data.payoutGuess != null) {
          setPayoutInput(String(data.payoutGuess));
        }
        if (round.kinds?.topSlot && data.topSlotGuess) {
          setSlotInput(data.topSlotGuess);
        }
        if (data.lastEditAt?.toMillis) {
          const next = data.lastEditAt.toMillis() + 30 * 1000;
          if (next > Date.now()) setCooldownUntil(next);
        }
      }
    });
    return unsub;
  }, [twitchUser?.twitchId, round?.id, round?.kinds?.payout, round?.kinds?.topSlot]);

  const submit = async () => {
    if (!editable) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = { roundId: round.id };
      if (round.kinds?.payout) body.payoutGuess = Number(payoutInput);
      if (round.kinds?.topSlot) body.topSlotGuess = slotInput;
      const res = await authedFetch('/api/predictions/submit', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'COOLDOWN' && data.retryAfter) {
          setCooldownUntil(Date.now() + data.retryAfter * 1000);
          setFeedback({ kind: 'error', message: `Wait ${data.retryAfter}s to edit again.` });
        } else {
          setFeedback({
            kind: 'error',
            message:
              {
                INVALID_PAYOUT: 'Enter a valid payout amount.',
                INVALID_SLOT: 'Pick a slot from the list.',
                SLOT_NOT_IN_LIST: 'That slot isn’t in this hunt.',
                NOT_OPEN: 'Predictions are closed for this round.',
              }[data.error] || data.error || 'Submit failed.',
          });
        }
      } else {
        setCooldownUntil(Date.now() + 30 * 1000);
        setFeedback({
          kind: 'success',
          message: data.isNew ? 'Slip submitted.' : 'Slip updated.',
        });
      }
    } catch (err) {
      setFeedback({ kind: 'error', message: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!twitchUser) {
    return (
      <div className="relative overflow-hidden border border-white/15 bg-zinc-card/30">
        <div className="px-5 py-7 text-center space-y-4">
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
            Sign in to predict
          </p>
          <button
            type="button"
            onClick={loginWithTwitch}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
          >
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              Sign in with Twitch
            </span>
          </button>
        </div>
      </div>
    );
  }

  const serial = fakeSerial(round?.id, twitchUser.twitchId);
  const yourWinnerEntry =
    settled && round.winners?.find((w) => w.twitchId === twitchUser.twitchId);

  return (
    <div className="relative">
      {/* Receipt — perforated top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-3 bg-zinc-broadcast"
        style={{
          maskImage:
            'radial-gradient(circle 5px at 7px 0, transparent 5px, black 5px)',
          maskSize: '14px 14px',
          maskRepeat: 'repeat-x',
        }}
        aria-hidden="true"
      />

      <div
        className={`relative bg-zinc-card/95 border border-white/15 pt-6 px-5 pb-5 sm:px-6 sm:pb-6 ${
          locked ? 'opacity-90' : ''
        }`}
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 4px)',
        }}
      >
        {/* Header line */}
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono mb-4">
          <span className="text-white/55">
            Slip <span className="text-emerald-signal">№ {serial}</span>
          </span>
          <span className="text-white/35">Void if detached</span>
        </div>

        <p
          className="text-2xl font-black tracking-tight text-white-body mb-1 leading-none"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {round?.title}
        </p>
        {round?.contextNote && (
          <p className="text-sm text-white/55 mb-4">{round.contextNote}</p>
        )}

        {/* Top slot tiles */}
        {round?.kinds?.topSlot && (
          <div className="mt-5">
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-2 font-mono">
              <span className="text-emerald-signal tabular-nums">01</span> Top slot pick
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {slots.map((s) => (
                <div key={s.name} className="flex-shrink-0">
                  <SlotTile
                    slot={s}
                    selected={slotInput === s.name}
                    onSelect={setSlotInput}
                    disabled={!editable}
                  />
                </div>
              ))}
              {slots.length === 0 && (
                <p className="text-sm text-white/40 italic px-2">No slots listed yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Payout input */}
        {round?.kinds?.payout && (
          <div className="mt-5">
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-2 font-mono">
              <span className="text-emerald-signal tabular-nums">
                {round.kinds.topSlot ? '02' : '01'}
              </span>{' '}
              Final payout guess
            </p>
            <div className="flex items-baseline gap-2 px-3 py-3 border-2 border-emerald-signal/40 bg-emerald-signal/5">
              <span className="text-2xl font-black text-emerald-signal font-mono">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={payoutInput}
                onChange={(e) => setPayoutInput(e.target.value)}
                placeholder="0.00"
                disabled={!editable}
                className="flex-1 bg-transparent text-3xl font-black text-white-body tabular-nums focus:outline-none placeholder:text-white/20"
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              />
            </div>
            {totalCost > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {QUICK_CHIPS(totalCost).map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => editable && setPayoutInput(String(c.value))}
                    disabled={!editable}
                    className="px-2.5 py-1 border border-white/15 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/65 hover:text-white-body hover:border-emerald-signal/40 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                  >
                    {c.label}
                  </button>
                ))}
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/35 font-mono self-center ml-1">
                  Cost {formatCurrency(totalCost)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        {editable && (
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || cooldown > 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                {submitting ? 'Submitting…' : entry ? 'Update slip' : 'Submit slip'}
              </span>
            </button>
            {cooldown > 0 && (
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
                Edit again in {cooldown}s
              </span>
            )}
            {entry && (
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
                Submitted · edits {entry.editCount ?? 1}
              </span>
            )}
          </div>
        )}

        {feedback && (
          <div
            className={`mt-3 flex items-center gap-2 text-[11px] font-bold tracking-eyebrow uppercase font-mono ${
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

        {/* Locked stamp */}
        {locked && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span
              className="text-5xl font-black tracking-tight text-red-destructive/80 border-4 border-red-destructive/80 px-6 py-2 rotate-[-8deg]"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              LOCKED IN
            </span>
          </div>
        )}

        {/* Settled result line */}
        {settled && entry && (
          <div className="mt-5 pt-4 border-t border-dashed border-white/15">
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-1 font-mono">
              Result
            </p>
            <div className="flex items-baseline gap-3 flex-wrap text-sm">
              {round.kinds.payout && (
                <>
                  <span className="text-white/55">Your guess</span>
                  <span className="font-bold text-white-body tabular-nums">
                    {formatCurrency(entry.payoutGuess)}
                  </span>
                  <span className="text-white/35">·</span>
                  <span className="text-white/55">Actual</span>
                  <span className="font-bold text-emerald-signal tabular-nums">
                    {formatCurrency(round.actual?.payout)}
                  </span>
                </>
              )}
              {round.kinds.topSlot && (
                <>
                  <span className="text-white/55">Top slot</span>
                  <span className="font-bold text-white-body">{entry.topSlotGuess || '—'}</span>
                  <span className="text-white/35">·</span>
                  <span className="text-white/55">Actual</span>
                  <span className="font-bold text-emerald-signal">
                    {round.actual?.topSlotName || '—'}
                  </span>
                </>
              )}
            </div>
            {yourWinnerEntry && (
              <p className="mt-3 inline-flex items-center gap-2 px-2 py-1 border border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                <Ticket size={11} aria-hidden="true" />
                {yourWinnerEntry.place === 1 ? '1st place' : yourWinnerEntry.place === 2 ? '2nd place' : '3rd place'}
                {yourWinnerEntry.prize?.tickets ? ` · +${yourWinnerEntry.prize.tickets} tickets` : ''}
                {yourWinnerEntry.prize?.cashLabel ? ` · ${yourWinnerEntry.prize.cashLabel}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Lock icon corner when locked */}
        {locked && (
          <div className="absolute top-3 right-3 text-red-destructive/70">
            <Lock size={14} aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
