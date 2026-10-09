import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit as fLimit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import useBallRound from './useBallRound';
import useBallsFeed from './useBallsFeed';
import useBallHunt from './useBallHunt';
import usePageVisible from './usePageVisible';
import { isActive } from '../utils/ball';

const PAGE = 20;

// Everything CH 42 reads (spec: Site page): the newest round, its balls while
// a drum is active and the tab is visible, the linked hunt's 60s poll, and
// settled rounds a page at a time. The archive reads round docs only.
export default function useBallData() {
  const visible = usePageVisible();
  const { round, error } = useBallRound();
  const active = isActive(round);
  const { balls, ready } = useBallsFeed(round ? round.id : null, { enabled: active && visible });
  const { hunt, stale } = useBallHunt(round ? round.huntId : null, { enabled: active });
  const auth = useTwitchAuth();
  const me = (auth && auth.twitchUser && auth.twitchUser.twitchId) || null;
  const [past, setPast] = useState({ rounds: [], loading: true, more: false, cursor: null, error: false });

  const loadPast = useCallback(async (cursor = null) => {
    setPast((p) => ({ ...p, loading: true }));
    try {
      const constraints = [where('status', '==', 'settled'), orderBy('settledAt', 'desc')];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(fLimit(PAGE));
      const snap = await getDocs(query(collection(db, 'ball_rounds'), ...constraints));
      const rounds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPast((p) => ({
        rounds: cursor ? [...p.rounds, ...rounds] : rounds,
        loading: false,
        more: snap.docs.length === PAGE,
        cursor: snap.docs[snap.docs.length - 1] || p.cursor,
        error: false,
      }));
    } catch {
      setPast((p) => ({ ...p, loading: false, error: true }));
    }
  }, []);

  // A settle moves the newest round into the archive: reload page one.
  const settledId = round && round.status === 'settled' ? round.id : null;
  useEffect(() => {
    loadPast(null);
  }, [loadPast, settledId]);

  return {
    round,
    roundError: error,
    balls,
    ballsReady: ready,
    hunt,
    stale,
    me,
    past: past.rounds,
    pastLoading: past.loading,
    pastError: past.error,
    hasMore: past.more,
    loadMore: () => loadPast(past.cursor),
  };
}
