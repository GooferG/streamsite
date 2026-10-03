import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The viewer's own entry (hunts/{roundId}/entries/{twitchId}). Its owner can
// always read it, sealed round or not. undefined while the first snapshot is
// in flight, so the slip never tells someone who guessed that they didn't;
// null when there is no entry (or no viewer).
export default function useMyEntry(roundId, twitchId) {
  const active = !!roundId && !!twitchId;
  const [state, setState] = useState({ key: null, entry: null });
  const key = active ? `${roundId}/${twitchId}` : null;

  useEffect(() => {
    if (!active) return undefined;
    return onSnapshot(
      doc(db, 'hunts', roundId, 'entries', twitchId),
      (snap) => setState({ key: `${roundId}/${twitchId}`, entry: snap.exists() ? { id: snap.id, ...snap.data() } : null }),
      () => setState({ key: `${roundId}/${twitchId}`, entry: null })
    );
  }, [active, roundId, twitchId]);

  if (!active) return null;
  return state.key === key ? state.entry : undefined;
}
