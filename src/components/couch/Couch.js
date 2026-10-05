import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMediaQuery from '../../hooks/useMediaQuery';
import { TIMINGS, useCamera } from '../camera/CameraProvider';
import { viewRect } from '../camera/cameraMath';
import { useNavHeight } from '../nav/navMetrics';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import CouchFront, { ROOM_QUERY } from './CouchFront';
import TvFrame from './TvFrame';
import { ART_ASPECT, LAYOUT } from './couchLayout';
import { buildCouch } from './couchModel';
import { reelItems, reelMode } from './reel';
import { isWatching } from '../../utils/watching';
import useCouchStage from './useCouchStage';

// The couch with its camera (spec: The camera). Must sit inside CameraProvider.
export const FLIP_MS = 400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What the camera aims at: the TV's screen for the TV and the remote.
export const aimFor = (id) => (id === 'tv' || id === 'remote' ? LAYOUT.screens.tv : LAYOUT.doors[id].rect);

const saveData = () => typeof navigator !== 'undefined' && !!(navigator.connection && navigator.connection.saveData);

export default function Couch({ input, noArt = false, introPullBack = false, introDone = true }) {
  const couch = useMemo(() => buildCouch(input), [input]);
  const roomLayout = useMediaQuery(ROOM_QUERY);
  const navH = useNavHeight();
  const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal, navH);
  const camera = useCamera();
  const navigate = useNavigate();
  const location = useLocation();
  const [flipTo, setFlipTo] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const mode = reelMode({ reducedMotion: prefersReducedMotion(), saveData: saveData(), autoplayBlocked: blocked });
  const items = useMemo(
    () => reelItems({ reel: input.reel, clips: input.clips, videos: input.videos, cards: couch.tv.cards }),
    [input.reel, input.clips, input.videos, couch.tv.cards]
  );
  const live = couch.tv.state === 'live';
  const watching = isWatching(location, live);
  const inRoom = roomLayout && !noArt;

  const onDoor = useCallback(
    async (door, el) => {
      const stageEl = stage.stageRef.current;
      if (door.id === 'tv' && live) {
        if (inRoom && stageEl) await camera.enterInPlace({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')), state: { watch: true } });
        else navigate(location.pathname, { state: { watch: true } });
        return;
      }
      if (!inRoom || !stageEl) {
        const art = el.querySelector('img[data-door-art]');
        const cutout = LAYOUT.doors[door.id] && LAYOUT.doors[door.id].cutout;
        const src = art && cutout ? art.currentSrc || art.src : null;
        await camera.growFrom({ rect: (src ? art : el).getBoundingClientRect(), src, href: door.href, doorId: door.id, cut: door.cut, view: viewRect(window, navH) });
        return;
      }
      // Reduced motion has no static and no zoom, so no flip either.
      if (door.id === 'remote' && !prefersReducedMotion()) {
        setFlipTo('gsn');
        await wait(FLIP_MS);
        // Gone while the TV flipped: nothing left to zoom.
        if (!stageEl.isConnected) return;
      }
      await camera.goThrough({ stage: stageEl, zoom: stage.zoomFor(aimFor(door.id)), href: door.href, doorId: door.id, cut: door.cut });
    },
    [camera, inRoom, live, location.pathname, navigate, stage, navH]
  );

  // On mount: start inside the TV for the intro, or pull back from the door we
  // came back through. Layout effect, so the zoomed frame is what paints first.
  useLayoutEffect(() => {
    const stageEl = stage.stageRef.current;
    if (introPullBack && !introDone) {
      if (inRoom && stageEl) camera.hold({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')) });
      return;
    }
    const back = camera.takeReturn();
    if (!back) return;
    const { doorId, cut } = back;
    if (inRoom && stageEl) {
      camera.pullBack({ stage: stageEl, zoom: stage.zoomFor(aimFor(doorId)), cut });
      return;
    }
    const tile = document.querySelector(`[data-door="${doorId}"]`);
    if (!tile) return;
    const art = tile.querySelector('img[data-door-art]');
    const cutout = LAYOUT.doors[doorId] && LAYOUT.doors[doorId].cutout;
    const src = art && cutout ? art.currentSrc || art.src : null;
    camera.shrinkInto({ rect: (src ? art : tile).getBoundingClientRect(), src, view: viewRect(window, navH), cut });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The intro: once the power-on finishes, pull back from the TV.
  const introPending = useRef(introPullBack && !introDone);
  useEffect(() => {
    if (!introPending.current || !introDone) return;
    introPending.current = false;
    const stageEl = stage.stageRef.current;
    if (inRoom && stageEl) camera.pullBack({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')), duration: TIMINGS.introPull, cut: null });
  }, [introDone, inRoom, camera, stage]);

  // Leaving "inside the TV" (Back, Esc, the button, or the stream ending).
  // If the camera is still tuning in from entering, the pull-back waits for it
  // (the context value changes when busy flips, which re-runs this effect).
  const wasWatching = useRef(watching);
  const pendingPull = useRef(false);
  useEffect(() => {
    if (wasWatching.current && !watching) pendingPull.current = true;
    wasWatching.current = watching;
    if (!pendingPull.current || camera.busy) return;
    pendingPull.current = false;
    const stageEl = stage.stageRef.current;
    if (inRoom && stageEl) camera.pullBack({ stage: stageEl, zoom: stage.zoomFor(aimFor('tv')) });
  }, [watching, inRoom, camera, stage]);

  // The stream ended while its flag is in history: drop the flag, so a
  // reconnect does not reopen the frame and Back is not a dead press.
  const stale = !live && !!(location.state && location.state.watch);
  useEffect(() => {
    if (stale) navigate(location.pathname, { replace: true, state: null });
  }, [stale, location.pathname, navigate]);

  const exitWatch = useCallback(() => {
    if (location.key === 'default') navigate(location.pathname, { replace: true, state: null });
    else navigate(-1);
  }, [location.key, location.pathname, navigate]);

  return (
    <>
      <CouchFront
        now={input.now}
        couch={couch}
        items={items}
        mode={mode}
        flipTo={flipTo}
        onDoor={onDoor}
        onAutoplayBlocked={() => setBlocked(true)}
        stage={stage}
        roomLayout={roomLayout}
        noArt={noArt}
      />
      {watching && <TvFrame onExit={exitWatch} navH={navH} />}
    </>
  );
}
