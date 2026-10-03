import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { entriesSealed } from '../../utils/predictionRound';

// The Hunts tab's one entries listener (the lineup and the meter share it).
// While a round is open, firestore.rules hide entries from viewers, so a
// viewer never queries them; a denied read (round re-opened before this
// listener caught up) also counts as sealed. `loading` is true from the moment
// entries become readable until the first snapshot lands, so the tab can keep
// them face down instead of flashing "no guesses".
export default function useRoundEntries(round) {
  const { isStaff } = useAuth();
  const sealed = entriesSealed(round, isStaff);
  const id = round && round.id;
  const enabled = !!id && !!(round && round.acceptPredictions) && !sealed;
  const [state, setState] = useState({ key: null, entries: [], denied: false });
  const key = enabled ? id : null;

  useEffect(() => {
    setState({ key: null, entries: [], denied: false });
    if (!enabled) return undefined;
    const q = query(collection(db, 'hunts', id, 'entries'), orderBy('submittedAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => setState({ key: id, entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })), denied: false }),
      () => setState({ key: id, entries: [], denied: true })
    );
  }, [id, enabled]);

  const loaded = state.key === key;
  return {
    entries: loaded ? state.entries : [],
    sealed: sealed || (loaded && state.denied),
    loading: enabled && !loaded,
  };
}
