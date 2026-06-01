import BroadcastFrame from '../BroadcastFrame';
import BroadcastHeader from '../BroadcastHeader';
import LeaderTakeover from '../LeaderTakeover';
import PodiumCard from '../PodiumCard';
import RaceBars from '../RaceBars';
import RosterTable from '../RosterTable';
import SponsorBanner from '../SponsorBanner';
import TickerCrawl from '../TickerCrawl';
import StationID from '../StationID';

const TAKEOVER_THRESHOLD = 1.3;

export default function BroadcastTheme({ data, now }) {
  const [leader, runnerUp, third, ...rest] = data.players;
  const showTakeover =
    leader && runnerUp && leader.wagered >= runnerUp.wagered * TAKEOVER_THRESHOLD;
  const racers = showTakeover
    ? rest.slice(0, 7)
    : [leader, runnerUp, third, ...rest].filter(Boolean).slice(0, 7);
  const roster = showTakeover ? data.players.slice(10) : data.players.slice(7);
  const racerLeader = showTakeover ? racers[0] : leader;

  return (
    <div data-theme="broadcast">
      <BroadcastFrame>
        <BroadcastHeader
          weekLabel={data.weekLabel}
          periodLabel={data.periodLabel}
          prizePool={data.prizePool}
          endsAt={data.endsAt}
          lastUpdatedAt={data.lastUpdatedAt}
          now={now}
        />

        {showTakeover && (
          <div className="px-4 sm:px-6 py-6 border-b border-white/8">
            <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr] gap-4 lg:gap-5">
              <LeaderTakeover leader={leader} runnerUp={runnerUp} />
              <div className="grid grid-cols-1 gap-4 lg:gap-5">
                <PodiumCard player={runnerUp} tier="runnerUp" />
                <PodiumCard player={third} tier="third" />
              </div>
            </div>
          </div>
        )}

        <SponsorBanner />

        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
          <span className="w-16 sm:w-20" aria-hidden="true" />
          <span aria-hidden="true" />
          <span className="text-right">WAGERED</span>
          <span className="text-right w-20 sm:w-24">PRIZE</span>
        </div>

        <RaceBars
          players={racers}
          leaderWagered={racerLeader ? racerLeader.wagered : 0}
        />
        <RosterTable
          players={roster}
          leaderWagered={racerLeader ? racerLeader.wagered : 0}
        />
        <TickerCrawl />
        <StationID />
      </BroadcastFrame>
    </div>
  );
}
