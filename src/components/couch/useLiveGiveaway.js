import { useEffect, useState } from 'react';
import { collection, limit as fLimit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The newest giveaway that is still running: the same query (and index) the
// /giveaway page uses. One document.
export default function useLiveGiveaway() {
  const [giveaway, setGiveaway] = useState(null);
  useEffect(() => {
    const q = query(
      collection(db, 'giveaways'),
      where('status', 'in', ['open', 'closed', 'rolling', 'playing']),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    return onSnapshot(
      q,
      (snap) => setGiveaway(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setGiveaway(null)
    );
  }, []);
  return giveaway;
}
