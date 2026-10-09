import { useEffect, useState } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Balls in an open drum, counted once per round (an aggregation read per
// 1,000 balls) for the Gamba hub row, which doesn't need it live.
export default function useBallDrumCount(roundId) {
  const [state, setState] = useState({ roundId: null, count: null });
  useEffect(() => {
    if (!roundId) return undefined;
    let cancelled = false;
    getCountFromServer(query(collection(db, 'ball_rounds', roundId, 'balls'), where('status', '==', 'drum')))
      .then((snap) => {
        if (!cancelled) setState({ roundId, count: snap.data().count });
      })
      .catch(() => {
        if (!cancelled) setState({ roundId, count: null });
      });
    return () => {
      cancelled = true;
    };
  }, [roundId]);
  return state.roundId === roundId ? state.count : null;
}
