import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

// The newest Goofer Ball round (a settled one lingers until the next opens).
// `round` is undefined until the first snapshot, then the round or null.
export default function useBallRound({ enabled = true } = {}) {
  const [state, setState] = useState({ round: undefined, error: false });
  useEffect(() => {
    if (!enabled) return undefined;
    const q = query(collection(db, 'ball_rounds'), orderBy('openedAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setState({ round: snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }, error: false }),
      () => setState({ round: null, error: true })
    );
  }, [enabled]);
  return state;
}
