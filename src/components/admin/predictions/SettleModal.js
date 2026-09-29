import { useState } from 'react';
import { Trophy, X, RefreshCcw, Ticket } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { roundCurrency } from '../../../utils/predictionRound';
import { placeLabel } from '../../../utils/predictionRewards';
import { inputCls, errorText, roundsAction } from './shared';

const FILL_ERRORS = {
  HUNT_NOT_FOUND: 'Hunt not found on communityhunts.gg. Enter the payout by hand.',
  COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Enter the payout by hand.',
};

const labelCls = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';

function PreviewRow({ place, winner, currency }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 border border-white/10 bg-zinc-broadcast/40">
      <span className="w-9 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
        {placeLabel(place)}
      </span>
      {winner ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white-body text-sm truncate">
              {winner.displayName || winner.twitchName}
            </p>
            <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono mt-0.5">
              guess {formatMoney(winner.payoutGuess, currency)} · off by {formatMoney(winner.diff, currency)}
            </p>
          </div>
          <div className="text-right text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono text-emerald-signal space-y-0.5">
            {winner.prize.tickets > 0 && (
              <p className="inline-flex items-center gap-1">
                <Ticket size={10} aria-hidden="true" />+{winner.prize.tickets}
              </p>
            )}
            {winner.prize.label && <p>{winner.prize.label}</p>}
          </div>
        </>
      ) : (
        <p className="flex-1 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/35 font-mono">
          No entry
        </p>
      )}
    </li>
  );
}

// Two steps: enter (or fill) the payout and preview who places, then confirm
// to pay. The round is locked by now, so the preview is what gets paid.
export default function SettleModal({ round, onClose, onSettled }) {
  const [step, setStep] = useState('payout');
  const [actualPayout, setActualPayout] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null); // 'fill' | 'preview' | 'settle'
  const [liveWarning, setLiveWarning] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [error, setError] = useState(null);
  const currency = roundCurrency(round);
  const canFill = round.source === 'communityhunts' && !!round.bonusHuntSnapshot?.huntId;
  const places = (round.rewards?.tiers || []).map((t) => t.place).sort((a, b) => a - b);

  const fillFromHunt = async () => {
    setBusy('fill');
    setError(null);
    const { ok, data } = await roundsAction({ action: 'hunt_result', id: round.id });
    setBusy(null);
    if (!ok) {
      setError(FILL_ERRORS[data.error] || errorText(data.error));
      return;
    }
    setActualPayout(String(data.result.payout));
    setLiveWarning(data.result.ended === false);
    // A round opened while nothing was live snapshots the previous hunt;
    // its payout would settle the wrong hunt.
    const createdMs = round.createdAt?.toMillis ? round.createdAt.toMillis() : null;
    const endedMs = data.result.endedAt ? Date.parse(data.result.endedAt) : NaN;
    setStaleWarning(createdMs != null && Number.isFinite(endedMs) && endedMs < createdMs);
  };

  const requestPreview = async (e) => {
    e.preventDefault();
    setError(null);
    if (actualPayout === '' || !Number.isFinite(Number(actualPayout))) {
      setError('Actual payout required');
      return;
    }
    setBusy('preview');
    const { ok, data } = await roundsAction({
      action: 'preview_settle',
      id: round.id,
      actualPayout: Number(actualPayout),
    });
    setBusy(null);
    if (!ok) {
      setError(errorText(data.error));
      return;
    }
    setPreview(data);
    setStep('preview');
  };

  const confirm = async () => {
    setError(null);
    setBusy('settle');
    const { ok, data } = await roundsAction({
      action: 'settle',
      id: round.id,
      actualPayout: Number(actualPayout),
    });
    setBusy(null);
    if (!ok) {
      setError(errorText(data.error));
      return;
    }
    onSettled(data);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settle round"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={requestPreview}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-orange-admin/40 bg-zinc-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <Trophy size={11} aria-hidden="true" />
            Settle round · {step === 'payout' ? '1/2 payout' : '2/2 confirm'}
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

        {step === 'payout' ? (
          <div className="px-5 py-5 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <label htmlFor="settle-actual-payout" className={`block text-white/55 ${labelCls}`}>
                  Actual final payout{currency ? ` (${currency})` : ''} <span className="text-emerald-signal">*</span>
                </label>
                {canFill && (
                  <button
                    type="button"
                    onClick={fillFromHunt}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1.5 px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 disabled:opacity-50"
                  >
                    <RefreshCcw size={11} aria-hidden="true" className={busy === 'fill' ? 'animate-spin' : ''} />
                    <span className={labelCls}>Fill from hunt</span>
                  </button>
                )}
              </div>
              <input
                id="settle-actual-payout"
                type="number"
                min="0"
                step="0.01"
                value={actualPayout}
                onChange={(e) => {
                  setActualPayout(e.target.value);
                  setLiveWarning(false);
                  setStaleWarning(false);
                }}
                className={inputCls}
                placeholder="0.00"
              />
              {liveWarning && (
                <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                  Hunt is still live. The payout may change.
                </p>
              )}
              {staleWarning && (
                <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                  This hunt ended before this round opened. Make sure it is the right hunt before settling.
                </p>
              )}
            </div>
            {error && (
              <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
            )}
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <p className={`text-white/55 ${labelCls}`}>
              Actual payout{' '}
              <span className="text-emerald-signal tabular-nums">{formatMoney(preview.actualPayout, currency)}</span>
            </p>
            <ol className="space-y-2">
              {preview.placements.map((winner, i) => (
                <PreviewRow key={places[i] ?? i + 1} place={places[i] ?? i + 1} winner={winner} currency={currency} />
              ))}
            </ol>
            <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
              {preview.entryCount} {preview.entryCount === 1 ? 'entry' : 'entries'} ranked · paying can't be undone
            </p>
            {error && (
              <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 px-5 pb-5">
          {step === 'payout' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
              >
                <span className={labelCls}>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={!!busy}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
              >
                <span className={labelCls}>{busy === 'preview' ? 'Ranking…' : 'Preview winners'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('payout');
                  setError(null);
                }}
                disabled={busy === 'settle'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150 disabled:opacity-50"
              >
                <span className={labelCls}>Back</span>
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!!busy}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
              >
                <Trophy size={13} aria-hidden="true" />
                <span className={labelCls}>{busy === 'settle' ? 'Paying…' : 'Confirm & pay'}</span>
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
