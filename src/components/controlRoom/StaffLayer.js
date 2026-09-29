import { lazy, Suspense } from 'react';
import LiveIndicator from '../LiveIndicator';
import ErrorBoundary from '../ErrorBoundary';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import CrashPill from './CrashPill';
import { panelAllowed } from './selectors';

// Staff-only control room; viewers never download it.
const ControlRoom = lazy(() => import('./ControlRoom'));
const StageMoment = lazy(() => import('./StageMoment'));

// The only part of the shell that reads the control room context, so a live
// snapshot (every new entry) re-renders this layer, not the routed page.
// Viewers still get the LIVE badge here.
export default function StaffLayer({ isLive, streamData, pathname }) {
  const cr = useControlRoom();
  const showPanel = !!cr?.enabled && panelAllowed(pathname);

  return (
    <>
      <LiveIndicator
        isLive={isLive}
        streamData={streamData}
        hidden={!!cr?.enabled && cr.prefs.hideLiveBadge}
      />

      {showPanel && (
        <ErrorBoundary fallback={(reset) => <CrashPill onReopen={reset} />}>
          <Suspense fallback={null}>
            <ControlRoom isLive={isLive} />
          </Suspense>
        </ErrorBoundary>
      )}

      {showPanel && cr.prefs.stage && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <StageMoment />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
