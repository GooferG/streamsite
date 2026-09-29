import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The 5 newest entrants of one giveaway, only while the panel shows it open.
export function useRecentEntrants(giveawayId, enabled) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    setEntries([]);
    if (!enabled || !giveawayId) return undefined;
    const q = query(collection(db, 'giveaways', giveawayId, 'entries'), orderBy('enteredAt', 'desc'), fLimit(5));
    return onSnapshot(
      q,
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setEntries([])
    );
  }, [giveawayId, enabled]);
  return entries;
}

// The newest giveaway of any status, to seed "New giveaway" and "Run last
// again" from the idle view.
export function useLatestGiveaway(enabled) {
  const [latest, setLatest] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const q = query(collection(db, 'giveaways'), orderBy('createdAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setLatest(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setLatest(null)
    );
  }, [enabled]);
  return latest;
}
