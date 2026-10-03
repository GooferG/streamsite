import Panel from '../onAir/Panel';
import { MONO } from '../onAir/classes';
import { placeLabel } from '../../utils/predictionRewards';
import { entryName } from './huntBoard';
import { winnerPrizeText } from './huntStats';
import ViewerAvatar from './ViewerAvatar';

// Settled rounds: everyone who placed after the winner, with what they won.
export default function RunnerUpCard({ winners }) {
  const rest = (winners || []).filter((w) => w && w.place >= 2).sort((a, b) => a.place - b.place);
  if (!rest.length) return null;
  return (
    <Panel as="section" aria-label="Runners-up" className="flex flex-col gap-3 px-5 py-[18px]">
      {rest.map((w) => {
        const name = entryName(w);
        const prize = winnerPrizeText(w.prize);
        return (
          <div key={`${w.place}-${w.twitchId}`} className="flex items-center gap-3.5">
            <ViewerAvatar
              src={w.profileImageUrl}
              name={name}
              className="h-11 w-11 bg-gradient-to-br from-onair-ink-3 to-onair-ink-6 text-onair-surface-1"
            />
            <div className="min-w-0 flex-1">
              <p className={`${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-5`}>
                {w.place === 2 ? 'Runner-up' : `${placeLabel(w.place)} place`}
              </p>
              <p className="truncate text-[1.0625rem] font-extrabold">{name}</p>
            </div>
            {prize && <p className="text-sm font-bold text-onair-ink-3">{prize}</p>}
          </div>
        );
      })}
    </Panel>
  );
}
