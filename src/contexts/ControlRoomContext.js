import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, orderBy, query, where, limit as fLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { useDriverLock } from '../hooks/useDriverLock';
import useGiveawayClock from '../components/admin/giveaways/useGiveawayClock';
import useWinnerAnnounce from '../components/admin/giveaways/useWinnerAnnounce';
import useResultsAnnounce from '../components/admin/predictions/useResultsAnnounce';
import { useWarnings } from '../components/controlRoom/useWarnings';
import { useLiveQuery } from '../components/controlRoom/useLiveQuery';
import { isOpenMode, readStore, writeStore } from '../components/controlRoom/storage';
import {
  FILTERS as REDEEM_FILTERS,
  QUEUE_CAP,
  newestAt,
  unseenCount,
} from '../components/controlRoom/redemptions';
import {
  LIVE_GIVEAWAY_STATUSES,
  activeRoundOf,
  controlRoomAllowed,
  currentPickOf,
  shownGiveaway,
} from '../components/controlRoom/selectors';

const ControlRoomContext = createContext(null);

// null outside a provider (tests, or code above it). Treat null like
// `enabled: false`.
export function useControlRoom() {
  return useContext(ControlRoomContext);
}

const giveawaysQuery = () =>
  query(
    collection(db, 'giveaways'),
    where('status', 'in', LIVE_GIVEAWAY_STATUSES),
    orderBy('createdAt', 'desc'),
    fLimit(5)
  );
const roundsQuery = () => query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(3));
const redemptionsQuery = () =>
  query(
    collection(db, 'redemptions'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    fLimit(QUEUE_CAP)
  );

// Live giveaway, prediction and redemption state and the timer engine for staff, on every
// route (so /admin and the floating panel share one engine), plus the panel's
// per-browser state. Timers only fire in the tab that holds the driver lock.
export function ControlRoomProvider({ children }) {
  const { isStaff } = useAuth();
  const { pathname } = useLocation();
  const enabled = !!isStaff && controlRoomAllowed(pathname);

  const giveawaysFeed = useLiveQuery(giveawaysQuery, enabled);
  const roundsFeed = useLiveQuery(roundsQuery, enabled);
  const redemptionsFeed = useLiveQuery(redemptionsQuery, enabled);
  const giveaways = giveawaysFeed.docs;
  const rounds = roundsFeed.docs;
  const redemptions = redemptionsFeed.docs;

  const { isDriver } = useDriverLock(enabled);
  const armed = enabled && isDriver;
  const { warnings, pushWarning, dismissWarning } = useWarnings();
  const warnSticky = useCallback((message) => pushWarning(message, { sticky: true }), [pushWarning]);

  useGiveawayClock(giveaways, warnSticky, { armed });
  const currentPick = useMemo(() => currentPickOf(giveaways), [giveaways]);
  const announce = useWinnerAnnounce(currentPick, { armed });
  const latestRound = rounds[0] || null;
  const results = useResultsAnnounce(latestRound, { armed });

  const [store, setStore] = useState(readStore);
  // Staff only: viewers never get a localStorage key.
  useEffect(() => {
    if (enabled) writeStore(store);
  }, [enabled, store]);
  const [ducked, setDucked] = useState(false);

  // The first good snapshot on a browser that has never tracked redemptions
  // counts everything already waiting as seen, so a backlog never pulses.
  const redeemReady = enabled && redemptionsFeed.ready;
  useEffect(() => {
    if (!redeemReady) return;
    setStore((s) =>
      s.redeemSeenAt != null ? s : { ...s, redeemSeenAt: newestAt(redemptions) ?? Date.now() }
    );
  }, [redeemReady, redemptions]);

  const panelActions = useMemo(() => {
    const remember = (s) => (isOpenMode(s.mode) ? s.mode : s.restoreTo);
    return {
      open: () => setStore((s) => ({ ...s, mode: s.restoreTo })),
      toggle: () =>
        setStore((s) =>
          isOpenMode(s.mode) ? { ...s, mode: 'pill', restoreTo: s.mode } : { ...s, mode: s.restoreTo }
        ),
      minimize: () => setStore((s) => ({ ...s, mode: 'pill', restoreTo: remember(s) })),
      close: () => setStore((s) => ({ ...s, mode: 'closed', restoreTo: remember(s) })),
      dock: () => setStore((s) => ({ ...s, mode: 'dock', restoreTo: 'dock' })),
      undock: (rect) => setStore((s) => ({ ...s, mode: 'float', restoreTo: 'float', rect: rect || s.rect })),
      moveTo: (rect, corner) => setStore((s) => ({ ...s, rect, corner: corner || s.corner })),
      setTab: (tab) => setStore((s) => ({ ...s, tab })),
      resizeTo: (rect, size) => setStore((s) => ({ ...s, rect, size })),
      setDockW: (dockW) => setStore((s) => ({ ...s, dockW })),
      resetPosition: () =>
        setStore((s) => ({
          ...s,
          mode: 'float',
          restoreTo: 'float',
          rect: null,
          corner: 'tr',
          size: null,
          dockW: null,
        })),
    };
  }, []);
  const setStage = useCallback((on) => setStore((s) => ({ ...s, stage: !!on })), []);
  const setHideLiveBadge = useCallback((on) => setStore((s) => ({ ...s, hideLiveBadge: !!on })), []);

  // The Redeem tab calls this while it's on screen. The mark only moves forward.
  const markRedeemSeen = useCallback(
    (ms) =>
      setStore((s) =>
        Number.isFinite(ms) && (s.redeemSeenAt == null || ms > s.redeemSeenAt) ? { ...s, redeemSeenAt: ms } : s
      ),
    []
  );
  const setRedeemFilter = useCallback(
    (filter) => setStore((s) => (REDEEM_FILTERS.includes(filter) ? { ...s, redeemFilter: filter } : s)),
    []
  );

  const value = {
    enabled,
    giveaways,
    giveaway: shownGiveaway(giveaways),
    rounds,
    activeRound: activeRoundOf(rounds),
    latestRound,
    dataLost: giveawaysFeed.error || roundsFeed.error || redemptionsFeed.error,
    dataGaveUp: giveawaysFeed.gaveUp || roundsFeed.gaveUp || redemptionsFeed.gaveUp,
    redemptions,
    redeem: {
      pending: redemptions.length,
      unseen: unseenCount(redemptions, store.redeemSeenAt),
      capped: redemptions.length >= QUEUE_CAP,
    },
    markRedeemSeen,
    setRedeemFilter,
    isDriver: armed,
    announce,
    results,
    warnings,
    pushWarning,
    dismissWarning,
    panel: {
      mode: store.mode,
      restoreTo: store.restoreTo,
      rect: store.rect,
      corner: store.corner,
      tab: store.tab,
      size: store.size,
      dockW: store.dockW,
    },
    panelActions,
    prefs: { stage: store.stage, hideLiveBadge: store.hideLiveBadge, redeemFilter: store.redeemFilter },
    setStage,
    setHideLiveBadge,
    ducked,
    setDucked,
  };

  return <ControlRoomContext.Provider value={value}>{children}</ControlRoomContext.Provider>;
}
