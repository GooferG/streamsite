import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const IDLE = { roundId: null, balls: [], ready: false, error: false };

// Every ball in one round's drum (and on its rack). Re-subscribes when the
// round changes; nothing listens while disabled (Spark read budget).
export default function useBallsFeed(roundId, { enabled = true } = {}) {
  const [state, setState] = useState(IDLE);
  useEffect(() => {
    if (!enabled || !roundId) {
      setState(IDLE);
      return undefined;
    }
    setState({ ...IDLE, roundId });
    return onSnapshot(
      collection(db, 'ball_rounds', roundId, 'balls'),
      (snap) => setState({ roundId, balls: snap.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true, error: false }),
      () => setState((s) => ({ ...s, error: true }))
    );
  }, [roundId, enabled]);
  const { balls, ready, error } = state.roundId === roundId && enabled ? state : IDLE;
  return { balls, ready, error };
}
