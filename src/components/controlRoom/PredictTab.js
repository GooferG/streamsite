import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trophy } from 'lucide-react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import RoundControl from '../admin/predictions/RoundControl';
import NewRoundModal from '../admin/predictions/NewRoundModal';
import { statusTone } from '../admin/predictions/shared';
import { lastRewardsRound } from '../../utils/predictionRewards';

function Summary({ round }) {
  const bonuses = round.bonusHuntSnapshot?.bonusCount;
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0 flex-1">
        <span
          className={`inline-block px-1.5 py-0.5 border text-[0.5625rem] font-bold tracking-eyebrow-md uppercase font-mono ${statusTone(round.status)}`}
        >
          {round.status}
        </span>
        <p className="mt-1.5 font-bold text-white-body truncate">{round.title}</p>
      </div>
      <div className="text-right">
        <p className="cr-lbl">guesses</p>
        <p className="cr-timecode">{round.entryCount ?? 0}</p>
      </div>
      {bonuses != null && (
        <div className="text-right">
          <p className="cr-lbl">bonuses</p>
          <p className="cr-big">{bonuses}</p>
        </div>
      )}
    </div>
  );
}

function Winners({ round }) {
  const winners = (round.winners || []).slice(0, 3);
  if (winners.length === 0) return <p className="cr-lbl mt-3">No winners. No eligible entries.</p>;
  return (
    <ol className="mt-3 space-y-1" aria-label="Winners">
      {winners.map((w) => (
        <li key={`${w.place}-${w.twitchId}`} className="flex items-center gap-2 text-sm">
          <Trophy size={11} className="text-orange-admin" aria-hidden="true" />
          <span className="font-mono text-white/45">#{w.place}</span>
          <span className="text-white-body truncate">{w.displayName || w.twitchName}</span>
        </li>
      ))}
    </ol>
  );
}

// The active round (or the newest one) with the same lifecycle controls as
// /admin/hunts. Settling opens SettleModal over the page.
export default function PredictTab() {
  const cr = useControlRoom();
  const [creating, setCreating] = useState(false);
  const round = cr.activeRound || cr.latestRound;
  const isLatest = !!round && round.id === cr.latestRound?.id;

  return (
    <div>
      {round ? (
        <>
          <Summary round={round} />
          <RoundControl key={round.id} round={round} results={isLatest ? cr.results : null} onDeleted={() => {}} />
          {round.status === 'settled' && <Winners round={round} />}
        </>
      ) : (
        <>
          <p className="cr-lbl">prediction</p>
          <p className="cr-timecode is-quiet">IDLE</p>
          <p className="text-sm text-white/55 mt-2">No round running.</p>
        </>
      )}
      {!cr.activeRound && (
        <button type="button" className="cr-btn is-go mt-3 w-full" onClick={() => setCreating(true)}>
          <Plus size={12} aria-hidden="true" />
          New round
        </button>
      )}
      <div className="mt-4 flex justify-end">
        <Link to="/admin/hunts" className="cr-lbl hover:text-white-body">
          Open in admin ↗
        </Link>
      </div>
      {creating && (
        <NewRoundModal
          lastRound={lastRewardsRound(cr.rounds)}
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      )}
    </div>
  );
}
