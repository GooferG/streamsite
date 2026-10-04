import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import HuntsPage from './HuntsPage';
import Leaderboard from '../components/Leaderboard';
import GambaGuide from '../components/gamba/GambaGuide';
import GambaTuner from '../components/gamba/GambaTuner';
import { MONO } from '../components/onAir/classes';
import { channelForPath } from '../data/gambaTools';
import useTuningPhrase, { TUNING_PHRASES } from '../hooks/useTuningPhrase';

// Code-split the heavier tools so they only download when opened. The slot
// catalogue itself is fetched from /api/slots on first use (useSlotCatalog).
const SlotPicker = lazy(() => import('../components/SlotPicker'));
const BonusBattle = lazy(() => import('../components/BonusBattle'));

// While a tool chunk loads: its own label, then the broadcast tuning phrases.
function ToolLoading({ label }) {
  const phrase = useTuningPhrase(true, [label, ...TUNING_PHRASES]);
  return (
    <div className="px-4 py-16 text-center">
      <p className={`${MONO} text-[0.625rem] font-bold tracking-[0.25em] text-onair-ink-4 motion-safe:animate-pulse`}>{phrase}</p>
    </div>
  );
}

// /gamba/*: the tuner, then the hub (no tool id) or the tool. An unknown tool
// id goes back to the hub.
export default function GambaPage() {
  const { pathname } = useLocation();
  const toolId = pathname.split('/')[2] || null;
  const channel = channelForPath(pathname);
  if (toolId && !channel) return <Navigate to="/gamba" replace />;

  return (
    <div className="px-4 pb-16 pt-20 sm:px-6">
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px]">
        <GambaTuner current={channel} />
        <div className="mt-4">
          {!toolId && <GambaGuide />}
          {toolId === 'leaderboard' && <Leaderboard />}
          {toolId === 'hunts' && <HuntsPage />}
          {toolId === 'bonus-battle' && (
            <Suspense fallback={<ToolLoading label="Loading bonus battle…" />}>
              <BonusBattle />
            </Suspense>
          )}
          {toolId === 'wheel' && (
            <Suspense fallback={<ToolLoading label="Tuning slot signal…" />}>
              <SlotPicker />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
