import { useEffect, useState } from 'react';
import { getGameCovers } from '../utils/igdbApi';
import { useSchedule } from '../hooks/useSchedule';
import ScheduleFront from '../components/schedule/ScheduleFront';

// /schedule: the programming guide. Wires the live schedule into ScheduleFront.
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /schedule?fixture=upcoming|cover|late|live|livelong|liveoffday|aired|tba|dark|loading
  // renders the guide from scheduleFixtures. Webpack drops this branch, and the
  // fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/schedule/scheduleFixtures').SCHEDULE_FIXTURES[key] || null;
  };
}

// IGDB covers keyed by gameName, for the days that are on. Slots shows have
// none; the monitor falls back to its ident.
function useCovers(schedule, loading) {
  const [covers, setCovers] = useState({});
  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const names = schedule.filter((e) => e.status !== 'off' && e.gameName).map((e) => e.gameName);
    if (names.length) {
      getGameCovers(names)
        .then((found) => {
          if (!cancelled) setCovers(found);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [schedule, loading]);
  return covers;
}

function LiveSchedule({ isLive, stream }) {
  // On a failed read useSchedule serves the SCHEDULE constant; say so.
  const { schedule, loading, error } = useSchedule();
  const covers = useCovers(schedule, loading);
  return (
    <ScheduleFront
      schedule={schedule}
      loading={loading}
      stale={!!error}
      covers={covers}
      isLive={isLive}
      stream={stream}
    />
  );
}

export default function SchedulePage({ isLive = false, stream = null }) {
  const [fixture] = useState(readFixture);
  return (
    <div className="relative min-h-screen px-4 pb-20 pt-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {fixture ? <ScheduleFront {...fixture} /> : <LiveSchedule isLive={isLive} stream={stream} />}
      </div>
    </div>
  );
}
