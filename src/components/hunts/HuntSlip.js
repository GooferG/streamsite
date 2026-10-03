import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import Ticket from '../onAir/Ticket';
import OnAirButton from '../onAir/OnAirButton';
import { FOCUS, MONO } from '../onAir/classes';
import { authedFetch } from '../../utils/authedFetch';
import { formatMoney } from '../../utils/money';
import { fitFontSize } from '../../utils/fitText';
import { caretAfter, formatAmountInput, localeSeparators, parseAmountInput, significantBefore } from '../../utils/amountInput';
import { placeLabel } from '../../utils/predictionRewards';
import { ordinal, quickPicks, winnerPrizeText } from './huntStats';
import { guessOf } from './huntBoard';
import { toMs } from './huntTime';

// The prediction slip on the On Air ticket. Same submit API, 30s edit
// cooldown and grouped amount input as before; only the presentation moved.
const EDIT_COOLDOWN_MS = 30 * 1000;
const ERRORS = {
  INVALID_PAYOUT: 'Enter a valid payout amount.',
  NOT_OPEN: 'Predictions are closed for this round.',
};

export function fakeSerial(roundId, twitchId) {
  if (!roundId) return '0000-0000';
  const a = roundId.slice(-4).toUpperCase();
  const b = (twitchId || '').slice(-4).toUpperCase();
  return `${a}-${b || '----'}`;
}

// Seconds left until targetMs. Measured against the clock at render time (a
// `now` held in state would be stale on the first frame after a new target,
// showing a slip mounted minutes ago as "Edit again in 330s"); the interval
// only forces re-renders while the countdown runs.
function useCooldown(targetMs) {
  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!targetMs || targetMs <= Date.now()) return undefined;
    const t = setInterval(() => {
      if (Date.now() >= targetMs) clearInterval(t);
      tick();
    }, 250);
    return () => clearInterval(t);
  }, [targetMs]);
  return targetMs ? Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)) : 0;
}

function SlipHeader({ serial, locked = false, title, sub }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`${MONO} flex justify-between gap-2 text-[0.625rem] tracking-[0.24em] text-onair-viewer-light`}>
        <span className="min-w-0 truncate">Your slip · No. {serial}</span>
        {locked && (
          <span className="flex-none whitespace-nowrap text-onair-signal">
            <span aria-hidden="true">● </span>Locked
          </span>
        )}
      </p>
      <h2 className="text-[1.375rem] font-extrabold leading-tight">{title}</h2>
      {sub && <p className="text-sm leading-snug text-onair-viewer-muted">{sub}</p>}
    </div>
  );
}

function BigGuess({ value, currency }) {
  const text = formatMoney(value, currency);
  return (
    <div style={{ containerType: 'inline-size' }}>
      <p
        className="whitespace-nowrap text-4xl font-extrabold tracking-[-0.02em] tabular-nums"
        style={{ fontSize: fitFontSize(text, { min: 1.5, max: 2.25 }) }}
      >
        {text}
      </p>
    </div>
  );
}

function Note({ children }) {
  return <p className="text-center text-xs text-onair-viewer-muted">{children}</p>;
}

function Feedback({ feedback }) {
  return (
    <p role="status" className={`text-center text-xs ${feedback && feedback.kind === 'error' ? 'text-onair-loss' : 'text-onair-signal'}`}>
      {feedback ? feedback.message : ''}
    </p>
  );
}

function OpenSlip({ round, serial, myEntry, currency, startCost, prize, guessCount }) {
  const [editing, setEditing] = useState(false);
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
  const myGuess = guessOf(myEntry);
  const lastEditMs = toMs(myEntry && myEntry.lastEditAt);

  // Seed the input from the saved guess and resume an edit cooldown.
  useEffect(() => {
    if (myGuess != null) setPayoutInput(String(myGuess));
    if (lastEditMs && lastEditMs + EDIT_COOLDOWN_MS > Date.now()) setCooldownUntil(lastEditMs + EDIT_COOLDOWN_MS);
  }, [myGuess, lastEditMs]);

  // Regrouping moves characters around the caret; put it back after the same digit.
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
    const caret = (selectionStart ?? value.length) - (next === null ? 1 : 0);
    caretRef.current = significantBefore(value, caret, seps.decimal);
    if (next !== null) setPayoutInput(next);
    rerender();
  };

  const valid = payoutInput !== '' && Number(payoutInput) > 0;
  const canSubmit = valid && !submitting && cooldown === 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await authedFetch('/api/predictions/submit', {
        method: 'POST',
        body: JSON.stringify({ roundId: round.id, payoutGuess: Number(payoutInput) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'COOLDOWN' && data.retryAfter) {
          setCooldownUntil(Date.now() + data.retryAfter * 1000);
          setFeedback({ kind: 'error', message: `Wait ${data.retryAfter}s to edit again.` });
        } else {
          setFeedback({ kind: 'error', message: ERRORS[data.error] || data.error || 'Submit failed.' });
        }
      } else {
        setCooldownUntil(Date.now() + EDIT_COOLDOWN_MS);
        setEditing(false);
        setFeedback({ kind: 'success', message: data.isNew ? 'Slip submitted.' : 'Slip updated.' });
      }
    } catch {
      setFeedback({ kind: 'error', message: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (myGuess != null && !editing) {
    const others = Math.max(0, guessCount - 1);
    return (
      <Ticket header={<SlipHeader serial={serial} locked title="You're on the board" sub="Good luck. Results land when the last bonus opens." />}>
        <div className="flex flex-col gap-3">
          <BigGuess value={myGuess} currency={currency} />
          <p className="text-[0.8125rem] text-onair-viewer-muted">
            {others > 0
              ? `Sealed with ${others} other ${others === 1 ? 'guess' : 'guesses'}. Revealed when entries close.`
              : 'First on the board. Revealed when entries close.'}
          </p>
          <OnAirButton
            variant="ghost"
            onClick={() => {
              setEditing(true);
              setFeedback(null);
            }}
          >
            Change guess
          </OnAirButton>
          {cooldown > 0 && <Note>Edit again in {cooldown}s</Note>}
          <Feedback feedback={feedback} />
        </div>
      </Ticket>
    );
  }

  const picks = quickPicks(startCost);
  return (
    <Ticket header={<SlipHeader serial={serial} title="Call the payout" sub={prize ? `Closest guess takes ${prize}.` : 'Closest guess wins.'} />}>
      <div className="flex flex-col gap-3">
        <label htmlFor={inputId} className="sr-only">
          Final payout guess
        </label>
        <div
          className={`flex items-center gap-1.5 rounded-onair-inner bg-black/[0.35] px-4 py-1 shadow-onair-well ring-1 focus-within:ring-2 focus-within:ring-onair-viewer-light ${
            valid ? 'ring-onair-viewer-bright/[0.55]' : 'ring-white/[0.06]'
          }`}
        >
          <span className="text-[0.9375rem] font-bold text-onair-viewer-muted">{currency || '$'}</span>
          <div className="min-w-0 flex-1" style={{ containerType: 'inline-size' }}>
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
              className="block w-full min-w-0 bg-transparent py-2 text-[2rem] font-extrabold tabular-nums text-white-body outline-none placeholder:text-onair-viewer-muted/50"
              style={{ fontSize: fitFontSize(display || '0.00', { min: 1.25, max: 2 }) }}
            />
          </div>
        </div>
        {picks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picks.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPayoutInput(String(p.value))}
                className={`min-h-9 rounded-onair-tile bg-white/[0.07] px-3 text-xs text-onair-viewer-ink hover:bg-white/[0.13] ${FOCUS}`}
              >
                {p.label} {formatMoney(p.value, currency, { decimals: 0 })}
              </button>
            ))}
          </div>
        )}
        <OnAirButton variant="viewer" onClick={submit} disabled={!canSubmit}>
          {submitting ? 'Locking…' : myGuess != null ? 'Update guess' : 'Lock it in'}
        </OnAirButton>
        {cooldown > 0 && <p className="text-center text-xs text-onair-winner-warm">Edit again in {cooldown}s</p>}
        <Feedback feedback={feedback} />
        <Note>Editable until Goofer closes entries.</Note>
        {myGuess != null && (
          <OnAirButton
            variant="ghost"
            size="sm"
            className="self-center"
            onClick={() => {
              setEditing(false);
              setPayoutInput(String(myGuess));
            }}
          >
            Keep {formatMoney(myGuess, currency)}
          </OnAirButton>
        )}
      </div>
    </Ticket>
  );
}

function positionText({ below, above }) {
  return `${below} ${below === 1 ? 'guess' : 'guesses'} below you · ${above} above`;
}

export default function HuntSlip({ mode, round, viewer, onSignIn, myEntry, currency, startCost, prize, guessCount = 0, position = null, rank = null }) {
  const twitchId = viewer && viewer.twitchId;
  const serial = fakeSerial(round && round.id, twitchId);
  const prizeLine = prize ? `Closest guess takes ${prize}.` : 'Closest guess wins.';
  const myGuess = guessOf(myEntry);

  if (!twitchId) {
    const title = mode === 'open' ? 'Call the payout' : mode === 'locked' ? 'Entries closed' : 'Call the next payout';
    const sub =
      mode === 'offair'
        ? 'Predictions open when Goofer starts a round.'
        : mode === 'locked'
          ? 'Sign in to be ready for the next round.'
          : prizeLine;
    return (
      <Ticket header={<SlipHeader serial={serial} title={title} sub={sub} />}>
        <OnAirButton variant="viewer" onClick={onSignIn}>
          Sign in with Twitch
        </OnAirButton>
      </Ticket>
    );
  }

  if (mode === 'offair') {
    return (
      <Ticket header={<SlipHeader serial={serial} title="No round open" sub="Predictions open when Goofer starts a round." />}>
        <Note>Your slip unlocks when entries open.</Note>
      </Ticket>
    );
  }

  if (mode === 'open') {
    return (
      <OpenSlip
        key={round.id}
        round={round}
        serial={serial}
        myEntry={myEntry}
        currency={currency}
        startCost={startCost}
        prize={prize}
        guessCount={guessCount}
      />
    );
  }

  if (mode === 'locked') {
    if (myGuess == null) {
      return (
        <Ticket header={<SlipHeader serial={serial} title="Entries closed" sub="You didn't get a guess in this round. Next one's yours." />}>
          <Note>Results land when the last bonus opens.</Note>
        </Ticket>
      );
    }
    return (
      <Ticket header={<SlipHeader serial={serial} locked title="Entries closed" sub="Good luck. Results land when the last bonus opens." />}>
        <div className="flex flex-col gap-3">
          <BigGuess value={myGuess} currency={currency} />
          {position && <p className="text-[0.8125rem] text-onair-viewer-muted">{positionText(position)}</p>}
        </div>
      </Ticket>
    );
  }

  // settled
  if (myGuess == null) {
    return (
      <Ticket header={<SlipHeader serial={serial} title="Call the next payout" sub={prizeLine} />}>
        <Note>Next round opens when Goofer starts the next hunt.</Note>
      </Ticket>
    );
  }
  const actual = round.actual && round.actual.payout;
  const won = (round.winners || []).find((w) => w && w.twitchId === twitchId);
  const sub = won
    ? winnerPrizeText(won.prize) || 'You placed this round.'
    : rank
      ? `Off by ${formatMoney(Math.abs(myGuess - actual), currency)} · ${ordinal(rank.place)} of ${rank.of}`
      : `Off by ${formatMoney(Math.abs(myGuess - actual), currency)}`;
  return (
    <Ticket header={<SlipHeader serial={serial} title={won ? `${placeLabel(won.place)} place!` : 'Your result'} sub={sub} />}>
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-onair-viewer-muted">Your guess</dt>
          <dd className="font-bold tabular-nums">{formatMoney(myGuess, currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-onair-viewer-muted">Actual</dt>
          <dd className="font-bold tabular-nums text-onair-winner-light">{formatMoney(actual, currency)}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <Note>Next round opens when Goofer starts the next hunt.</Note>
      </div>
    </Ticket>
  );
}
