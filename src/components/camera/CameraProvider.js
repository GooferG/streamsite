import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { prefetchRoute } from '../../routes/loaders';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import CameraIris from './CameraIris';
import CameraStatic from './CameraStatic';
import { REST, irisCircle, toCss, viewRect, zoomTransform } from './cameraMath';

// The site's one camera (spec: The camera). It sits above the per-route
// ErrorBoundary so a move survives the page swap: zoom into a door, cut,
// change the page under the cut, show it. Only transforms move. The cut is
// the door's (Ruling R23): 'static' for screens (the page tunes in), 'iris'
// for things (a black iris closes on the object, the page fades up).
export const TIMINGS = {
  zoom: 650,
  cut: 520,
  staticIn: 120,
  iris: 520,
  minHold: 250,
  maxHold: 1500,
  tuneOut: 300,
  pull: 700,
  introPull: 1100,
  fade: 150,
  grow: 650,
};
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';
const EASE_OUT = 'cubic-bezier(0.25, 1, 0.5, 1)';
// The iris starts closing at 60% of the move: the ease-in zoom lands at about
// four times its average speed, a landing the static (at the cut mark) hides
// and an iris starting later would leave in the open.
const IRIS_AT = 0.6;
// Mirrors tailwind's signal-lock keyframes: the page settling as it tunes in.
const SIGNAL_LOCK = [
  { transform: 'translateY(-14px)' },
  { transform: 'translateY(6px)', offset: 0.3 },
  { transform: 'translateY(-2px)', offset: 0.55 },
  { transform: 'translateY(0)' },
];

const CameraContext = createContext(null);
export const useCamera = () => useContext(CameraContext);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raf = (cb) =>
  typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(cb) : setTimeout(cb, 16);
const frames = (n) => new Promise((resolve) => (n <= 0 ? resolve() : raf(() => frames(n - 1).then(resolve))));
const basePath = (href) => href.split(/[?#]/)[0];

function setTransform(el, zoom) {
  if (el) el.style.transform = zoom === REST ? '' : toCss(zoom);
}

// One transform tween, committed as an inline style when it ends.
function move(el, from, to, duration, easing) {
  if (!el) return Promise.resolve();
  if (!duration || typeof el.animate !== 'function') {
    setTransform(el, to);
    return Promise.resolve();
  }
  const anim = el.animate([{ transform: toCss(from) }, { transform: toCss(to) }], { duration, easing, fill: 'forwards' });
  return anim.finished.then(
    () => {
      setTransform(el, to);
      anim.cancel();
    },
    () => setTransform(el, to)
  );
}

function fade(el, duration) {
  if (!el || !duration || typeof el.animate !== 'function') return Promise.resolve();
  return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }).finished.catch(() => {});
}

export default function CameraProvider({ children, timings = TIMINGS }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  // The cut on screen: { cut: 'static' | 'iris', phase, at, duration } or null.
  const [cover, setCover] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const ghostRef = useRef(null);
  const lastDoor = useRef(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  // How we arrived at the current entry, recorded once per location key during
  // render so a page's mount effect (which runs before ours) can read it.
  const seen = useRef({ key: location.key, path: location.pathname, arrived: null });
  if (seen.current.key !== location.key) {
    seen.current = { key: location.key, path: location.pathname, arrived: { from: seen.current.path, type: navType } };
  }

  const api = useMemo(() => {
    const t = timings;
    const start = () => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      return true;
    };
    const finish = () => {
      busyRef.current = false;
      setBusy(false);
    };

    // One move's cut: show(phase, duration) puts it on screen. The iris centres
    // on the view the caller zoomed into (the whole window if it names none).
    function coverFor(cut, view) {
      const at = cut === 'iris' ? irisCircle(view || viewRect(window, 0), window) : null;
      return (phase, duration) => setCover({ cut, phase, at, duration });
    }

    // The new page appears once the hold is over: the static tunes out as the
    // page settles like a picture locking on, or the black fades off it.
    async function reveal(show, cut) {
      await wait(t.minHold);
      await frames(2);
      const main = document.getElementById('main');
      if (cut === 'static' && main && typeof main.animate === 'function' && !prefersReducedMotion()) {
        main.animate(SIGNAL_LOCK, { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      }
      show('out');
      await wait(t.tuneOut);
      setCover(null);
    }

    // Zoom `el` from rest to `zoom` and bring the cut up over the end of it
    // (the static fades in at the cut mark, the iris closes on the object from
    // IRIS_AT of the move), wait for the page chunk (bounded), then run `go`
    // under the cut and show the page.
    // If the viewer navigates elsewhere meanwhile (the nav stays usable under
    // the cut), the move is dropped: no `go`, no stale door; `skipped` cleans up.
    async function zoomAndCut({ el, zoom, duration, load, go, skipped, cut, view }) {
      const key = locationRef.current.key;
      const show = coverFor(cut, view);
      const zooming = move(el, REST, zoom, duration, EASE_IN);
      await wait(cut === 'iris' ? Math.round(duration * IRIS_AT) : t.cut);
      const coming = cut === 'iris' ? t.iris : t.staticIn;
      show('in', coming);
      await Promise.all([zooming, wait(coming)]);
      show('hold');
      await Promise.race([load, wait(t.maxHold)]);
      if (locationRef.current.key === key) {
        go();
      } else {
        lastDoor.current = null;
        if (skipped) skipped();
      }
      await reveal(show, cut);
    }

    // Back: the cut starts up over the object, then gives way as `pull` runs.
    // The static fades as the pull starts; the iris opens on the object and
    // the pull starts halfway through. No cut (the intro): just the pull.
    async function uncover(cut, view, pull) {
      if (cut) {
        const show = coverFor(cut, view);
        show('hold');
        await frames(1);
        if (cut === 'iris') {
          show('open', t.tuneOut);
          await wait(t.tuneOut / 2);
        } else {
          show('out');
        }
      }
      await pull();
    }

    return {
      // `view` is the rect `zoom` fills; the iris centres on it.
      async goThrough({ stage, zoom, href, doorId, state, cut = 'static', view }) {
        if (!start()) return;
        try {
          const load = prefetchRoute(href);
          lastDoor.current = { doorId, path: basePath(href), cut };
          if (prefersReducedMotion()) {
            await fade(stage, t.fade);
            navigate(href, { state });
            return;
          }
          await zoomAndCut({ el: stage, zoom, duration: t.zoom, load, go: () => navigate(href, { state }), cut, view });
        } finally {
          setCover(null);
          finish();
        }
      },

      async enterInPlace({ stage, zoom, state }) {
        if (!start()) return;
        try {
          const path = locationRef.current.pathname;
          if (prefersReducedMotion()) {
            navigate(path, { state });
            return;
          }
          await zoomAndCut({ el: stage, zoom, duration: t.zoom, load: Promise.resolve(), go: () => navigate(path, { state }), cut: 'static' });
        } finally {
          setCover(null);
          finish();
        }
      },

      // `cut` is the door's ('static' | 'iris'), or null for a bare pull (the
      // intro); `view` is the rect `zoom` fills, where the iris centres.
      async pullBack({ stage, zoom, duration, cut = 'static', view }) {
        if (!start()) return;
        try {
          if (prefersReducedMotion()) {
            setTransform(stage, REST);
            return;
          }
          setTransform(stage, zoom);
          await uncover(cut, view, () => move(stage, zoom, REST, duration ?? t.pull, EASE_OUT));
        } finally {
          setCover(null);
          finish();
        }
      },

      hold({ stage, zoom }) {
        setTransform(stage, zoom);
      },

      // The door Back came through, once: { doorId, cut } or null.
      takeReturn() {
        const arrived = seen.current.arrived;
        const door = lastDoor.current;
        if (!door || !arrived || arrived.type !== 'POP') return null;
        if (locationRef.current.pathname !== '/' || arrived.from !== door.path) return null;
        lastDoor.current = null;
        return { doorId: door.doorId, cut: door.cut };
      },

      async growFrom({ rect, src, href, doorId, view, cut = 'static' }) {
        if (!start()) return;
        try {
          const load = prefetchRoute(href);
          lastDoor.current = { doorId, path: basePath(href), cut };
          if (prefersReducedMotion()) {
            navigate(href);
            return;
          }
          setGhost({ src, rect, transform: '' });
          await frames(1);
          const zoom = zoomTransform(rect, rect, view, { max: 6 });
          await zoomAndCut({
            el: ghostRef.current,
            zoom,
            duration: t.grow,
            load,
            go: () => {
              navigate(href);
              setGhost(null);
            },
            skipped: () => setGhost(null),
            cut,
            view,
          });
        } finally {
          setGhost(null);
          setCover(null);
          finish();
        }
      },

      async shrinkInto({ rect, src, view, cut = 'static' }) {
        if (!start()) return;
        try {
          if (prefersReducedMotion()) return;
          const zoom = zoomTransform(rect, rect, view, { max: 6 });
          setGhost({ src, rect, transform: toCss(zoom) });
          await uncover(cut, view, () => move(ghostRef.current, zoom, REST, t.pull, EASE_OUT));
        } finally {
          setGhost(null);
          setCover(null);
          finish();
        }
      },
    };
  }, [navigate, timings]);

  const value = useMemo(() => ({ ...api, busy }), [api, busy]);
  const ghostStyle = ghost && {
    left: ghost.rect.x,
    top: ghost.rect.y,
    width: ghost.rect.width,
    height: ghost.rect.height,
    transform: ghost.transform || undefined,
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
      {ghost &&
        (ghost.src ? (
          <img
            ref={ghostRef}
            src={ghost.src}
            alt=""
            aria-hidden="true"
            data-testid="camera-ghost"
            className="pointer-events-none fixed z-[38] origin-top-left object-contain"
            style={ghostStyle}
          />
        ) : (
          <div
            ref={ghostRef}
            aria-hidden="true"
            data-testid="camera-ghost"
            className="pointer-events-none fixed z-[38] origin-top-left rounded-onair-card bg-onair-surface-4"
            style={ghostStyle}
          />
        ))}
      <CameraStatic phase={cover && cover.cut === 'static' ? cover.phase : 'off'} />
      <CameraIris iris={cover && cover.cut === 'iris' ? cover : null} />
    </CameraContext.Provider>
  );
}
