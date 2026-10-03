import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The latest prediction round (a settled one lingers until the next opens).
// undefined until the first snapshot lands, then the round or null, so the
// tab can tell "still tuning" from "off air".
export default function usePredictionRound() {
  const [round, setRound] = useState(undefined);
  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setRound(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setRound(null)
    );
  }, []);
  return round;
}
