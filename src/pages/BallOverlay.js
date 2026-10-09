import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useClock } from '../hooks/useClock';
import useOverlaySound from '../hooks/useOverlaySound';
import useBallRound from '../hooks/useBallRound';
import useBallsFeed from '../hooks/useBallsFeed';
import useBallHunt from '../hooks/useBallHunt';
import useBallArrivals from '../hooks/useBallArrivals';
import useBroadcastSettings from '../hooks/useBroadcastSettings';
import { useToasts } from '../components/ball/toastQueue';
import CornerBox from '../components/ball/CornerBox';
import RackBoard from '../components/ball/RackBoard';
import DrawTakeover from '../components/ball/DrawTakeover';
import WinnerCard from '../components/ball/WinnerCard';
import { demoFeed } from '../components/ball/ballDemo';
import { drawMoment, drumBalls, hasResults, isActive, liveRows, winnerMoment } from '../utils/ball';

// OBS browser source for Goofer Ball (spec: OBS overlay). Transparent; it
// follows Firestore, so staff run the round from the control room.
//
// Query params:
//   pos=bl|br|tl|tr   corner for the box and the live rack (default bl)
//   sound=1           blower, tube and landing sounds (OBS audio)
//   demo=1            loop a fake round, for placing it in OBS
//   fixture=open|draw|rack|winner   dev only

const POSITION = {
  bl: 'left-8 bottom-8',
  br: 'right-8 bottom-8',
  tl: 'left-8 top-8',
  tr: 'right-8 top-8',
};

let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Webpack drops this branch, and the fixtures with it, from production builds.
  readFixture = (key, now) => (key ? require('../components/ball/ballFixtures').overlayFixture(key, now) : null);
}

function useLiveBall(enabled) {
  const { round } = useBallRound({ enabled });
  const active = enabled && isActive(round);
  const { balls, ready } = useBallsFeed(round ? round.id : null, { enabled: active });
  const { hunt, stale } = useBallHunt(round ? round.huntId : null, { enabled: active });
  return { round: round || null, balls, ready, hunt, stale };
}

function useDemo(enabled) {
  const startedAt = useRef(Date.now());
  const now = useClock({ intervalMs: 250, active: enabled });
  return useMemo(() => (enabled ? demoFeed(now - startedAt.current, startedAt.current) : null), [enabled, now]);
}

export default function BallOverlay() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const demo = params.get('demo') === '1';
  const [fixture] = useState(() => readFixture(params.get('fixture'), Date.now()));
  const position = POSITION[params.get('pos')] || POSITION.bl;
  const sound = useOverlaySound(params.get('sound') === '1');

  const liveEnabled = !demo && !fixture;
  const live = useLiveBall(liveEnabled);
  const demoData = useDemo(demo);
  const data = fixture || demoData || live;
  const { reveals } = useBroadcastSettings(liveEnabled);
  const { toast, push } = useToasts();
  useBallArrivals(data.balls, data.ready, push);

  // The browser source must be see-through (same as the giveaway overlay).
  useEffect(() => {
    const prev = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      [document.documentElement.style.background, document.body.style.background] = prev;
    };
  }, []);

  const round = data.round;
  const probe = drawMoment(round, Date.now()) || winnerMoment(round, Date.now());
  const now = useClock({ fast: !!probe, active: !!probe });
  const moment = drawMoment(round, now) || winnerMoment(round, now);
  // Stage mode: a staff browser plays the full-screen moments; OBS keeps
  // only the corner cards, so nothing plays twice.
  const fullScreen = reveals !== 'stage';

  let body = null;
  if (moment && fullScreen && moment.kind === 'draw') {
    const drum = drumBalls(data.balls);
    body = (
      <DrawTakeover
        entry={moment.entry}
        rack={round.rack || []}
        balls={drum}
        left={data.ready ? drum.length : null}
        elapsed={now - moment.at}
        sound={sound}
      />
    );
  } else if (moment && fullScreen && moment.kind === 'winner') {
    body = <WinnerCard round={round} />;
  } else if (isActive(round)) {
    const rows = liveRows(round, data.hunt);
    body =
      round.huntId && hasResults(rows) ? (
        <RackBoard round={round} rows={rows} stale={data.stale} position={position} />
      ) : (
        <CornerBox round={round} balls={data.balls} toast={toast} position={position} ready={data.ready} />
      );
  }

  return <div className="pointer-events-none fixed inset-0 overflow-hidden font-onair text-onair-ink-1">{body}</div>;
}
