import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Ticket, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { authedFetch } from '../utils/authedFetch';
import { formatMoney } from '../utils/money';
import { fitFontSize } from '../utils/fitText';
import {
  localeSeparators,
  parseAmountInput,
  formatAmountInput,
  significantBefore,
  caretAfter,
} from '../utils/amountInput';
import { roundCurrency, roundTotalCost } from '../utils/predictionRound';
import { winnerPrizeLabel } from '../utils/predictionRewards';

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

// Guesses either side of the start cost: a hunt paying back half is as
// normal as one doubling.
function quickPicks(totalCost) {
  const c = Number(totalCost) || 0;
  if (c <= 0) return [];
  return [
    { label: 'Half back', value: Math.round(c / 2) },
    { label: 'Break even', value: Math.round(c * 100) / 100 },
    { label: '+20%', value: Math.round(c * 1.2) },
    { label: '2×', value: Math.round(c * 2) },
  ];
}

const EYEBROW = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';

function SlipFrame({ serial, aside, children }) {
  return (
    <section className="relative border border-white/8 bg-zinc-card/30" aria-label="Prediction slip">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="text-white/55">
          Slip <span className="text-emerald-signal tabular-nums">№ {serial}</span>
        </span>
        <span className="text-white/35">{aside}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * Props:
 *   round: prediction round doc
 */
export default function PredictionSlip({ round }) {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const [entry, setEntry] = useState(null);
  // Canonical guess ("1850000.5"); the input shows it grouped.
  const [payoutInput, setPayoutInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const cooldown = useCooldown(cooldownUntil);
  const inputId = useId();
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const [, rerender] = useReducer((n) => n + 1, 0);
  const seps = useMemo(() => localeSeparators(), []);
  const display = formatAmountInput(payoutInput, seps);

  const status = round?.status;
  const editable = status === 'open' && !!twitchUser;
  const locked = status === 'locked';
  const settled = status === 'settled';
  const canSubmit = editable && payoutInput !== '' && !submitting && cooldown === 0;

  const currency = roundCurrency(round);
  const totalCost = roundTotalCost(round);

  // Subscribe to the viewer's own entry.
  useEffect(() => {
    if (!twitchUser?.twitchId || !round?.id) {
      setEntry(null);
      return undefined;
    }
    const ref = doc(db, 'hunts', round.id, 'entries', twitchUser.twitchId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setEntry(data);
      if (data) {
        if (data.payoutGuess != null) setPayoutInput(String(data.payoutGuess));
        if (data.lastEditAt?.toMillis) {
          const next = data.lastEditAt.toMillis() + 30 * 1000;
          if (next > Date.now()) setCooldownUntil(next);
        }
      }
    });
    return unsub;
  }, [twitchUser?.twitchId, round?.id]);

  // Regrouping moves characters around the caret; put it back after the
  // same digit the viewer just typed.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const count = caretRef.current;
    caretRef.current = null;
    if (count == null || !el || document.activeElement !== el) return;
    const pos = caretAfter(el.value, count, seps.decimal);
    el.setSelectionRange(pos, pos);
  });

  const onAmountChange = (e) => {
    const { value, selectionStart } = e.target;
    const next = parseAmountInput(value, seps);
    // A rejected keystroke puts the caret back where it was, one character
    // left of where the browser left it.
    const caret = (selectionStart ?? value.length) - (next === null ? 1 : 0);
    caretRef.current = significantBefore(value, caret, seps.decimal);
    if (next !== null) setPayoutInput(next);
    // Typing a character that parses away leaves the state unchanged; render
    // anyway so the caret is restored.
    rerender();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = { roundId: round.id, payoutGuess: Number(payoutInput) };
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
      <SlipFrame serial={fakeSerial(round?.id, null)} aside="Void if detached">
        <div className="px-5 py-7 text-center space-y-4">
          <p className={`${EYEBROW} text-white/45`}>Sign in to predict</p>
          <button
            type="button"
            onClick={loginWithTwitch}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
          >
            <span className={EYEBROW}>Sign in with Twitch</span>
          </button>
        </div>
      </SlipFrame>
    );
  }

  const yourWinnerEntry =
    settled && round.winners?.find((w) => w.twitchId === twitchUser.twitchId);

  return (
    <SlipFrame
      serial={fakeSerial(round?.id, twitchUser.twitchId)}
      aside={
        locked ? (
          <span className="inline-flex items-center gap-1.5 text-orange-admin">
            <Lock size={11} aria-hidden="true" />
            Locked
          </span>
        ) : (
          'Void if detached'
        )
      }
    >
      <div className={`px-4 sm:px-5 py-5 ${locked ? 'opacity-90' : ''}`}>
        <p
          className="text-2xl font-black tracking-tight text-white-body mb-1 leading-none"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {round?.title}
        </p>
        {round?.contextNote && (
          <p className="text-sm text-white/55">{round.contextNote}</p>
        )}

        {/* Payout input */}
        <div className="mt-5">
          <label htmlFor={inputId} className={`block mb-2 ${EYEBROW} text-white/55`}>
            <span className="text-emerald-signal tabular-nums">01</span>{' '}
            Final payout guess
          </label>
          <div
            className={`flex items-stretch border-2 bg-zinc-broadcast/60 transition-colors duration-150 ${
              editable ? 'border-emerald-signal/40 focus-within:border-emerald-signal' : 'border-white/15'
            }`}
          >
            <span className="flex items-center px-3 border-r border-white/10 font-mono text-xs font-bold tracking-eyebrow-sm text-emerald-signal">
              {currency || '$'}
            </span>
            <div className="flex-1 min-w-0 px-3 py-2.5" style={{ containerType: 'inline-size' }}>
              <input
                id={inputId}
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={display}
                onChange={onAmountChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder={`0${seps.decimal}00`}
                disabled={!editable}
                className="block w-full min-w-0 bg-transparent text-3xl leading-9 font-black text-white-body tabular-nums focus:outline-none placeholder:text-white/20 disabled:cursor-not-allowed"
                style={{ fontSize: fitFontSize(display || '0.00', { min: 1.125, max: 1.875 }) }}
              />
            </div>
          </div>
          {totalCost > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {quickPicks(totalCost).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => editable && setPayoutInput(String(c.value))}
                  disabled={!editable}
                  className={`px-2.5 py-1 border border-white/15 ${EYEBROW} text-white/65 hover:text-white-body hover:border-emerald-signal/40 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {c.label}
                </button>
              ))}
              <span className={`${EYEBROW} text-white/35 self-center ml-1`}>
                Cost {formatMoney(totalCost, currency)}
              </span>
            </div>
          )}
        </div>

        {/* Submit */}
        {editable && (
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              <span className={EYEBROW}>
                {submitting ? 'Submitting…' : entry ? 'Update slip' : 'Submit slip'}
              </span>
            </button>
            {cooldown > 0 && (
              <span className={`${EYEBROW} text-orange-admin`}>Edit again in {cooldown}s</span>
            )}
            {entry && (
              <span className={`${EYEBROW} text-white/45`}>Submitted · edits {entry.editCount ?? 1}</span>
            )}
          </div>
        )}

        {feedback && (
          <div
            className={`mt-3 flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono ${
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

        {/* Settled result line */}
        {settled && entry && (
          <div className="mt-5 pt-4 border-t border-white/8">
            <p className={`${EYEBROW} text-white/45 mb-1`}>Result</p>
            <div className="flex items-baseline gap-3 flex-wrap text-sm">
              <span className="text-white/55">Your guess</span>
              <span className="font-bold text-white-body tabular-nums">
                {formatMoney(entry.payoutGuess, currency)}
              </span>
              <span className="text-white/35">·</span>
              <span className="text-white/55">Actual</span>
              <span className="font-bold text-emerald-signal tabular-nums">
                {formatMoney(round.actual?.payout, currency)}
              </span>
            </div>
            {yourWinnerEntry && (
              <p className={`mt-3 inline-flex items-center gap-2 px-2 py-1 border border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal ${EYEBROW}`}>
                <Ticket size={11} aria-hidden="true" />
                {yourWinnerEntry.place === 1 ? '1st place' : yourWinnerEntry.place === 2 ? '2nd place' : '3rd place'}
                {yourWinnerEntry.prize?.tickets ? ` · +${yourWinnerEntry.prize.tickets} tickets` : ''}
                {winnerPrizeLabel(yourWinnerEntry.prize) ? ` · ${winnerPrizeLabel(yourWinnerEntry.prize)}` : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Locked stamp, same voice as the overlay's "Locked in" */}
      {locked && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="px-5 py-2 border-[3px] border-orange-admin bg-zinc-broadcast/90 text-orange-admin font-mono font-black uppercase tracking-eyebrow-md text-2xl sm:text-3xl -rotate-6">
            Locked in
          </span>
        </div>
      )}
    </SlipFrame>
  );
}
