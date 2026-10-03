import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The latest prediction round (a settled one lingers until the next opens).
// `round` is undefined until the first snapshot lands, then the round or null,
// so the tab can tell "still tuning" from "off air"; `error` flags a failed
// read, which the tab shows as "no signal" rather than an idle channel.
export default function usePredictionRound() {
  const [state, setState] = useState({ round: undefined, error: false });
  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setState({ round: snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }, error: false }),
      () => setState({ round: null, error: true })
    );
  }, []);
  return state;
}
