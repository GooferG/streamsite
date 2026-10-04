import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { prefetchRoute } from '../../routes/loaders';
import { prefersReducedMotion } from '../onAir/useChannelSwitch';
import CameraStatic from './CameraStatic';
import { REST, toCss, zoomTransform } from './cameraMath';

// The site's one camera (spec: The camera). It sits above the per-route
// ErrorBoundary so a move survives the page swap: zoom into a door, cut to
// static, change the page under it, tune in. Only transforms move.
export const TIMINGS = {
  zoom: 650,
  cut: 520,
  staticIn: 120,
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
  const [staticPhase, setStaticPhase] = useState('off');
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

    async function tuneIn() {
      await wait(t.minHold);
      await frames(2);
      const main = document.getElementById('main');
      if (main && typeof main.animate === 'function' && !prefersReducedMotion()) {
        main.animate(SIGNAL_LOCK, { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      }
      setStaticPhase('out');
      await wait(t.tuneOut);
      setStaticPhase('off');
    }

    // Zoom `el` from rest to `zoom`, bring the static up near the end, wait for
    // the page chunk (bounded), then run `go` under the static and tune in.
    async function zoomAndCut(el, zoom, duration, load, go) {
      const zooming = move(el, REST, zoom, duration, EASE_IN);
      await wait(t.cut);
      setStaticPhase('in');
      await Promise.all([zooming, wait(t.staticIn)]);
      await Promise.race([load, wait(t.maxHold)]);
      go();
      await tuneIn();
    }

    return {
      async goThrough({ stage, zoom, href, doorId, state }) {
        if (!start()) return;
        try {
          const load = prefetchRoute(href);
          lastDoor.current = { doorId, path: basePath(href) };
          if (prefersReducedMotion()) {
            await fade(stage, t.fade);
            navigate(href, { state });
            return;
          }
          await zoomAndCut(stage, zoom, t.zoom, load, () => navigate(href, { state }));
        } finally {
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
          await zoomAndCut(stage, zoom, t.zoom, Promise.resolve(), () => navigate(path, { state }));
        } finally {
          finish();
        }
      },

      async pullBack({ stage, zoom, duration, withStatic = true }) {
        if (!start()) return;
        try {
          if (prefersReducedMotion()) {
            setTransform(stage, REST);
            return;
          }
          setTransform(stage, zoom);
          if (withStatic) {
            setStaticPhase('hold');
            await frames(1);
            setStaticPhase('out');
          }
          await move(stage, zoom, REST, duration ?? t.pull, EASE_OUT);
        } finally {
          if (withStatic) setStaticPhase('off');
          finish();
        }
      },

      hold({ stage, zoom }) {
        setTransform(stage, zoom);
      },

      takeReturn() {
        const arrived = seen.current.arrived;
        const door = lastDoor.current;
        if (!door || !arrived || arrived.type !== 'POP') return null;
        if (locationRef.current.pathname !== '/' || arrived.from !== door.path) return null;
        lastDoor.current = null;
        return door.doorId;
      },

      async growFrom({ rect, src, href, doorId, view }) {
        if (!start()) return;
        try {
          const load = prefetchRoute(href);
          lastDoor.current = { doorId, path: basePath(href) };
          if (prefersReducedMotion()) {
            navigate(href);
            return;
          }
          setGhost({ src, rect, transform: '' });
          await frames(1);
          const zoom = zoomTransform(rect, rect, view, { max: 6 });
          await zoomAndCut(ghostRef.current, zoom, t.grow, load, () => {
            navigate(href);
            setGhost(null);
          });
        } finally {
          finish();
        }
      },

      async shrinkInto({ rect, src, view }) {
        if (!start()) return;
        try {
          if (prefersReducedMotion()) return;
          const zoom = zoomTransform(rect, rect, view, { max: 6 });
          setGhost({ src, rect, transform: toCss(zoom) });
          setStaticPhase('hold');
          await frames(1);
          setStaticPhase('out');
          await move(ghostRef.current, zoom, REST, t.pull, EASE_OUT);
        } finally {
          setGhost(null);
          setStaticPhase('off');
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
      <CameraStatic phase={staticPhase} />
    </CameraContext.Provider>
  );
}
