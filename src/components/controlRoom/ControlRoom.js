import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { pickKey } from '../../utils/giveaway';
import { isOpenMode } from './storage';
import {
  DOCK_W,
  NAV_H,
  PANEL_W,
  clampRect,
  defaultRect,
  inDockZone,
  nearestCorner,
  originFor,
  pillAnchor,
  shouldUndock,
  snapToCorner,
} from './geometry';
import { MOTION, flipFrom, prefersReducedMotion } from './motion';
import { tabLeds, tallies } from './panelStatus';
import { useMediaQuery } from './useMediaQuery';
import PanelChrome from './PanelChrome';
import Pill from './Pill';
import WarningStrip from './WarningStrip';
import GiveawayTab from './GiveawayTab';
import PredictTab from './PredictTab';
import RedeemTab from './RedeemTab';
import './controlRoom.css';

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const isTypingTarget = (el) => !!el && (TYPING_TAGS.includes(el.tagName) || el.isContentEditable);
// A modal, or an inline draft that marks itself keep-open, owns the keys:
// powering the panel off would unmount it mid-flow.
const modalOpen = () => !!document.querySelector('[aria-modal="true"], [data-cr-keep-open]');
// pt-BR and US-International layouts report the backtick as a dead key.
const isBacktick = (e) => e.key === '`' || (e.key === 'Dead' && e.code === 'Backquote');
// Clamping only needs the float width (always PANEL_W); a drag measures the
// panel itself for snapping.
const FALLBACK_SIZE = { w: PANEL_W, h: 420 };

function statusMessage(g) {
  if (!g) return '';
  if (g.status === 'open') return `Giveaway open: ${g.prize || ''}`;
  if (g.status === 'closed') return 'Giveaway entries closed';
  if (g.status === 'rolling') return `Winner picked: ${(g.winner && (g.winner.displayName || g.winner.twitchName)) || 'someone'}`;
  if (g.status === 'playing') return 'Bonus on stream';
  return '';
}

function useViewport() {
  const [view, setView] = useState(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setView({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return view;
}

// The floating / docked control room. Positioned with left/top (never a
// resting transform) so SettleModal and friends can still be position: fixed.
export default function ControlRoom({ isLive = false }) {
  const cr = useControlRoom();
  const { panel, panelActions } = cr;
  const narrow = useMediaQuery('(max-width: 767px)');
  const view = useViewport();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const flipRectRef = useRef(null);
  const prevMode = useRef(panel.mode);
  const [anim, setAnim] = useState(null); // 'on' | 'off' | null
  const [flipping, setFlipping] = useState(false);
  const [dragRect, setDragRect] = useState(null);
  const [ghost, setGhost] = useState(false);
  const [dragging, setDragging] = useState(false);
  const docked = panel.mode === 'dock' && !narrow;
  const reduced = prefersReducedMotion();

  // A drag can be interrupted mid-gesture (Escape/backtick minimize, auto-
  // restore, a narrow-mode flip that drops the pointer handlers, or a lost
  // native pointer capture) without ever firing pointerup/pointercancel. Any
  // of those must fully clear drag state, or the panel is left with a frozen
  // position and a resting `.cr-lifted` transform.
  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setDragRect(null);
    setGhost(false);
    setDragging(false);
  }, []);

  // Power on when opening from the pill/closed; FLIP between float and dock.
  useLayoutEffect(() => {
    const was = prevMode.current;
    prevMode.current = panel.mode;
    if (isOpenMode(panel.mode) && !isOpenMode(was)) {
      setAnim('on');
      const active = document.activeElement;
      if (!active || active === document.body || active.closest?.('[data-control-room-button]')) {
        document.getElementById(`cr-tab-${panel.tab}`)?.focus({ preventScroll: true });
      }
    } else if (isOpenMode(panel.mode) && isOpenMode(was) && was !== panel.mode) {
      flipFrom(rootRef.current, flipRectRef.current);
    }
    flipRectRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.mode]);

  useEffect(() => {
    if (anim !== 'on') return undefined;
    const t = setTimeout(() => setAnim(null), reduced ? MOTION.reducedFade : MOTION.powerOn);
    return () => clearTimeout(t);
  }, [anim, reduced]);

  // Belt and suspenders on top of the synchronous clears below: if the panel
  // ever leaves an open mode, or narrow mode drops the drag handlers
  // entirely, any drag in progress is gone too.
  useEffect(() => {
    if (!isOpenMode(panel.mode) || narrow) clearDrag();
  }, [panel.mode, narrow, clearDrag]);

  const powerOffThen = useCallback(
    (action) => {
      // Minimizing/closing ends the drag right away rather than waiting on
      // the power-off timer or a pointerup that may never come.
      clearDrag();
      if (!isOpenMode(panel.mode)) return action();
      setAnim('off');
      setTimeout(() => {
        setAnim(null);
        action();
        document.querySelector('[data-control-room-button]')?.focus?.({ preventScroll: true });
      }, reduced ? MOTION.reducedFade : MOTION.powerOff);
      return undefined;
    },
    [panel.mode, reduced, clearDrag]
  );
  const minimize = useCallback(() => powerOffThen(panelActions.minimize), [powerOffThen, panelActions]);
  const close = useCallback(() => powerOffThen(panelActions.close), [powerOffThen, panelActions]);

  const switchTab = useCallback(
    (tab) => {
      if (tab === panel.tab) return;
      if (reduced) {
        panelActions.setTab(tab);
        return;
      }
      setFlipping(true);
      setTimeout(() => panelActions.setTab(tab), MOTION.tabSwap);
      setTimeout(() => setFlipping(false), MOTION.tabFlip);
    },
    [panel.tab, panelActions, reduced]
  );

  // ` toggles, Escape minimizes (unless something inside wants Escape first).
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isBacktick(e)) {
        if (isTypingTarget(e.target) || modalOpen()) return;
        e.preventDefault();
        if (isOpenMode(panel.mode)) minimize();
        else panelActions.open();
        return;
      }
      if (e.key === 'Escape' && isOpenMode(panel.mode)) {
        if (cr.ducked || isTypingTarget(e.target) || modalOpen()) return;
        minimize();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel.mode, panelActions, minimize, cr.ducked]);

  // A new pick opens the panel on the Giveaway tab; if that opened it, it goes
  // back to where it was once the giveaway leaves rolling/playing.
  const pick = cr.giveaway && cr.giveaway.status === 'rolling' ? pickKey(cr.giveaway) : null;
  const lastPick = useRef(pick);
  const autoFrom = useRef(null);
  useEffect(() => {
    if (pick && pick !== lastPick.current) {
      if (!isOpenMode(panel.mode)) {
        if (autoFrom.current == null) autoFrom.current = panel.mode;
        panelActions.open();
      }
      panelActions.setTab('giveaway');
    }
    lastPick.current = pick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  const settled = !cr.giveaway || cr.giveaway.status === 'open' || cr.giveaway.status === 'closed';
  useEffect(() => {
    if (!settled || autoFrom.current == null) return;
    const to = autoFrom.current;
    autoFrom.current = null;
    // Auto-restore bypasses the power-off animation, so clear any drag here too.
    clearDrag();
    if (to === 'closed') panelActions.close();
    else panelActions.minimize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // Docked: the page reflows into the remaining width.
  useEffect(() => {
    const root = document.documentElement;
    if (docked) {
      root.style.setProperty('--control-dock-w', `${DOCK_W}px`);
      document.body.classList.add('control-docked');
    } else {
      root.style.removeProperty('--control-dock-w');
      document.body.classList.remove('control-docked');
    }
  }, [docked]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--control-dock-w');
      document.body.classList.remove('control-docked');
    },
    []
  );

  const toggleDock = () => {
    flipRectRef.current = rootRef.current?.getBoundingClientRect() || null;
    if (panel.mode === 'dock') panelActions.undock();
    else panelActions.dock();
  };

  const dragHandlers = narrow
    ? {}
    : {
        onPointerDown: (e) => {
          if (e.button !== 0 || e.target.closest('button, a, input, select, textarea, [role="menu"]')) return;
          const el = rootRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          dragRef.current = {
            offX: e.clientX - r.left,
            offY: e.clientY - r.top,
            startX: e.clientX,
            fromDock: panel.mode === 'dock',
            size: { w: r.width || PANEL_W, h: r.height || FALLBACK_SIZE.h },
            // The rect at pointerdown, kept so a drop into the dock zone can
            // restore the float position it actually started from rather
            // than the drop point (which is only ~48px from the edge).
            startRect: { x: r.left, y: r.top },
          };
          if (panel.mode !== 'dock') {
            setDragRect({ x: r.left, y: r.top });
            setDragging(true);
          }
        },
        onPointerMove: (e) => {
          const d = dragRef.current;
          if (!d) return;
          if (d.fromDock) {
            if (!shouldUndock(d.startX, e.clientX)) return;
            d.fromDock = false;
            d.size = { w: PANEL_W, h: d.size.h };
            d.offX = Math.min(d.offX, PANEL_W - 24);
            const next = clampRect({ x: e.clientX - d.offX, y: e.clientY - d.offY }, d.size, view);
            setDragRect(next);
            setDragging(true);
            panelActions.undock(next);
            return;
          }
          setDragRect(clampRect({ x: e.clientX - d.offX, y: e.clientY - d.offY }, d.size, view));
          setGhost(inDockZone(e.clientX, view.vw));
        },
        onPointerUp: (e) => {
          const d = dragRef.current;
          clearDrag();
          if (!d || d.fromDock) return;
          const at = clampRect({ x: e.clientX - d.offX, y: e.clientY - d.offY }, d.size, view);
          if (inDockZone(e.clientX, view.vw)) {
            flipRectRef.current = rootRef.current?.getBoundingClientRect() || null;
            const floatRect = clampRect(d.startRect, d.size, view);
            panelActions.moveTo(floatRect, nearestCorner(floatRect, d.size, view));
            panelActions.dock();
          } else {
            const snapped = snapToCorner(at, d.size, view);
            panelActions.moveTo(snapped.rect, snapped.corner || nearestCorner(snapped.rect, d.size, view));
          }
        },
        onLostPointerCapture: clearDrag,
      };
  if (dragHandlers.onPointerUp) dragHandlers.onPointerCancel = dragHandlers.onPointerUp;

  const live = (
    <p className="sr-only" aria-live="polite">
      {statusMessage(cr.giveaway)}
    </p>
  );

  if (panel.mode === 'closed') return live;
  if (panel.mode === 'pill') {
    return (
      <>
        {live}
        <Pill
          giveaway={cr.giveaway}
          round={cr.activeRound}
          warnings={cr.warnings}
          dataLost={cr.dataLost}
          redeem={cr.redeem}
          anchor={narrow ? { left: 16, bottom: 16 } : pillAnchor(panel.corner, panel.restoreTo)}
          onOpen={panelActions.open}
        />
      </>
    );
  }

  const rect = dragRect || clampRect(panel.rect || defaultRect(view.vw), FALLBACK_SIZE, view);
  let style;
  if (narrow) style = { left: 0, right: 0, bottom: 0, maxHeight: '75vh' };
  else if (docked) style = { top: NAV_H, right: 0, bottom: 0, width: DOCK_W };
  else style = { left: rect.x, top: rect.y, width: PANEL_W, maxHeight: '70vh' };
  style.transformOrigin = originFor(panel.corner, panel.restoreTo);

  const classes = [
    'cr-panel fixed z-[65] flex flex-col',
    narrow ? 'is-sheet' : docked ? 'is-docked' : '',
    anim === 'on' ? 'cr-power-on' : '',
    anim === 'off' ? 'cr-power-off' : '',
    dragging ? 'cr-lifted' : '',
    cr.ducked ? 'cr-ducked' : '',
  ].join(' ');

  return (
    <>
      {live}
      {ghost && (
        <div
          className="cr-dock-ghost fixed z-[64]"
          style={{ top: NAV_H, right: 0, bottom: 0, width: DOCK_W }}
          aria-hidden="true"
        />
      )}
      <section
        ref={rootRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cr-title"
        className={classes}
        style={style}
      >
        <PanelChrome
          tallies={tallies({ isLive, giveaway: cr.giveaway, activeRound: cr.activeRound, redeem: cr.redeem })}
          dataLost={cr.dataLost}
          leds={tabLeds({ giveaway: cr.giveaway, activeRound: cr.activeRound, redeem: cr.redeem })}
          tab={panel.tab}
          onTab={switchTab}
          stage={cr.prefs.stage}
          onStage={cr.setStage}
          hideLiveBadge={cr.prefs.hideLiveBadge}
          onHideLiveBadge={cr.setHideLiveBadge}
          docked={docked}
          narrow={narrow}
          onDock={toggleDock}
          onMinimize={minimize}
          onClose={close}
          onResetPosition={panelActions.resetPosition}
          dragHandlers={dragHandlers}
        />
        <div
          id="cr-body"
          role="tabpanel"
          aria-labelledby={`cr-tab-${panel.tab}`}
          className={`cr-body ${flipping ? 'cr-flip' : ''}`}
        >
          <WarningStrip warnings={cr.warnings} onDismiss={cr.dismissWarning} className="mb-3" />
          {cr.dataLost && (
            <p className="mb-3 text-xs text-red-destructive font-mono">
              {cr.dataGaveUp ? 'Live data lost. Reload to reconnect.' : 'Live data lost. Reconnecting…'}
            </p>
          )}
          {panel.tab === 'predict' ? (
            <PredictTab />
          ) : panel.tab === 'redeem' ? (
            <RedeemTab />
          ) : (
            <GiveawayTab scopeRef={rootRef} />
          )}
          <div className="cr-static" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
