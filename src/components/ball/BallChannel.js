import { useState } from 'react';
import BallFront from './BallFront';
import useBallData from '../../hooks/useBallData';
import { usePrefersReducedMotion } from '../../hooks/useClock';
import useRevealClock from '../../hooks/useRevealClock';

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba/ball?fixture=open|rack|closed|settled|offair|empty|loading.
  // Webpack drops this branch, and the fixtures with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    return key ? require('./ballFixtures').frontFixture(key, Date.now()) : null;
  };
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
