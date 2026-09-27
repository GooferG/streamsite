import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { RefreshCcw } from 'lucide-react';
import { db } from '../config/firebase';
import useTuningPhrase from '../hooks/useTuningPhrase';
import useCommunityHunts from '../hooks/useCommunityHunts';
import PredictionSlip from '../components/PredictionSlip';
import PredictionWall from '../components/PredictionWall';
import PredictionNumberLine from '../components/PredictionNumberLine';
import PredictionWinnersReveal from '../components/PredictionWinnersReveal';
import SuggestionSubmit from '../components/SuggestionSubmit';
import SuggestionList from '../components/SuggestionList';
import CurrentHuntCard from '../components/hunts/CurrentHuntCard';
import RecentHunts from '../components/hunts/RecentHunts';
import CommunityHuntsPromo from '../components/hunts/CommunityHuntsPromo';

function PredictionModeBanner({ round }) {
  if (!round) return null;
  const tone =
    round.status === 'open'
      ? 'text-emerald-signal border-emerald-signal/40'
      : round.status === 'locked'
        ? 'text-orange-admin border-orange-admin/50'
        : 'text-white-body border-white/30';

  const features = [
    round.acceptPredictions && 'PREDICT',
    round.acceptSuggestions && 'SUGGEST',
  ].filter(Boolean).join(' + ') || 'HUNT';
  const statusLabel =
    round.status === 'open' ? 'OPEN'
      : round.status === 'locked' ? 'LOCKED'
      : 'SETTLED';
  const label = `${features} · ${statusLabel}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border ${tone} bg-zinc-card/30 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono`}>
      <span className="inline-flex items-center gap-2">
        <span className="relative flex w-1.5 h-1.5">
          {round.status === 'open' && (
            <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
          )}
          <span
            className={`relative w-1.5 h-1.5 rounded-full ${
              round.status === 'open'
                ? 'bg-emerald-signal'
                : round.status === 'locked'
                  ? 'bg-orange-admin'
                  : 'bg-white-body'
            }`}
          />
        </span>
        <span>{label}</span>
      </span>
      <span className="text-white/15">·</span>
      <span className="text-white/55 truncate max-w-[40ch]">{round.title}</span>
      <span className="ml-auto text-white/40 tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
        {round.acceptPredictions && (
          <span>{String(round.entryCount ?? 0).padStart(4, '0')} ENTRIES</span>
        )}
        {round.acceptSuggestions && (
          <span>{String(round.suggestionCount ?? 0).padStart(3, '0')} SUGG.</span>
        )}
      </span>
    </div>
  );
}

function usePredictionRound() {
  const [round, setRound] = useState(null);
  useEffect(() => {
    // Most recent non-deleted round. Show settled rounds too (last result lingers).
    const q = query(
      collection(db, 'hunts'),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setRound(null);
      } else {
        const d = snap.docs[0];
        setRound({ id: d.id, ...d.data() });
      }
    });
    return unsub;
  }, []);
  return round;
}

// /gamba/hunts: the current prediction round (and its suggestions), then
// GooferG's communityhunts.gg hunts, then the communityhunts.gg promo band.
export default function HuntsPage() {
  const round = usePredictionRound();
  const { live, recent, loading } = useCommunityHunts();
  const current = live || recent[0] || null;
  const archive = current ? recent.filter((h) => h.id !== current.id) : recent;
  const tuningPhrase = useTuningPhrase(loading && !current);

  const mode =
    !round
      ? 'no_round'
      : round.status === 'open'
        ? 'predicting'
        : round.status === 'locked'
          ? 'opening'
          : 'settled';

  return (
    <div className="space-y-6">
      {round && <PredictionModeBanner round={round} />}

      {/* PREDICTING mode — slip + wall hero (only if predictions enabled) */}
      {mode === 'predicting' && round?.acceptPredictions && (
        <>
          <PredictionSlip round={round} />
          <PredictionNumberLine round={round} />
          <PredictionWall round={round} />
        </>
      )}

      {/* OPENING mode (predictions locked, hunt is being opened) */}
      {mode === 'opening' && round?.acceptPredictions && (
        <>
          <PredictionSlip round={round} />
          <PredictionWall round={round} />
        </>
      )}

      {/* SETTLED mode — winners hero */}
      {mode === 'settled' && round?.acceptPredictions && (
        <>
          <PredictionWinnersReveal round={round} />
          <PredictionNumberLine round={round} />
          <PredictionWall round={round} />
          <PredictionSlip round={round} />
        </>
      )}

      {/* Suggestion sections — render whenever the round accepts suggestions */}
      {round?.acceptSuggestions && (
        <>
          <SuggestionSubmit hunt={round} />
          <SuggestionList huntId={round.id} adminMode={false} />
        </>
      )}

      {/* communityhunts.gg hunts. Hidden entirely when there is no data. */}
      {loading && !current ? (
        <div className="border border-white/8 bg-zinc-card/30 py-12 flex flex-col items-center gap-3 text-white/65">
          <RefreshCcw size={20} className="animate-spin" aria-hidden="true" />
          <p className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono">{tuningPhrase}</p>
        </div>
      ) : current ? (
        <>
          <CurrentHuntCard hunt={current} isLive={!!live} />
          <RecentHunts hunts={archive} />
        </>
      ) : null}

      <CommunityHuntsPromo />
    </div>
  );
}
