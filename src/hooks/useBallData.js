import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [past, setPast] = useState({ rounds: [], loading: true, more: false, error: false });
  // Only the latest request may apply; a Load more can't run on top of another.
  const seq = useRef(0);
  const busy = useRef(false);
  const cursor = useRef(null);

  const loadPast = useCallback(async (after = null) => {
    const mine = ++seq.current;
    busy.current = true;
    setPast((p) => ({ ...p, loading: true, error: false }));
    try {
      const constraints = [where('status', '==', 'settled'), orderBy('settledAt', 'desc')];
      if (after) constraints.push(startAfter(after));
      constraints.push(fLimit(PAGE));
      const snap = await getDocs(query(collection(db, 'ball_rounds'), ...constraints));
      if (mine !== seq.current) return;
      busy.current = false;
      const rounds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cursor.current = snap.docs.length ? snap.docs[snap.docs.length - 1] : after;
      setPast((p) => ({
        rounds: after ? [...p.rounds, ...rounds] : rounds,
        loading: false,
        more: snap.docs.length === PAGE,
        error: false,
      }));
    } catch {
      if (mine !== seq.current) return;
      busy.current = false;
      setPast((p) => ({ ...p, loading: false, error: true }));
    }
  }, []);

  // Page one once the round is known, then again only when a new round
  // settles (it moves into the archive).
  const roundKnown = round !== undefined;
  const settledId = round && round.status === 'settled' ? round.id : null;
  const seenSettled = useRef(false);
  useEffect(() => {
    if (!roundKnown) return;
    if (seenSettled.current === false) {
      seenSettled.current = settledId;
      loadPast(null);
    } else if (settledId && settledId !== seenSettled.current) {
      seenSettled.current = settledId;
      loadPast(null);
    }
  }, [roundKnown, settledId, loadPast]);

  useEffect(() => () => {
    seq.current += 1;
  }, []);

  const loadMore = useCallback(() => {
    if (busy.current || !cursor.current) return;
    loadPast(cursor.current);
  }, [loadPast]);

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
    loadMore,
  };
}
