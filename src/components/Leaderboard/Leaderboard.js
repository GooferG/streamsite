import { useEffect, useState } from 'react';
import { useLeaderboardData } from '../../hooks/useLeaderboardData';
import BroadcastFrame from './BroadcastFrame';
import BroadcastHeader from './BroadcastHeader';
import LeaderTakeover from './LeaderTakeover';
import RaceBars from './RaceBars';
import RosterTable from './RosterTable';
import TickerCrawl from './TickerCrawl';
import StationID from './StationID';

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
  const [leader, runnerUp, ...rest] = data.players;
  const racers = [runnerUp, ...rest.slice(0, 3)].filter(Boolean); // P02..P05
  const roster = data.players.slice(5); // P06..P20

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
      <LeaderTakeover leader={leader} runnerUp={runnerUp} />
      <RaceBars players={racers} leaderWagered={leader ? leader.wagered : 0} />
      <RosterTable players={roster} />
      <TickerCrawl />
      <StationID />
    </BroadcastFrame>
  );
}
