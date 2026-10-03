import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The viewer's own entry (hunts/{roundId}/entries/{twitchId}). Its owner can
// always read it, sealed round or not.
export default function useMyEntry(roundId, twitchId) {
  const [entry, setEntry] = useState(null);
  useEffect(() => {
    setEntry(null);
    if (!roundId || !twitchId) return undefined;
    return onSnapshot(
      doc(db, 'hunts', roundId, 'entries', twitchId),
      (snap) => setEntry(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setEntry(null)
    );
  }, [roundId, twitchId]);
  return entry;
}
