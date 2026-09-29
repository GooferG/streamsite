import { useState } from 'react';
import { Lock, Unlock, Trophy, Trash2 } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { formatHuntDate } from '../../../utils/huntFormat';
import { placeLabel, rewardSummary } from '../../../utils/predictionRewards';
import SettleModal from './SettleModal';
import ChatStatus from './ChatStatus';
import { errorText, roundsAction, statusTone } from './shared';

const STEPS = [
  { key: 'open', label: 'Open' },
  { key: 'locked', label: 'Locked' },
  { key: 'settled', label: 'Settled' },
];

const btnLabel = 'text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';
const btnSecondary =
  'inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50';

function sourceLine(round) {
  const s = round.bonusHuntSnapshot;
  if (round.source === 'communityhunts' && s) {
    const when = s.status === 'live' ? 'Live' : s.endedAt ? `Ended ${formatHuntDate(s.endedAt)}` : null;
    return [formatMoney(s.totalCost, s.currency), s.currency, `${s.bonusCount} bonuses`, when]
      .filter(Boolean)
      .join(' · ');
  }
  return `Manual · ${formatMoney(round.manualTotalCost, null)}`;
}

function StepRail({ status }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
      {STEPS.map((step, i) => (
        <li key={step.key} className="inline-flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && (
            <span className="text-white/20" aria-hidden="true">
              →
            </span>
          )}
          <span className={i === current ? 'text-orange-admin' : i < current ? 'text-emerald-signal' : 'text-white/30'}>
            <span className="tabular-nums">0{i + 1}</span> {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Header, lifecycle steps and actions for one round. readOnly (a past round
// opened from the list) hides the lifecycle actions.
export default function RoundControl({ round, readOnly = false, results = null, onDeleted, compact = false }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [settling, setSettling] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const tiers = (round.rewards?.tiers || []).slice().sort((a, b) => a.place - b.place);
  const live = !readOnly && round.acceptPredictions;

  const act = async (action) => {
    setBusy(action);
    setError(null);
    const { ok, data } = await roundsAction({ action, id: round.id });
    setBusy(null);
    if (!ok) {
      setError(errorText(data.error));
      return false;
    }
    if (action === 'delete' && onDeleted) onDeleted();
    return true;
  };

  const lockAndSettle = async () => {
    if (await act('lock')) setSettling(true);
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden border border-orange-admin/30 bg-zinc-card/40">
        <div
          className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />
        <div className={compact ? 'relative px-4 py-4 space-y-4' : 'relative px-6 sm:px-8 py-6 space-y-4'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
              ▸ Prediction round
            </p>
            <span className={`px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${statusTone(round.status)}`}>
              {round.status}
            </span>
          </div>
          <div>
            {compact ? (
              <p className="font-black text-white-body leading-tight tracking-[-0.03em] text-xl">{round.title}</p>
            ) : (
              <p
                className="font-black text-white-body leading-[0.9] tracking-[-0.03em]"
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)' }}
              >
                {round.title}
              </p>
            )}
            {round.contextNote && <p className="mt-2 text-sm text-white/55">{round.contextNote}</p>}
            <p className="mt-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono">
              {sourceLine(round)}
            </p>
          </div>
          {round.acceptPredictions && <StepRail status={round.status} />}
          {round.acceptPredictions && tiers.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
              {tiers.map((tier) => (
                <li key={tier.place} className="text-white/55">
                  <span className="text-white-body">{placeLabel(tier.place)}</span> ·{' '}
                  {rewardSummary(tier, round.rewards?.type)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {round.acceptPredictions && <ChatStatus round={round} results={results} />}

      <div className="flex flex-wrap items-center gap-2">
        {live && round.status === 'open' && (
          <>
            <button
              type="button"
              onClick={() => act('lock')}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
            >
              <Lock size={13} aria-hidden="true" />
              <span className={btnLabel}>{busy === 'lock' ? 'Locking…' : 'Lock entries'}</span>
            </button>
            <button type="button" onClick={lockAndSettle} disabled={!!busy} className={btnSecondary}>
              <Trophy size={13} aria-hidden="true" />
              <span className={btnLabel}>Lock & settle</span>
            </button>
          </>
        )}
        {live && round.status === 'locked' && (
          <>
            <button
              type="button"
              onClick={() => setSettling(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
            >
              <Trophy size={13} aria-hidden="true" />
              <span className={btnLabel}>Settle & pay</span>
            </button>
            <button type="button" onClick={() => act('reopen')} disabled={!!busy} className={btnSecondary}>
              <Unlock size={13} aria-hidden="true" />
              <span className={btnLabel}>{busy === 'reopen' ? 'Reopening…' : 'Reopen'}</span>
            </button>
          </>
        )}
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150"
          >
            <Trash2 size={12} aria-hidden="true" />
            <span className={btnLabel}>Delete</span>
          </button>
        ) : (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => act('delete')}
              disabled={!!busy}
              className={`inline-flex items-center gap-2 px-3 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 ${btnLabel}`}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={`px-3 py-2 border border-white/10 text-white/60 hover:text-white-body ${btnLabel}`}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>
      )}

      {settling && (
        <SettleModal round={round} onClose={() => setSettling(false)} onSettled={() => setSettling(false)} />
      )}
    </div>
  );
}
