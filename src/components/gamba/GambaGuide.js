import { useState } from 'react';
import FeaturedMonitor from './FeaturedMonitor';
import GuideListings from './GuideListings';
import useGuideData from './useGuideData';
import useNow from '../hunts/useNow';
import { MONO } from '../onAir/classes';
import { formatResets, guideRows, huntFeature, pickFeatured } from './guide';

// /gamba: the guide channel (CH 00). The featured monitor, then tonight's
// listings. Hunts takes the monitor while it is on air (spec Part 4).
export function GuideView({ data, now }) {
  const featured = pickFeatured(data);
  const feature = featured === 'hunts' ? huntFeature(data) : null;
  const resets = formatResets(data.countdown);
  const rows = guideRows({ featured, feature, hunts: data.hunts, leaderboard: data.leaderboard, resets, roundError: data.roundError });
  const ready = !data.hunts.loading && data.round !== undefined && !data.leaderboard.isLoading;
  return (
    <div className="font-onair">
      <FeaturedMonitor featured={featured} feature={feature} leaderboard={data.leaderboard} resets={resets} now={now} ready={ready} />
      <section aria-labelledby="gamba-whats-on" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <h2 id="gamba-whats-on" className="text-2xl font-extrabold text-onair-ink-1">
            What's on
          </h2>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Tonight's listings</span>
        </div>
        <GuideListings rows={rows} />
      </section>
    </div>
  );
}

function LiveGuide() {
  const data = useGuideData();
  const now = useNow(30 * 1000);
  return <GuideView data={data} now={now} />;
}

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba?fixture=live|prehunt|offair|noleaderboard renders the hub
  // from fixtures. Webpack drops this branch, and the module with it, from
  // production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('./guideFixtures').GUIDE_FIXTURES[key] || null;
  };
}

export default function GambaGuide() {
  const [fixture] = useState(readFixture);
  return fixture ? <GuideView data={fixture} now={fixture.now} /> : <LiveGuide />;
}
