import BroadcastFrame from '../BroadcastFrame';
import BroadcastHeader from '../BroadcastHeader';
import LeaderTakeover from '../LeaderTakeover';
import PodiumCard from '../PodiumCard';
import RaceBars from '../RaceBars';
import RosterTable from '../RosterTable';
import SponsorBanner from '../SponsorBanner';
import TickerCrawl from '../TickerCrawl';
import StationID from '../StationID';

export default function BroadcastTheme({ data, now }) {
  const [leader, runnerUp, third, ...rest] = data.players;
  // The top 3 always headline the broadcast (leader takeover + 2nd/3rd podium),
  // matching the other themes. The race bars below cover ranks 4+ and the roster
  // table the tail. (Previously this was gated on the leader being >=1.3x the
  // runner-up, which made the top-3 block vanish once the live poll narrowed the
  // gap below that ratio — surprising on theme switch.)
  const racers = rest.slice(0, 7);
  const roster = data.players.slice(10);
  const racerLeader = racers[0];

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

        {leader && (
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
