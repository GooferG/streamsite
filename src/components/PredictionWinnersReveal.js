import { Trophy, Ticket } from 'lucide-react';

function formatCurrency(val) {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PLACE_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD' };
const PLACE_COLOR = {
  1: 'text-orange-admin border-orange-admin/60 bg-orange-admin/10',
  2: 'text-white-body border-white/45 bg-white/5',
  3: 'text-emerald-signal border-emerald-signal/50 bg-emerald-signal/5',
};

function WinnerCard({ winner, round }) {
  const tone = PLACE_COLOR[winner.place] || PLACE_COLOR[1];
  const label = PLACE_LABEL[winner.place] || `${winner.place}TH`;
  return (
    <div className={`relative border-2 px-5 py-5 ${tone}`}>
      <span className="absolute -top-3 left-3 px-2 py-0.5 bg-zinc-broadcast border-2 border-current text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
        {label}
      </span>
      <div className="flex items-center gap-3">
        {winner.profileImageUrl ? (
          <img
            src={winner.profileImageUrl}
            alt=""
            className="w-12 h-12 rounded-full border-2 border-current"
          />
        ) : (
          <div className="w-12 h-12 rounded-full border-2 border-current bg-zinc-broadcast/50 flex items-center justify-center text-base font-black">
            {(winner.displayName || winner.twitchName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className="text-xl font-black leading-tight truncate"
            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          >
            {winner.displayName || winner.twitchName}
          </p>
          <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/55 font-mono mt-0.5 truncate">
            {round.kinds.payout && typeof winner.payoutGuess === 'number'
              ? <>guess {formatCurrency(winner.payoutGuess)}{typeof winner.diff === 'number' ? ` · off by ${formatCurrency(winner.diff)}` : ''}</>
              : winner.topSlotGuess
                ? `picked ${winner.topSlotGuess}`
                : null}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {winner.prize?.tickets > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 border border-current text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Ticket size={11} aria-hidden="true" />
            +{winner.prize.tickets} tickets
          </span>
        )}
        {winner.prize?.cashLabel && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 border border-current text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={11} aria-hidden="true" />
            {winner.prize.cashLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PredictionWinnersReveal({ round }) {
  if (!round || round.status !== 'settled') return null;
  const winners = round.winners || [];
  if (winners.length === 0) {
    return (
      <div className="border border-white/15 bg-zinc-card/30 px-5 py-6 text-center">
        <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          No winners — no eligible entries.
        </p>
      </div>
    );
  }
  return (
    <div className="border border-white/10 bg-zinc-card/30 px-4 sm:px-6 py-5">
      <div className="flex items-center justify-between mb-4 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
        <span className="inline-flex items-center gap-2 text-orange-admin">
          <Trophy size={11} aria-hidden="true" />
          <span>Winners</span>
        </span>
        <span className="text-white/40 tabular-nums">
          actual {round.actual?.payout != null ? formatCurrency(round.actual.payout) : '—'}
          {round.actual?.topSlotName ? ` · ${round.actual.topSlotName}` : ''}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {winners.map((w) => (
          <WinnerCard key={`${w.place}-${w.twitchId}`} winner={w} round={round} />
        ))}
      </div>
    </div>
  );
}
