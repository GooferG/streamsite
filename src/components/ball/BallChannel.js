import { useEffect, useState } from 'react';
import BallFront from './BallFront';
import useBallData from '../../hooks/useBallData';
import { usePrefersReducedMotion } from '../../hooks/useClock';
import { spoilerSafe } from '../../utils/ball';

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba/ball?fixture=open|rack|closed|settled|offair|empty|loading.
  // Webpack drops this branch, and the fixtures with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    return key ? require('./ballFixtures').frontFixture(key, Date.now()) : null;
  };
}

// Looks again at the next held-back reveal (draw or settle), so the page
// shows each one when its chat line is due and not before.
function useRevealClock(data) {
  const [now, setNow] = useState(() => Date.now());
  const { nextAt } = spoilerSafe({ round: data.round, balls: data.balls, past: data.past }, now);
  useEffect(() => {
    if (nextAt == null) return undefined;
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, nextAt - Date.now()) + 25);
    return () => clearTimeout(id);
  }, [nextAt]);
  return now;
}

function LiveChannel() {
  const data = useBallData();
  const still = usePrefersReducedMotion();
  const now = useRevealClock(data);
  return <BallFront {...data} onLoadMore={data.loadMore} still={still} now={now} />;
}

// CH 42 in the Gamba tuner.
export default function BallChannel() {
  const [fixture] = useState(readFixture);
  return fixture ? <BallFront {...fixture} onLoadMore={() => {}} /> : <LiveChannel />;
}
