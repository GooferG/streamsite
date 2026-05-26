import { useEffect, useState } from 'react';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import BroadcastFrame from './BroadcastFrame';
import BroadcastHeader from './BroadcastHeader';
import LeaderTakeover from './LeaderTakeover';
import PodiumCard from './PodiumCard';
import RaceBars from './RaceBars';
import RosterTable from './RosterTable';
import SponsorBanner from './SponsorBanner';
import TickerCrawl from './TickerCrawl';
import StationID from './StationID';

const TAKEOVER_THRESHOLD = 1.3;

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Leaderboard() {
  const data = useLeaderboardData();
  const now = useNow();
  const [leader, runnerUp, third, ...rest] = data.players;
  const showTakeover =
    leader && runnerUp && leader.wagered >= runnerUp.wagered * TAKEOVER_THRESHOLD;
  const racers = showTakeover
    ? rest.slice(0, 7)
    : [leader, runnerUp, third, ...rest].filter(Boolean).slice(0, 7);
  const roster = showTakeover ? data.players.slice(10) : data.players.slice(7);
  const racerLeader = showTakeover ? racers[0] : leader;

  return (
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

      <RaceBars
        players={racers}
        leaderWagered={racerLeader ? racerLeader.wagered : 0}
      />
      <RosterTable players={roster} />
      <TickerCrawl />
      <StationID />
    </BroadcastFrame>
  );
}
